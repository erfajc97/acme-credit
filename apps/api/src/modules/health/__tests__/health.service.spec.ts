import { describe, expect, it, vi } from 'vitest';
import { HealthService } from '../health.service';

function makeService(query: () => Promise<unknown>) {
  const prisma = { $queryRaw: vi.fn(query) };
  return { prisma, service: new HealthService(prisma as never) };
}

describe('HealthService', () => {
  it('reports liveness with the service name', () => {
    const { service } = makeService(async () => [{ '?column?': 1 }]);
    expect(service.liveness()).toEqual({ status: 'ok', service: 'lending-core' });
  });

  it('is ready only after the database answers', async () => {
    const { prisma, service } = makeService(async () => [{ '?column?': 1 }]);
    await expect(service.readiness()).resolves.toEqual({ status: 'ok', service: 'lending-core' });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('is not ready when the database is down', async () => {
    const { service } = makeService(async () => {
      throw new Error('connection refused');
    });
    await expect(service.readiness()).rejects.toThrow('connection refused');
  });
});
