import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { setActiveLocale, t } from '@/app/i18n';
import {
  holdPollInterval,
  HOLD_POLL_MS,
  HOLD_WATCH_MS,
} from '@/app/tanstack-queries/authorizationsQuery';
import {
  accountFixture,
  ACCOUNT_ID,
  activityFixture,
  authorizationDetailFixture,
  authorizationFixture,
  page,
} from '@/test/fixtures';
import { apiError, core, json, network, server, signedIn } from '@/test/server';
import { plain } from '@/test/text';
import Activity from '../Activity';
import { toActivityRow } from '../hooks/useActivityPage';

const user = userEvent.setup();
const AUTH_ID = authorizationFixture().id;

function withAccount(orders = [authorizationFixture()], movements = [activityFixture()]) {
  server.use(
    signedIn,
    http.get(core('/accounts/me'), () => json(accountFixture())),
    http.get(core(`/accounts/${ACCOUNT_ID}/authorizations`), () => json(page(orders))),
    http.get(core(`/accounts/${ACCOUNT_ID}/activity`), () => json(page(movements))),
  );
}

const region = (name: string) => screen.findByRole('region', { name });

describe('Activity island: movements', () => {
  it('lists movements as ledger rows', async () => {
    withAccount();
    render(<Activity locale="en-US" />);
    const movements = await region(t('activity.listTitle'));
    const list = await within(movements).findByRole('list');
    const [first] = within(list).getAllByRole('listitem');
    expect(first).toHaveTextContent(`${t('activity.type.purchase')} · Corner Grocery`);
    expect(first).toHaveTextContent('$12.50');
    expect(first).toHaveTextContent(t('status.posted'));
  });

  it('teaches the first step when there is no account yet', async () => {
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () => apiError(404, 'common.not_found')),
    );
    render(<Activity />);
    expect(await screen.findByText(t('activity.emptyTitle'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('common.backToAccount') })).toHaveAttribute(
      'href',
      '/app',
    );
  });

  it('empty lists teach what will show up there', async () => {
    withAccount([], []);
    render(<Activity />);
    expect(await screen.findByText(t('activity.emptyTitle'))).toBeInTheDocument();
    expect(await screen.findByText(t('activity.orders.emptyTitle'))).toBeInTheDocument();
  });

  it('shows an error with retry, and retries the movements', async () => {
    let fail = true;
    withAccount();
    server.use(
      http.get(core(`/accounts/${ACCOUNT_ID}/activity`), () =>
        fail ? apiError(403, 'common.forbidden') : json(page([activityFixture()])),
      ),
    );
    render(<Activity />);
    const movements = await region(t('activity.listTitle'));
    const alert = await within(movements).findByRole('alert');
    expect(alert).toHaveTextContent(t('activity.loadFailedTitle'));
    fail = false;
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(await within(movements).findByRole('list')).toBeInTheDocument();
  });

  it('retries the account when that is what failed', async () => {
    let fail = true;
    withAccount();
    server.use(
      http.get(core('/accounts/me'), () =>
        fail ? apiError(403, 'common.forbidden') : json(accountFixture()),
      ),
    );
    render(<Activity />);
    const alert = await screen.findByRole('alert');
    fail = false;
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(await region(t('activity.orders.title'))).toBeInTheDocument();
  });
});

describe('Activity island: orders', () => {
  it('words each order, opens its items and cancels one on hold with an idempotency key', async () => {
    withAccount([
      authorizationFixture({
        merchantName: 'Taquería El Sol',
        amountCents: '2050',
        items: [
          { sku: 'TAC-PASTOR', name: 'Al pastor tacos (order)', quantity: 2, unitCents: '850' },
          { sku: 'TAC-HORCH', name: 'Horchata', quantity: 1, unitCents: '350' },
        ],
      }),
      authorizationFixture({
        id: 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5e',
        status: 'DECLINED',
        declineReason: 'card_frozen',
      }),
      authorizationFixture({
        id: 'c1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5f',
        status: 'CAPTURED',
        merchantName: 'Electro Hub',
      }),
    ]);
    let voidKey = '';
    let voidBody: unknown = null;
    server.use(
      http.post(network(`/purchases/${AUTH_ID}/void`), async ({ request }) => {
        voidKey = request.headers.get('idempotency-key') ?? '';
        const text = await request.text();
        voidBody = text ? (JSON.parse(text) as unknown) : null;
        return json({ status: 'REVERSED' });
      }),
    );
    render(<Activity />);
    const orders = await region(t('activity.orders.title'));
    const [list] = await within(orders).findAllByRole('list');
    const rows = within(list as HTMLElement)
      .getAllByRole('listitem')
      .filter((item) => item.parentElement === list);
    const [held, declined, posted] = rows as [HTMLElement, HTMLElement, HTMLElement];
    expect(held).toHaveTextContent('Taquería El Sol · 3 artículos');
    expect(held).toHaveTextContent(t('status.onHold'));
    expect(held).toHaveTextContent('2 × Orden de tacos al pastor, 1 × Agua de horchata');
    expect(declined).toHaveTextContent(t('activity.orders.declineShort.card_frozen'));
    expect(within(declined).queryByRole('button')).not.toBeInTheDocument();
    expect(posted).toHaveTextContent(t('status.posted'));
    await user.click(within(held).getByRole('button', { name: /Taquería El Sol/ }));
    expect(await screen.findByText(/Taquería El Sol cancelado/)).toBeInTheDocument();
    expect(voidKey).toMatch(/^[0-9a-f-]{36}$/);
    // The network voids only for the card that made the purchase (the id alone is not enough).
    expect(voidBody).toEqual({ cardToken: accountFixture().card?.token });
  });

  it('explains a refused cancel by its code', async () => {
    withAccount();
    server.use(
      http.post(network(`/purchases/${AUTH_ID}/void`), () =>
        apiError(409, 'authorization.not_reversible'),
      ),
    );
    render(<Activity />);
    const orders = await region(t('activity.orders.title'));
    await user.click(await within(orders).findByRole('button', { name: /Corner Grocery/ }));
    expect(await screen.findByText(t('errors.authorization.not_reversible'))).toBeInTheDocument();
  });

  it('shows an error with retry when the orders cannot load', async () => {
    withAccount();
    server.use(
      http.get(core(`/accounts/${ACCOUNT_ID}/authorizations`), () =>
        apiError(404, 'common.not_found'),
      ),
    );
    render(<Activity />);
    expect(await screen.findByText(t('activity.orders.loadFailedTitle'))).toBeInTheDocument();
  });
});

describe('Activity island: order detail', () => {
  const ORDER = authorizationFixture({
    merchantName: 'Taquería El Sol',
    amountCents: '2050',
    items: [
      { sku: 'TAC-PASTOR', name: 'Al pastor tacos (order)', quantity: 2, unitCents: '850' },
      { sku: 'TAC-HORCH', name: 'Horchata', quantity: 1, unitCents: '350' },
    ],
  });
  const DETAIL = authorizationDetailFixture({
    merchantName: 'Taquería El Sol',
    amountCents: '2050',
    itemCount: 3,
    items: [
      {
        sku: 'TAC-PASTOR',
        name: 'Al pastor tacos (order)',
        quantity: 2,
        unitPriceCents: '850',
        lineTotalCents: '1700',
      },
      {
        sku: 'TAC-HORCH',
        name: 'Horchata',
        quantity: 1,
        unitPriceCents: '350',
        lineTotalCents: '350',
      },
    ],
  });
  const OLDER_ID = 'f1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5f';
  const detailName = () => t('activity.detail.title');

  /** GET …/authorizations/:id, recording which ids were asked for. */
  function withDetail(answer: () => Response | Promise<Response> = () => json(DETAIL)) {
    const reads: string[] = [];
    server.use(
      http.get(core(`/accounts/${ACCOUNT_ID}/authorizations/:authorizationId`), ({ params }) => {
        reads.push(String(params.authorizationId));
        return answer();
      }),
    );
    return reads;
  }

  beforeEach(() => window.history.replaceState(null, '', '/app/activity'));
  afterEach(() => window.history.replaceState(null, '', '/'));

  async function openFromList() {
    const orders = await region(t('activity.orders.title'));
    const link = await within(orders).findByRole('link', { name: /Taquería El Sol/ });
    await user.click(link);
    return { link, sheet: await screen.findByRole('dialog', { name: detailName() }) };
  }

  const lineTexts = (sheet: HTMLElement) =>
    within(within(sheet).getByRole('region', { name: t('activity.detail.items') }))
      .getAllByRole('listitem')
      .map((line) => plain(line.textContent));

  it('tapping an order opens every line, the total, what happened and its timeline, deep-linked as ?order=<id>', async () => {
    withAccount([ORDER]);
    const reads = withDetail();
    render(<Activity />);
    const { sheet } = await openFromList();
    expect(window.location.search).toBe(`?order=${AUTH_ID}`);
    expect(lineTexts(sheet)).toEqual([
      'Orden de tacos al pastor2 × USD 8.50USD 17.00',
      'Agua de horchata1 × USD 3.50USD 3.50',
    ]);
    expect(plain(sheet.textContent)).toContain(
      plain(t('activity.detail.outcome.APPROVED', { amount: 'USD 20.50' })),
    );
    expect(sheet).toHaveTextContent('Taquería El Sol');
    expect(sheet).toHaveTextContent(t('status.onHold'));
    expect(sheet.contains(document.activeElement)).toBe(true);
    const timeline = await within(sheet).findByRole('region', {
      name: t('activity.detail.timelineTitle'),
    });
    expect(timeline).toHaveTextContent(t('activity.detail.timeline.createdAt'));
    expect(timeline).toHaveTextContent(t('activity.detail.timeline.approvedAt'));
    expect(reads).toEqual([AUTH_ID]);
  });

  it('opens at once from the list row while the detail loads (no skeleton), then adds the timeline', async () => {
    withAccount([ORDER]);
    withDetail(async () => {
      await delay(300);
      return json(DETAIL);
    });
    render(<Activity />);
    const { sheet } = await openFromList();
    expect(lineTexts(sheet)).toHaveLength(2);
    expect(within(sheet).queryByRole('status')).not.toBeInTheDocument();
    expect(
      within(sheet).queryByRole('region', { name: t('activity.detail.timelineTitle') }),
    ).not.toBeInTheDocument();
    expect(
      await within(sheet).findByRole('region', { name: t('activity.detail.timelineTitle') }),
    ).toBeInTheDocument();
  });

  it('the close button closes it, drops ?order= and gives focus back to the order', async () => {
    withAccount([ORDER]);
    withDetail();
    render(<Activity />);
    const { link, sheet } = await openFromList();
    await user.click(within(sheet).getByRole('button', { name: t('common.close') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.location.search).toBe('');
    await waitFor(() => expect(link).toHaveFocus());
    // Closing stepped back onto the list's own entry (no dead "same list" step): Forward reopens it.
    window.history.forward();
    expect(await screen.findByRole('dialog', { name: detailName() })).toBeInTheDocument();
  });

  it('Back closes it on the same page: the ClientRouter never sees that history move (no page swap)', async () => {
    const router = vi.fn();
    window.addEventListener('popstate', router);
    try {
      withAccount([ORDER]);
      withDetail();
      render(<Activity />);
      await openFromList();
      window.history.back();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
      expect(window.location.search).toBe('');
      window.history.forward();
      expect(await screen.findByRole('dialog', { name: detailName() })).toBeInTheDocument();
      expect(router).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener('popstate', router);
    }
  });

  it('a shared link opens that order on load, even one that is not on the first page of orders', async () => {
    window.history.replaceState(null, '', `/app/activity?order=${OLDER_ID}`);
    const before = window.history.length;
    withAccount([ORDER]);
    const reads = withDetail(() => json({ ...DETAIL, id: OLDER_ID, merchantName: 'Electro Hub' }));
    render(<Activity />);
    const sheet = await screen.findByRole('dialog', { name: detailName() });
    expect(await within(sheet).findByText('Electro Hub')).toBeInTheDocument();
    expect(reads).toEqual([OLDER_ID]);
    await user.click(within(sheet).getByRole('button', { name: t('common.close') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.location.pathname + window.location.search).toBe('/app/activity');
    expect(window.history.length).toBe(before);
  });

  it('shows the loading state while an order that is not listed arrives', async () => {
    window.history.replaceState(null, '', `/app/activity?order=${OLDER_ID}`);
    withAccount([ORDER]);
    withDetail(async () => {
      await delay(200);
      return json(DETAIL);
    });
    render(<Activity />);
    const sheet = await screen.findByRole('dialog', { name: detailName() });
    expect(within(sheet).getByRole('status')).toHaveTextContent(t('activity.detail.loading'));
    expect(await within(sheet).findByText('Agua de horchata')).toBeInTheDocument();
  });

  it('an order the API does not know for this account (404) says so instead of an empty sheet', async () => {
    window.history.replaceState(null, '', `/app/activity?order=${OLDER_ID}`);
    withAccount([ORDER]);
    withDetail(() => apiError(404, 'common.not_found'));
    render(<Activity />);
    const sheet = await screen.findByRole('dialog', { name: detailName() });
    expect(await within(sheet).findByText(t('activity.detail.notFoundTitle'))).toBeInTheDocument();
  });

  it('a failed detail shows an error with retry, and retries', async () => {
    window.history.replaceState(null, '', `/app/activity?order=${OLDER_ID}`);
    let fail = true;
    withAccount([ORDER]);
    withDetail(() => (fail ? apiError(403, 'common.forbidden') : json(DETAIL)));
    render(<Activity />);
    const sheet = await screen.findByRole('dialog', { name: detailName() });
    const alert = await within(sheet).findByRole('alert');
    fail = false;
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(await within(sheet).findByText('Agua de horchata')).toBeInTheDocument();
  });

  it('a malformed ?order= is ignored: no sheet, no request', async () => {
    window.history.replaceState(null, '', '/app/activity?order=nope');
    withAccount([ORDER]);
    const reads = withDetail();
    render(<Activity />);
    await region(t('activity.orders.title'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(reads).toEqual([]);
  });

  it('a purchase in Movements opens its order (a purchase movement carries the order id)', async () => {
    withAccount(
      [ORDER],
      [
        activityFixture({ id: AUTH_ID, merchantName: 'Taquería El Sol', itemCount: 3 }),
        activityFixture({ id: 'dep-1', type: 'deposit', status: 'CONFIRMED', merchantName: null }),
      ],
    );
    const reads = withDetail();
    render(<Activity />);
    const movements = await region(t('activity.listTitle'));
    const list = await within(movements).findByRole('list');
    const [purchase, deposit] = within(list).getAllByRole('listitem') as [HTMLElement, HTMLElement];
    expect(within(deposit).queryByRole('link')).not.toBeInTheDocument();
    await user.click(within(purchase).getByRole('link', { name: /Taquería El Sol · 3 artículos/ }));
    expect(await screen.findByRole('dialog', { name: detailName() })).toBeInTheDocument();
    expect(reads).toEqual([AUTH_ID]);
  });

  it('a card purchase without lines says so', async () => {
    const card = {
      merchantName: 'Taquería El Sol',
      status: 'CAPTURED',
      capturedCents: '1250',
    } as const;
    withAccount([authorizationFixture(card)]);
    withDetail(() => json(authorizationDetailFixture(card)));
    render(<Activity />);
    const { sheet } = await openFromList();
    expect(sheet).toHaveTextContent(t('activity.detail.noItems'));
    expect(plain(sheet.textContent)).toContain(
      plain(t('activity.detail.outcome.CAPTURED', { amount: 'USD 12.50' })),
    );
  });
});

/** 23 rows → pages of 10, 10 and 3; each row names its page so a test can tell them apart. */
function pagedRows<T>(build: (page: number, index: number) => T) {
  const requests: { page: string | null; pageSize: string | null }[] = [];
  const answer = (request: Request) => {
    const params = new URL(request.url).searchParams;
    requests.push({ page: params.get('page'), pageSize: params.get('pageSize') });
    const current = Number(params.get('page'));
    const count = current < 3 ? 10 : 3;
    const items = Array.from({ length: count }, (_, index) => build(current, index));
    return json(page(items, { current, total: 23 }));
  };
  return { requests, answer };
}

const pageHex = (current: number, index: number) =>
  `${current.toString(16).padStart(2, '0')}${index.toString(16).padStart(2, '0')}`;

describe('Activity island: numbered pages (10 rows each, page in the URL)', () => {
  beforeEach(() => window.history.replaceState(null, '', '/app/activity'));
  afterEach(() => window.history.replaceState(null, '', '/'));

  function withPagedMovements() {
    const paged = pagedRows((current, index) =>
      activityFixture({ id: `act-${current}-${index}`, merchantName: `Shop p${current}` }),
    );
    withAccount();
    server.use(
      http.get(core(`/accounts/${ACCOUNT_ID}/activity`), async ({ request }) => {
        // The next page arrives late, so the test can see the previous one stay on screen.
        if (new URL(request.url).searchParams.get('page') !== '1') await delay(50);
        return paged.answer(request);
      }),
    );
    return paged.requests;
  }

  it('asks the API for page 1 of 10 rows, counts them and offers the other pages', async () => {
    const requests = withPagedMovements();
    render(<Activity locale="en-US" />);
    const movements = await region(t('activity.listTitle'));
    expect(await within(movements).findAllByText(/Shop p1/)).toHaveLength(10);
    expect(within(movements).getByText('Showing 1–10 of 23')).toBeInTheDocument();
    const nav = within(movements).getByRole('navigation', { name: t('activity.pagesLabel') });
    expect(within(nav).getByRole('button', { name: 'Page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(nav).getByRole('button', { name: t('common.pagination.previous') }),
    ).toBeDisabled();
    expect(requests[0]).toEqual({ page: '1', pageSize: '10' });
  });

  it('a page change keeps the old rows while the next page loads, writes ?movementsPage= and moves focus to the list heading', async () => {
    const requests = withPagedMovements();
    render(<Activity locale="en-US" />);
    const movements = await region(t('activity.listTitle'));
    await within(movements).findAllByText(/Shop p1/);
    const nav = within(movements).getByRole('navigation', { name: t('activity.pagesLabel') });
    await user.click(within(nav).getByRole('button', { name: 'Page 3' }));
    expect(window.location.search).toBe('?movementsPage=3');
    // No skeleton flash: page 1 stays while page 3 is on its way, and the pager waits for it.
    expect(within(movements).getAllByText(/Shop p1/)).toHaveLength(10);
    expect(within(nav).getByRole('button', { name: 'Page 2' })).toBeDisabled();
    expect(await within(movements).findAllByText(/Shop p3/)).toHaveLength(3);
    expect(within(movements).getByText('Showing 21–23 of 23')).toBeInTheDocument();
    expect(within(nav).getByRole('button', { name: 'Page 3' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('button', { name: t('common.pagination.next') })).toBeDisabled();
    expect(screen.getByRole('heading', { name: t('activity.listTitle') })).toHaveFocus();
    expect(requests.map((request) => request.page)).toEqual(['1', '3']);
  });

  it('a shared link opens the orders on its page, and Back walks back a page without the ClientRouter seeing it', async () => {
    const paged = pagedRows((current, index) =>
      authorizationFixture({
        id: `a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b${pageHex(current, index)}`,
        merchantName: `Store p${current}`,
      }),
    );
    withAccount();
    server.use(
      http.get(core(`/accounts/${ACCOUNT_ID}/authorizations`), ({ request }) =>
        paged.answer(request),
      ),
    );
    window.history.replaceState(null, '', '/app/activity?ordersPage=2');
    const router = vi.fn();
    window.addEventListener('popstate', router);
    try {
      render(<Activity locale="en-US" />);
      const orders = await region(t('activity.orders.title'));
      expect(await within(orders).findAllByRole('link', { name: /Store p2/ })).toHaveLength(10);
      expect(within(orders).getByText('Showing 11–20 of 23')).toBeInTheDocument();
      const nav = within(orders).getByRole('navigation', { name: t('activity.orders.pagesLabel') });
      await user.click(within(nav).getByRole('button', { name: t('common.pagination.next') }));
      expect(await within(orders).findAllByRole('link', { name: /Store p3/ })).toHaveLength(3);
      expect(window.location.search).toBe('?ordersPage=3');
      window.history.back();
      expect(await within(orders).findAllByRole('link', { name: /Store p2/ })).toHaveLength(10);
      expect(window.location.search).toBe('?ordersPage=2');
      expect(router).not.toHaveBeenCalled();
      expect(paged.requests.map((request) => request.page)).toEqual(['2', '3']);
    } finally {
      window.removeEventListener('popstate', router);
    }
  });

  it('a list that fits in one page shows no pager', async () => {
    withAccount();
    render(<Activity locale="en-US" />);
    const orders = await region(t('activity.orders.title'));
    await within(orders).findByRole('link', { name: /Corner Grocery/ });
    expect(within(orders).getByText('Showing 1–1 of 1')).toBeInTheDocument();
    expect(within(orders).queryByRole('navigation')).not.toBeInTheDocument();
  });
});

describe('toActivityRow', () => {
  it('words every type, keeps the description, and falls back to "Recorded" for an unknown status', () => {
    setActiveLocale('en-US');
    const row = toActivityRow(
      activityFixture({ type: 'collateral_released', status: 'SETTLED_LATER', description: '' }),
    );
    expect(row.title).toBe(t('activity.type.collateral_released'));
    expect(row.statusLabel).toBe(t('status.recorded'));
    expect(row.tone).toBe('neutral');
    expect(row.detail).toBe('Oct 21, 2026, 12:00 PM');
  });
});

describe('holdPollInterval (W3 stop condition)', () => {
  const now = Date.parse('2026-10-21T12:00:00.000Z');
  it('polls while a fresh hold waits to post, and stops once it posts or ages out', () => {
    const hold = authorizationFixture({
      createdAt: new Date(now - HOLD_WATCH_MS + 1).toISOString(),
    });
    expect(holdPollInterval([hold], now)).toBe(HOLD_POLL_MS);
    expect(
      holdPollInterval([{ ...hold, createdAt: new Date(now - HOLD_WATCH_MS).toISOString() }], now),
    ).toBe(false);
    expect(holdPollInterval([{ ...hold, status: 'CAPTURED' }], now)).toBe(false);
    expect(holdPollInterval(undefined, now)).toBe(false);
  });
});
