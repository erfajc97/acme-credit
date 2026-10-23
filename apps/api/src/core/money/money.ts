/**
 * Money is integer cents in a `bigint` (P1, ADR-0002). JSON carries digit strings; these are
 * the only conversions and the only arithmetic that is not a plain `+` / `-` on cents.
 */
export type Cents = bigint;

const BPS_DENOMINATOR = 10_000n;
const DIGITS = /^(0|-?[1-9]\d*)$/;

/** Parses a digit string already validated by the contract (`centsSchema`). */
export function centsFrom(value: string): Cents {
  if (!DIGITS.test(value)) throw new Error('not an integer cents string');
  return BigInt(value);
}

export function centsToString(value: Cents): string {
  return value.toString();
}

/**
 * Credit granted for a deposit: amount × ratio (basis points), rounded DOWN so the limit never
 * exceeds what the collateral covers. The ONE rounding of the limit (MO1).
 */
export function limitForDeposit(amount: Cents, ratioBps: number): Cents {
  if (!Number.isInteger(ratioBps) || ratioBps <= 0 || ratioBps > Number(BPS_DENOMINATOR)) {
    throw new Error('ratio out of range');
  }
  return (amount * BigInt(ratioBps)) / BPS_DENOMINATOR;
}

/** What the customer can still spend: limit − held − posted debt (never below zero). */
export function availableCredit(balances: {
  creditLimitCents: Cents;
  heldCents: Cents;
  postedDebtCents: Cents;
}): Cents {
  const available = balances.creditLimitCents - balances.heldCents - balances.postedDebtCents;
  return available > 0n ? available : 0n;
}

export function minCents(a: Cents, b: Cents): Cents {
  return a < b ? a : b;
}
