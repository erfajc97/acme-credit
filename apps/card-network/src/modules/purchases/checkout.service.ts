import {
  type CheckoutRequest,
  type CheckoutResult,
  type OrderLine,
  priceCart,
  STORE_MERCHANTS,
} from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import { Injectable } from '@nestjs/common';
import { fingerprintOf, IdempotencyStore } from '../../core/idempotency/idempotency-store';
import { PurchasesService } from './purchases.service';

/**
 * The in-wallet store's checkout: the network, acting as the merchant, prices the cart from
 * the catalog (the browser never sends a price, A4) and authorizes the total like any card
 * purchase, with the priced lines attached so the core can check and store them.
 */
@Injectable()
export class CheckoutService {
  private readonly results = new IdempotencyStore<CheckoutResult>();

  constructor(private readonly purchases: PurchasesService) {}

  async checkout(input: {
    idempotencyKey: string;
    request: CheckoutRequest;
  }): Promise<CheckoutResult> {
    const { cardToken, merchant, items } = input.request;
    const priced = price(input.request);
    return this.results.execute({
      key: input.idempotencyKey,
      fingerprint: fingerprintOf([
        'checkout',
        cardToken,
        merchant,
        items.map((item) => [item.sku, item.quantity]),
      ]),
      work: async () => {
        const store = STORE_MERCHANTS[merchant];
        const authorization = await this.purchases.forward({
          idempotencyKey: input.idempotencyKey,
          body: {
            cardToken,
            amountCents: priced.totalCents.toString(),
            merchant: { name: store.name, mcc: store.mcc },
            items: priced.lines,
          },
        });
        return {
          authorizationId: authorization.id,
          status: authorization.status,
          declineReason: authorization.declineReason,
          availableCents: null,
          merchantName: store.name,
          totalCents: priced.totalCents.toString(),
          lines: priced.lines,
        };
      },
    });
  }
}

/** The catalog is the only price source; a SKU it does not sell here is a client error. */
function price(request: CheckoutRequest): { lines: OrderLine[]; totalCents: bigint } {
  try {
    return priceCart(request);
  } catch {
    // priceCart throws only for an unknown SKU or one of another merchant.
    throw new AppHttpException('common.validation_failed', { reason: 'unknown_sku' });
  }
}
