import { findRouteMarkerViolations } from '@acme/nest-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from './support/harness';

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.close();
});

interface Parameter {
  name: string;
  in: string;
  required?: boolean;
}

describe('lending core API docs', () => {
  it('serves the OpenAPI 3.1 document of the real routes at /docs/openapi.json', async () => {
    const res = await h.http.get('/docs/openapi.json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.openapi).toBe('3.1.0');
    expect(res.body.components.securitySchemes.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });

    const deposit = res.body.paths['/v1/accounts/{id}/deposits'].post;
    expect(deposit.security).toEqual([{ bearer: [] }]);
    expect(deposit.tags).toEqual(['payments']);
    expect(deposit.parameters as Parameter[]).toContainEqual(
      expect.objectContaining({ name: 'Idempotency-Key', in: 'header', required: true }),
    );
    expect(deposit.requestBody.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/AmountRequestDto',
    });

    const signed = res.body.paths['/v1/network/authorizations'].post;
    const names = (signed.parameters as Parameter[]).map((p) => p.name);
    expect(names).toEqual(
      expect.arrayContaining(['X-Signature', 'X-Signature-Timestamp', 'Idempotency-Key']),
    );
    expect(res.body.components.schemas.ErrorEnvelope.properties.code.enum).toContain(
      'idempotency.key_required',
    );
  });

  it('serves Swagger UI from the app at /docs, with a CSP scoped to the docs', async () => {
    const res = await h.http.get('/docs').redirects(1);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('swagger-ui-bundle.js');
    expect(res.text).not.toMatch(/https?:\/\/(cdn|unpkg)/);
    expect(res.headers['content-security-policy']).toContain("style-src 'self' 'unsafe-inline'");

    const bundle = await h.http.get('/docs/swagger-ui-bundle.js');
    expect(bundle.status).toBe(200);

    const health = await h.http.get('/health');
    expect(health.headers['content-security-policy']).not.toBe(
      res.headers['content-security-policy'],
    );
  });

  it('mounts the docs outside the controllers: the route-marker scan stays clean (AN10)', () => {
    expect(findRouteMarkerViolations(h.app)).toEqual([]);
  });
});
