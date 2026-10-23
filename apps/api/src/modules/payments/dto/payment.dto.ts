import { amountRequestSchema, providerWebhookSchema } from '@acme/contracts';
import { createZodDto } from 'nestjs-zod';

export class AmountRequestDto extends createZodDto(amountRequestSchema) {}

export class ProviderWebhookDto extends createZodDto(providerWebhookSchema) {}
