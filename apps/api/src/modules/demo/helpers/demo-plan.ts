import {
  DEMO_MERCHANTS,
  priceCart,
  STORE_MERCHANTS,
  type OrderLine,
  type StoreMerchantId,
} from '@acme/contracts';
import { createHash } from 'node:crypto';

/**
 * The demo customer's history (dev and demo only): a confirmed deposit, captured store
 * purchases across the four store merchants, one decline, one live hold and one repayment.
 * Every step goes through the real services; the plan is only data.
 */
export const DEMO_DEPOSIT_CENTS = '500000';

export interface DemoPurchase {
  step: string;
  merchant: { name: string; mcc: string };
  items?: OrderLine[];
  amountCents: string;
  capture: boolean;
}

function storePurchase(input: {
  step: string;
  merchant: StoreMerchantId;
  items: { sku: string; quantity: number }[];
  capture: boolean;
}): DemoPurchase {
  const { lines, totalCents } = priceCart({ merchant: input.merchant, items: input.items });
  const { name, mcc } = STORE_MERCHANTS[input.merchant];
  return {
    step: input.step,
    merchant: { name, mcc },
    items: lines,
    amountCents: totalCents.toString(),
    capture: input.capture,
  };
}

const fuel = DEMO_MERCHANTS[1];

export const DEMO_PURCHASES: readonly DemoPurchase[] = [
  storePurchase({
    step: 'taqueria',
    merchant: 'taqueria',
    items: [
      { sku: 'TAC-PASTOR', quantity: 2 },
      { sku: 'TAC-HORCH', quantity: 1 },
    ],
    capture: true,
  }),
  storePurchase({
    step: 'market',
    merchant: 'market',
    items: [
      { sku: 'MKT-COFFEE', quantity: 1 },
      { sku: 'MKT-AVOCADO', quantity: 2 },
    ],
    capture: true,
  }),
  storePurchase({
    step: 'electro',
    merchant: 'electro',
    items: [{ sku: 'ELC-EARBUDS', quantity: 1 }],
    capture: true,
  }),
  storePurchase({
    step: 'casa',
    merchant: 'casa',
    items: [{ sku: 'HOM-MUGS', quantity: 1 }],
    capture: true,
  }),
  // More than the whole limit: declined for insufficient funds, decided and stored like any other.
  {
    step: 'declined',
    merchant: { name: fuel.name, mcc: fuel.mcc },
    amountCents: '900000',
    capture: false,
  },
  // Authorized, never captured: a live hold the admin can release (or the worker expires).
  storePurchase({
    step: 'hold',
    merchant: 'casa',
    items: [{ sku: 'HOM-PLANT', quantity: 1 }],
    capture: false,
  }),
];

/** Part of the captured debt the demo customer has already paid back. */
export const DEMO_REPAYMENT_CENTS = '2000';

/**
 * A deterministic idempotency key per customer and step: a re-run replays every step instead
 * of repeating it, and a run cut short resumes where it stopped.
 */
export function demoKey(customerId: string, step: string): string {
  const hex = createHash('sha256').update(`demo:${customerId}:${step}`).digest('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}
