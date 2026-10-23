import type { AdminAccount, AdminAccountAction, AdminAccountDetail } from '@acme/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { rememberListQuery } from '@/app/helpers/listMemory';
import { ACCOUNTS_LIST } from '@/app/helpers/listQuery';
import { setActiveLocale, t } from '@/app/i18n';
import { queryClient } from '@/app/lib/queryClient';
import {
  ACCOUNTS_KEY,
  AUDIT_LOG_KEY,
  AUTHORIZATIONS_KEY,
  DASHBOARD_KEY,
  JOURNAL_KEY,
  PURCHASES_KEY,
} from '@/app/tanstack-queries/adminQueries';
import {
  ACCOUNT_ID,
  adminAccountDetailFixture,
  adminPayoutFixture,
  auditEntryFixture,
  authorizationFixture,
  journalEntryFixture,
  page,
  STORE_ITEMS,
} from '@/test/fixtures';
import { apiError, core, json, server, signedIn } from '@/test/server';
import AccountDetail from '../AccountDetail';
import { actionAvailability, closePreview } from '../helpers/accountActions';

// These specs pin the English copy and US formats; Purchases.spec covers the es-MX default.
beforeEach(() => setActiveLocale('en-US'));

const user = userEvent.setup();
const BASE = `/admin/accounts/${ACCOUNT_ID}`;

/** What the API answers to an admin action (A5): the account, its card masked (never the token). */
function actionAnswer(account: AdminAccount): AdminAccountAction {
  return {
    id: account.id,
    status: account.status,
    currency: account.currency,
    collateralCents: account.collateralCents,
    creditLimitCents: account.creditLimitCents,
    heldCents: account.heldCents,
    postedDebtCents: account.postedDebtCents,
    availableCents: account.availableCents,
    card: { last4: account.cardLast4 ?? '4242', expiresMonth: '08/29' },
    frozenBy: account.status === 'FROZEN' ? 'ADMIN' : null,
    openedAt: account.openedAt,
    activatedAt: account.activatedAt,
    closedAt: account.closedAt,
  };
}

/** The account and its three histories, answered from the given account state. */
function accountApi(current: () => AdminAccountDetail) {
  server.use(
    signedIn,
    http.get(core(BASE), () => json(current())),
    http.get(core(`${BASE}/authorizations`), () =>
      json(
        page([
          authorizationFixture(),
          authorizationFixture({
            id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
            status: 'DECLINED',
            declineReason: 'insufficient_funds',
            amountCents: '84020',
          }),
        ]),
      ),
    ),
    http.get(core(`${BASE}/ledger`), () => json(page([journalEntryFixture()]))),
    http.get(core('/admin/audit-log'), () => json(page([auditEntryFixture()]))),
  );
}

function openAccountPage(id = ACCOUNT_ID) {
  window.history.replaceState(null, '', `/en/accounts/view?id=${id}`);
  render(<AccountDetail locale="en-US" />);
}

describe('AccountDetail island', () => {
  it('asks for the account and its three histories at once (no waterfall behind the account read)', async () => {
    let releaseAccount: () => void = () => undefined;
    const accountReady = new Promise<void>((resolve) => (releaseAccount = resolve));
    const started: string[] = [];
    accountApi(() => adminAccountDetailFixture());
    server.use(
      http.get(core(BASE), async () => {
        started.push('account');
        await accountReady;
        return json(adminAccountDetailFixture());
      }),
      http.get(core(`${BASE}/authorizations`), () => {
        started.push('authorizations');
        return json(page([authorizationFixture()]));
      }),
      http.get(core(`${BASE}/ledger`), () => {
        started.push('ledger');
        return json(page([journalEntryFixture()]));
      }),
      http.get(core('/admin/audit-log'), ({ request }) => {
        started.push(`audit:${new URL(request.url).searchParams.get('entityId')}`);
        return json(page([auditEntryFixture()]));
      }),
    );
    openAccountPage();
    // The histories were requested while the account itself is still on its way.
    await vi.waitFor(() =>
      expect([...started].sort()).toEqual([
        'account',
        `audit:${ACCOUNT_ID}`,
        'authorizations',
        'ledger',
      ]),
    );
    expect(screen.queryByRole('heading', { name: 'Ada Lovelace' })).not.toBeInTheDocument();
    releaseAccount();
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(await screen.findByText(t('journal.kind.purchase_capture'))).toBeInTheDocument();
    expect(started).toHaveLength(4);
  });

  it('an id that is not a valid account id reads nothing at all', async () => {
    const started: string[] = [];
    server.use(
      signedIn,
      http.get(core('/admin/*'), ({ request }) => {
        started.push(new URL(request.url).pathname);
        return json(page([]));
      }),
    );
    openAccountPage('not-a-uuid');
    expect(await screen.findByText(t('accountDetail.notFoundTitle'))).toBeInTheDocument();
    expect(started).toEqual([]);
  });

  it('shows the customer, status, every balance and the three histories', async () => {
    accountApi(() => adminAccountDetailFixture());
    openAccountPage();
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('•••• 4242', { exact: false })).toBeInTheDocument();
    const balances = screen.getByRole('region', { name: t('accountDetail.balancesTitle') });
    expect(balances).toHaveTextContent(`${t('accountDetail.collateral')}$500.00`);
    expect(balances).toHaveTextContent(`${t('accountDetail.held')}$40.00`);
    expect(balances).toHaveTextContent(`${t('accountDetail.owed')}$120.00`);
    expect(balances).toHaveTextContent(`${t('accountDetail.available')}$340.00`);

    const authorizations = screen.getByRole('region', {
      name: t('accountDetail.authorizations.title'),
    });
    const declined = within(await within(authorizations).findByRole('table')).getAllByRole(
      'row',
    )[2] as HTMLElement;
    expect(declined).toHaveTextContent(t('status.authorization.DECLINED'));
    expect(declined).toHaveTextContent(t('declineReason.insufficient_funds'));
    expect(declined).toHaveTextContent('$840.20');

    const journal = screen.getByRole('region', { name: t('accountDetail.journal.title') });
    const postings = await within(journal).findByRole('table');
    expect(within(postings).getAllByRole('row')[1]).toHaveTextContent(
      `${t('journal.ledgerAccount.receivable')}receivable:${ACCOUNT_ID}$12.50`,
    );
    expect(within(journal).getByText(t('journal.balanced'))).toBeInTheDocument();

    const audit = screen.getByRole('region', { name: t('accountDetail.audit.title') });
    expect(await within(audit).findByRole('table')).toHaveTextContent('req-7f3a');
  });

  it('a store purchase unfolds its order lines: qty × name @ unit and the subtotal', async () => {
    accountApi(() => adminAccountDetailFixture());
    server.use(
      http.get(core(`${BASE}/authorizations`), () =>
        json(
          page([
            authorizationFixture({
              merchantName: 'Taquería El Sol',
              amountCents: '9374',
              items: STORE_ITEMS,
            }),
          ]),
        ),
      ),
    );
    openAccountPage();
    const authorizations = await screen.findByRole('region', {
      name: t('accountDetail.authorizations.title'),
    });
    const row = within(await within(authorizations).findByRole('table')).getAllByRole(
      'row',
    )[1] as HTMLElement;
    await user.click(within(row).getByText(t('orders.showItems', { count: 3 })));
    const items = within(row).getByRole('list', {
      name: t('orders.itemsCaption', { merchant: 'Taquería El Sol' }),
    });
    expect(within(items).getAllByRole('listitem')[1]).toHaveTextContent(
      '3 × Concha@ $12.25 each$36.75',
    );
  });

  it('freezes with an idempotency key, toasts with the customer name, refreshes the views and closes the dialog', async () => {
    let account = adminAccountDetailFixture();
    let key: string | null = null;
    accountApi(() => account);
    server.use(
      http.post(core(`${BASE}/freeze`), ({ request }) => {
        key = request.headers.get('idempotency-key');
        account = adminAccountDetailFixture({ status: 'FROZEN' });
        return json(actionAnswer(account));
      }),
    );
    queryClient.setQueryData([DASHBOARD_KEY], { stale: false });
    // The accounts list as its screen caches it: one entry per filter (status, q) and page.
    queryClient.setQueryData([ACCOUNTS_KEY, null, null, 1], page([]));
    openAccountPage();
    await user.click(await screen.findByRole('button', { name: t('accountDetail.freeze.action') }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(
      t('accountDetail.freeze.body', { name: 'Ada Lovelace', held: '$40.00', owed: '$120.00' }),
    );
    await user.click(
      within(dialog).getByRole('button', { name: t('accountDetail.freeze.action') }),
    );
    expect(
      await screen.findByText(t('accountDetail.freeze.done', { name: 'Ada Lovelace' })),
    ).toBeInTheDocument();
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(
      await screen.findByRole('button', { name: t('accountDetail.unfreeze.action') }),
    ).toBeInTheDocument();
    expect(queryClient.getQueryState([DASHBOARD_KEY])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState([ACCOUNTS_KEY, null, null, 1])?.isInvalidated).toBe(true);
    // The key was released after the definitive answer: nothing lingers for the next intent.
    expect(window.sessionStorage.length).toBe(0);
  });

  it('closes an account with debt: the dialog names what is applied and returned; the journal is refreshed', async () => {
    accountApi(() => adminAccountDetailFixture({ heldCents: '0', availableCents: '38000' }));
    server.use(
      http.post(core(`${BASE}/close`), () => {
        return json({
          account: actionAnswer(adminAccountDetailFixture({ status: 'CLOSED' })),
          settlement: {
            collateralCents: '50000',
            appliedToDebtCents: '12000',
            releasedCents: '38000',
          },
        });
      }),
    );
    queryClient.setQueryData([JOURNAL_KEY, null, null, 1], page([]));
    queryClient.setQueryData([AUDIT_LOG_KEY, null, null, 1], page([]));
    openAccountPage();
    await user.click(await screen.findByRole('button', { name: t('accountDetail.close.action') }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(
      t('accountDetail.close.bodyWithDebt', {
        collateral: '$500.00',
        owed: '$120.00',
        released: '$380.00',
        name: 'Ada Lovelace',
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: t('accountDetail.close.action') }));
    expect(
      await screen.findByText(
        t('accountDetail.close.done', { released: '$380.00', name: 'Ada Lovelace' }),
      ),
    ).toBeInTheDocument();
    expect(queryClient.getQueryState([JOURNAL_KEY, null, null, 1])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState([AUDIT_LOG_KEY, null, null, 1])?.isInvalidated).toBe(true);
  });

  it.each([
    ['freeze', 'account.not_active', adminAccountDetailFixture()],
    ['unfreeze', 'account.not_frozen', adminAccountDetailFixture({ status: 'FROZEN' })],
    ['close', 'account.pending_holds', adminAccountDetailFixture({ heldCents: '0' })],
    ['close', 'account.closed', adminAccountDetailFixture({ heldCents: '0' })],
  ] as const)(
    'a refused %s (%s) explains the code and keeps the dialog open',
    async (action, code, account) => {
      accountApi(() => account);
      server.use(http.post(core(`${BASE}/${action}`), () => apiError(409, code)));
      openAccountPage();
      await user.click(
        await screen.findByRole('button', { name: t(`accountDetail.${action}.action`) }),
      );
      const dialog = await screen.findByRole('dialog');
      await user.click(
        within(dialog).getByRole('button', { name: t(`accountDetail.${action}.action`) }),
      );
      expect(await screen.findByText(t(`errors.${code}`))).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    },
  );

  it('without an answer the key is kept for the retry, and the fallback copy is shown', async () => {
    accountApi(() => adminAccountDetailFixture());
    const keys: (string | null)[] = [];
    server.use(
      http.post(core(`${BASE}/freeze`), ({ request }) => {
        keys.push(request.headers.get('idempotency-key'));
        return new Response('bad gateway', { status: 502 });
      }),
    );
    openAccountPage();
    await user.click(await screen.findByRole('button', { name: t('accountDetail.freeze.action') }));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: t('accountDetail.freeze.action') });
    await user.click(confirm);
    expect(await screen.findByText(t('accountDetail.freeze.failed'))).toBeInTheDocument();
    await vi.waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);
    await vi.waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[1]).toBe(keys[0]);
  });

  it('blocks close while purchases are on hold and says why next to it', async () => {
    accountApi(() => adminAccountDetailFixture());
    openAccountPage();
    expect(
      await screen.findByRole('button', { name: t('accountDetail.close.action') }),
    ).toBeDisabled();
    expect(
      screen.getByText(t('accountDetail.closeBlocked', { amount: '$40.00' })),
    ).toBeInTheDocument();
  });

  it('a closed account offers no actions', async () => {
    accountApi(() =>
      adminAccountDetailFixture({ status: 'CLOSED', closedAt: '2026-10-20T09:00:00.000Z' }),
    );
    openAccountPage();
    expect(await screen.findByText(t('accountDetail.actionsClosed'))).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t('accountDetail.close.action') }),
    ).not.toBeInTheDocument();
  });

  it('an unknown account is "not found" with the way back to the filtered list (W17)', async () => {
    rememberListQuery(ACCOUNTS_LIST, { pathname: '/en/accounts', search: '?status=FROZEN' });
    server.use(
      signedIn,
      http.get(core(BASE), () => apiError(404, 'common.not_found')),
    );
    openAccountPage();
    expect(await screen.findByText(t('accountDetail.notFoundTitle'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('common.backToAccounts') })).toHaveAttribute(
      'href',
      '/en/accounts?status=FROZEN',
    );
  });

  it('a malformed id is "not found" without calling the API', async () => {
    server.use(signedIn);
    openAccountPage('not-a-uuid');
    expect(await screen.findByText(t('accountDetail.notFoundTitle'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('common.backToAccounts') })).toHaveAttribute(
      'href',
      '/en/accounts',
    );
  });

  it('shows an error with retry when the account cannot be loaded', async () => {
    let fail = true;
    accountApi(() => adminAccountDetailFixture());
    server.use(
      http.get(core(BASE), () =>
        fail ? apiError(403, 'common.forbidden') : json(adminAccountDetailFixture()),
      ),
    );
    openAccountPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t('accountDetail.loadFailedTitle'));
    fail = false;
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
  });

  it('empty histories teach what will appear there', async () => {
    server.use(
      signedIn,
      http.get(core(BASE), () => json(adminAccountDetailFixture({ status: 'PENDING_COLLATERAL' }))),
      http.get(core(`${BASE}/authorizations`), () => json(page([]))),
      http.get(core(`${BASE}/ledger`), () => json(page([]))),
      http.get(core('/admin/audit-log'), () => apiError(500, 'common.internal')),
    );
    openAccountPage();
    expect(
      await screen.findByText(t('accountDetail.authorizations.emptyTitle')),
    ).toBeInTheDocument();
    expect(await screen.findByText(t('accountDetail.journal.emptyTitle'))).toBeInTheDocument();
    expect(
      await screen.findByText(t('accountDetail.audit.loadFailedTitle'), {}, { timeout: 4000 }),
    ).toBeInTheDocument();
  });
});

describe('AccountDetail freeze reasons, payouts and holds', () => {
  const HOLD = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
  const releaseName = () =>
    t('releaseHold.actionFor', { amount: '$12.50', merchant: 'Corner Grocery' });

  it('freezes with the reason picked in the dialog (the default is a review)', async () => {
    let account = adminAccountDetailFixture();
    const bodies: unknown[] = [];
    accountApi(() => account);
    server.use(
      http.post(core(`${BASE}/freeze`), async ({ request }) => {
        bodies.push(await request.json());
        account = adminAccountDetailFixture({
          status: 'FROZEN',
          frozenBy: 'ADMIN',
          freezeReason: 'suspected_fraud',
        });
        return json(actionAnswer(account));
      }),
    );
    openAccountPage();
    await user.click(await screen.findByRole('button', { name: t('accountDetail.freeze.action') }));
    const dialog = await screen.findByRole('dialog');
    const reasons = within(dialog).getByRole('radiogroup', {
      name: t('accountDetail.freeze.reasonLabel'),
    });
    expect(within(reasons).getByRole('radio', { name: 'Operations review' })).toBeChecked();
    await user.click(within(reasons).getByRole('radio', { name: 'Suspected fraud' }));
    await user.click(
      within(dialog).getByRole('button', { name: t('accountDetail.freeze.action') }),
    );
    expect(
      await screen.findByText(t('accountDetail.freeze.done', { name: 'Ada Lovelace' })),
    ).toBeInTheDocument();
    expect(bodies).toEqual([{ reason: 'suspected_fraud' }]);
    // The header now says who froze it and why.
    const frozen = `${t('accountDetail.frozenBy', { actor: t('freezeActor.ADMIN') })} · ${t('accountDetail.frozenReason', { reason: t('freezeReason.suspected_fraud') })}`;
    expect(await screen.findByText(frozen)).toBeInTheDocument();
  });

  it('a freeze left at its default sends admin_review', async () => {
    const bodies: unknown[] = [];
    accountApi(() => adminAccountDetailFixture());
    server.use(
      http.post(core(`${BASE}/freeze`), async ({ request }) => {
        bodies.push(await request.json());
        return json(actionAnswer(adminAccountDetailFixture({ status: 'FROZEN' })));
      }),
    );
    openAccountPage();
    await user.click(await screen.findByRole('button', { name: t('accountDetail.freeze.action') }));
    const dialog = await screen.findByRole('dialog');
    await user.click(
      within(dialog).getByRole('button', { name: t('accountDetail.freeze.action') }),
    );
    await vi.waitFor(() => expect(bodies).toEqual([{ reason: 'admin_review' }]));
  });

  it('a card the customer froze offers "Freeze as admin", explained in the dialog', async () => {
    accountApi(() =>
      adminAccountDetailFixture({
        status: 'FROZEN',
        frozenBy: 'CUSTOMER',
        freezeReason: 'customer_request',
      }),
    );
    openAccountPage();
    const frozen = `${t('accountDetail.frozenBy', { actor: t('freezeActor.CUSTOMER') })} · ${t('accountDetail.frozenReason', { reason: t('freezeReason.customer_request') })}`;
    expect(await screen.findByText(frozen)).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: t('accountDetail.freeze.takeOverAction') }),
    );
    const dialog = await screen.findByRole('dialog', {
      name: t('accountDetail.freeze.takeOverTitle'),
    });
    expect(dialog).toHaveTextContent(
      t('accountDetail.freeze.takeOverBody', { name: 'Ada Lovelace' }),
    );
  });

  it('lists the account payouts with status, attempts, last error and provider reference', async () => {
    const { customer: _customer, ...payout } = adminPayoutFixture();
    accountApi(() =>
      adminAccountDetailFixture({
        status: 'CLOSED',
        closedAt: '2026-10-21T13:00:00.000Z',
        payouts: [payout],
      }),
    );
    openAccountPage();
    const panel = await screen.findByRole('region', { name: t('accountDetail.payouts.title') });
    const row = within(within(panel).getByRole('table')).getAllByRole('row')[1] as HTMLElement;
    expect(row).toHaveTextContent(t('payoutReason.collateral_release'));
    expect(row).toHaveTextContent(t('status.payout.FAILED'));
    expect(row).toHaveTextContent('provider_rejected');
    expect(row).toHaveTextContent('pay_7Hq2');
    expect(row).toHaveTextContent('$380.00');
    expect(within(row).getAllByRole('cell')[2]).toHaveTextContent('3');
  });

  it('without payouts it says when they will appear', async () => {
    accountApi(() => adminAccountDetailFixture());
    openAccountPage();
    const panel = await screen.findByRole('region', { name: t('accountDetail.payouts.title') });
    expect(panel).toHaveTextContent(t('accountDetail.payouts.emptyTitle'));
  });

  it('releases a live hold: the dialog names the money, the key goes along, every view of it refreshes', async () => {
    let key: string | null = null;
    accountApi(() => adminAccountDetailFixture());
    server.use(
      http.post(core(`/admin/authorizations/${HOLD}/release`), ({ request }) => {
        key = request.headers.get('idempotency-key');
        return json(authorizationFixture({ status: 'REVERSED', reversalReason: 'admin_release' }));
      }),
    );
    queryClient.setQueryData([PURCHASES_KEY, 'list', null, null, 1], page([]));
    queryClient.setQueryData([DASHBOARD_KEY], { stale: false });
    openAccountPage();
    const authorizations = await screen.findByRole('region', {
      name: t('accountDetail.authorizations.title'),
    });
    const row = within(await within(authorizations).findByRole('table')).getAllByRole(
      'row',
    )[1] as HTMLElement;
    await user.click(within(row).getByRole('button', { name: releaseName() }));
    const dialog = await screen.findByRole('dialog', { name: t('releaseHold.title') });
    expect(dialog).toHaveTextContent(
      t('releaseHold.body', { amount: '$12.50', merchant: 'Corner Grocery', name: 'Ada Lovelace' }),
    );
    await user.click(within(dialog).getByRole('button', { name: t('releaseHold.action') }));
    expect(
      await screen.findByText(
        t('releaseHold.done', { amount: '$12.50', merchant: 'Corner Grocery' }),
      ),
    ).toBeInTheDocument();
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(queryClient.getQueryState([PURCHASES_KEY, 'list', null, null, 1])?.isInvalidated).toBe(
      true,
    );
    expect(queryClient.getQueryState([DASHBOARD_KEY])?.isInvalidated).toBe(true);
    // The account's own holds and balances were read again (active queries refetch on invalidation).
    await vi.waitFor(() =>
      expect(
        queryClient.getQueryState([AUTHORIZATIONS_KEY, ACCOUNT_ID, null, 1])?.dataUpdateCount,
      ).toBe(2),
    );
    expect(window.sessionStorage.length).toBe(0);
  });

  it.each(['authorization.not_reversible', 'operation.in_progress'] as const)(
    'a refused release (%s) explains the code and keeps the dialog open',
    async (code) => {
      accountApi(() => adminAccountDetailFixture());
      server.use(
        http.post(core(`/admin/authorizations/${HOLD}/release`), () => apiError(409, code)),
      );
      openAccountPage();
      // The rows render as cards (phones) and as a table (desktop): either button opens the dialog.
      await user.click(
        (await screen.findAllByRole('button', { name: releaseName() }))[0] as HTMLElement,
      );
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByRole('button', { name: t('releaseHold.action') }));
      expect(await screen.findByText(t(`errors.${code}`))).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    },
  );

  it('without an answer the release keeps its key for the retry and shows the fallback copy', async () => {
    const keys: (string | null)[] = [];
    accountApi(() => adminAccountDetailFixture());
    server.use(
      http.post(core(`/admin/authorizations/${HOLD}/release`), ({ request }) => {
        keys.push(request.headers.get('idempotency-key'));
        return new Response('bad gateway', { status: 502 });
      }),
    );
    openAccountPage();
    // The rows render as cards (phones) and as a table (desktop): either button opens the dialog.
    await user.click(
      (await screen.findAllByRole('button', { name: releaseName() }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: t('releaseHold.action') });
    await user.click(confirm);
    expect(await screen.findByText(t('releaseHold.failed'))).toBeInTheDocument();
    await vi.waitFor(() => expect(confirm).toBeEnabled());
    await user.click(confirm);
    await vi.waitFor(() => expect(keys).toHaveLength(2));
    expect(keys[1]).toBe(keys[0]);
  });

  it('a released hold says why; a declined one offers no release', async () => {
    accountApi(() => adminAccountDetailFixture());
    server.use(
      http.get(core(`${BASE}/authorizations`), () =>
        json(
          page([
            authorizationFixture({ status: 'REVERSED', reversalReason: 'expired' }),
            authorizationFixture({
              id: 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
              status: 'DECLINED',
              declineReason: 'card_frozen',
              expiresAt: null,
            }),
          ]),
        ),
      ),
    );
    openAccountPage();
    const authorizations = await screen.findByRole('region', {
      name: t('accountDetail.authorizations.title'),
    });
    const table = await within(authorizations).findByRole('table');
    expect(table).toHaveTextContent(t('reversalReason.expired'));
    expect(
      within(table).queryByRole('button', { name: new RegExp(t('releaseHold.action')) }),
    ).toBeNull();
  });
});

describe('account action rules', () => {
  it('offers actions by status and blocks close from the first cent on hold', () => {
    const free = { frozenBy: null };
    expect(actionAvailability({ ...free, status: 'ACTIVE', heldCents: '0' })).toEqual({
      actions: ['freeze', 'close'],
      isCloseBlocked: false,
    });
    expect(actionAvailability({ ...free, status: 'ACTIVE', heldCents: '1' })).toEqual({
      actions: ['freeze', 'close'],
      isCloseBlocked: true,
    });
    expect(
      actionAvailability({ status: 'FROZEN', frozenBy: 'ADMIN', heldCents: '0' }).actions,
    ).toEqual(['unfreeze', 'close']);
    expect(
      actionAvailability({ ...free, status: 'PENDING_COLLATERAL', heldCents: '0' }).actions,
    ).toEqual(['close']);
    expect(actionAvailability({ ...free, status: 'CLOSED', heldCents: '5' })).toEqual({
      actions: [],
      isCloseBlocked: false,
    });
  });

  it('a freeze the customer placed can be taken over by an admin; an admin freeze cannot be re-frozen', () => {
    expect(
      actionAvailability({ status: 'FROZEN', frozenBy: 'CUSTOMER', heldCents: '0' }).actions,
    ).toEqual(['unfreeze', 'freeze', 'close']);
    expect(
      actionAvailability({ status: 'FROZEN', frozenBy: 'ADMIN', heldCents: '0' }).actions,
    ).not.toContain('freeze');
  });

  it('close pays the debt from the collateral first and never returns a negative amount', () => {
    expect(closePreview({ collateralCents: '50000', postedDebtCents: '12000' })).toEqual({
      collateralCents: 50000n,
      appliedCents: 12000n,
      releasedCents: 38000n,
    });
    expect(closePreview({ collateralCents: '50000', postedDebtCents: '50000' }).releasedCents).toBe(
      0n,
    );
    expect(closePreview({ collateralCents: '50000', postedDebtCents: '50001' })).toEqual({
      collateralCents: 50000n,
      appliedCents: 50000n,
      releasedCents: 0n,
    });
    expect(closePreview({ collateralCents: '50000', postedDebtCents: '0' }).appliedCents).toBe(0n);
  });
});

describe('AccountDetail: numbered history pages and the purchase sheet', () => {
  it('each history pages on its own, in the address next to the account id', async () => {
    const journalPages: (string | null)[] = [];
    accountApi(() => adminAccountDetailFixture());
    server.use(
      http.get(core(`${BASE}/ledger`), ({ request }) => {
        const requested = new URL(request.url).searchParams.get('page');
        journalPages.push(requested);
        return json(
          page(
            [
              journalEntryFixture(
                requested === '2'
                  ? { id: 'f1e2d3c4-b5a6-4978-8695-a4b3c2d1e0f9', kind: 'collateral_deposit' }
                  : {},
              ),
            ],
            { page: Number(requested), total: 12 },
          ),
        );
      }),
    );
    openAccountPage();
    const journal = await screen.findByRole('region', { name: t('accountDetail.journal.title') });
    const pages = await within(journal).findByRole('navigation', {
      name: t('common.pagination.nav', { list: t('accountDetail.journal.title') }),
    });
    await user.click(within(pages).getByRole('button', { name: t('common.pagination.next') }));
    expect(
      await within(journal).findByText(t('journal.kind.collateral_deposit')),
    ).toBeInTheDocument();
    expect(window.location.search).toBe(`?id=${ACCOUNT_ID}&journalPage=2`);
    expect(journalPages).toEqual(['1', '2']);
    expect(within(journal).getByText('Showing 11–11 of 12')).toBeInTheDocument();
  });

  it('a purchase opens its sheet named after the account customer; the address keeps the account', async () => {
    accountApi(() => adminAccountDetailFixture());
    openAccountPage();
    const authorizations = await screen.findByRole('region', {
      name: t('accountDetail.authorizations.title'),
    });
    const row = within(await within(authorizations).findByRole('table')).getAllByRole(
      'row',
    )[1] as HTMLElement;
    await user.click(
      within(row).getByRole('link', {
        name: t('purchaseDetail.open', { merchant: 'Corner Grocery' }),
      }),
    );
    expect(window.location.search).toBe(`?id=${ACCOUNT_ID}&purchase=${authorizationFixture().id}`);
    const sheet = await screen.findByRole('dialog', { name: t('purchaseDetail.title') });
    expect(sheet).toHaveTextContent('Ada Lovelace');
    expect(sheet).toHaveTextContent('Corner Grocery');
    expect(sheet).toHaveTextContent(t('orders.noItems'));
  });
});

describe('AccountDetail history search', () => {
  it("searches the account's purchases and entries separately, each in the address, page back to 1", async () => {
    const asked: string[] = [];
    accountApi(() => adminAccountDetailFixture());
    server.use(
      http.get(core(`${BASE}/authorizations`), ({ request }) => {
        const params = new URL(request.url).searchParams;
        asked.push(`purchases:${params.toString()}`);
        return json(params.get('q') ? page([]) : page([authorizationFixture()]));
      }),
      http.get(core(`${BASE}/ledger`), ({ request }) => {
        const params = new URL(request.url).searchParams;
        asked.push(`ledger:${params.toString()}`);
        return json(page([journalEntryFixture()]));
      }),
    );
    window.history.replaceState(null, '', `/en/accounts/view?id=${ACCOUNT_ID}&purchasesPage=2`);
    render(<AccountDetail locale="en-US" />);
    const box = await screen.findByLabelText(t('search.accountPurchases.label'));
    await user.type(box, 'zzz{Enter}');
    expect(window.location.search).toBe(`?id=${ACCOUNT_ID}&purchasesQ=zzz`);
    expect(await screen.findByText('No results for “zzz”')).toBeInTheDocument();
    expect(asked).toContain('purchases:q=zzz&page=1&pageSize=10');
    await user.type(screen.getByLabelText(t('search.accountLedger.label')), 'fee{Enter}');
    expect(window.location.search).toBe(`?id=${ACCOUNT_ID}&purchasesQ=zzz&journalQ=fee`);
    await vi.waitFor(() => expect(asked).toContain('ledger:q=fee&page=1&pageSize=10'));
    await user.click(screen.getByRole('button', { name: t('search.clearAction') }));
    expect(window.location.search).toBe(`?id=${ACCOUNT_ID}&journalQ=fee`);
  });
});
