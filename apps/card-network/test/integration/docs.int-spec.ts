import { findRouteMarkerViolations } from '@acme/nest-core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../src/app.module';
import { createNetworkApi } from '../../src/core/http/create-network-api';

let app: INestApplication;

beforeAll(async () => {
  app = await createNetworkApi(AppModule, { CORS_ORIGINS: [] }, { logger: false });
  await app.init();
});

afterAll(async () => {
  await app.close();
});

interface Parameter {
  name: string;
  in: string;
  required?: boolean;
}

describe('card network API docs', () => {
  it('serves the OpenAPI 3.1 document at /docs/openapi.json', async () => {
    const res = await request(app.getHttpServer()).get('/docs/openapi.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.components.securitySchemes.bearer).toBeDefined();

    const purchase = res.body.paths['/v1/purchases'].post;
    expect(purchase.tags).toEqual(['purchases']);
    expect(purchase.parameters as Parameter[]).toContainEqual(
      expect.objectContaining({ name: 'Idempotency-Key', in: 'header', required: true }),
    );

    const provider = res.body.paths['/v1/provider/payments'].post;
    expect((provider.parameters as Parameter[]).map((p) => p.name)).toEqual(
      expect.arrayContaining(['X-Signature', 'X-Signature-Timestamp']),
    );
  });

  it('serves Swagger UI from the app at /docs', async () => {
    const res = await request(app.getHttpServer()).get('/docs').redirects(1);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('swagger-ui-bundle.js');
    expect(res.headers['content-security-policy']).toContain("style-src 'self' 'unsafe-inline'");
  });

  it('mounts the docs outside the controllers: the route-marker scan stays clean (AN10)', () => {
    expect(findRouteMarkerViolations(app)).toEqual([]);
  });
});
