import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { listHref } from '@/app/helpers/listMemory';
import { ACCOUNTS_LIST } from '@/app/helpers/listQuery';
import { VALIDATION_PARAMS } from '@/app/helpers/validationParams';
import { setActiveLocale, t } from '@/app/i18n';
import { ACCOUNT_ID, adminAccountFixture, OTHER_ACCOUNT_ID, page } from '@/test/fixtures';
import { apiError, core, json, server, signedIn } from '@/test/server';
import Accounts from '../Accounts';
import { SEARCH_DEBOUNCE_MS } from '@/app/hooks/useListSearch';

// These specs pin the English copy and US formats; Purchases.spec covers the es-MX default.
beforeEach(() => setActiveLocale('en-US'));

const user = userEvent.setup();

/** Records every list request's query and answers with what `answer` returns. */
function accountsApi(answer: (params: URLSearchParams) => Response) {
  const seen: string[] = [];
  server.use(
    signedIn,
    http.get(core('/admin/accounts'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      seen.push(params.toString());
      return answer(params);
    }),
  );
  return seen;
}

const table = () => screen.findByRole('table', { name: t('accounts.tableCaption') });

describe('Accounts island', () => {
  it('lists accounts with status words, exact amounts and the masked card, linked to the detail', async () => {
    accountsApi(() =>
      json(
        page([
          adminAccountFixture(),
          adminAccountFixture({
            id: OTHER_ACCOUNT_ID,
            status: 'FROZEN',
            cardLast4: null,
            customer: {
              id: '2d8f9c74-5cab-4f20-9e3d-9c4b6a8f0e32',
              email: 'alan@example.test',
              fullName: 'Alan Turing',
            },
          }),
        ]),
      ),
    );
    window.history.replaceState(null, '', '/accounts');
    render(<Accounts locale="en-US" />);
    const rows = within(await table()).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Ada Lovelace');
    expect(rows[1]).toHaveTextContent(t('status.account.ACTIVE'));
    expect(rows[1]).toHaveTextContent('$500.00$500.00$40.00$120.00$340.00');
    expect(rows[1]).toHaveTextContent('•••• 4242');
    expect(
      within(rows[1] as HTMLElement).getByRole('link', { name: /Ada Lovelace/ }),
    ).toHaveAttribute('href', `/en/accounts/view?id=${ACCOUNT_ID}`);
    expect(rows[2]).toHaveTextContent(t('status.account.FROZEN'));
    expect(rows[2]).toHaveTextContent(t('accounts.noCard'));
  });

  it('a status filter goes into the URL, starts again from the first page, and Back restores the previous list', async () => {
    const seen = accountsApi((params) =>
      json(
        page(
          [
            adminAccountFixture({
              status: params.get('status') === 'FROZEN' ? 'FROZEN' : 'ACTIVE',
            }),
          ],
          { page: Number(params.get('page')), total: 31 },
        ),
      ),
    );
    window.history.replaceState(null, '', '/accounts?q=ada&page=3');
    render(<Accounts locale="en-US" />);
    await table();
    expect(seen[0]).toBe('q=ada&page=3&pageSize=10');
    await user.click(screen.getByRole('radio', { name: t('status.account.FROZEN') }));
    expect(window.location.search).toBe('?status=FROZEN&q=ada');
    await vi.waitFor(() => expect(seen.at(-1)).toBe('status=FROZEN&q=ada&page=1&pageSize=10'));
    expect(listHref(ACCOUNTS_LIST)).toBe('/accounts?status=FROZEN&q=ada');

    act(() => {
      window.history.back();
    });
    await vi.waitFor(() => expect(window.location.search).toBe('?q=ada&page=3'));
    await vi.waitFor(() =>
      expect(screen.getByRole('radio', { name: t('accounts.filters.all') })).toBeChecked(),
    );
    // Back is served from the cache: no second request for the list it returns to.
    expect(seen).toEqual(['q=ada&page=3&pageSize=10', 'status=FROZEN&q=ada&page=1&pageSize=10']);
  });

  it('searches as the admin types, 300 ms after the last keystroke, with one request and one history entry', async () => {
    const seen = accountsApi(() => json(page([adminAccountFixture()])));
    window.history.replaceState(null, '', '/accounts?status=ACTIVE');
    render(<Accounts locale="en-US" />);
    await table();
    const box = screen.getByLabelText(t('search.accounts.label'));
    expect(box).toHaveAttribute('maxlength', '100');
    expect(box).toHaveAttribute('placeholder', t('search.accounts.placeholder'));
    await user.type(box, '  lovelace ');
    await vi.waitFor(() => expect(window.location.search).toBe('?status=ACTIVE&q=lovelace'));
    await vi.waitFor(() =>
      expect(seen).toEqual([
        'status=ACTIVE&page=1&pageSize=10',
        'status=ACTIVE&q=lovelace&page=1&pageSize=10',
      ]),
    );

    act(() => {
      window.history.back();
    });
    await vi.waitFor(() => expect(window.location.search).toBe('?status=ACTIVE'));
    // The box follows the address it came back to, and that is not a new search.
    await vi.waitFor(() => expect(box).toHaveValue(''));
    expect(window.location.search).toBe('?status=ACTIVE');
  });

  it('waits exactly the debounce: nothing at 299 ms after the last keystroke, the search at 300 ms', async () => {
    const seen = accountsApi(() => json(page([adminAccountFixture()])));
    window.history.replaceState(null, '', '/accounts');
    render(<Accounts locale="en-US" />);
    await table();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      fireEvent.change(screen.getByLabelText(t('search.accounts.label')), {
        target: { value: 'ada' },
      });
      act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
      expect(window.location.search).toBe('');
      act(() => vi.advanceTimersByTime(1));
      expect(window.location.search).toBe('?q=ada');
    } finally {
      vi.useRealTimers();
    }
    expect(SEARCH_DEBOUNCE_MS).toBe(300);
    await vi.waitFor(() =>
      expect(seen).toEqual(['page=1&pageSize=10', 'q=ada&page=1&pageSize=10']),
    );
  });

  it('Enter searches at once, and the pending debounce adds no second entry', async () => {
    const seen = accountsApi(() => json(page([adminAccountFixture()])));
    window.history.replaceState(null, '', '/accounts');
    render(<Accounts locale="en-US" />);
    await table();
    const before = window.history.length;
    await user.type(screen.getByLabelText(t('search.accounts.label')), 'ada{Enter}');
    expect(window.location.search).toBe('?q=ada');
    await vi.waitFor(() => expect(seen.at(-1)).toBe('q=ada&page=1&pageSize=10'));
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 50));
    expect(window.history.length).toBe(before + 1);
    expect(seen).toEqual(['page=1&pageSize=10', 'q=ada&page=1&pageSize=10']);
  });

  it('validates the API cap before searching', async () => {
    const seen = accountsApi(() => json(page([adminAccountFixture()])));
    window.history.replaceState(null, '', '/accounts');
    render(<Accounts locale="en-US" />);
    await table();
    // A value past the cap can only arrive pasted around maxLength; the list never sends it.
    fireEvent.change(screen.getByLabelText(t('search.accounts.label')), {
      target: { value: 'a'.repeat(101) },
    });
    expect(
      await screen.findByText(t('validation.searchTooLong', VALIDATION_PARAMS)),
    ).toBeInTheDocument();
    expect(window.location.search).toBe('');
    expect(seen).toEqual(['page=1&pageSize=10']);
  });

  it('searches with exactly the API cap (100 characters): the last passing length', async () => {
    const seen = accountsApi(() => json(page([adminAccountFixture()])));
    window.history.replaceState(null, '', '/accounts');
    render(<Accounts locale="en-US" />);
    await table();
    fireEvent.change(screen.getByLabelText(t('search.accounts.label')), {
      target: { value: 'a'.repeat(100) },
    });
    await vi.waitFor(() => expect(window.location.search).toBe(`?q=${'a'.repeat(100)}`));
    expect(screen.queryByText(t('validation.searchTooLong', VALIDATION_PARAMS))).toBeNull();
    await vi.waitFor(() => expect(seen).toHaveLength(2));
  });

  it('numbered pages: the next page replaces the rows, goes into the address and says "Showing 11–11 of 11"', async () => {
    const seen = accountsApi((params) =>
      params.get('page') === '2'
        ? json(
            page(
              [
                adminAccountFixture({
                  id: OTHER_ACCOUNT_ID,
                  customer: {
                    id: '2d8f9c74-5cab-4f20-9e3d-9c4b6a8f0e32',
                    email: 'alan@example.test',
                    fullName: 'Alan Turing',
                  },
                }),
              ],
              { page: 2, total: 11 },
            ),
          )
        : json(page([adminAccountFixture()], { total: 11 })),
    );
    window.history.replaceState(null, '', '/accounts?status=ACTIVE');
    render(<Accounts locale="en-US" />);
    await table();
    expect(screen.getByText('Showing 1–1 of 11')).toHaveAttribute('role', 'status');
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('Showing 11–11 of 11')).toBeInTheDocument();
    const rows = within(await table()).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent('Alan Turing');
    expect(window.location.search).toBe('?status=ACTIVE&page=2');
    expect(seen).toEqual(['status=ACTIVE&page=1&pageSize=10', 'status=ACTIVE&page=2&pageSize=10']);
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('an empty filtered list offers to clear the filters', async () => {
    accountsApi(() => json(page([])));
    window.history.replaceState(null, '', '/accounts?status=CLOSED');
    render(<Accounts locale="en-US" />);
    expect(await screen.findByText(t('accounts.emptyTitle'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('accounts.clearFilters') }));
    expect(window.location.search).toBe('');
  });

  it('a search that finds nothing says so with the text, and clearing it keeps the status filter', async () => {
    const seen = accountsApi(() => json(page([])));
    window.history.replaceState(null, '', '/accounts?status=FROZEN&q=zzz&page=2');
    render(<Accounts locale="en-US" />);
    expect(await screen.findByText(t('search.noResultsTitle', { q: 'zzz' }))).toBeInTheDocument();
    expect(screen.getByText('No results for “zzz”')).toBeInTheDocument();
    expect(screen.queryByText(t('accounts.emptyTitle'))).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('search.clearAction') }));
    expect(window.location.search).toBe('?status=FROZEN');
    await vi.waitFor(() => expect(seen.at(-1)).toBe('status=FROZEN&page=1&pageSize=10'));
    expect(screen.getByLabelText(t('search.accounts.label'))).toHaveValue('');
  });

  it('the clear button empties the box and drops the search at once', async () => {
    accountsApi(() => json(page([adminAccountFixture()])));
    window.history.replaceState(null, '', '/accounts?q=ada');
    render(<Accounts locale="en-US" />);
    await table();
    const box = screen.getByLabelText(t('search.accounts.label'));
    expect(box).toHaveValue('ada');
    await user.click(screen.getByRole('button', { name: t('search.clear') }));
    expect(box).toHaveValue('');
    expect(window.location.search).toBe('');
  });

  it('with no filters, the empty state says no accounts exist yet', async () => {
    accountsApi(() => json(page([])));
    window.history.replaceState(null, '', '/accounts');
    render(<Accounts locale="en-US" />);
    expect(await screen.findByText(t('accounts.emptyNoneTitle'))).toBeInTheDocument();
  });

  it('shows an error with retry', async () => {
    let fail = true;
    accountsApi(() =>
      fail ? apiError(403, 'common.forbidden') : json(page([adminAccountFixture()])),
    );
    window.history.replaceState(null, '', '/accounts');
    render(<Accounts locale="en-US" />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t('accounts.loadFailedTitle'));
    fail = false;
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(await table()).toBeInTheDocument();
  });
});
