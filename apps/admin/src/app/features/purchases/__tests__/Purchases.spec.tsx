import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { listHref } from '@/app/helpers/listMemory';
import { PURCHASES_LIST } from '@/app/helpers/listQuery';
import { t } from '@/app/i18n';
import { ACCOUNT_ID, adminAuthorizationFixture, authorizationFixture, page } from '@/test/fixtures';
import { apiError, core, json, server, signedIn } from '@/test/server';
import Purchases from '../Purchases';

const user = userEvent.setup();

/** es-MX shows USD amounts as "USD 93.74", with the no-break space Intl puts after the code. */
const NBSP = String.fromCodePoint(0xa0);
const usd = (amount: string) => `USD${NBSP}${amount}`;
/** The same amount as toHaveTextContent sees it (it folds every white space into one space). */
const usdText = (amount: string) => `USD ${amount}`;

const DECLINED_ID = 'f6a7b8c9-d0e1-4f2a-8b3c-4d5e6f7a8b92';

/** Records every list request's query and answers with what `answer` returns. */
function purchasesApi(answer: (params: URLSearchParams) => Response) {
  const seen: string[] = [];
  server.use(
    signedIn,
    http.get(core('/admin/authorizations'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      seen.push(params.toString());
      return answer(params);
    }),
  );
  return seen;
}

const twoPurchases = () =>
  page([
    adminAuthorizationFixture(),
    adminAuthorizationFixture({
      id: DECLINED_ID,
      status: 'DECLINED',
      declineReason: 'card_frozen',
      amountCents: '84020',
      merchantName: 'City Fuel',
      merchantMcc: '5541',
      items: [],
    }),
  ]);

const table = () => screen.findByRole('table', { name: t('purchases.tableCaption') });

describe('Purchases island (es-MX, the default)', () => {
  it('lists each purchase: date, customer linked to the account, merchant + MCC, status in words, amounts', async () => {
    const seen = purchasesApi(() => json(twoPurchases()));
    window.history.replaceState(null, '', '/purchases');
    render(<Purchases />);
    const rows = within(await table()).getAllByRole('row');
    expect(
      within(rows[0] as HTMLElement)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Comercio', 'Cliente', 'Fecha', 'Estado', 'Monto', 'Aplicado']);
    const order = rows[1] as HTMLElement;
    expect(order).toHaveTextContent('Taquería El Sol');
    expect(order).toHaveTextContent('MCC 5812');
    expect(order).toHaveTextContent('21 oct 2026');
    expect(order).toHaveTextContent('En espera');
    expect(order).toHaveTextContent(usdText('93.74'));
    expect(within(order).getByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute(
      'href',
      `/accounts/view?id=${ACCOUNT_ID}`,
    );
    const declined = rows[2] as HTMLElement;
    expect(declined).toHaveTextContent('Rechazada');
    expect(declined).toHaveTextContent('Tarjeta congelada');
    expect(declined).toHaveTextContent(usdText('840.20'));
    expect(declined).toHaveTextContent(t('orders.noItems'));
    expect(seen).toEqual(['page=1&pageSize=10']);
  });

  it('unfolds the order lines of a store purchase: qty × name @ unit and the line subtotal', async () => {
    purchasesApi(() => json(twoPurchases()));
    window.history.replaceState(null, '', '/purchases');
    render(<Purchases />);
    const order = within(await table()).getAllByRole('row')[1] as HTMLElement;
    const toggle = within(order).getByText('Artículos (3)');
    await user.click(toggle);
    const items = within(order).getByRole('list', {
      name: 'Artículos de la compra en Taquería El Sol',
    });
    expect(
      within(items)
        .getAllByRole('listitem')
        .map((line) => line.textContent),
    ).toEqual([
      `2 × Americano@ ${usd('3.50')} c/u${usd('7.00')}`,
      `3 × Concha@ ${usd('12.25')} c/u${usd('36.75')}`,
      `1 × Orange juice@ ${usd('49.99')} c/u${usd('49.99')}`,
    ]);
  });

  it('a status filter goes into the URL; the old rows stay on screen, marked as updating, until the new ones arrive', async () => {
    let releaseDeclined: () => void = () => undefined;
    const declinedReady = new Promise<void>((resolve) => (releaseDeclined = resolve));
    const seen = purchasesApi(() => json(twoPurchases()));
    server.use(
      http.get(core('/admin/authorizations'), async ({ request }) => {
        const params = new URL(request.url).searchParams;
        if (params.get('status') !== 'DECLINED') return undefined;
        seen.push(params.toString());
        await declinedReady;
        return json(
          page([
            adminAuthorizationFixture({
              id: DECLINED_ID,
              status: 'DECLINED',
              merchantName: 'City Fuel',
            }),
          ]),
        );
      }),
    );
    window.history.replaceState(null, '', '/purchases?page=2');
    render(<Purchases />);
    await table();
    // A filter change starts again at page 1: the page leaves the address.
    await user.click(screen.getByRole('radio', { name: 'Rechazada' }));
    expect(window.location.search).toBe('?status=DECLINED');
    expect(await screen.findByText(t('common.updating'))).toBeInTheDocument();
    expect(within(await table()).getByText('Taquería El Sol')).toBeInTheDocument();
    expect(screen.queryByText(t('purchases.loading'))).not.toBeInTheDocument();

    releaseDeclined();
    expect(await within(await table()).findByText('City Fuel')).toBeInTheDocument();
    expect(within(await table()).queryByText('Taquería El Sol')).not.toBeInTheDocument();
    expect(screen.queryByText(t('common.updating'))).not.toBeInTheDocument();
    expect(seen).toEqual(['page=2&pageSize=10', 'status=DECLINED&page=1&pageSize=10']);
    expect(listHref(PURCHASES_LIST)).toBe('/purchases?status=DECLINED');

    act(() => {
      window.history.back();
    });
    await vi.waitFor(() => expect(window.location.search).toBe('?page=2'));
    await vi.waitFor(() =>
      expect(screen.getByRole('radio', { name: t('purchases.filters.all') })).toBeChecked(),
    );
    expect(await within(await table()).findByText('Taquería El Sol')).toBeInTheDocument();
  });

  it('numbered pages of 10: the page goes into the address next to the filter, with "Showing 11–20 of 23"', async () => {
    const seen = purchasesApi((params) =>
      json(
        page(
          [
            adminAuthorizationFixture(
              params.get('page') === '2' ? { id: DECLINED_ID, merchantName: 'City Fuel' } : {},
            ),
          ],
          { page: Number(params.get('page')), total: 23 },
        ),
      ),
    );
    window.history.replaceState(null, '', '/purchases?status=APPROVED');
    render(<Purchases />);
    await table();
    const pages = screen.getByRole('navigation', {
      name: t('common.pagination.nav', { list: t('nav.purchases') }),
    });
    await user.click(
      within(pages).getByRole('button', { name: t('common.pagination.page', { page: 2 }) }),
    );
    expect(window.location.search).toBe('?status=APPROVED&page=2');
    expect(await within(await table()).findByText('City Fuel')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Mostrando 11–11 de 23');
    expect(seen).toEqual([
      'status=APPROVED&page=1&pageSize=10',
      'status=APPROVED&page=2&pageSize=10',
    ]);
    expect(listHref(PURCHASES_LIST)).toBe('/purchases?status=APPROVED&page=2');
  });

  it('an old link past the end says the page no longer exists and offers the last one', async () => {
    purchasesApi((params) => json(page([], { page: Number(params.get('page')), total: 23 })));
    window.history.replaceState(null, '', '/purchases?page=9');
    render(<Purchases />);
    expect(
      await screen.findByText(t('common.pageOutOfRange', { totalPages: '3' })),
    ).toBeInTheDocument();
    expect(screen.queryByText(t('purchases.emptyTitle'))).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('common.goToLastPage') }));
    expect(window.location.search).toBe('?page=3');
  });

  it('an empty filtered list offers to show every purchase again', async () => {
    purchasesApi(() => json(page([])));
    window.history.replaceState(null, '', '/purchases?status=REVERSED');
    render(<Purchases />);
    expect(await screen.findByText(t('purchases.emptyFilteredTitle'))).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('purchases.showAll') }));
    expect(window.location.search).toBe('');
  });

  it('with no filter, the empty state says what will appear here', async () => {
    purchasesApi(() => json(page([])));
    window.history.replaceState(null, '', '/purchases');
    render(<Purchases />);
    expect(await screen.findByText(t('purchases.emptyTitle'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('purchases.showAll') })).not.toBeInTheDocument();
  });

  it('shows the loading rows first, then an error with retry, then the list', async () => {
    let fail = true;
    purchasesApi(() => (fail ? apiError(403, 'common.forbidden') : json(twoPurchases())));
    window.history.replaceState(null, '', '/purchases');
    render(<Purchases />);
    expect(screen.getByRole('status')).toHaveTextContent(t('purchases.loading'));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t('purchases.loadFailedTitle'));
    fail = false;
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(await table()).toBeInTheDocument();
  });

  it('an unknown card shows no customer instead of a broken link', async () => {
    purchasesApi(() =>
      json(page([adminAuthorizationFixture({ customer: null, accountId: null })])),
    );
    window.history.replaceState(null, '', '/purchases');
    render(<Purchases />);
    const row = within(await table()).getAllByRole('row')[1] as HTMLElement;
    expect(row).toHaveTextContent(t('purchases.noCustomer'));
    // Only the purchase's own detail link: no link to an account that does not exist.
    expect(
      within(row)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([`?purchase=${adminAuthorizationFixture().id}`]);
  });
});

describe('Purchases island (en-US)', () => {
  it('renders in English with US amounts and English links', async () => {
    purchasesApi(() => json(twoPurchases()));
    window.history.replaceState(null, '', '/en/purchases');
    render(<Purchases locale="en-US" />);
    const order = within(await table()).getAllByRole('row')[1] as HTMLElement;
    expect(order).toHaveTextContent('On hold');
    expect(order).toHaveTextContent('$93.74');
    expect(within(order).getByRole('link', { name: 'Ada Lovelace' })).toHaveAttribute(
      'href',
      `/en/accounts/view?id=${ACCOUNT_ID}`,
    );
    expect(within(order).getByText('Items (3)')).toBeInTheDocument();
  });
});

describe('Purchases: releasing a live hold (en-US)', () => {
  const HOLD_ID = 'e5f6a7b8-c9d0-4e1f-8a2b-3c4d5e6f7a81';
  const releaseLabel = () =>
    t('releaseHold.actionFor', { amount: '$93.74', merchant: 'Taquería El Sol' });
  // "Expires soon" depends on the clock (FT7): a week before the fixture's expiry, only Date is faked.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-21T12:00:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('a live hold shows when it expires and releases from its row; the list is read again', async () => {
    let released = false;
    let key: string | null = null;
    const seen = purchasesApi(() =>
      json(
        page([
          adminAuthorizationFixture(
            released ? { status: 'REVERSED', reversalReason: 'admin_release' } : {},
          ),
        ]),
      ),
    );
    server.use(
      http.post(core(`/admin/authorizations/${HOLD_ID}/release`), ({ request }) => {
        key = request.headers.get('idempotency-key');
        released = true;
        return json(
          authorizationFixture({
            id: HOLD_ID,
            status: 'REVERSED',
            reversalReason: 'admin_release',
          }),
        );
      }),
    );
    window.history.replaceState(null, '', '/en/purchases');
    render(<Purchases locale="en-US" />);
    const row = within(await table()).getAllByRole('row')[1] as HTMLElement;
    expect(row).toHaveTextContent(t('holds.expires', { date: 'Oct 28, 2026, 12:00 PM' }));
    await user.click(within(row).getByRole('button', { name: releaseLabel() }));
    const dialog = await screen.findByRole('dialog', { name: t('releaseHold.title') });
    expect(dialog).toHaveTextContent(
      t('releaseHold.body', {
        amount: '$93.74',
        merchant: 'Taquería El Sol',
        name: 'Ada Lovelace',
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: t('releaseHold.action') }));
    expect(
      await screen.findByText(
        t('releaseHold.done', { amount: '$93.74', merchant: 'Taquería El Sol' }),
      ),
    ).toBeInTheDocument();
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    // Invalidated by PURCHASES_KEY: the open list is read again and the hold now says why it ended.
    expect(
      await within(await table()).findByText(t('reversalReason.admin_release')),
    ).toBeInTheDocument();
    expect(seen).toHaveLength(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cancel closes the dialog without releasing anything', async () => {
    let posted = false;
    purchasesApi(() => json(page([adminAuthorizationFixture()])));
    server.use(
      http.post(core(`/admin/authorizations/${HOLD_ID}/release`), () => {
        posted = true;
        return json(authorizationFixture());
      }),
    );
    window.history.replaceState(null, '', '/en/purchases');
    render(<Purchases locale="en-US" />);
    const row = within(await table()).getAllByRole('row')[1] as HTMLElement;
    await user.click(within(row).getByRole('button', { name: releaseLabel() }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: t('common.cancel') }));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(posted).toBe(false);
  });
});

describe('Purchases: the order detail sheet (?purchase=<id>)', () => {
  const ORDER_ID = adminAuthorizationFixture().id;

  it('the merchant opens the order: customer, status, each line with its product image, total; Back closes it', async () => {
    purchasesApi(() => json(twoPurchases()));
    window.history.replaceState(null, '', '/purchases?status=APPROVED');
    render(<Purchases />);
    const order = within(await table()).getAllByRole('row')[1] as HTMLElement;
    await user.click(
      within(order).getByRole('link', {
        name: t('purchaseDetail.open', { merchant: 'Taquería El Sol' }),
      }),
    );
    expect(window.location.search).toBe(`?status=APPROVED&purchase=${ORDER_ID}`);
    const sheet = await screen.findByRole('dialog', { name: t('purchaseDetail.title') });
    expect(sheet).toHaveTextContent('Ada Lovelace');
    expect(sheet).toHaveTextContent('En espera');
    expect(sheet).toHaveTextContent(
      t('purchaseDetail.timeline.approved', { amount: usdText('93.74') }),
    );
    const items = within(sheet)
      .getAllByRole('listitem')
      .filter((item) => item.querySelector('img'));
    expect(items.map((item) => item.querySelector('img')?.getAttribute('src'))).toEqual([
      '/products/cafe-americano.svg',
      '/products/pan-dulce.svg',
      '/products/jugo.svg',
    ]);
    expect(items[1]).toHaveTextContent(`Concha3 × ${usdText('12.25')}${usdText('36.75')}`);
    expect(sheet).toHaveTextContent(`${t('purchaseDetail.total')}${usdText('93.74')}`);

    act(() => window.history.back());
    await vi.waitFor(() => expect(window.location.search).toBe('?status=APPROVED'));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('a shared link opens the sheet; Close removes only the parameter', async () => {
    purchasesApi(() => json(twoPurchases()));
    window.history.replaceState(null, '', `/purchases?purchase=${ORDER_ID}`);
    render(<Purchases />);
    const sheet = await screen.findByRole('dialog', { name: t('purchaseDetail.title') });
    await user.click(within(sheet).getByRole('button', { name: t('purchaseDetail.close') }));
    await vi.waitFor(() => expect(window.location.search).toBe(''));
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('a link to a purchase that is not on this page says so instead of showing another one', async () => {
    purchasesApi(() => json(twoPurchases()));
    window.history.replaceState(
      null,
      '',
      '/purchases?purchase=0b6d7a52-3a8f-4d0e-9c1b-000000000000',
    );
    render(<Purchases />);
    const sheet = await screen.findByRole('dialog', { name: t('purchaseDetail.title') });
    expect(await within(sheet).findByText(t('purchaseDetail.notFoundTitle'))).toBeInTheDocument();
  });
});

describe('Purchases search', () => {
  it('searches by q in the address from page 1, keeps the status, and an empty search offers to clear it', async () => {
    const seen = purchasesApi((params) =>
      params.get('q') === 'nada' ? json(page([])) : json(twoPurchases()),
    );
    window.history.replaceState(null, '', '/purchases?status=DECLINED&page=2');
    render(<Purchases locale="es-MX" />);
    const box = await screen.findByLabelText(t('search.purchases.label'));
    expect(box).toHaveAttribute('placeholder', 'Buscar por id, comercio o cliente…');
    await user.type(box, ' nada {Enter}');
    expect(window.location.search).toBe('?status=DECLINED&q=nada');
    expect(await screen.findByText('Sin resultados para «nada»')).toBeInTheDocument();
    expect(seen.at(-1)).toBe('status=DECLINED&q=nada&page=1&pageSize=10');
    await user.click(screen.getByRole('button', { name: t('search.clearAction') }));
    expect(window.location.search).toBe('?status=DECLINED');
    expect(listHref(PURCHASES_LIST)).toBe('/purchases?status=DECLINED');
  });
});
