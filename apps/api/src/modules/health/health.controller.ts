import type { HealthResponse } from '@acme/contracts';
import { Public } from '@acme/nest-core';
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

/** Probes for the orchestrator: public by necessity, they carry no data. Outside /v1. */
@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  @Public()
  liveness(): HealthResponse {
    return this.health.liveness();
  }

  @Get('ready')
  @Public()
  readiness(): Promise<HealthResponse> {
    return this.health.readiness();
  }
}
