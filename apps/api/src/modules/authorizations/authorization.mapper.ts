import {
  itemCountOf,
  orderLineSchema,
  toPurchaseLines,
  type Authorization,
  type AuthorizationDetail,
  type OrderLine,
} from '@acme/contracts';
import type { Prisma } from '../../generated/prisma/client';
import { centsToString } from '../../core/money/money';

export const authorizationSelect = {
  id: true,
  accountId: true,
  amountCents: true,
  capturedCents: true,
  status: true,
  declineReason: true,
  merchantName: true,
  merchantMcc: true,
  items: true,
  expiresAt: true,
  reversalReason: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AuthorizationSelect;

export type AuthorizationRow = Prisma.AuthorizationGetPayload<{
  select: typeof authorizationSelect;
}>;

export function toAuthorization(row: AuthorizationRow): Authorization {
  return {
    id: row.id,
    accountId: row.accountId,
    amountCents: centsToString(row.amountCents),
    capturedCents: centsToString(row.capturedCents),
    status: row.status,
    declineReason: row.declineReason,
    merchantName: row.merchantName,
    merchantMcc: row.merchantMcc,
    items: toOrderLines(row.items),
    expiresAt: row.expiresAt?.toISOString() ?? null,
    reversalReason: row.reversalReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const orderLinesSchema = orderLineSchema.array();

/** The jsonb column holds what the service validated on insert; parsed again on the way out. */
export function toOrderLines(items: Prisma.JsonValue): OrderLine[] {
  return orderLinesSchema.parse(items);
}

/** Audit actions of the steps after the decision; the service writes them, the detail reads them. */
export const AUTHORIZATION_STEP_ACTIONS = {
  captured: 'authorization.captured',
  reversed: 'authorization.reversed',
} as const;

export interface AuthorizationStep {
  action: string;
  createdAt: Date;
}

function stepAt(steps: readonly AuthorizationStep[], action: string): string | null {
  return steps.find((step) => step.action === action)?.createdAt.toISOString() ?? null;
}

/** The order detail of a customer's purchase: priced lines and when each step happened. */
export function toAuthorizationDetail(
  row: AuthorizationRow & { accountId: string },
  steps: readonly AuthorizationStep[],
): AuthorizationDetail {
  const lines = toOrderLines(row.items);
  const createdAt = row.createdAt.toISOString();
  // The decision is taken in the transaction that creates the row.
  const declined = row.status === 'DECLINED';
  return {
    id: row.id,
    accountId: row.accountId,
    status: row.status,
    declineReason: row.declineReason,
    merchantName: row.merchantName,
    merchantMcc: row.merchantMcc,
    amountCents: centsToString(row.amountCents),
    capturedCents: centsToString(row.capturedCents),
    itemCount: itemCountOf(lines),
    items: toPurchaseLines(lines),
    timeline: {
      createdAt,
      approvedAt: declined ? null : createdAt,
      declinedAt: declined ? createdAt : null,
      capturedAt: stepAt(steps, AUTHORIZATION_STEP_ACTIONS.captured),
      reversedAt: stepAt(steps, AUTHORIZATION_STEP_ACTIONS.reversed),
    },
    expiresAt: row.expiresAt?.toISOString() ?? null,
    reversalReason: row.reversalReason,
    createdAt,
    updatedAt: row.updatedAt.toISOString(),
  };
}
