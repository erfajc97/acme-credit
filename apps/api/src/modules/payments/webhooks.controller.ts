import { Signed, SKIP_ALL_THROTTLES } from '@acme/nest-core';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Actor } from '../../core/audit/record-change';
import { CurrentActor } from '../../core/http/request-context';
import { ProviderWebhookDto } from './dto/payment.dto';
import { PaymentSettlementService } from './payment-settlement.service';

/**
 * Payment provider webhooks (P3, MO4). The signature is verified by the guard before the body
 * is parsed; the body only names the payment, whose state is re-read at the provider. Signed
 * service traffic is not rate limited per IP: the provider retries until it gets an answer.
 */
@Controller('v1/webhooks')
@Signed('provider')
@SkipThrottle(SKIP_ALL_THROTTLES)
export class WebhooksController {
  constructor(private readonly settlement: PaymentSettlementService) {}

  @Post('payments')
  @HttpCode(204)
  async payments(@CurrentActor() actor: Actor, @Body() body: ProviderWebhookDto): Promise<void> {
    await this.settlement.handleWebhook(actor, body);
  }
}
