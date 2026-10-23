import { Controller, Get, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SkipThrottle, Throttle, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Public, Roles } from '../auth/access.decorators';
import { ACCESS_AUTHENTICATOR, type AccessAuthenticator } from '../auth/access.guard';
import { createApp, globalProviders } from '../bootstrap';
import {
  CREDENTIALS_THROTTLE,
  DEFAULT_THROTTLE,
  MONEY_THROTTLE,
  SESSION_THROTTLE,
  SIGNUP_THROTTLE,
  SKIP_ALL_THROTTLES,
} from '../http/throttle';
import { loggerParams } from '../observability/logger';

/** The customer id comes from a header (the real authenticator verifies a JWT). */
const headerAuthenticator: AccessAuthenticator = {
  authenticate: (req) => {
    const id = req.headers['x-test-user'];
    return Promise.resolve(typeof id === 'string' ? { id, role: 'customer' } : null);
  },
};

@Controller('quota')
class QuotaController {
  @Get('anonymous')
  @Public()
  anonymous() {
    return {};
  }

  @Get('mine')
  @Roles('customer')
  mine() {
    return {};
  }

  @Get('signed')
  @Public()
  @SkipThrottle(SKIP_ALL_THROTTLES)
  signed() {
    return {};
  }

  @Get('hourly')
  @Public()
  @Throttle({ hourly: { ttl: 3_600_000, limit: 1 } })
  hourly() {
    return {};
  }
}

@Module({
  imports: [
    LoggerModule.forRoot(loggerParams({ NODE_ENV: 'test', LOG_LEVEL: 'info' })),
    // Same three windows as production, with tiny limits so the test can reach them.
    ThrottlerModule.forRoot([
      { name: 'burst', ttl: 1_000, limit: 3 },
      { name: 'default', ttl: 60_000, limit: 2 },
      { name: 'hourly', ttl: 3_600_000, limit: 100 },
    ]),
  ],
  controllers: [QuotaController],
  providers: [
    ...globalProviders(),
    { provide: ACCESS_AUTHENTICATOR, useValue: headerAuthenticator },
  ],
})
class QuotaModule {}

let app: NestExpressApplication;

beforeAll(async () => {
  app = await createApp(QuotaModule, { CORS_ORIGINS: [] }, { logger: false });
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('rate limits per client (EDoS / DDoS, A12)', () => {
  it('counts a signed-in customer on their own budget, not on a shared office IP', async () => {
    const server = app.getHttpServer();
    const as = (user: string) => request(server).get('/quota/mine').set('x-test-user', user);
    expect((await as('reviewer-a')).status).toBe(200);
    expect((await as('reviewer-a')).status).toBe(200);
    expect((await as('reviewer-a')).status).toBe(429);
    // Same IP, another reviewer: still served.
    expect((await as('reviewer-b')).status).toBe(200);
  });

  it('counts anonymous callers by IP', async () => {
    const server = app.getHttpServer();
    expect((await request(server).get('/quota/anonymous')).status).toBe(200);
    expect((await request(server).get('/quota/anonymous')).status).toBe(200);
    const blocked = await request(server).get('/quota/anonymous');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ code: 'common.rate_limited' });
  });

  it('lets signed server-to-server routes skip every window, burst included', async () => {
    const server = app.getHttpServer();
    const statuses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(server)
          .get('/quota/signed')
          .then((r) => r.status),
      ),
    );
    expect(statuses).toEqual([200, 200, 200, 200, 200]);
  });

  it('applies a route hourly cap on top of the per-minute one', async () => {
    const server = app.getHttpServer();
    expect((await request(server).get('/quota/hourly')).status).toBe(200);
    expect((await request(server).get('/quota/hourly')).status).toBe(429);
  });
});

describe('production budgets', () => {
  it('lets a person browse (300/min, bursts of 50/s) and caps a flood per hour', () => {
    expect(DEFAULT_THROTTLE).toEqual([
      { name: 'burst', ttl: 1_000, limit: 50 },
      { name: 'default', ttl: 60_000, limit: 300 },
      { name: 'hourly', ttl: 3_600_000, limit: 6_000 },
    ]);
  });

  it('keeps the costly doors tight: sign-in, sign-up, sessions and money', () => {
    expect(CREDENTIALS_THROTTLE).toEqual({
      default: { ttl: 60_000, limit: 10 },
      hourly: { ttl: 3_600_000, limit: 120 },
    });
    expect(SIGNUP_THROTTLE).toEqual({
      default: { ttl: 60_000, limit: 5 },
      hourly: { ttl: 3_600_000, limit: 60 },
    });
    expect(SESSION_THROTTLE).toEqual({ default: { ttl: 60_000, limit: 30 } });
    expect(MONEY_THROTTLE).toEqual({
      default: { ttl: 60_000, limit: 10 },
      hourly: { ttl: 3_600_000, limit: 60 },
    });
  });
});
