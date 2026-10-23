import { z } from 'zod';

/**
 * Money is integer cents (P1, ADR-0002). On the wire it is a string of digits ("12550" =
 * USD 125.50) so no JSON number ever carries an amount.
 */
export const CURRENCY = 'USD';

/** Largest amount any single operation may move: USD 1,000,000.00. */
export const MAX_OPERATION_CENTS = 100_000_000n;

/** Collateral policy (ADR-0002): a deposit between USD 200 and USD 10,000. */
export const MIN_DEPOSIT_CENTS = 20_000n;
export const MAX_DEPOSIT_CENTS = 1_000_000n;

/**
 * Most collateral one account may hold: confirmed plus still-pending deposits, USD 10,000.00
 * (decision G11, proposal: the same figure as the single-deposit maximum). The API checks it
 * under the account lock; the wallet shows it from this constant (G12).
 */
export const MAX_ACCOUNT_COLLATERAL_CENTS = 1_000_000n;

/** A positive amount of cents as a canonical digit string (no sign, no leading zeros). */
export const centsSchema = z
  .string()
  .regex(/^[1-9]\d{0,14}$/, 'cents must be a positive integer string')
  // zod 4 runs every check even after the regex fails, so guard BigInt() against non-digits.
  .refine(
    (value) => !/^\d+$/.test(value) || BigInt(value) <= MAX_OPERATION_CENTS,
    'amount too large',
  );

/** A balance that may be zero (never negative on the wire). */
export const balanceCentsSchema = z.string().regex(/^(0|[1-9]\d{0,14})$/);

/** A signed posting amount: debit positive, credit negative. */
export const signedCentsSchema = z.string().regex(/^(0|-?[1-9]\d{0,14})$/);

/**
 * Parses what a person types ("125.5", "1,250.00", "  40 ") into cents. Returns null for
 * anything that is not a plain positive decimal with at most two fractional digits: signs,
 * exponents, letters, a third decimal or an empty field are never rounded or guessed (W11).
 */
export function parseMoneyInput(text: string): bigint | null {
  const trimmed = text.trim().replace(/,(?=\d{3}(\D|$))/g, '');
  const match = /^(\d{1,13})(?:\.(\d{1,2}))?$/.exec(trimmed);
  if (!match) return null;
  const whole = BigInt(match[1] ?? '0');
  const fraction = BigInt((match[2] ?? '').padEnd(2, '0'));
  const cents = whole * 100n + fraction;
  return cents > 0n ? cents : null;
}

/** Formats cents for display, e.g. 12550n → "$125.50". Never goes through a float. */
export function formatCents(cents: bigint | string, locale = 'en-US'): string {
  const value = typeof cents === 'bigint' ? cents : BigInt(cents);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const dollars = absolute / 100n;
  const remainder = (absolute % 100n).toString().padStart(2, '0');
  const formatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const whole = formatter.format(dollars);
  const decimalSeparator =
    new Intl.NumberFormat(locale).formatToParts(1.1).find((part) => part.type === 'decimal')
      ?.value ?? '.';
  return `${negative ? '-' : ''}${whole}${decimalSeparator}${remainder}`;
}
