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

describe('lending core HTTP surface', () => {
  it('answers liveness and echoes a caller request id', async () => {
    const res = await h.http.get('/health').set('X-Request-ID', 'it-health-0001');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'lending-core' });
    expect(res.headers['x-request-id']).toBe('it-health-0001');
  });

  it('is ready once the database answers', async () => {
    const res = await h.http.get('/ready');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', service: 'lending-core' });
  });

  it('answers an unknown route with the envelope sharing the header id', async () => {
    const res = await h.http.get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: 'common.not_found' });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('declares exactly one access marker on every route (AN10)', () => {
    expect(findRouteMarkerViolations(h.app)).toEqual([]);
  });
});
