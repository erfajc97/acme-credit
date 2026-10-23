import { checkoutRequestSchema } from '@acme/contracts';
import { createZodDto } from 'nestjs-zod';

/** Body of `POST /v1/checkout`: SKUs and quantities only, never a price (strict). */
export class CheckoutRequestDto extends createZodDto(checkoutRequestSchema) {}
