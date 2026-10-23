import type { PurchaseResult } from '@acme/contracts';
import { Public } from '@acme/nest-core';
import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IdempotencyKey } from '../../core/http/idempotency-key';
import {
  AuthorizationParamsDto,
  PurchaseRequestDto,
  VoidPurchaseRequestDto,
} from './dto/purchase.dto';
import { PurchasesService } from './purchases.service';

/** Each purchase costs a signed call to the core: stricter than the global limit (A12). */
/** A shopper's checkouts and voids: a busy reviewer, never a flood (A12, EDoS). */
export const PURCHASE_THROTTLE = {
  default: { ttl: 60_000, limit: 30 },
  hourly: { ttl: 3_600_000, limit: 300 },
};

/**
 * Called from the customer's browser. `@Public()` because the card token is the credential
 * the network checks (through the core), as at a real merchant terminal. A void carries the
 * token too: an authorization id alone (it shows up in links and logs) cancels nothing.
 */
@Controller('v1/purchases')
@Throttle(PURCHASE_THROTTLE)
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Post()
  @Public()
  @HttpCode(201)
  create(
    @IdempotencyKey() idempotencyKey: string,
    @Body() request: PurchaseRequestDto,
  ): Promise<PurchaseResult> {
    return this.purchases.purchase({ idempotencyKey, request });
  }

  @Post(':authorizationId/void')
  @Public()
  @HttpCode(200)
  void(
    @IdempotencyKey() idempotencyKey: string,
    @Param() params: AuthorizationParamsDto,
    @Body() request: VoidPurchaseRequestDto,
  ): Promise<PurchaseResult> {
    return this.purchases.void({
      idempotencyKey,
      authorizationId: params.authorizationId,
      cardToken: request.cardToken,
    });
  }
}
