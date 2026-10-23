import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { listHref } from '@/app/helpers/listMemory';
import { PAYOUTS_LIST } from '@/app/helpers/listQuery';
import { setActiveLocale, t } from '@/app/i18n';
import { ACCOUNT_ID, adminPayoutFixture, page } from '@/test/fixtures';
import { apiError, core, json, server, signedIn } from '@/test/server';
import Payouts from '../Payouts';

const user = userEvent.setup();

/** Records every list request's query and answers with what `answer` returns. */
function payoutsApi(answer: (params: URLSearchParams) => Response) {
  const seen: string[] = [];
  server.use(
    signedIn,
    http.get(core('/admin/payouts'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      seen.push(params.toString());
      return answer(params);
    }),
  );
  return seen;
}

const SENT_ID = '8c9d0e1f-2a3b-4c4d-9e5f-6a7b8c9d0e25';
const twoPayouts = (total = 2) =>
  page(
    [
      adminPayoutFixture(),
      adminPayoutFixture({
        id: SENT_ID,
        status: 'SENT',
        attempts: 1,
        amountCents: '12550',
        reason: 'repayment_refund',
        lastError: null,
        providerPaymentId: 'pay_9Kd1',
        failedAt: null,
        sentAt: '2026-10-21T15:00:00.000Z',
        customer: {
          id: '2d8f9c74-5cab-4f20-9e3d-9c4b6a8f0e32',
          email: 'grace@example.test',
          fullName: 'Grace Hopper',
        },
      }),
    ],
    { total },
  );

const table = () => screen.findByRole('table', { name: t('payouts.tableCaption') });

function openPayouts(search = '') {
  window.history.replaceState(null, '', `/en/payouts${search}`);
  render(<Payouts locale="en-US" />);
}

describe('Payouts island', () => {
  beforeEach(() => setActiveLocale('en-US'));

  it('lists each payout: customer linked to the account, reason, status, attempts, last error, reference, amount', async () => {
    const seen = payoutsApi(() => json(twoPayouts()));
    openPayouts();
    const rows = within(await table()).getAllByRole('row');
    expect(
      within(rows[0] as HTMLElement)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual([
      t('payouts.columns.customer'),
      t('payouts.columns.reason'),
      t('payouts.columns.status'),
      t('payouts.columns.attempts'),
      t('payouts.columns.lastError'),
      t('payouts.columns.reference'),
      t('payouts.columns.amount'),
    ]);
    const failed = rows[1] as HTMLElement;
    expect(within(failed).getByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute(
      'href',
      `/en/accounts/view?id=${ACCOUNT_ID}`,
    );
    expect(failed).toHaveTextContent(t('status.payout.FAILED'));
    expect(failed).toHaveTextContent(t('payouts.failedAt', { time: 'Oct 21, 2026, 4:30 PM' }));
    expect(failed).toHaveTextContent('provider_rejected');
    expect(failed).toHaveTextContent('pay_7Hq2');
    expect(failed).toHaveTextContent('$380.00');
    const sent = rows[2] as HTMLElement;
    expect(sent).toHaveTextContent(t('payoutReason.repayment_refund'));
    expect(sent).toHaveTextContent(t('payouts.sentAt', { time: 'Oct 21, 2026, 3:00 PM' }));
    expect(sent).toHaveTextContent('$125.50');
    expect(seen).toEqual(['page=1&pageSize=10']);
  });

  it('filters by status in the address (W17) and remembers it for the way back', async () => {
    const seen = payoutsApi((params) =>
      json(params.get('status') === 'FAILED' ? page([adminPayoutFixture()]) : twoPayouts()),
    );
    openPayouts();
    await table();
    await user.click(screen.getByRole('radio', { name: t('status.payout.FAILED') }));
    await vi.waitFor(() => expect(window.location.search).toBe('?status=FAILED'));
    await vi.waitFor(() =>
      expect(
        within(screen.getByRole('table', { name: t('payouts.tableCaption') })).getAllByRole('row'),
      ).toHaveLength(2),
    );
    expect(seen).toEqual(['page=1&pageSize=10', 'status=FAILED&page=1&pageSize=10']);
    expect(listHref(PAYOUTS_LIST)).toBe('/en/payouts?status=FAILED');
  });

  it('opens page 2 from the numbered pages, in the address, with the range in words', async () => {
    const seen = payoutsApi((params) =>
      json(
        params.get('page') === '2'
          ? page(
              [
                adminPayoutFixture({
                  id: '9d0e1f2a-3b4c-4d5e-8f6a-7b8c9d0e1f36',
                  amountCents: '777',
                }),
              ],
              { page: 2, total: 11 },
            )
          : twoPayouts(11),
      ),
    );
    openPayouts();
    await table();
    await user.click(
      screen.getByRole('button', { name: t('common.pagination.page', { page: 2 }) }),
    );
    await vi.waitFor(() =>
      expect(
        within(screen.getByRole('table', { name: t('payouts.tableCaption') })).getAllByRole('row'),
      ).toHaveLength(2),
    );
    expect(window.location.search).toBe('?page=2');
    expect(seen).toEqual(['page=1&pageSize=10', 'page=2&pageSize=10']);
    expect(screen.getByText('Showing 11–11 of 11')).toBeInTheDocument();
  });

  it('an empty filter offers every payout again; an empty list says what will appear', async () => {
    payoutsApi(() => json(page([])));
    openPayouts('?status=PENDING');
    expect(await screen.findByText(t('payouts.emptyFilteredTitle'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('payouts.showAll') }));
    expect(await screen.findByText(t('payouts.emptyTitle'))).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('shows an error with retry when the list cannot be loaded', async () => {
    let fail = true;
    payoutsApi(() => (fail ? apiError(403, 'common.forbidden') : json(twoPayouts())));
    openPayouts();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t('payouts.loadFailedTitle'));
    fail = false;
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(await table()).toBeInTheDocument();
  });

  it('renders in Spanish by default', async () => {
    setActiveLocale('es-MX');
    payoutsApi(() => json(twoPayouts()));
    window.history.replaceState(null, '', '/payouts');
    render(<Payouts />);
    const failed = within(await table()).getAllByRole('row')[1] as HTMLElement;
    expect(failed).toHaveTextContent('Falló');
    expect(failed).toHaveTextContent('Devolución del colateral');
  });
});

describe('Payouts search', () => {
  it('searches by q in the address from page 1 and keeps the status filter', async () => {
    const seen = payoutsApi(() => json(twoPayouts()));
    window.history.replaceState(null, '', '/en/payouts?status=FAILED&page=3');
    render(<Payouts locale="en-US" />);
    await user.type(await screen.findByLabelText(t('search.payouts.label')), 'po_123{Enter}');
    expect(window.location.search).toBe('?status=FAILED&q=po_123');
    await vi.waitFor(() => expect(seen.at(-1)).toBe('status=FAILED&q=po_123&page=1&pageSize=10'));
  });

  it('an empty search names what was searched and clears only the search', async () => {
    payoutsApi(() => json(page([])));
    window.history.replaceState(null, '', '/en/payouts?status=FAILED&q=po_404');
    render(<Payouts locale="en-US" />);
    expect(await screen.findByText('No results for “po_404”')).toBeInTheDocument();
    expect(screen.queryByText(t('payouts.emptyFilteredTitle'))).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('search.clearAction') }));
    expect(window.location.search).toBe('?status=FAILED');
  });
});
