import type { Account as AccountData } from '@acme/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { navigateTo } from '@/app/helpers/navigation';
import { t } from '@/app/i18n';
import {
  accountFixture,
  ACCOUNT_ID,
  authorizationFixture,
  depositFixture,
  page,
  PENDING_ACCOUNT,
  repaymentFixture,
} from '@/test/fixtures';
import { apiError, core, json, server, signedIn, signedOut } from '@/test/server';
import Account from '../Account';

vi.mock('@/app/helpers/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/helpers/navigation')>()),
  navigateTo: vi.fn(),
}));

const user = userEvent.setup();

function mockAccount(account: AccountData) {
  server.use(
    http.get(core('/accounts/me'), () => json(account)),
    http.get(core(`/accounts/${ACCOUNT_ID}/authorizations`), () => json(page([]))),
  );
}

describe('Account island: session gate (WA11)', () => {
  beforeEach(() => vi.mocked(navigateTo).mockReset());

  it('sends an anonymous visitor to sign in with a way back', async () => {
    window.history.replaceState(null, '', '/app');
    server.use(signedOut);
    render(<Account />);
    expect(await screen.findByText(t('session.redirecting'))).toBeInTheDocument();
    await waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/signin?returnTo=%2Fapp'));
  });

  it('shows an error with retry when the session cannot be checked, never "signed out"', async () => {
    server.use(http.post(core('/auth/refresh'), () => apiError(503, 'common.internal')));
    render(<Account locale="en-US" />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t('session.checkFailedTitle'));
    expect(navigateTo).not.toHaveBeenCalled();
    server.use(signedIn);
    mockAccount(accountFixture());
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(
      await screen.findByRole('region', { name: t('account.balances.title') }),
    ).toBeInTheDocument();
  });
});

describe('Account island: loading and errors (W13)', () => {
  it('shows the skeleton while loading, then an error with retry', async () => {
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () => apiError(500, 'common.internal')),
    );
    render(<Account locale="en-US" />);
    expect(screen.getByRole('status')).toHaveTextContent(t('account.loading'));
    const alert = await screen.findByRole('alert', {}, { timeout: 4000 });
    expect(alert).toHaveTextContent(t('account.loadFailedTitle'));
    mockAccount(accountFixture());
    await user.click(within(alert).getByRole('button', { name: t('common.retry') }));
    expect(
      await screen.findByRole('region', { name: t('account.balances.title') }),
    ).toBeInTheDocument();
  });
});

describe('Account island: no account yet', () => {
  it('opens the account with an idempotency key, confirms, and moves to the deposit step', async () => {
    let opened = false;
    let key: string | null = null;
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () =>
        opened ? json(PENDING_ACCOUNT) : apiError(404, 'common.not_found'),
      ),
      http.post(core('/accounts'), ({ request }) => {
        key = request.headers.get('idempotency-key');
        opened = true;
        return json(PENDING_ACCOUNT, 201);
      }),
      http.get(core(`/accounts/${ACCOUNT_ID}/deposits`), () => json(page([]))),
    );
    render(<Account locale="en-US" />);
    await user.click(await screen.findByRole('button', { name: t('account.onboarding.open') }));
    expect(await screen.findByText(t('account.toast.opened'))).toBeInTheDocument();
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(await screen.findByRole('heading', { name: t('deposit.title') })).toBeInTheDocument();
  });

  it('says why opening failed, by code', async () => {
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () => apiError(404, 'common.not_found')),
      http.post(core('/accounts'), () => apiError(409, 'account.already_open')),
    );
    render(<Account locale="en-US" />);
    await user.click(await screen.findByRole('button', { name: t('account.onboarding.open') }));
    expect(await screen.findByText(t('errors.account.already_open'))).toBeInTheDocument();
  });
});

describe('Account island: security deposit', () => {
  function pendingCollateral(deposits: unknown[] = []) {
    server.use(
      signedIn,
      http.get(core(`/accounts/${ACCOUNT_ID}/deposits`), () => json(page(deposits))),
    );
    mockAccount(PENDING_ACCOUNT);
  }

  it('validates the deposit range on the client: last passing and first failing values', async () => {
    pendingCollateral();
    render(<Account locale="en-US" />);
    const field = await screen.findByLabelText(t('deposit.amountLabel'));
    const submit = screen.getByRole('button', { name: t('deposit.submit') });
    // The range and the room left under the per-account cap (nothing confirmed yet: all of it).
    expect(
      screen.getByText(
        `${t('deposit.amountHint', { min: '$200.00', max: '$10,000.00' })} ${t('deposit.roomHint', { room: '$10,000.00', cap: '$10,000.00' })}`,
      ),
    ).toBeInTheDocument();

    await user.type(field, '199.99');
    await user.click(submit);
    expect(await screen.findByText(/starts at \$200\.00/)).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, '10,000.01');
    await user.click(submit);
    expect(await screen.findByText(/goes up to \$10,000\.00/)).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, '12.345');
    await user.click(submit);
    expect(await screen.findByText(t('validation.amountInvalid'))).toBeInTheDocument();
  });

  it('requests the deposit, shows where to approve it, and follows it until confirmed', async () => {
    pendingCollateral();
    const created = depositFixture({ amountCents: '20000' });
    let body: unknown;
    let posted = false;
    let confirmed = false;
    server.use(
      http.post(core(`/accounts/${ACCOUNT_ID}/deposits`), async ({ request }) => {
        body = await request.json();
        posted = true;
        return json(created, 201);
      }),
      http.get(core(`/accounts/${ACCOUNT_ID}/deposits`), () =>
        json(page(!posted ? [] : [{ ...created, status: confirmed ? 'CONFIRMED' : 'PENDING' }])),
      ),
      http.get(core('/accounts/me'), () =>
        json(
          confirmed
            ? accountFixture({
                heldCents: '0',
                postedDebtCents: '0',
                availableCents: '20000',
                collateralCents: '20000',
                creditLimitCents: '20000',
              })
            : PENDING_ACCOUNT,
        ),
      ),
    );
    render(<Account locale="en-US" />);
    await user.type(await screen.findByLabelText(t('deposit.amountLabel')), '200');
    await user.click(screen.getByRole('button', { name: t('deposit.submit') }));

    expect(body).toEqual({ amountCents: '20000' });
    expect(
      await screen.findByText(t('deposit.toast.requested', { amount: '$200.00' })),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(t('transfer.deposit.waitingTitle', { amount: '$200.00' })),
    ).toBeInTheDocument();
    const approve = screen.getByRole('link', {
      name: (name) =>
        name.startsWith(t('transfer.approve')) && name.endsWith(t('a11y.opensInNewTab')),
    });
    expect(approve).toHaveAttribute('href', created.checkout.approveUrl);
    expect(approve).toHaveAttribute('target', '_blank');
    expect(screen.queryByLabelText(t('deposit.amountLabel'))).not.toBeInTheDocument();

    confirmed = true;
    // The poll (every 3 s) sees the deposit decided and refreshes the account: the card is live.
    expect(
      await screen.findByRole('region', { name: t('account.balances.title') }, { timeout: 8000 }),
    ).toBeInTheDocument();
  }, 15000);

  it('resumes a pending deposit after a reload (the form stays hidden: one transfer at a time)', async () => {
    pendingCollateral([depositFixture()]);
    render(<Account locale="en-US" />);
    expect(
      await screen.findByText(t('transfer.deposit.waitingTitle', { amount: '$250.50' })),
    ).toBeInTheDocument();
    expect(screen.getByText(t('transfer.waiting'))).toBeInTheDocument();
    expect(screen.queryByLabelText(t('deposit.amountLabel'))).not.toBeInTheDocument();
  });

  it('shows the code copy (with the range) when the API refuses the amount', async () => {
    pendingCollateral();
    server.use(
      http.post(core(`/accounts/${ACCOUNT_ID}/deposits`), () =>
        apiError(422, 'deposit.amount_out_of_range'),
      ),
    );
    render(<Account locale="en-US" />);
    await user.type(await screen.findByLabelText(t('deposit.amountLabel')), '300');
    await user.click(screen.getByRole('button', { name: t('deposit.submit') }));
    expect(
      await screen.findByText(
        t('errors.deposit.amount_out_of_range', {
          depositMin: '$200.00',
          depositMax: '$10,000.00',
        }),
      ),
    ).toBeInTheDocument();
  });

  it('shows the cap copy when a deposit would cross the per-account maximum (422)', async () => {
    pendingCollateral();
    server.use(
      http.post(core(`/accounts/${ACCOUNT_ID}/deposits`), () =>
        apiError(422, 'payment.deposit_cap_exceeded'),
      ),
    );
    render(<Account locale="en-US" />);
    await user.type(await screen.findByLabelText(t('deposit.amountLabel')), '300');
    await user.click(screen.getByRole('button', { name: t('deposit.submit') }));
    expect(await screen.findByText(t('errors.payment.deposit_cap_exceeded'))).toBeInTheDocument();
    // The form stays filled for a smaller amount.
    expect(screen.getByLabelText(t('deposit.amountLabel'))).toHaveValue('300');
  });

  it('a deposit list that fails to load shows an error with retry', async () => {
    server.use(
      signedIn,
      http.get(core(`/accounts/${ACCOUNT_ID}/deposits`), () => apiError(404, 'common.not_found')),
    );
    mockAccount(PENDING_ACCOUNT);
    render(<Account locale="en-US" />);
    expect(await screen.findByText(t('transfer.loadFailedTitle'))).toBeInTheDocument();
  });
});

describe('Account island: open card', () => {
  it('shows every balance in the ledger style, the card and the vault meter', async () => {
    server.use(signedIn);
    mockAccount(accountFixture());
    render(<Account locale="en-US" />);
    const balances = await screen.findByRole('region', { name: t('account.balances.title') });
    const [available] = within(balances).getAllByText(t('account.balances.available'), {
      selector: 'dt',
    });
    expect(available?.nextElementSibling).toHaveTextContent('$340.00');
    expect(
      screen.getByText(t('account.balances.limit'), { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('$500.00');
    expect(screen.getByText(t('account.card.numberLabel', { last4: '4242' }))).toBeInTheDocument();
    const meter = screen.getByRole('figure', { name: t('account.meter.label') });
    expect(meter).toHaveTextContent(`${t('account.meter.collateral')}$500.00`);
    expect(
      within(meter)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual([
      t('account.balances.owed'),
      t('account.balances.onHold'),
      t('account.balances.available'),
    ]);
  });

  it('the home is usage only: a card strip links to the card page, no freeze control', async () => {
    server.use(signedIn);
    mockAccount(accountFixture({ status: 'FROZEN' }));
    render(<Account locale="en-US" />);
    const strip = await screen.findByRole('link', { name: /Your card/ });
    expect(strip).toHaveAttribute('href', '/en/app/card');
    expect(strip).toHaveTextContent(t('status.frozen'));
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: t('account.actions.freeze') }),
    ).not.toBeInTheDocument();
  });
});

describe('Account island: card page', () => {
  async function freezeSwitch() {
    return screen.findByRole('switch', { name: t('card.freeze.label') });
  }

  it('prints the card for the signed-in customer with its details and settings', async () => {
    server.use(signedIn);
    mockAccount(accountFixture());
    render(<Account locale="en-US" screen="card" />);
    expect(await freezeSwitch()).not.toBeChecked();
    expect(screen.getAllByText('Ada Lovelace').length).toBe(2);
    expect(screen.getByText(t('card.secured'))).toBeInTheDocument();
    const details = screen.getByRole('region', { name: t('card.detailsTitle') });
    expect(
      within(details).getByText(t('account.card.expires'), { selector: 'dt' }).nextElementSibling,
    ).toHaveTextContent('08/29');
    expect(within(details).getByText(t('status.active'))).toBeInTheDocument();
    expect(screen.getByText(t('card.limit.body', { limit: '$500.00' }))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('card.close.link') })).toHaveAttribute(
      'href',
      '/en/app/profile',
    );
  });

  it('freezes only after confirming, with an idempotency key, then shows it frozen', async () => {
    let frozen = false;
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () =>
        json(accountFixture({ status: frozen ? 'FROZEN' : 'ACTIVE' })),
      ),
      http.post(core(`/accounts/${ACCOUNT_ID}/freeze`), ({ request }) => {
        frozen = request.headers.get('idempotency-key') !== null;
        return json(accountFixture({ status: 'FROZEN' }));
      }),
      http.post(core(`/accounts/${ACCOUNT_ID}/unfreeze`), () =>
        apiError(409, 'account.not_frozen'),
      ),
    );
    render(<Account locale="en-US" screen="card" />);
    await user.click(await freezeSwitch());
    const dialog = await screen.findByRole('dialog', { name: t('card.freeze.freezeTitle') });
    expect(frozen).toBe(false);
    expect(
      screen.getByRole('switch', { name: t('card.freeze.label'), hidden: true }),
    ).not.toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: t('card.freeze.freezeConfirm') }));
    expect(await screen.findByText(t('account.toast.frozen'))).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(t('account.frozenTitle'))).toBeInTheDocument();
    expect(await freezeSwitch()).toBeChecked();
    await user.click(await freezeSwitch());
    const unfreeze = await screen.findByRole('dialog', { name: t('card.freeze.unfreezeTitle') });
    await user.click(
      within(unfreeze).getByRole('button', { name: t('card.freeze.unfreezeConfirm') }),
    );
    expect(await screen.findByText(t('errors.account.not_frozen'))).toBeInTheDocument();
    // A refused unfreeze keeps the dialog open (W5: it closes on success only).
    expect(
      screen.getByRole('dialog', { name: t('card.freeze.unfreezeTitle') }),
    ).toBeInTheDocument();
  });

  it('cancelling the confirmation changes nothing', async () => {
    let calls = 0;
    server.use(
      signedIn,
      http.post(core(`/accounts/${ACCOUNT_ID}/freeze`), () => {
        calls += 1;
        return json(accountFixture({ status: 'FROZEN' }));
      }),
    );
    mockAccount(accountFixture());
    render(<Account locale="en-US" screen="card" />);
    await user.click(await freezeSwitch());
    const dialog = await screen.findByRole('dialog', { name: t('card.freeze.freezeTitle') });
    await user.click(within(dialog).getByRole('button', { name: t('card.freeze.cancel') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls).toBe(0);
    expect(await freezeSwitch()).not.toBeChecked();
  });

  it('unfreezes a frozen card', async () => {
    server.use(
      signedIn,
      http.post(core(`/accounts/${ACCOUNT_ID}/unfreeze`), () => json(accountFixture())),
    );
    mockAccount(accountFixture({ status: 'FROZEN' }));
    render(<Account locale="en-US" screen="card" />);
    await user.click(await freezeSwitch());
    const dialog = await screen.findByRole('dialog', { name: t('card.freeze.unfreezeTitle') });
    await user.click(
      within(dialog).getByRole('button', { name: t('card.freeze.unfreezeConfirm') }),
    );
    expect(await screen.findByText(t('account.toast.unfrozen'))).toBeInTheDocument();
  });

  it('freeze failure without a code shows the action fallback', async () => {
    server.use(
      signedIn,
      http.post(core(`/accounts/${ACCOUNT_ID}/freeze`), () => new Response(null, { status: 502 })),
    );
    mockAccount(accountFixture());
    render(<Account locale="en-US" screen="card" />);
    await user.click(await freezeSwitch());
    const dialog = await screen.findByRole('dialog', { name: t('card.freeze.freezeTitle') });
    await user.click(within(dialog).getByRole('button', { name: t('card.freeze.freezeConfirm') }));
    expect(await screen.findByText(t('account.toast.freezeFailed'))).toBeInTheDocument();
  });

  it('raises the limit from the card page through the deposit dialog', async () => {
    server.use(
      signedIn,
      http.get(core(`/accounts/${ACCOUNT_ID}/deposits`), () => json(page([]))),
    );
    mockAccount(accountFixture());
    render(<Account locale="en-US" screen="card" />);
    await user.click(await screen.findByRole('button', { name: t('account.actions.deposit') }));
    const dialog = await screen.findByRole('dialog', { name: t('deposit.addTitle') });
    expect(await within(dialog).findByLabelText(t('deposit.amountLabel'))).toBeInTheDocument();
  });

  it('shows the room left under the cap in the deposit dialog', async () => {
    server.use(
      signedIn,
      http.get(core(`/accounts/${ACCOUNT_ID}/deposits`), () => json(page([]))),
    );
    mockAccount(accountFixture({ collateralCents: '250050' }));
    render(<Account locale="en-US" screen="card" />);
    await user.click(await screen.findByRole('button', { name: t('account.actions.deposit') }));
    const dialog = await screen.findByRole('dialog', { name: t('deposit.addTitle') });
    expect(
      await within(dialog).findByText(
        t('deposit.roomHint', { room: '$7,499.50', cap: '$10,000.00' }),
        { exact: false },
      ),
    ).toBeInTheDocument();
  });

  it('at the cap the deposit dialog explains it instead of offering the form', async () => {
    server.use(
      signedIn,
      http.get(core(`/accounts/${ACCOUNT_ID}/deposits`), () => json(page([]))),
    );
    mockAccount(accountFixture({ collateralCents: '980001', creditLimitCents: '980001' }));
    render(<Account locale="en-US" screen="card" />);
    await user.click(await screen.findByRole('button', { name: t('account.actions.deposit') }));
    const dialog = await screen.findByRole('dialog', { name: t('deposit.addTitle') });
    expect(await within(dialog).findByText(t('deposit.capReachedTitle'))).toBeInTheDocument();
    expect(
      within(dialog).getByText(t('deposit.capReachedBody', { cap: '$10,000.00' })),
    ).toBeInTheDocument();
    expect(within(dialog).queryByLabelText(t('deposit.amountLabel'))).not.toBeInTheDocument();
  });

  it('a card Acme Credit froze says so and offers no unfreeze switch', async () => {
    server.use(signedIn);
    mockAccount(accountFixture({ status: 'FROZEN', frozenBy: 'ADMIN' }));
    render(<Account locale="en-US" screen="card" />);
    expect(await screen.findByText(t('card.adminFrozen.title'))).toBeInTheDocument();
    expect(screen.getByText(t('card.adminFrozen.body'))).toBeInTheDocument();
    expect(screen.queryByRole('switch', { name: t('card.freeze.label') })).not.toBeInTheDocument();
    expect(screen.queryByText(t('account.frozenTitle'))).not.toBeInTheDocument();
  });

  it('a card the customer froze keeps its switch and the customer notice', async () => {
    server.use(signedIn);
    mockAccount(accountFixture({ status: 'FROZEN', frozenBy: 'CUSTOMER' }));
    render(<Account locale="en-US" screen="card" />);
    expect(await freezeSwitch()).toBeChecked();
    expect(screen.getByText(t('account.frozenTitle'))).toBeInTheDocument();
    expect(screen.queryByText(t('card.adminFrozen.title'))).not.toBeInTheDocument();
  });

  it('without an open card it points back to the wallet', async () => {
    server.use(signedIn);
    mockAccount(PENDING_ACCOUNT);
    render(<Account locale="en-US" screen="card" />);
    expect(await screen.findByText(t('card.noCardTitle'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('common.backToAccount') })).toHaveAttribute(
      'href',
      '/en/app',
    );
  });
});

describe('Account island: payments and deposits from the home', () => {
  it('a payment can never exceed what is owed; a valid one waits for the bank', async () => {
    let body: unknown;
    server.use(
      signedIn,
      http.get(core(`/accounts/${ACCOUNT_ID}/repayments`), () =>
        json(page(body ? [repaymentFixture()] : [])),
      ),
      http.post(core(`/accounts/${ACCOUNT_ID}/repayments`), async ({ request }) => {
        body = await request.json();
        return json(repaymentFixture(), 201);
      }),
    );
    mockAccount(accountFixture());
    render(<Account locale="en-US" />);
    await user.click(await screen.findByRole('button', { name: t('account.actions.payment') }));
    const dialog = await screen.findByRole('dialog', { name: t('payment.title') });
    expect(
      within(dialog).getByText(t('payment.amountHint', { owed: '$120.00' })),
    ).toBeInTheDocument();
    const field = within(dialog).getByLabelText(t('payment.amountLabel'));
    await user.type(field, '120.01');
    await user.click(within(dialog).getByRole('button', { name: t('payment.submit') }));
    expect(await within(dialog).findByText(t('validation.paymentAboveOwed'))).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, '50.25');
    await user.click(within(dialog).getByRole('button', { name: t('payment.submit') }));
    expect(
      await within(dialog).findByText(t('transfer.repayment.waitingTitle', { amount: '$50.25' })),
    ).toBeInTheDocument();
    expect(body).toEqual({ amountCents: '5025' });
    expect(
      await screen.findByText(t('payment.toast.requested', { amount: '$50.25' })),
    ).toBeInTheDocument();
  });

  it('shows the code copy when the API refuses a payment', async () => {
    server.use(
      signedIn,
      http.get(core(`/accounts/${ACCOUNT_ID}/repayments`), () => json(page([]))),
      http.post(core(`/accounts/${ACCOUNT_ID}/repayments`), () =>
        apiError(422, 'repayment.exceeds_debt'),
      ),
    );
    mockAccount(accountFixture());
    render(<Account locale="en-US" />);
    await user.click(await screen.findByRole('button', { name: t('account.actions.payment') }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(t('payment.amountLabel')), '10');
    await user.click(within(dialog).getByRole('button', { name: t('payment.submit') }));
    expect(await screen.findByText(t('errors.repayment.exceeds_debt'))).toBeInTheDocument();
  });

  it('with nothing owed, the payment dialog says so instead of a form', async () => {
    server.use(
      signedIn,
      http.get(core(`/accounts/${ACCOUNT_ID}/repayments`), () => json(page([]))),
    );
    mockAccount(accountFixture({ postedDebtCents: '0', availableCents: '46000' }));
    render(<Account locale="en-US" />);
    await user.click(await screen.findByRole('button', { name: t('account.actions.payment') }));
    expect(await screen.findByText(t('payment.noDebtTitle'))).toBeInTheDocument();
  });

  it('adds to the deposit from a dialog and reports a confirmed one', async () => {
    const confirmed = depositFixture({
      status: 'CONFIRMED',
      confirmedAt: '2026-10-21T10:01:00.000Z',
    });
    let created = false;
    server.use(
      signedIn,
      http.get(core(`/accounts/${ACCOUNT_ID}/deposits`), () =>
        json(page(created ? [confirmed] : [])),
      ),
      http.post(core(`/accounts/${ACCOUNT_ID}/deposits`), () => {
        created = true;
        return json(depositFixture(), 201);
      }),
    );
    mockAccount(accountFixture());
    render(<Account locale="en-US" />);
    await user.click(await screen.findByRole('button', { name: t('account.actions.deposit') }));
    const dialog = await screen.findByRole('dialog', { name: t('deposit.addTitle') });
    await user.type(within(dialog).getByLabelText(t('deposit.amountLabel')), '250.50');
    await user.click(within(dialog).getByRole('button', { name: t('deposit.addSubmit') }));
    expect(
      await within(dialog).findByText(t('transfer.deposit.confirmedTitle', { amount: '$250.50' })),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t('common.done') }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Account island: closed account', () => {
  it('without settlement lines still offers a new card', async () => {
    let reopened = false;
    server.use(
      signedIn,
      http.get(core(`/accounts/${ACCOUNT_ID}/activity`), () => json(page([]))),
      http.get(core('/accounts/me'), () =>
        json(reopened ? PENDING_ACCOUNT : accountFixture({ status: 'CLOSED' })),
      ),
      http.post(core('/accounts'), () => {
        reopened = true;
        return json(PENDING_ACCOUNT, 201);
      }),
      http.get(core(`/accounts/${ACCOUNT_ID}/deposits`), () => json(page([]))),
    );
    render(<Account locale="en-US" />);
    await user.click(await screen.findByRole('button', { name: t('closed.openNew') }));
    expect(await screen.findByRole('heading', { name: t('deposit.title') })).toBeInTheDocument();
  });

  it('a settlement that fails to load shows an error with retry', async () => {
    server.use(
      signedIn,
      http.get(core(`/accounts/${ACCOUNT_ID}/activity`), () => apiError(404, 'common.not_found')),
    );
    mockAccount(accountFixture({ status: 'CLOSED' }));
    render(<Account locale="en-US" />);
    expect(await screen.findByText(t('closed.loadFailedTitle'))).toBeInTheDocument();
  });
});

describe('Account island: wallet home (es-MX default)', () => {
  it('greets, links the store as the main action and lists the newest orders with their items', async () => {
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () => json(accountFixture())),
      http.get(core(`/accounts/${ACCOUNT_ID}/authorizations`), () =>
        json(
          page([
            authorizationFixture({
              merchantName: 'Taquería El Sol',
              amountCents: '2900',
              status: 'CAPTURED',
              items: [
                {
                  sku: 'TAC-PASTOR',
                  name: 'Al pastor tacos (order)',
                  quantity: 2,
                  unitCents: '850',
                },
              ],
            }),
          ]),
        ),
      ),
    );
    render(<Account />);
    expect(await screen.findByText(t('account.greeting', { name: 'Ada' }))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('account.actions.shop') })).toHaveAttribute(
      'href',
      '/app/store',
    );
    const recent = await screen.findByRole('region', { name: t('account.recent.title') });
    expect(await within(recent).findByText('Taquería El Sol · 2 artículos')).toBeInTheDocument();
    expect(within(recent).getByText(t('status.posted'))).toBeInTheDocument();
    // Each recent order opens its detail on the Activity page.
    expect(
      within(recent)
        .getByRole('link', { name: /Taquería El Sol · 2 artículos/ })
        .getAttribute('href'),
    ).toMatch(/^\/app\/activity\?order=[0-9a-f-]{36}$/);
    expect(within(recent).getByRole('link', { name: t('account.recent.seeAll') })).toHaveAttribute(
      'href',
      '/app/activity',
    );
  });

  it('on English pages every link stays under /en', async () => {
    server.use(signedIn);
    mockAccount(accountFixture());
    render(<Account locale="en-US" />);
    expect(await screen.findByRole('link', { name: 'Go to the store' })).toHaveAttribute(
      'href',
      '/en/app/store',
    );
    expect(await screen.findByText(t('account.recent.emptyTitle'))).toBeInTheDocument();
  });
});
