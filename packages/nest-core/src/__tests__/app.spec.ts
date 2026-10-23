import { Body, Controller, Get, Module, Post, Req } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerModule } from '@nestjs/throttler';
import type { Request } from 'express';
import { LoggerModule } from 'nestjs-pino';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CurrentPrincipal, Public, Roles, Signed, type Principal } from '../auth/access.decorators';
import {
  ACCESS_AUTHENTICATOR,
  SIGNING_SECRETS,
  type AccessAuthenticator,
} from '../auth/access.guard';
import { signRequest } from '../signing/signature';
import { findRouteMarkerViolations } from '../auth/route-markers';
import { createApp, globalProviders } from '../bootstrap';
import { loggerParams } from '../observability/logger';

const NETWORK_SECRET = 'network-secret-for-tests';

/** Test authenticator: the role comes from a header (the real one verifies a JWT). */
const headerAuthenticator: AccessAuthenticator = {
  authenticate: (req) => {
    const role = req.headers['x-test-role'];
    return Promise.resolve(typeof role === 'string' ? { id: 'user-1', role } : null);
  },
};

class AmountDto extends createZodDto(z.object({ amount: z.string().max(12) }).strict()) {}

@Controller('fixture')
class FixtureController {
  @Get('open')
  @Public()
  open() {
    return { ok: true };
  }

  @Post('echo')
  @Public()
  echo(@Req() req: Request & { rawBody?: Buffer }, @Body() body: unknown) {
    return { raw: req.rawBody?.toString('utf8') ?? null, body };
  }

  @Post('dto')
  @Public()
  dto(@Body() body: AmountDto) {
    return body;
  }

  @Post('signed')
  @Signed('network')
  signed(@Body() body: unknown) {
    return { body };
  }

  @Get('ip')
  @Public()
  ip(@Req() req: Request) {
    return { ip: req.ip };
  }

  @Get('me')
  @Roles('customer')
  me(@CurrentPrincipal() principal: Principal) {
    return principal;
  }

  @Get('closed')
  closed() {
    return { leaked: true };
  }
}

@Public()
@Controller('double')
class DoubleMarkedController {
  @Get()
  @Public()
  twice() {
    return {};
  }
}

@Module({
  imports: [
    LoggerModule.forRoot(loggerParams({ NODE_ENV: 'test', LOG_LEVEL: 'info' })),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 1_000 }]),
  ],
  controllers: [FixtureController, DoubleMarkedController],
  providers: [
    ...globalProviders(),
    { provide: SIGNING_SECRETS, useValue: { network: NETWORK_SECRET } },
    { provide: ACCESS_AUTHENTICATOR, useValue: headerAuthenticator },
  ],
})
class FixtureModule {}

let app: NestExpressApplication;
const ALLOWED = 'http://allowed.test';

beforeAll(async () => {
  app = await createApp(FixtureModule, { CORS_ORIGINS: [ALLOWED] }, { logger: false });
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('client IP behind a proxy (rate limits per client, A12)', () => {
  const FORWARDED = '203.0.113.7';

  it('ignores X-Forwarded-For by default, so a client cannot pick its own rate-limit bucket', async () => {
    const res = await request(app.getHttpServer())
      .get('/fixture/ip')
      .set('X-Forwarded-For', FORWARDED);
    expect(res.body.ip).not.toBe(FORWARDED);
  });

  it('with TRUST_PROXY=1 reads the client from the one proxy in front (Render, an ALB)', async () => {
    const proxied = await createApp(
      FixtureModule,
      { CORS_ORIGINS: [ALLOWED], TRUST_PROXY: 1 },
      { logger: false },
    );
    await proxied.init();
    try {
      const res = await request(proxied.getHttpServer())
        .get('/fixture/ip')
        .set('X-Forwarded-For', `198.51.100.9, ${FORWARDED}`);
      // One trusted hop: the address the proxy appended, never the client-supplied first one.
      expect(res.body.ip).toBe(FORWARDED);
    } finally {
      await proxied.close();
    }
  });
});

describe('default-deny (AN10)', () => {
  it('serves a public route', async () => {
    const res = await request(app.getHttpServer()).get('/fixture/open');
    expect(res.status).toBe(200);
  });

  it('denies an unmarked route with 403 and the forbidden code', async () => {
    const res = await request(app.getHttpServer()).get('/fixture/closed');
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ code: 'common.forbidden' });
    expect(res.body).not.toHaveProperty('leaked');
  });

  it('reports routes with zero or two markers', () => {
    expect(findRouteMarkerViolations(app)).toEqual([
      { route: 'FixtureController.closed', markers: 0 },
      { route: 'DoubleMarkedController.twice', markers: 2 },
    ]);
  });
});

describe('signed routes (P3)', () => {
  const body = '{"amountCents":"100"}';
  const KEY = '5d0c6b8e-1f2a-4b3c-9d4e-7f8a9b0c1d2e';
  const send = (headers: Record<string, string>, raw = body) =>
    request(app.getHttpServer())
      .post('/fixture/signed')
      .set('Content-Type', 'application/json')
      .set(headers)
      .send(raw);
  const now = () => Math.floor(Date.now() / 1000);
  const sign = (raw = body, secret = NETWORK_SECRET, at = now(), idempotencyKey = KEY) => ({
    ...signRequest(
      { secret, method: 'POST', path: '/fixture/signed', idempotencyKey, rawBody: raw },
      at,
    ),
    'Idempotency-Key': idempotencyKey,
  });

  it('accepts a request signed over the exact raw body and its idempotency key', async () => {
    const res = await send(sign());
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ body: { amountCents: '100' } });
  });

  it('rejects a forged, a tampered, a stale and an unsigned request with 401', async () => {
    for (const res of [
      await send(sign(body, 'wrong-secret')),
      await send(sign(), '{"amountCents":"999"}'),
      await send(sign(body, NETWORK_SECRET, now() - 301)),
      await send({}),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ code: 'signature.invalid' });
    }
  });

  it('rejects a captured request replayed under another, a dropped or an added Idempotency-Key', async () => {
    const captured = sign();
    const { 'Idempotency-Key': _dropped, ...withoutKey } = captured;
    const unkeyed = sign(body, NETWORK_SECRET, now(), '');
    for (const res of [
      await send({ ...captured, 'Idempotency-Key': '0e1d2c3b-4a59-4687-9a6b-5c4d3e2f1a0b' }),
      await send(withoutKey),
      await send({ ...unkeyed, 'Idempotency-Key': KEY }),
    ]) {
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ code: 'signature.invalid' });
    }
    expect((await send(unkeyed)).status).toBe(201);
  });
});

describe('role routes', () => {
  it('401 without a user, 403 with another role, 200 with the role and the principal', async () => {
    const server = app.getHttpServer();
    expect((await request(server).get('/fixture/me')).body).toMatchObject({
      code: 'common.unauthenticated',
    });
    expect((await request(server).get('/fixture/me').set('x-test-role', 'admin')).status).toBe(403);
    const ok = await request(server).get('/fixture/me').set('x-test-role', 'customer');
    expect(ok.body).toEqual({ id: 'user-1', role: 'customer' });
  });
});

describe('request id on errors raised before routing (A15)', () => {
  it('keeps the caller id on malformed JSON and answers the validation envelope', async () => {
    const res = await request(app.getHttpServer())
      .post('/fixture/echo')
      .set('Content-Type', 'application/json')
      .set('X-Request-ID', 'malformed-json-01')
      .send('{bad');
    expect(res.status).toBe(422);
    expect(res.headers['x-request-id']).toBe('malformed-json-01');
    expect(res.body).toMatchObject({
      code: 'common.validation_failed',
      requestId: 'malformed-json-01',
    });
  });

  it('answers 413 with the payload code just above the 1 MB limit, and accepts just below', async () => {
    const over = JSON.stringify({ pad: 'x'.repeat(1024 * 1024) });
    const res = await request(app.getHttpServer())
      .post('/fixture/echo')
      .set('Content-Type', 'application/json')
      .send(over);
    expect(res.status).toBe(413);
    expect(res.body).toMatchObject({ code: 'common.payload_too_large' });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);

    const under = JSON.stringify({ pad: 'x'.repeat(1024 * 1024 - 64) });
    const ok = await request(app.getHttpServer())
      .post('/fixture/echo')
      .set('Content-Type', 'application/json')
      .send(under);
    expect(ok.status).toBe(201);
  });
});

describe('global validation pipe (AN2)', () => {
  const post = (body: object) =>
    request(app.getHttpServer())
      .post('/fixture/dto')
      .set('Content-Type', 'application/json')
      .send(body);

  it('accepts a valid body', async () => {
    const res = await post({ amount: '1250' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ amount: '1250' });
  });

  it('rejects a wrong type, an unknown key and an over-long value with issue paths', async () => {
    for (const body of [
      { amount: 1250 },
      { amount: '1', extra: true },
      { amount: '1'.repeat(13) },
    ]) {
      const res = await post(body);
      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'common.validation_failed' });
      expect(res.body.details.issues.length).toBeGreaterThan(0);
    }
  });
});

describe('raw body for signed routes (P3)', () => {
  it('keeps the exact bytes next to the parsed body', async () => {
    const raw = '{"b":1,  "a":2}';
    const res = await request(app.getHttpServer())
      .post('/fixture/echo')
      .set('Content-Type', 'application/json')
      .send(raw);
    expect(res.body).toEqual({ raw, body: { b: 1, a: 2 } });
  });
});

describe('CORS allowlist (A12)', () => {
  it('allows a listed origin with credentials and exposes the request id header', async () => {
    const res = await request(app.getHttpServer())
      .options('/fixture/open')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    const allowed = String(res.headers['access-control-allow-headers'])
      .toLowerCase()
      .split(',')
      .map((header) => header.trim())
      .sort();
    expect(allowed).toEqual(['authorization', 'content-type', 'idempotency-key', 'x-request-id']);

    const get = await request(app.getHttpServer()).get('/fixture/open').set('Origin', ALLOWED);
    expect(get.headers['access-control-expose-headers']).toContain('X-Request-ID');
  });

  it('does not allow a foreign origin', async () => {
    const res = await request(app.getHttpServer())
      .options('/fixture/open')
      .set('Origin', 'http://evil.test')
      .set('Access-Control-Request-Method', 'GET');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('security headers (A12)', () => {
  it('sends helmet headers', async () => {
    const res = await request(app.getHttpServer()).get('/fixture/open');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('keeps every API answer out of shared caches: authenticated, public and error responses (A5)', async () => {
    const http = request(app.getHttpServer());
    const responses = [
      await http.get('/fixture/me').set('x-test-role', 'customer'),
      await http.get('/fixture/open'),
      await http.get('/fixture/me'),
      await http.get('/no-such-route'),
    ];
    expect(responses.map((res) => res.status)).toEqual([200, 200, 401, 404]);
    for (const res of responses) expect(res.headers['cache-control']).toBe('private, no-store');
  });
});
