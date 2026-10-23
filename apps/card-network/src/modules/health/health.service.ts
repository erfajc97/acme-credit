import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@acme/contracts';

export const SERVICE_NAME = 'card-network';

@Injectable()
export class HealthService {
  liveness(): HealthResponse {
    return { status: 'ok', service: SERVICE_NAME };
  }
}
