import { describe, expect, it } from 'vitest';
import { HealthService } from '../health.service';

describe('HealthService', () => {
  it('reports liveness with the service name', () => {
    expect(new HealthService().liveness()).toEqual({ status: 'ok', service: 'card-network' });
  });
});
