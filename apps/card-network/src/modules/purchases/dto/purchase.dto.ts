import { idSchema, purchaseRequestSchema, voidPurchaseRequestSchema } from '@acme/contracts';
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Body of `POST /v1/purchases` (the contract's schema, strict). */
export class PurchaseRequestDto extends createZodDto(purchaseRequestSchema) {}

export class AuthorizationParamsDto extends createZodDto(
  z.object({ authorizationId: idSchema }).strict(),
) {}

/** Body of `POST /v1/purchases/:authorizationId/void`: the card that made the purchase. */
export class VoidPurchaseRequestDto extends createZodDto(voidPurchaseRequestSchema) {}
