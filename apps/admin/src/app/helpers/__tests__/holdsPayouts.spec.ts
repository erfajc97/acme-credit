import {
  ADMIN_FREEZE_REASONS,
  FREEZE_ACTORS,
  FREEZE_REASONS,
  PAYOUT_REASONS,
  PAYOUT_STATUSES,
  REVERSAL_REASONS,
} from '@acme/contracts';
import { setActiveLocale, t } from '@/app/i18n';
import { ACCOUNT_ID, adminAuthorizationFixture, adminPayoutFixture } from '@/test/fixtures';
import { formatDay, formatHour } from '../dates';
import {
  HOLD_EXPIRY_WARNING_MS,
  isExpiringSoon,
  isLiveHold,
  toHoldView,
  toReleaseTarget,
} from '../holds';
import { parsePayoutsQuery, serializePayoutsQuery } from '../listQuery';
import { formatPercent } from '../money';
import { toPurchaseRow } from '../orders';
import { toPayoutRow } from '../payouts';
import {
  FREEZE_ACTOR,
  FREEZE_REASON,
  PAYOUT_REASON,
  PAYOUT_STATUS,
  REVERSAL_REASON,
} from '../statusLabels';

beforeEach(() => setActiveLocale('en-US'));

const hasCopy = (key: string) => t(key) !== key;
const EXPIRES = '2026-10-28T12:00:00.000Z';
const expiresAt = Date.parse(EXPIRES);

describe('holds (release and expiry)', () => {
  it('only an approved hold is live: captured, declined and reversed ones cannot be released', () => {
    expect(isLiveHold({ status: 'APPROVED' })).toBe(true);
    for (const status of ['CAPTURED', 'DECLINED', 'REVERSED'] as const)
      expect(isLiveHold({ status })).toBe(false);
  });

  it('"expiring soon" starts exactly 24 h before the expiry (last passing / first failing)', () => {
    const hold = { status: 'APPROVED' as const, expiresAt: EXPIRES };
    expect(isExpiringSoon(hold, expiresAt - HOLD_EXPIRY_WARNING_MS)).toBe(true);
    expect(isExpiringSoon(hold, expiresAt - HOLD_EXPIRY_WARNING_MS - 1)).toBe(false);
    // Past its expiry but not swept yet: still a live hold about to lapse.
    expect(isExpiringSoon(hold, expiresAt + 1)).toBe(true);
    expect(isExpiringSoon({ status: 'APPROVED', expiresAt: null }, expiresAt)).toBe(false);
    expect(isExpiringSoon({ status: 'CAPTURED', expiresAt: EXPIRES }, expiresAt)).toBe(false);
  });

  it('a live hold shows its expiry and can be released; a released one says why', () => {
    const live = toHoldView(
      { status: 'APPROVED', expiresAt: EXPIRES, reversalReason: null },
      expiresAt - HOLD_EXPIRY_WARNING_MS - 1,
    );
    expect(live).toEqual({
      expires: 'Oct 28, 2026, 12:00 PM',
      expiresSoon: false,
      reversalKey: null,
      canRelease: true,
    });
    const released = toHoldView(
      { status: 'REVERSED', expiresAt: EXPIRES, reversalReason: 'admin_release' },
      expiresAt,
    );
    expect(released).toEqual({
      expires: null,
      expiresSoon: false,
      reversalKey: 'reversalReason.admin_release',
      canRelease: false,
    });
  });

  it('the release names the amount, merchant and customer', () => {
    expect(
      toReleaseTarget(
        { id: 'h-1', amountCents: '9374', merchantName: 'Taquería El Sol' },
        'Ada Lovelace',
      ),
    ).toEqual({
      authorizationId: 'h-1',
      amount: '$93.74',
      merchant: 'Taquería El Sol',
      customerName: 'Ada Lovelace',
    });
  });

  it('a purchase row offers "Release hold" only while the hold is live', () => {
    expect(toPurchaseRow(adminAuthorizationFixture()).release?.customerName).toBe('Ada Lovelace');
    expect(toPurchaseRow(adminAuthorizationFixture({ status: 'CAPTURED' })).release).toBeNull();
    expect(
      toPurchaseRow(adminAuthorizationFixture({ customer: null })).release?.customerName,
    ).toBeNull();
  });
});

describe('payout rows', () => {
  it('a failed payout shows its attempts, last error, reference and when it failed', () => {
    expect(toPayoutRow(adminPayoutFixture())).toEqual({
      id: '7b8c9d0e-1f2a-4b3c-8d4e-5f6a7b8c9d14',
      customer: { name: 'Ada Lovelace', email: 'ada@example.test' },
      accountHref: `/en/accounts/view?id=${ACCOUNT_ID}`,
      amount: '$380.00',
      reasonKey: 'payoutReason.collateral_release',
      statusKey: 'status.payout.FAILED',
      tone: 'danger',
      attempts: '3',
      lastError: 'provider_rejected',
      reference: 'pay_7Hq2',
      created: 'Oct 21, 2026, 2:00 PM',
      outcome: { labelKey: 'payouts.failedAt', time: 'Oct 21, 2026, 4:30 PM' },
    });
  });

  it('a sent one says when; a pending one says the next attempt; the account page has no customer', () => {
    const sent = adminPayoutFixture({
      status: 'SENT',
      sentAt: '2026-10-21T15:00:00.000Z',
      failedAt: null,
      lastError: null,
    });
    expect(toPayoutRow(sent).outcome).toEqual({
      labelKey: 'payouts.sentAt',
      time: 'Oct 21, 2026, 3:00 PM',
    });
    const pending = adminPayoutFixture({
      status: 'PENDING',
      failedAt: null,
      nextAttemptAt: '2026-10-21T17:00:00.000Z',
    });
    expect(toPayoutRow(pending).outcome).toEqual({
      labelKey: 'payouts.nextAttemptAt',
      time: 'Oct 21, 2026, 5:00 PM',
    });
    expect(toPayoutRow({ ...pending, nextAttemptAt: null }).outcome).toBeNull();
    const { customer: _customer, ...withoutCustomer } = adminPayoutFixture();
    expect(toPayoutRow(withoutCustomer).customer).toBeNull();
  });
});

describe('the payouts list address (W17)', () => {
  it('keeps only a status the API accepts', () => {
    expect(parsePayoutsQuery('?status=FAILED')).toEqual({ status: 'FAILED' });
    expect(parsePayoutsQuery('?status=LOST&cursor=abc')).toEqual({ status: undefined });
    expect(serializePayoutsQuery({ status: 'PENDING' })).toBe('?status=PENDING');
    expect(serializePayoutsQuery({})).toBe('');
    expect(serializePayoutsQuery(parsePayoutsQuery('?page=2&status=FAILED'))).toBe(
      '?status=FAILED&page=2',
    );
  });
});

describe('words for the new states (never color alone)', () => {
  it('every payout status and reason, reversal reason, freeze reason and actor has copy', () => {
    for (const status of PAYOUT_STATUSES)
      expect(hasCopy(PAYOUT_STATUS[status].labelKey)).toBe(true);
    for (const reason of PAYOUT_REASONS) expect(hasCopy(PAYOUT_REASON[reason])).toBe(true);
    for (const reason of REVERSAL_REASONS) expect(hasCopy(REVERSAL_REASON[reason])).toBe(true);
    for (const reason of FREEZE_REASONS) expect(hasCopy(FREEZE_REASON[reason])).toBe(true);
    for (const actor of FREEZE_ACTORS) expect(hasCopy(FREEZE_ACTOR[actor])).toBe(true);
    expect(ADMIN_FREEZE_REASONS.every((reason) => FREEZE_REASONS.includes(reason))).toBe(true);
  });
});

describe('chart and percent formats', () => {
  it('formats percents and chart ticks in the page locale', () => {
    expect(formatPercent(12.5)).toBe('12.5%');
    expect(formatHour(Date.parse('2026-10-21T16:00:00.000Z'))).toBe('4 PM');
    expect(formatDay(Date.parse('2026-10-21T16:00:00.000Z'))).toBe('Oct 21');
    setActiveLocale('es-MX');
    expect(formatPercent(12.5)).toMatch(/^12\.5\s?%$/);
  });
});
