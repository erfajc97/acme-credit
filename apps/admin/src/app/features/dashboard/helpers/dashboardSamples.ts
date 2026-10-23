import type { AdminAuthorization, AdminPayout } from '@acme/contracts';
import { formatDateTime, formatDay, formatHour } from '@/app/helpers/dates';
import { isExpiringSoon } from '@/app/helpers/holds';
import { formatAmount, formatCount } from '@/app/helpers/money';
import { t } from '@/app/i18n';
import { accountHref } from '@/app/lib/endpoints';
import { ALERTS_PER_KIND, TREND_MAX_BUCKETS } from '../data';

/*
 * The dashboard's figures the API's dashboard endpoint does not count, computed from the newest
 * page of a list (a sample). A sample whose list goes on is said as "10+" / "latest 10".
 */

interface Sample {
  items: readonly unknown[];
  totalPages: number;
}

/** Does the list go on past the sample (its first page)? */
export function hasMoreThanSample(sample: Sample): boolean {
  return sample.totalPages > 1;
}

/** How many rows of a sample count: "7", or "10+" when the list has more pages. */
export function sampleCount(sample: Sample, count = sample.items.length): string {
  return `${formatCount(count)}${hasMoreThanSample(sample) ? '+' : ''}`;
}

const HOUR_MS = 60 * 60 * 1000;

export type TrendUnit = 'hour' | 'day';

export interface TrendBucket {
  key: string;
  /** The tick under the bar: an hour or a day, in the page's locale. */
  label: string;
  approved: number;
  declined: number;
}

export interface PurchaseTrend {
  unit: TrendUnit;
  buckets: TrendBucket[];
  /** Purchases the chart draws (the sample, minus what fell before the first bucket). */
  count: number;
}

/** Start of the hour, or of the local day, an instant falls in. */
function bucketStart(instant: number, unit: TrendUnit): number {
  const date = new Date(instant);
  if (unit === 'hour') date.setMinutes(0, 0, 0);
  else date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function nextStart(start: number, unit: TrendUnit): number {
  if (unit === 'hour') return start + HOUR_MS;
  const date = new Date(start);
  date.setDate(date.getDate() + 1);
  return date.getTime();
}

function emptyBuckets(oldest: number, newest: number, unit: TrendUnit): number[] {
  const starts: number[] = [];
  for (let start = bucketStart(oldest, unit); start <= newest; start = nextStart(start, unit))
    starts.push(start);
  return starts.slice(-TREND_MAX_BUCKETS);
}

/**
 * Purchases per hour (when the sample spans a day or less) or per day, approved vs declined, from
 * the newest page of purchases. Hours or days without purchases between two that have some are
 * drawn as empty bars; at most TREND_MAX_BUCKETS, the newest kept.
 */
export function purchaseTrend(
  purchases: readonly Pick<AdminAuthorization, 'createdAt' | 'status'>[],
): PurchaseTrend {
  if (purchases.length === 0) return { unit: 'hour', buckets: [], count: 0 };
  const instants = purchases.map((purchase) => Date.parse(purchase.createdAt));
  const newest = Math.max(...instants);
  const oldest = Math.min(...instants);
  const unit: TrendUnit = newest - oldest <= 24 * HOUR_MS ? 'hour' : 'day';
  const starts = emptyBuckets(oldest, newest, unit);
  const buckets = starts.map((start): TrendBucket => ({
    key: String(start),
    label: unit === 'hour' ? formatHour(start) : formatDay(start),
    approved: 0,
    declined: 0,
  }));
  let count = 0;
  purchases.forEach((purchase, index) => {
    const slot = buckets[starts.indexOf(bucketStart(instants[index] ?? 0, unit))];
    if (!slot) return;
    if (purchase.status === 'DECLINED') slot.declined += 1;
    else slot.approved += 1;
    count += 1;
  });
  return { unit, buckets, count };
}

export interface TrendChartView {
  approved: string;
  declined: string;
  /** The whole chart in one sentence (assistive tech). */
  summary: string;
  maxLabel: string;
  bars: { key: string; label: string; approved: number; declined: number; title: string }[];
}

/** The chart's words: totals, the one-sentence summary, the scale and each bar's tooltip. */
export function trendChartView(trend: PurchaseTrend): TrendChartView | null {
  if (trend.count === 0) return null;
  const approved = trend.buckets.reduce((sum, bucket) => sum + bucket.approved, 0);
  const declined = trend.buckets.reduce((sum, bucket) => sum + bucket.declined, 0);
  const max = Math.max(...trend.buckets.map((bucket) => bucket.approved + bucket.declined));
  const first = trend.buckets[0]?.label ?? '';
  const last = trend.buckets[trend.buckets.length - 1]?.label ?? '';
  return {
    approved: formatCount(approved),
    declined: formatCount(declined),
    summary: t(`dashboard.trend.summary.${trend.unit}`, {
      approved: formatCount(approved),
      declined: formatCount(declined),
      from: first,
      to: last,
    }),
    maxLabel: t('dashboard.trend.max', { count: formatCount(max) }),
    bars: trend.buckets.map((bucket) => ({
      ...bucket,
      title: t('dashboard.trend.bar', {
        label: bucket.label,
        approved: formatCount(bucket.approved),
        declined: formatCount(bucket.declined),
      }),
    })),
  };
}

/** Live holds of the sample that expire within the warning window, soonest first. */
export function expiringHolds(
  holds: readonly AdminAuthorization[],
  now: number,
): AdminAuthorization[] {
  return holds
    .filter((hold) => isExpiringSoon(hold, now))
    .sort((left, right) => Date.parse(left.expiresAt ?? '') - Date.parse(right.expiresAt ?? ''));
}

/** Total on hold across holds: what goes back to available credit if they all lapse. */
export function heldTotal(holds: readonly Pick<AdminAuthorization, 'amountCents'>[]): string {
  return formatAmount(holds.reduce((sum, hold) => sum + BigInt(hold.amountCents), 0n));
}

export interface AlertItem {
  id: string;
  kind: 'payoutFailed' | 'holdExpiring';
  /** Who it is about, or null when the core does not know the card's owner. */
  name: string | null;
  amount: string;
  /** The payout's last error, or the hold's merchant. */
  detail: string | null;
  /** When the payout failed, or when the hold expires (formatted). */
  at: string | null;
  href: string | null;
}

/** What needs a person: failed payouts first (money owed to a customer), then holds about to lapse. */
export function alertItems(
  failed: readonly AdminPayout[],
  expiring: readonly AdminAuthorization[],
): AlertItem[] {
  const payouts = failed.slice(0, ALERTS_PER_KIND).map((payout): AlertItem => ({
    id: payout.id,
    kind: 'payoutFailed',
    name: payout.customer.fullName,
    amount: formatAmount(payout.amountCents),
    detail: payout.lastError,
    at: payout.failedAt ? formatDateTime(payout.failedAt) : null,
    href: accountHref(payout.accountId),
  }));
  const holds = expiring.slice(0, ALERTS_PER_KIND).map((hold): AlertItem => ({
    id: hold.id,
    kind: 'holdExpiring',
    name: hold.customer?.fullName ?? null,
    amount: formatAmount(hold.amountCents),
    detail: hold.merchantName,
    at: hold.expiresAt ? formatDateTime(hold.expiresAt) : null,
    href: hold.accountId ? accountHref(hold.accountId) : null,
  }));
  return [...payouts, ...holds];
}
