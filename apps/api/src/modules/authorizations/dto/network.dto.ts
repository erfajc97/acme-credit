import { networkAuthorizationRequestSchema, networkCaptureRequestSchema } from '@acme/contracts';
import { createZodDto } from 'nestjs-zod';

export class NetworkAuthorizationDto extends createZodDto(networkAuthorizationRequestSchema) {}

export class NetworkCaptureDto extends createZodDto(networkCaptureRequestSchema) {}
