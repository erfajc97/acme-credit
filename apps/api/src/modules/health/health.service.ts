import type { HealthResponse } from '@acme/contracts';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

export const SERVICE_NAME = 'lending-core';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  liveness(): HealthResponse {
    return { status: 'ok', service: SERVICE_NAME };
  }

  /** Ready = the database answers. A failure surfaces as the logged 500 envelope. */
  async readiness(): Promise<HealthResponse> {
    await this.prisma.$queryRaw`SELECT 1`;
    return this.liveness();
  }
}
