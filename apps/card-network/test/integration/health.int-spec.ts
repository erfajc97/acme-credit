import { createApp, findRouteMarkerViolations } from '@acme/nest-core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';

let app: INestApplication;

beforeAll(async () => {
  app = await createApp(AppModule, { CORS_ORIGINS: [] }, { logger: false });
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('card network HTTP surface', () => {
  it('answers liveness and echoes a caller request id', async () => {
    const res = await request(app.getHttpServer())
      .get('/health')
      .set('X-Request-ID', 'it-health-0001');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'card-network' });
    expect(res.headers['x-request-id']).toBe('it-health-0001');
  });

  it('answers an unknown route with the envelope sharing the header id', async () => {
    const res = await request(app.getHttpServer()).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'common.not_found' });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('declares exactly one access marker on every route (AN10)', () => {
    expect(findRouteMarkerViolations(app)).toEqual([]);
  });
});
