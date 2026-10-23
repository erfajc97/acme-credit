import type { Session, User } from '@acme/contracts';
import {
  CREDENTIALS_THROTTLE,
  CurrentPrincipal,
  type Principal,
  Public,
  Roles,
  SESSION_THROTTLE,
  SIGNUP_THROTTLE,
} from '@acme/nest-core';
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Env } from '../../core/config/env';
import { ENV } from '../../core/config/env.provider';
import { EmptyBodyDto } from '../../core/http/dto';
import { AuthService, type IssuedSession } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import {
  REFRESH_COOKIE,
  refreshCookieOptions,
  type RefreshCookieOptions,
} from './helpers/refresh-cookie';

/** Sign-in and sign-up are brute-force targets: far below the global limit (A12). */

/** The parts of Express's request and response this controller uses (cookie-parser adds cookies). */
interface Request {
  cookies?: unknown;
}
interface Response {
  cookie(name: string, value: string, options: RefreshCookieOptions): unknown;
  clearCookie(name: string, options: RefreshCookieOptions): unknown;
}

function refreshCookieOf(request: Request): string | undefined {
  const cookies = request.cookies as Record<string, unknown> | undefined;
  const value = cookies?.[REFRESH_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Simulated IdP. Public routes by necessity: they are how a caller gets credentials. The
 * refresh token lives only in an httpOnly cookie scoped to /v1/auth (SameSite from
 * COOKIE_SAME_SITE: Strict by default).
 */
@Controller('v1/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('register')
  @Public()
  @HttpCode(201)
  @Throttle(SIGNUP_THROTTLE)
  async register(
    @Body() body: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Session> {
    return this.withCookie(response, await this.auth.register(body));
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  @Throttle(CREDENTIALS_THROTTLE)
  async login(
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Session> {
    return this.withCookie(response, await this.auth.login(body));
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  @Throttle(SESSION_THROTTLE)
  async refresh(
    @Req() request: Request,
    @Body() _body: EmptyBodyDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<Session> {
    return this.withCookie(response, await this.auth.refresh(refreshCookieOf(request)));
  }

  /** Public: an expired access token must still be able to end its session. */
  @Post('logout')
  @Public()
  @HttpCode(204)
  @Throttle(SESSION_THROTTLE)
  async logout(
    @Req() request: Request,
    @Body() _body: EmptyBodyDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(refreshCookieOf(request));
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  private cookieOptions(): RefreshCookieOptions {
    return refreshCookieOptions(this.env);
  }

  private withCookie(response: Response, issued: IssuedSession): Session {
    response.cookie(REFRESH_COOKIE, issued.refreshToken, {
      ...this.cookieOptions(),
      maxAge: this.env.REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
    return issued.session;
  }
}

@Controller('v1/me')
@Roles('customer', 'admin')
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  me(@CurrentPrincipal() principal: Principal): Promise<User> {
    return this.auth.me(principal.id);
  }
}
