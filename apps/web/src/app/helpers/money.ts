import { formatCents } from '@acme/contracts';
import { getActiveLocale } from '@/app/i18n';

/**
 * Display of an amount of integer cents (P1) in the page's locale: "$1,234.56" (en-US),
 * "USD 1,234.56" (es-MX). Always USD; never through a float.
 */
export function formatAmount(cents: string | bigint): string {
  return formatCents(cents, getActiveLocale());
}

/** The currency sign drawn inside money fields. */
export const CURRENCY_SYMBOL = '$';

/**
 * Share of `part` in `whole` as a percentage for the meter's widths (display only). Integer
 * cents, so the division happens once at the end; clamped to 0–100 and 0 for an empty whole.
 */
export function percentOf(part: string | bigint, whole: string | bigint): number {
  const total = BigInt(whole);
  if (total <= 0n) return 0;
  const value = BigInt(part);
  const basisPoints = (value * 10_000n) / total;
  const clamped = basisPoints < 0n ? 0n : basisPoints > 10_000n ? 10_000n : basisPoints;
  return Number(clamped) / 100;
}
