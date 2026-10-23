import type { Authorization, ErrorCode, PurchaseRequest, PurchaseResult } from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CORE_CLIENT,
  type CoreCallResult,
  type CoreClient,
  type NetworkAuthorizationRequest,
} from '../../core/core-client/core-client.port';
import { fingerprintOf, IdempotencyStore } from '../../core/idempotency/idempotency-store';
import { CaptureService } from './capture.service';

/** Attempts after the first: the browser is waiting, so the inline budget is small. */
export const AUTHORIZATION_RETRIES = 3;

/** Core rejections the browser can act on; anything else is our own fault → 503. */
const PASSED_THROUGH = new Set<ErrorCode>(['idempotency.key_reused', 'common.validation_failed']);

/**
 * The card network's front door: a browser purchase becomes a signed, idempotent
 * authorization request to the core (P3, MO2); its outcome is replayed for the same key.
 */
@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);
  private readonly results = new IdempotencyStore<PurchaseResult>();

  constructor(
    @Inject(CORE_CLIENT) private readonly core: CoreClient,
    private readonly captures: CaptureService,
  ) {}

  purchase(input: { idempotencyKey: string; request: PurchaseRequest }): Promise<PurchaseResult> {
    const { cardToken, amountCents, merchant } = input.request;
    return this.results.execute({
      key: input.idempotencyKey,
      fingerprint: fingerprintOf(['purchase', cardToken, amountCents, merchant.name, merchant.mcc]),
      work: () => this.authorize(input.idempotencyKey, input.request),
    });
  }

  /** Only the card that made the purchase may void it (the attacker knows the id, not the card). */
  void(input: {
    idempotencyKey: string;
    authorizationId: string;
    cardToken: string;
  }): Promise<PurchaseResult> {
    return this.results.execute({
      key: input.idempotencyKey,
      fingerprint: fingerprintOf(['void', input.authorizationId, input.cardToken]),
      work: async () => {
        await this.captures.reverse({
          authorizationId: input.authorizationId,
          cardToken: input.cardToken,
        });
        return {
          authorizationId: input.authorizationId,
          status: 'REVERSED',
          declineReason: null,
          availableCents: null,
        };
      },
    });
  }

  private async authorize(
    idempotencyKey: string,
    request: PurchaseRequest,
  ): Promise<PurchaseResult> {
    const authorization = await this.forward({
      idempotencyKey,
      body: {
        cardToken: request.cardToken,
        amountCents: request.amountCents,
        merchant: { name: request.merchant.name, mcc: request.merchant.mcc },
      },
    });
    return toPurchaseResult(authorization);
  }

  /**
   * Sends one authorization to the core (signed, the caller's key on every retry) and
   * schedules the capture of an approval. Shared by card purchases and store checkouts, so
   * both doors map the core's failures and settle the hold the same way (G12).
   */
  async forward(input: {
    idempotencyKey: string;
    body: NetworkAuthorizationRequest;
  }): Promise<Authorization> {
    const result = await this.core.authorize(input.body, {
      idempotencyKey: input.idempotencyKey,
      retries: AUTHORIZATION_RETRIES,
    });
    if (result.kind !== 'ok') throw this.failure(result);
    this.captures.track(result.value, input.body.cardToken);
    return result.value;
  }

  private failure(result: Exclude<CoreCallResult<unknown>, { kind: 'ok' }>): AppHttpException {
    if (result.kind === 'rejected' && result.code && PASSED_THROUGH.has(result.code)) {
      return new AppHttpException(result.code);
    }
    if (result.kind === 'rejected') {
      this.logger.error(`core rejected an authorization: ${result.status} ${result.code ?? '-'}`);
    }
    return new AppHttpException('payment.provider_unavailable');
  }
}

/** The core never reports the available credit to the network, so it stays null. */
function toPurchaseResult(authorization: Authorization): PurchaseResult {
  return {
    authorizationId: authorization.id,
    status: authorization.status,
    declineReason: authorization.declineReason,
    availableCents: null,
  };
}
