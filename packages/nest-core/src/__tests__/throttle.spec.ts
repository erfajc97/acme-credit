import { Controller, Get, Module } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Public } from '../auth/access.decorators';
import { createApp, globalProviders } from '../bootstrap';
import { loggerParams } from '../observability/logger';

@Controller('limited')
class LimitedController {
  @Get()
  @Public()
  hit() {
    return {};
  }
}

@Module({
  imports: [
    LoggerModule.forRoot(loggerParams({ NODE_ENV: 'test', LOG_LEVEL: 'info' })),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }]),
  ],
  controllers: [LimitedController],
  providers: globalProviders(),
})
class LimitedModule {}

let app: NestExpressApplication;

beforeAll(async () => {
  app = await createApp(LimitedModule, { CORS_ORIGINS: [] }, { logger: false });
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('global rate limit (A12)', () => {
  it('answers 429 with the rate-limited code after the limit (last passing, first failing)', async () => {
    const server = app.getHttpServer();
    expect((await request(server).get('/limited')).status).toBe(200);
    expect((await request(server).get('/limited')).status).toBe(200);
    const blocked = await request(server).get('/limited');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ code: 'common.rate_limited' });
  });
});
