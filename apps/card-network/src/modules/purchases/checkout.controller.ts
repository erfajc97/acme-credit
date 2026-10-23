import type { CheckoutResult } from '@acme/contracts';
import { Public } from '@acme/nest-core';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IdempotencyKey } from '../../core/http/idempotency-key';
import { CheckoutService } from './checkout.service';
import { CheckoutRequestDto } from './dto/checkout.dto';
import { PURCHASE_THROTTLE } from './purchases.controller';

/**
 * The in-wallet store's checkout, called from the customer's browser. `@Public()` like
 * `/v1/purchases`: the card token is the credential the core checks. Voided through
 * `/v1/purchases/:authorizationId/void`, as any card authorization.
 */
@Controller('v1/checkout')
@Throttle(PURCHASE_THROTTLE)
export class CheckoutController {
  constructor(private readonly checkouts: CheckoutService) {}

  @Post()
  @Public()
  @HttpCode(201)
  create(
    @IdempotencyKey() idempotencyKey: string,
    @Body() request: CheckoutRequestDto,
  ): Promise<CheckoutResult> {
    return this.checkouts.checkout({ idempotencyKey, request });
  }
}
