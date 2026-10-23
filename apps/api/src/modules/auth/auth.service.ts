import type { LoginRequest, RegisterRequest, Session, User } from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Prisma } from '../../generated/prisma/client';
import { AccessTokens } from '../../core/auth/access-tokens';
import { PasswordHasher } from '../../core/auth/password-hasher';
import type { Env } from '../../core/config/env';
import { ENV } from '../../core/config/env.provider';
import { isUniqueViolation } from '../../core/database/db-errors';
import { PrismaService } from '../../core/database/prisma.service';

const REFRESH_TOKEN_BYTES = 32;

export const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;

/** A session for the client plus the refresh token, which only ever travels in a cookie. */
export interface IssuedSession {
  session: Session;
  refreshToken: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toUser(row: UserRow): User {
  return { id: row.id, email: row.email, fullName: row.fullName, role: row.role };
}

/**
 * Simulated identity provider (plan §4.7): Argon2id passwords, 15-minute access tokens and
 * rotating refresh tokens. Reusing a refresh token that was already rotated means it leaked:
 * the whole family is revoked.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hasher: PasswordHasher,
    private readonly tokens: AccessTokens,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async register(input: RegisterRequest): Promise<IssuedSession> {
    const passwordHash = await this.hasher.hash(input.password);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash,
          fullName: input.fullName,
          role: 'customer',
        },
        select: userSelect,
      });
      return this.startSession(user, randomUUID());
    } catch (error) {
      if (isUniqueViolation(error)) throw new AppHttpException('auth.email_taken');
      throw error;
    }
  }

  /** Same answer for a wrong email, a wrong password and the wrong app (no enumeration). */
  async login(input: LoginRequest): Promise<IssuedSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { ...userSelect, passwordHash: true },
    });
    const valid = await this.hasher.verify(user?.passwordHash ?? null, input.password);
    if (!user || !valid || user.role !== input.audience) {
      throw new AppHttpException('auth.invalid_credentials');
    }
    return this.startSession(user, randomUUID());
  }

  async refresh(refreshToken: string | undefined): Promise<IssuedSession> {
    if (!refreshToken) throw new AppHttpException('auth.session_expired');
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: {
        id: true,
        familyId: true,
        expiresAt: true,
        revokedAt: true,
        user: { select: userSelect },
      },
    });
    if (!stored || stored.expiresAt.getTime() <= Date.now()) {
      throw new AppHttpException('auth.session_expired');
    }
    const rotated = stored.revokedAt
      ? { count: 0 }
      : await this.prisma.refreshToken.updateMany({
          where: { id: stored.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
    if (rotated.count !== 1) {
      await this.revokeFamily(stored.familyId);
      throw new AppHttpException('auth.session_expired');
    }
    return this.startSession(stored.user, stored.familyId);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { familyId: true },
    });
    if (stored) await this.revokeFamily(stored.familyId);
  }

  async me(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    if (!user) throw new AppHttpException('common.unauthenticated');
    return toUser(user);
  }

  private async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async startSession(user: UserRow, familyId: string): Promise<IssuedSession> {
    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        familyId,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.env.REFRESH_TOKEN_TTL_SECONDS * 1000),
      },
      select: { id: true },
    });
    const accessToken = await this.tokens.issue({ id: user.id, role: user.role });
    return {
      session: { accessToken, expiresInSeconds: this.tokens.ttlSeconds, user: toUser(user) },
      refreshToken,
    };
  }
}
