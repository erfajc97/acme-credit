import type { AdminAuthorization, AdminPayout } from '@acme/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { setActiveLocale, t } from '@/app/i18n';
import {
  ACCOUNT_ID,
  adminAuthorizationFixture,
  adminPayoutFixture,
  dashboardFixture,
  page,
} from '@/test/fixtures';
import { apiError, core, json, server, signedIn } from '@/test/server';
import Dashboard from '../Dashboard';
import { TREND_MAX_BUCKETS } from '../data';
import {
  alertItems,
  expiringHolds,
  purchaseTrend,
  sampleCount,
  trendChartView,
} from '../helpers/dashboardSamples';
import { ALERTS_PER_KIND } from '../data';
import { toDashboardView } from '../helpers/dashboardView';

// These specs pin the English copy and US formats; Purchases.spec covers the es-MX default.
beforeEach(() => setActiveLocale('en-US'));

const user = userEvent.setup();
const HOUR = 60 * 60 * 1000;
const inHours = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

type Page<T> = ReturnType<typeof page<T>>;

interface Lists {
  purchases?: () => Response;
  holds?: () => Response;
  pending?: () => Response;
  failed?: () => Response;
}

/**
 * The dashboard's reads: the figures, and the newest page of purchases (all, or live holds) and
 * of payouts (pending, failed). Each list answers empty unless the test says otherwise.
 */
function dashboardApi(lists: Lists = {}, figures: () => Response = () => json(dashboardFixture())) {
  const seen: string[] = [];
  const empty = () => json(page([]));
  server.use(
    signedIn,
    http.get(core('/admin/dashboard'), figures),
    http.get(core('/admin/authorizations'), ({ request }) => {
      const query = new URL(request.url).searchParams;
      seen.push(`authorizations?${query.toString()}`);
      return (query.get('status') === 'APPROVED' ? lists.holds : lists.purchases)?.() ?? empty();
    }),
    http.get(core('/admin/payouts'), ({ request }) => {
      const query = new URL(request.url).searchParams;
      seen.push(`payouts?${query.toString()}`);
      return (query.get('status') === 'FAILED' ? lists.failed : lists.pending)?.() ?? empty();
    }),
  );
  return seen;
}

const answer =
  <T,>(body: Page<T>) =>
  () =>
    json(body);

describe('Dashboard KPIs', () => {
  it('reads the figures and the newest page (10 rows) of each side list, once', async () => {
    const seen = dashboardApi();
    render(<Dashboard locale="en-US" />);
    expect(
      await screen.findByRole('region', { name: t('dashboard.kpi.activeAccounts') }),
    ).toBeInTheDocument();
    await vi.waitFor(() =>
      expect([...seen].sort()).toEqual([
        'authorizations?page=1&pageSize=10',
        'authorizations?status=APPROVED&page=1&pageSize=10',
        'payouts?status=FAILED&page=1&pageSize=10',
        'payouts?status=PENDING&page=1&pageSize=10',
      ]),
    );
  });

  it('shows active accounts, collateral, credit in use and the last 24 h, every number labeled', async () => {
    dashboardApi();
    render(<Dashboard locale="en-US" />);
    const active = await screen.findByRole('region', { name: t('dashboard.kpi.activeAccounts') });
    expect(active).toHaveTextContent('1,204');
    expect(active).toHaveTextContent(
      t('dashboard.kpi.activeDetail', { frozen: '7', total: '1,255' }),
    );
    expect(
      within(active).getByRole('link', { name: t('dashboard.kpi.viewActive') }),
    ).toHaveAttribute('href', '/en/accounts?status=ACTIVE');
    const collateral = screen.getByRole('region', { name: t('dashboard.kpi.collateral') });
    expect(collateral).toHaveTextContent('$612,500.00');
    expect(collateral).toHaveTextContent(
      t('dashboard.kpi.collateralDetail', { limit: '$601,250.50' }),
    );
    // Held 4,321.75 + owed 19,880.33 = 24,202.08 of 601,250.50 → 4.02 % (one decimal at most).
    const used = screen.getByRole('region', { name: t('dashboard.kpi.creditUsed') });
    expect(used).toHaveTextContent('4%');
    expect(used).toHaveTextContent(
      t('dashboard.kpi.creditUsedDetail', { used: '$24,202.08', limit: '$601,250.50' }),
    );
    const purchases = screen.getByRole('region', { name: t('dashboard.kpi.purchases24h') });
    expect(purchases).toHaveTextContent(`${t('dashboard.approved')}318`);
    expect(purchases).toHaveTextContent(`${t('dashboard.declined')}26`);
    // 26 of 344 decisions → 7.56 % → "7.6%".
    expect(purchases).toHaveTextContent(t('dashboard.kpi.declineRate', { rate: '7.6%' }));
  });

  it('counts holds expiring within 24 h with the money they free, and payouts pending and failed', async () => {
    dashboardApi({
      holds: answer(
        page([
          adminAuthorizationFixture({
            id: '0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c01',
            amountCents: '1250',
            expiresAt: inHours(2),
          }),
          adminAuthorizationFixture({
            id: '0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c02',
            amountCents: '777',
            expiresAt: inHours(23),
          }),
          adminAuthorizationFixture({
            id: '0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c03',
            amountCents: '5000',
            expiresAt: inHours(72),
          }),
        ]),
      ),
      pending: answer(
        page([adminPayoutFixture({ status: 'PENDING', failedAt: null })], { total: 14 }),
      ),
      failed: answer(page([adminPayoutFixture()])),
    });
    render(<Dashboard locale="en-US" />);
    const holds = await screen.findByRole('region', { name: t('dashboard.kpi.holdsExpiring') });
    await within(holds).findByText(t('dashboard.kpi.holdsDetail', { amount: '$20.27' }));
    expect(within(holds).getByText('2')).toBeInTheDocument();
    expect(within(holds).getByRole('link', { name: t('dashboard.kpi.viewHolds') })).toHaveAttribute(
      'href',
      '/en/purchases?status=APPROVED',
    );
    const payouts = screen.getByRole('region', { name: t('dashboard.kpi.payouts') });
    // A sample whose list goes on is said as "1+": never read as the total.
    expect(payouts).toHaveTextContent(`${t('status.payout.PENDING')}1+`);
    expect(payouts).toHaveTextContent(`${t('status.payout.FAILED')}1`);
    expect(
      within(payouts).getByRole('link', { name: t('dashboard.kpi.viewPayouts') }),
    ).toHaveAttribute('href', '/en/payouts?status=FAILED');
  });

  it('a side list that fails says so in its card with a retry; the figures stay', async () => {
    let fail = true;
    dashboardApi({ failed: () => (fail ? apiError(500, 'common.internal') : json(page([]))) });
    render(<Dashboard locale="en-US" />);
    const payouts = await screen.findByRole('region', { name: t('dashboard.kpi.payouts') });
    const alert = await within(payouts).findByRole('alert', {}, { timeout: 4000 });
    expect(alert).toHaveTextContent(t('dashboard.kpi.failed'));
    expect(screen.getByRole('region', { name: t('dashboard.kpi.collateral') })).toHaveTextContent(
      '$612,500.00',
    );
    fail = false;
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(await within(payouts).findByText(t('dashboard.kpi.payoutsDetail'))).toBeInTheDocument();
    // With nothing failed, the card opens the payouts still on their way.
    expect(
      within(payouts).getByRole('link', { name: t('dashboard.kpi.viewPayouts') }),
    ).toHaveAttribute('href', '/en/payouts?status=PENDING');
  });
});

describe('Dashboard alerts', () => {
  it('lists failed payouts first, then holds about to expire, each a link to its account', async () => {
    dashboardApi({
      holds: answer(
        page([
          adminAuthorizationFixture({
            merchantName: 'City Fuel',
            amountCents: '4410',
            expiresAt: inHours(3),
          }),
        ]),
      ),
      failed: answer(page([adminPayoutFixture()])),
    });
    render(<Dashboard locale="en-US" />);
    const panel = await screen.findByRole('region', { name: t('dashboard.alerts.title') });
    const items = within(
      await within(panel).findByRole('list', { name: t('dashboard.alerts.title') }),
    ).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(t('dashboard.alerts.payoutFailed'));
    expect(items[0]).toHaveTextContent('Ada Lovelace');
    expect(items[0]).toHaveTextContent('$380.00');
    expect(items[0]).toHaveTextContent('provider_rejected');
    expect(items[1]).toHaveTextContent(t('dashboard.alerts.holdExpiring'));
    expect(items[1]).toHaveTextContent('City Fuel');
    expect(items[1]).toHaveTextContent('$44.10');
    expect(within(items[0] as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      expect.stringContaining('/en/accounts/view?id='),
    );
  });

  it('says all is clear when nothing needs a person, and offers a retry when it cannot check', async () => {
    let fail = true;
    dashboardApi({ holds: () => (fail ? apiError(500, 'common.internal') : json(page([]))) });
    render(<Dashboard locale="en-US" />);
    const panel = await screen.findByRole('region', { name: t('dashboard.alerts.title') });
    const alert = await within(panel).findByRole('alert', {}, { timeout: 4000 });
    expect(alert).toHaveTextContent(t('dashboard.alerts.failed'));
    fail = false;
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(await within(panel).findByText(t('dashboard.alerts.none'))).toBeInTheDocument();
  });
});

describe('Dashboard purchase trend and recent purchases', () => {
  const purchasesAt = (total: number) =>
    answer(
      page(
        [
          adminAuthorizationFixture({
            id: 'b1000000-0000-4000-8000-000000000001',
            createdAt: '2026-10-21T15:40:00.000Z',
            status: 'CAPTURED',
          }),
          adminAuthorizationFixture({
            id: 'b1000000-0000-4000-8000-000000000002',
            createdAt: '2026-10-21T15:05:00.000Z',
            status: 'DECLINED',
            declineReason: 'insufficient_funds',
            customer: null,
          }),
          adminAuthorizationFixture({
            id: 'b1000000-0000-4000-8000-000000000003',
            createdAt: '2026-10-21T13:10:00.000Z',
          }),
        ],
        { total },
      ),
    );

  it('draws purchases per hour with its totals in words, and says when it is only the latest page', async () => {
    dashboardApi({ purchases: purchasesAt(24) });
    render(<Dashboard locale="en-US" />);
    const panel = await screen.findByRole('region', { name: t('dashboard.trend.title') });
    const chart = await within(panel).findByRole('img');
    expect(chart).toHaveAccessibleName(
      t('dashboard.trend.summary.hour', { from: '1 PM', to: '3 PM', approved: '2', declined: '1' }),
    );
    expect(panel).toHaveTextContent(t('dashboard.trend.captionLatest.hour', { count: '3' }));
    expect(panel).toHaveTextContent(t('dashboard.trend.approvedTotal', { count: '2' }));
    expect(panel).toHaveTextContent(t('dashboard.trend.declinedTotal', { count: '1' }));
  });

  it('the recent table shows who, where, status in words and amount, and links to all purchases', async () => {
    dashboardApi({ purchases: purchasesAt(3) });
    render(<Dashboard locale="en-US" />);
    const panel = await screen.findByRole('region', { name: t('dashboard.recentPurchasesTitle') });
    const rows = within(await within(panel).findByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('Taquería El Sol');
    expect(rows[1]).toHaveTextContent('Ada Lovelace');
    expect(rows[1]).toHaveTextContent('$93.74');
    expect(rows[1]).toHaveTextContent(t('status.authorization.CAPTURED'));
    expect(rows[2]).toHaveTextContent(t('purchases.noCustomer'));
    expect(rows[2]).toHaveTextContent(t('status.authorization.DECLINED'));
    expect(
      within(panel).getByRole('link', { name: t('dashboard.viewAllPurchases') }),
    ).toHaveAttribute('href', '/en/purchases');
    expect(screen.getByRole('region', { name: t('dashboard.trend.title') })).toHaveTextContent(
      t('dashboard.trend.captionAll.hour'),
    );
  });

  it('teaches what will appear when there are no purchases, and retries when they cannot be loaded', async () => {
    let fail = true;
    dashboardApi({ purchases: () => (fail ? apiError(500, 'common.internal') : json(page([]))) });
    render(<Dashboard locale="en-US" />);
    const panel = await screen.findByRole('region', { name: t('dashboard.recentPurchasesTitle') });
    const alert = await within(panel).findByRole('alert', {}, { timeout: 4000 });
    expect(alert).toHaveTextContent(t('dashboard.recentPurchasesFailed'));
    fail = false;
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(await within(panel).findByText(t('dashboard.recentPurchasesEmpty'))).toBeInTheDocument();
    expect(screen.getByText(t('dashboard.trend.emptyTitle'))).toBeInTheDocument();
    // The dashboard's own figures were never hidden by the panel's failure.
    expect(
      screen.getByRole('region', { name: t('dashboard.kpi.activeAccounts') }),
    ).toBeInTheDocument();
  });
});

describe('Dashboard figures', () => {
  it('a balanced ledger shows no banner (owner decision): the figures speak for themselves', async () => {
    dashboardApi();
    render(<Dashboard locale="en-US" />);
    await screen.findByRole('region', { name: t('dashboard.kpi.activeAccounts') });
    expect(screen.queryByText(t('dashboard.ledgerBalancedTitle'))).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t('dashboard.openLedger') })).not.toBeInTheDocument();
  });

  it('reconciled balances are one calm line: accounts checked and zero differences', async () => {
    dashboardApi();
    render(<Dashboard locale="en-US" />);
    expect(
      await screen.findByText(
        t('dashboard.reconciliation.clean', { checked: '1,255', mismatches: '0' }),
      ),
    ).toHaveAttribute('role', 'status');
  });

  it('one mismatched account is already not clean (the boundary next to zero)', () => {
    const reconciliation = (mismatches: number) =>
      toDashboardView(
        dashboardFixture({
          reconciliation: {
            accountsChecked: 3,
            mismatches,
            mismatchedAccountIds: mismatches ? [ACCOUNT_ID] : [],
          },
        }),
      ).reconciliation.isClean;
    expect(reconciliation(0)).toBe(true);
    expect(reconciliation(1)).toBe(false);
  });

  it('mismatched balances raise an alert linking each account to check', async () => {
    const other = '6a4f3e2d-5c6b-4a79-9887-b6c5d4e3f2a1';
    dashboardApi({}, () =>
      json(
        dashboardFixture({
          reconciliation: {
            accountsChecked: 1255,
            mismatches: 2,
            mismatchedAccountIds: [ACCOUNT_ID, other],
          },
        }),
      ),
    );
    render(<Dashboard locale="en-US" />);
    const alert = await screen.findByRole('alert', {
      name: t('dashboard.reconciliation.mismatchTitle'),
    });
    expect(alert).toHaveTextContent(
      t('dashboard.reconciliation.mismatchBody', { checked: '1,255', mismatches: '2' }),
    );
    expect(
      within(alert)
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      [
        t('dashboard.reconciliation.account', { id: '5f3e2d1c' }),
        `/en/accounts/view?id=${ACCOUNT_ID}`,
      ],
      [t('dashboard.reconciliation.account', { id: '6a4f3e2d' }), `/en/accounts/view?id=${other}`],
    ]);
    expect(screen.queryByText(/Balances reconciled/)).not.toBeInTheDocument();
  });

  it('raises an alert when the trial balance is not zero (the money safety signal)', async () => {
    dashboardApi({}, () => json(dashboardFixture({ ledgerTrialBalanceCents: '-125' })));
    render(<Dashboard locale="en-US" />);
    const signal = await screen.findByRole('alert', { name: t('dashboard.ledgerUnbalancedTitle') });
    expect(signal).toHaveTextContent(t('dashboard.ledgerUnbalancedBody', { amount: '-$1.25' }));
    expect(screen.queryByText(t('dashboard.ledgerBalancedTitle'))).not.toBeInTheDocument();
  });

  it('counts accounts by status with words, each a link to the filtered list', async () => {
    dashboardApi();
    render(<Dashboard locale="en-US" />);
    const frozen = await screen.findByRole('link', {
      name: t('dashboard.viewAccounts', { status: t('status.account.FROZEN') }),
    });
    expect(frozen).toHaveAttribute('href', '/en/accounts?status=FROZEN');
    expect(frozen).toHaveTextContent('7');
    expect(screen.getByText(t('dashboard.accountsTotal', { count: '1,255' }))).toBeInTheDocument();
  });

  it('shows an error with retry, then the figures', async () => {
    let fail = true;
    dashboardApi({}, () => (fail ? apiError(503, 'common.internal') : json(dashboardFixture())));
    render(<Dashboard locale="en-US" />);
    const alert = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(alert).toHaveTextContent(t('dashboard.loadFailedTitle'));
    fail = false;
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(
      await screen.findByRole('region', { name: t('dashboard.kpi.activeAccounts') }),
    ).toBeInTheDocument();
  });

  it('refresh re-reads everything; a failed refresh keeps the figures and says they may be stale', async () => {
    let calls = 0;
    const seen = dashboardApi({}, () => {
      calls += 1;
      return calls === 1 ? json(dashboardFixture()) : apiError(403, 'common.forbidden');
    });
    render(<Dashboard locale="en-US" />);
    await screen.findByText(t('dashboard.alerts.none'));
    await user.click(await screen.findByRole('button', { name: t('dashboard.refresh') }));
    expect(await screen.findByText(t('dashboard.refreshFailedTitle'))).toBeInTheDocument();
    expect(
      screen.getByRole('region', { name: t('dashboard.kpi.activeAccounts') }),
    ).toBeInTheDocument();
    expect(calls).toBe(2);
    await vi.waitFor(() => expect(seen).toHaveLength(8));
  });

  it('keeps the skeleton while the session is checked', () => {
    server.use(http.post(core('/auth/refresh'), () => new Promise<Response>(() => undefined)));
    render(<Dashboard locale="en-US" />);
    expect(screen.getByRole('status')).toHaveTextContent(t('dashboard.loading'));
  });
});

describe('toDashboardView', () => {
  it('says so when there are no accounts yet, counts a missing status as zero and has no rate without purchases', () => {
    const view = toDashboardView(
      dashboardFixture({
        accountsByStatus: { ACTIVE: 0 } as ReturnType<typeof dashboardFixture>['accountsByStatus'],
        authorizationsLast24h: { approved: 0, declined: 0 },
        creditLimitCents: '0',
      }),
    );
    expect(view.hasAccounts).toBe(false);
    expect(view.statuses.map((row) => row.count)).toEqual(['0', '0', '0', '0']);
    expect(view.purchases24h.declineRate).toBeNull();
    expect(view.creditUsed.percent).toBe(0);
  });

  it('one account and one purchase are enough to speak of them', () => {
    const view = toDashboardView(
      dashboardFixture({
        accountsByStatus: { PENDING_COLLATERAL: 1, ACTIVE: 0, FROZEN: 0, CLOSED: 0 },
        authorizationsLast24h: { approved: 0, declined: 1 },
      }),
    );
    expect(view.hasAccounts).toBe(true);
    expect(view.purchases24h.declineRate).toBe('100%');
  });
});

describe('purchase trend (from the newest page)', () => {
  const at = (createdAt: string, status: AdminAuthorization['status'] = 'APPROVED') => ({
    createdAt,
    status,
  });

  it('buckets by hour within a day, with empty hours between purchases drawn as empty bars', () => {
    const trend = purchaseTrend([
      at('2026-10-21T15:59:59.999Z', 'DECLINED'),
      at('2026-10-21T15:00:00.000Z'),
      at('2026-10-21T12:30:00.000Z', 'CAPTURED'),
    ]);
    expect(trend.unit).toBe('hour');
    expect(trend.count).toBe(3);
    expect(trend.buckets.map((bucket) => [bucket.label, bucket.approved, bucket.declined])).toEqual(
      [
        ['12 PM', 1, 0],
        ['1 PM', 0, 0],
        ['2 PM', 0, 0],
        ['3 PM', 1, 1],
      ],
    );
  });

  it('a span of exactly 24 h stays hourly; one millisecond more goes per day', () => {
    const start = Date.parse('2026-10-20T10:00:00.000Z');
    const hourly = purchaseTrend([
      at(new Date(start + 24 * HOUR).toISOString()),
      at(new Date(start).toISOString()),
    ]);
    expect(hourly.unit).toBe('hour');
    expect(hourly.buckets).toHaveLength(TREND_MAX_BUCKETS);
    expect(hourly.count).toBe(1);
    const daily = purchaseTrend([
      at(new Date(start + 24 * HOUR + 1).toISOString()),
      at(new Date(start).toISOString()),
    ]);
    expect(daily.unit).toBe('day');
    expect(daily.buckets.map((bucket) => bucket.label)).toEqual(['Oct 20', 'Oct 21']);
    expect(daily.count).toBe(2);
  });

  it('keeps the newest buckets when the page spans more days than the chart has bars', () => {
    const purchases = Array.from({ length: 30 }, (_, day) =>
      at(new Date(Date.parse('2026-09-01T12:00:00.000Z') + day * 24 * HOUR).toISOString()),
    );
    const trend = purchaseTrend(purchases);
    expect(trend.buckets).toHaveLength(TREND_MAX_BUCKETS);
    expect(trend.buckets.at(-1)?.label).toBe('Sep 30');
    expect(trend.count).toBe(TREND_MAX_BUCKETS);
  });

  it('nothing to draw without purchases; the chart words name totals, scale and every bar', () => {
    expect(purchaseTrend([])).toEqual({ unit: 'hour', buckets: [], count: 0 });
    expect(trendChartView(purchaseTrend([]))).toBeNull();
    const chart = trendChartView(
      purchaseTrend([
        at('2026-10-21T15:10:00.000Z', 'DECLINED'),
        at('2026-10-21T15:00:00.000Z'),
        at('2026-10-21T14:00:00.000Z'),
      ]),
    );
    expect(chart?.maxLabel).toBe(t('dashboard.trend.max', { count: '2' }));
    expect(chart?.bars.map((bar) => bar.title)).toEqual([
      t('dashboard.trend.bar', { label: '2 PM', approved: '1', declined: '0' }),
      t('dashboard.trend.bar', { label: '3 PM', approved: '1', declined: '1' }),
    ]);
  });

  it('a sample says "N+" only when its list has more pages', () => {
    const payouts: Page<AdminPayout> = page([adminPayoutFixture()]);
    expect(sampleCount(payouts)).toBe('1');
    expect(sampleCount({ ...payouts, totalPages: 2 })).toBe('1+');
    expect(sampleCount({ ...payouts, totalPages: 2 }, 0)).toBe('0+');
  });
});

describe('alert items', () => {
  it('caps each kind, sorts holds soonest first, and copes with what the API leaves empty', () => {
    const now = Date.parse('2026-10-21T12:00:00.000Z');
    const hold = (id: string, hours: number) =>
      adminAuthorizationFixture({
        id,
        customer: null,
        accountId: null,
        expiresAt: new Date(now + hours * HOUR).toISOString(),
      });
    const expiring = expiringHolds(
      [hold('h3', 20), hold('h1', 1), hold('h-late', 25), hold('h2', 5), hold('h4', 23)],
      now,
    );
    expect(expiring.map((item) => item.id)).toEqual(['h1', 'h2', 'h3', 'h4']);
    const failed = [1, 2, 3, 4].map((n) =>
      adminPayoutFixture({ id: `p${n}`, failedAt: null, lastError: null }),
    );
    const items = alertItems(failed, expiring);
    expect(items.map((item) => item.id)).toEqual(['p1', 'p2', 'p3', 'h1', 'h2', 'h3']);
    expect(items).toHaveLength(ALERTS_PER_KIND * 2);
    expect(items[0]).toMatchObject({ kind: 'payoutFailed', at: null, detail: null });
    expect(items[3]).toMatchObject({
      kind: 'holdExpiring',
      name: null,
      href: null,
      at: 'Oct 21, 2026, 1:00 PM',
    });
  });
});
