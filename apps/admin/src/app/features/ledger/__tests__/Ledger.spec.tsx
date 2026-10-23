import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { setActiveLocale, t } from '@/app/i18n';
import { ACCOUNT_ID, dashboardFixture, journalEntryFixture, page } from '@/test/fixtures';
import { apiError, core, json, server, signedIn } from '@/test/server';
import Ledger from '../Ledger';

// These specs pin the English copy and US formats; Purchases.spec covers the es-MX default.
beforeEach(() => setActiveLocale('en-US'));

const user = userEvent.setup();

describe('Ledger island', () => {
  it('heads the journal with the trial balance and opens older entries by numbered page (in the address), each linked to its account', async () => {
    const pages: (string | null)[] = [];
    server.use(
      signedIn,
      http.get(core('/admin/dashboard'), () => json(dashboardFixture())),
      http.get(core('/admin/ledger'), ({ request }) => {
        const requested = new URL(request.url).searchParams.get('page');
        pages.push(requested);
        return requested === '2'
          ? json(
              page(
                [
                  journalEntryFixture({
                    id: 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a80',
                    kind: 'collateral_deposit',
                    accountId: null,
                  }),
                ],
                { page: 2, total: 11 },
              ),
            )
          : json(page([journalEntryFixture()], { total: 11 }));
      }),
    );
    render(<Ledger locale="en-US" />);
    const balance = (await screen.findByText(t('ledger.trialBalance')))
      .parentElement as HTMLElement;
    expect(balance).toHaveAttribute('role', 'status');
    await vi.waitFor(() =>
      expect(balance).toHaveTextContent(
        `${t('ledger.trialBalance')}$0.00${t('dashboard.ledgerBalancedTitle')}`,
      ),
    );
    expect(await screen.findByText(t('journal.kind.purchase_capture'))).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: t('journal.forAccount', { id: '5f3e2d1c' }) }),
    ).toHaveAttribute('href', `/en/accounts/view?id=${ACCOUNT_ID}`);
    await user.click(screen.getByRole('button', { name: t('common.pagination.next') }));
    expect(await screen.findByText(t('journal.kind.collateral_deposit'))).toBeInTheDocument();
    expect(window.location.search).toBe('?page=2');
    expect(pages).toEqual(['1', '2']);
    expect(screen.queryByText(t('journal.kind.purchase_capture'))).not.toBeInTheDocument();
  });

  it('a non-zero trial balance is an alert; an empty ledger teaches what will appear', async () => {
    server.use(
      signedIn,
      http.get(core('/admin/dashboard'), () =>
        json(dashboardFixture({ ledgerTrialBalanceCents: '250' })),
      ),
      http.get(core('/admin/ledger'), () => json(page([]))),
    );
    render(<Ledger locale="en-US" />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      `$2.50${t('dashboard.ledgerUnbalancedTitle')}`,
    );
    expect(await screen.findByText(t('ledger.emptyTitle'))).toBeInTheDocument();
  });

  it('says when the trial balance is unavailable, and retries a failed journal', async () => {
    let fail = true;
    server.use(
      signedIn,
      http.get(core('/admin/dashboard'), () => apiError(403, 'common.forbidden')),
      http.get(core('/admin/ledger'), () =>
        fail ? apiError(403, 'common.forbidden') : json(page([journalEntryFixture()])),
      ),
    );
    render(<Ledger locale="en-US" />);
    expect(await screen.findByText(t('ledger.trialBalanceUnavailable'))).toBeInTheDocument();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t('ledger.loadFailedTitle'));
    fail = false;
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(await screen.findByText(t('journal.kind.purchase_capture'))).toBeInTheDocument();
  });
});

describe('Ledger search', () => {
  it('searches entries by q from page 1, and an empty search offers to clear it', async () => {
    const seen: string[] = [];
    server.use(
      signedIn,
      http.get(core('/admin/dashboard'), () => json(dashboardFixture())),
      http.get(core('/admin/ledger'), ({ request }) => {
        const params = new URL(request.url).searchParams;
        seen.push(params.toString());
        return json(params.get('q') ? page([]) : page([journalEntryFixture()]));
      }),
    );
    window.history.replaceState(null, '', '/en/ledger?page=2');
    render(<Ledger locale="en-US" />);
    await user.type(await screen.findByLabelText(t('search.ledger.label')), 'refund{Enter}');
    expect(window.location.search).toBe('?q=refund');
    expect(await screen.findByText('No results for “refund”')).toBeInTheDocument();
    expect(seen.at(-1)).toBe('q=refund&page=1&pageSize=10');
    await user.click(screen.getByRole('button', { name: t('search.clearAction') }));
    expect(window.location.search).toBe('');
  });
});
