import { providerCreatePaymentSchema } from '@acme/contracts';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Body of `POST /v1/provider/payments` (the contract's schema, strict). */
export class CreatePaymentDto extends createZodDto(providerCreatePaymentSchema) {}

/** Our payment ids are UUIDs; the cap keeps any other value cheap to reject as 404. */
export class PaymentIdParamsDto extends createZodDto(
  z.object({ id: z.string().min(1).max(64) }).strict(),
) {}

/**
 * `?lang=` of the hosted pay page. Any short value is accepted and only `es` / `en` are
 * honoured (the resolver falls back otherwise), so a stray value never breaks the page.
 */
export class PayPageQueryDto extends createZodDto(
  z.object({ lang: z.string().max(16).optional() }).strict(),
) {}
