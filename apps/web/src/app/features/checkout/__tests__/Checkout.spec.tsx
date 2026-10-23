import type { CheckoutResult } from '@acme/contracts';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { setActiveLocale, t } from '@/app/i18n';
import { useCartStore } from '@/app/store/cartStore';
import {
  accountFixture,
  ACCOUNT_ID,
  authorizationFixture,
  page,
  PENDING_ACCOUNT,
} from '@/test/fixtures';
import { core, json, network, server, signedIn } from '@/test/server';
import { plain } from '@/test/text';
import Checkout from '../Checkout';
import { checkoutOutcome } from '../helpers/checkoutOutcome';

const user = userEvent.setup();
const AUTH_ID = authorizationFixture().id;

function result(overrides: Partial<CheckoutResult> = {}): CheckoutResult {
  return {
    authorizationId: AUTH_ID,
    status: 'APPROVED',
    declineReason: null,
    availableCents: '31100',
    merchantName: 'Taquería El Sol',
    totalCents: '2050',
    lines: [
      { sku: 'TAC-PASTOR', name: 'Al pastor tacos (order)', quantity: 2, unitCents: '850' },
      { sku: 'TAC-HORCH', name: 'Horchata', quantity: 1, unitCents: '350' },
    ],
    ...overrides,
  };
}

/** The account answers 340.00 available, then what the order left (after the refetch). */
function withAccount(availableAfter = '31950') {
  let calls = 0;
  server.use(
    signedIn,
    http.get(core('/accounts/me'), () => {
      calls += 1;
      return json(accountFixture(calls > 1 ? { availableCents: availableAfter } : {}));
    }),
    http.get(core(`/accounts/${ACCOUNT_ID}/authorizations`), () => json(page([]))),
  );
}

function fillCart() {
  useCartStore.getState().add('TAC-PASTOR');
  useCartStore.getState().add('TAC-PASTOR');
  useCartStore.getState().add('TAC-HORCH');
}

const payButton = (total: string) =>
  screen.findByRole('button', { name: t('checkout.confirm', { total }) });

describe('Checkout island', () => {
  it('reviews the order against what is available, pays with a key and shows the receipt', async () => {
    withAccount();
    fillCart();
    let body: unknown;
    let key: string | null = null;
    server.use(
      http.post(network('/checkout'), async ({ request }) => {
        key = request.headers.get('idempotency-key');
        body = await request.json();
        return json(result(), 201);
      }),
    );
    render(<Checkout locale="en-US" />);
    const order = await screen.findByRole('region', { name: t('checkout.linesTitle') });
    expect(order).toHaveTextContent('Al pastor tacos (order)');
    expect(order).toHaveTextContent('2 × $8.50');
    const payment = screen.getByRole('region', { name: t('checkout.summaryTitle') });
    expect(payment).toHaveTextContent(`${t('checkout.available')}$340.00`);
    expect(payment).toHaveTextContent(`${t('checkout.leftAfter')}$319.50`);
    expect(within(payment).queryByText(t('checkout.overLimitTitle'))).not.toBeInTheDocument();
    await user.click(await payButton('$20.50'));
    const receipt = await screen.findByRole('region', {
      name: t('checkout.result.approvedTitle', { total: '$20.50', merchant: 'Taquería El Sol' }),
    });
    // Focus lands on the outcome (the Pay button is gone) and the intro says what this is now.
    expect(within(receipt).getByRole('heading', { level: 2 })).toHaveFocus();
    expect(screen.getByText(t('checkout.resultIntro'))).toBeInTheDocument();
    expect(screen.queryByText(t('checkout.pageIntro'))).not.toBeInTheDocument();
    expect(body).toEqual({
      cardToken: 'tok_demo_4242',
      merchant: 'taqueria',
      items: [
        { sku: 'TAC-PASTOR', quantity: 2 },
        { sku: 'TAC-HORCH', quantity: 1 },
      ],
    });
    expect(key).toMatch(/^[0-9a-f-]{36}$/);
    expect(receipt).toHaveTextContent(t('checkout.result.onHold'));
    // "Available now" is the account as refetched after the order (invalidated by ACCOUNT_KEY).
    expect(receipt).toHaveTextContent(`${t('checkout.result.newAvailable')}$319.50`);
    expect(useCartStore.getState().quantities).toEqual({});
    expect(
      within(receipt).getByRole('link', { name: t('checkout.result.keepShopping') }),
    ).toHaveAttribute('href', '/en/app/store');
  });

  it('warns above "available" with both amounts but still sends; the decline keeps the cart and says why', async () => {
    withAccount();
    server.use(
      http.get(core('/accounts/me'), () => json(accountFixture({ availableCents: '1000' }))),
    );
    fillCart();
    server.use(
      http.post(network('/checkout'), () =>
        json(
          result({
            status: 'DECLINED',
            declineReason: 'insufficient_funds',
            availableCents: '1000',
            lines: [],
          }),
          201,
        ),
      ),
    );
    render(<Checkout />);
    const notice = await screen.findByText(t('checkout.overLimitTitle'));
    expect(plain(notice.parentElement?.textContent)).toContain(
      'El total de USD 20.50 es mayor que tu disponible de USD 10.00',
    );
    expect(screen.queryByText(t('checkout.leftAfter'))).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^Pagar USD/ }));
    const alert = await screen.findByRole('alert');
    expect(plain(alert.textContent)).toContain(
      'Este pedido de USD 20.50 se rechazó: es más que tu disponible de USD 10.00.',
    );
    expect(alert).toHaveTextContent(t('checkout.result.nothingCharged'));
    expect(screen.getByRole('heading', { level: 2, name: /20.50/ })).toHaveFocus();
    expect(screen.getByRole('link', { name: t('checkout.result.makePayment') })).toHaveAttribute(
      'href',
      '/app',
    );
    expect(useCartStore.getState().quantities).toEqual({ 'TAC-PASTOR': 2, 'TAC-HORCH': 1 });
  });

  it('without an answer it toasts that retrying is safe, and the retry reuses the same key (one order)', async () => {
    withAccount();
    fillCart();
    const keys: (string | null)[] = [];
    server.use(
      http.post(network('/checkout'), ({ request }) => {
        keys.push(request.headers.get('idempotency-key'));
        return keys.length === 1 ? new Response(null, { status: 504 }) : json(result(), 201);
      }),
    );
    render(<Checkout locale="en-US" />);
    await user.click(await payButton('$20.50'));
    expect(await screen.findByText(t('checkout.toast.failed'))).toBeInTheDocument();
    await user.click(await payButton('$20.50'));
    expect(await screen.findByText(t('checkout.result.onHold'))).toBeInTheDocument();
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  it('an empty cart teaches the way to the store', async () => {
    withAccount();
    render(<Checkout />);
    expect(await screen.findByText(t('checkout.emptyTitle'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('checkout.backToStore') })).toHaveAttribute(
      'href',
      '/app/store',
    );
  });

  it('a frozen card is said in words before paying', async () => {
    withAccount();
    server.use(http.get(core('/accounts/me'), () => json(accountFixture({ status: 'FROZEN' }))));
    fillCart();
    render(<Checkout />);
    expect(await screen.findByText(t('checkout.frozenNotice'))).toBeInTheDocument();
  });

  it('without an active card points back to the wallet', async () => {
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () => json(PENDING_ACCOUNT)),
    );
    fillCart();
    render(<Checkout />);
    expect(await screen.findByText(t('checkout.noCardTitle'))).toBeInTheDocument();
  });
});

describe('checkoutOutcome', () => {
  it('names the total (and what was available) for every decline reason, with a next step', () => {
    setActiveLocale('en-US');
    for (const reason of [
      'insufficient_funds',
      'card_frozen',
      'account_not_active',
      'invalid_card',
    ] as const) {
      const outcome = checkoutOutcome(
        result({ status: 'DECLINED', declineReason: reason, availableCents: null }),
        '600',
      );
      expect(outcome.kind).toBe('declined');
      if (outcome.kind === 'declined') {
        expect(t(outcome.bodyKey, outcome.params)).toContain('$20.50');
        expect(t(outcome.next.labelKey)).not.toBe(outcome.next.labelKey);
      }
    }
    const funds = checkoutOutcome(
      result({ status: 'DECLINED', declineReason: 'insufficient_funds', availableCents: null }),
      '600',
    );
    expect(funds.kind === 'declined' && t(funds.bodyKey, funds.params)).toContain(
      'your available $6.00',
    );
  });

  it('a decline without a reason reads as an unrecognized card', () => {
    const outcome = checkoutOutcome(result({ status: 'DECLINED', declineReason: null }), '600');
    expect(outcome.kind === 'declined' && outcome.bodyKey).toBe('checkout.decline.invalid_card');
  });

  it('an approval is a receipt of the priced lines in the page language', () => {
    const outcome = checkoutOutcome(result(), '34000');
    expect(outcome.kind === 'approved' && outcome.lines.map((line) => line.name)).toEqual([
      'Orden de tacos al pastor',
      'Agua de horchata',
    ]);
  });
});
