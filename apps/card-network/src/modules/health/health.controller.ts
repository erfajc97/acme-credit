import type { HealthResponse } from '@acme/contracts';
import { Public } from '@acme/nest-core';
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('health')
  @Public()
  liveness(): HealthResponse {
    return this.health.liveness();
  }
}
