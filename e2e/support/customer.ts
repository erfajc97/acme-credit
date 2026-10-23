import { randomBytes } from 'node:crypto';
import { expect, type Locator, type Page, type Response } from '@playwright/test';
import type { Account, CheckoutResult } from '../../packages/contracts/src';
import { findProduct, type StoreProduct } from '../../packages/contracts/src/store';
import type { NewCustomer } from './api';
import { e2eMarker, type Created } from './fixtures';
import { LOCALE, money, webPath, webT } from './i18n';
import { approveInBankTab, expectSameDocument, isPhoneLayout, markDocument, valueOf } from './ui';
import { API_URL, NETWORK_URL, WEB_URL } from './urls';

/**
 * A customer nobody has used before: the marker in the e-mail and the name (so the sweep finds
 * it), and a random password typed like a person would (never a seeded or demo value).
 */
export function newCustomer(): NewCustomer {
  const marker = e2eMarker();
  return {
    fullName: `${marker} Golden`,
    email: `${marker}@example.com`,
    password: `${randomBytes(12).toString('base64url')}-Aa9`,
  };
}

/** A catalog product as the store shows it in the suite's language. */
export function product(sku: string): StoreProduct & { label: string } {
  const found = findProduct(sku);
  if (!found) throw new Error(`e2e: no product ${sku} in the catalog`);
  return { ...found, label: found.name[LOCALE === 'en-US' ? 'en' : 'es'] };
}

const isPost = (url: string) => (response: Response) =>
  response.request().method() === 'POST' && response.url() === url;

/** The section links: the side bar from lg, the bottom tab bar on phones. */
export function appNav(page: Page) {
  return page.getByRole('navigation', {
    name: webT(isPhoneLayout(page) ? 'a11y.tabNav' : 'a11y.accountNav'),
  });
}

/** Sign-up by typing every field, then the app's own same-document move to the wallet. */
export async function signUp(page: Page, customer: NewCustomer): Promise<void> {
  await page.goto(`${WEB_URL}${webPath('/signup')}`);
  const submit = page.getByRole('button', { name: webT('auth.signUp.submit') });
  // Disabled until the island hydrates: typing before that would be lost.
  await expect(submit).toBeEnabled({ timeout: 15_000 });
  await page.getByLabel(webT('auth.fields.fullName')).fill(customer.fullName);
  await page.getByLabel(webT('auth.fields.email')).fill(customer.email);
  await page.getByLabel(webT('auth.fields.newPassword')).fill(customer.password);
  await markDocument(page);
  const registered = page.waitForResponse(isPost(`${API_URL}/v1/auth/register`));
  await submit.click();
  expect((await registered).status()).toBe(201);
  await expect(page).toHaveURL(`${WEB_URL}${webPath('/app')}`);
  await expectSameDocument(page);
}

/** Opens the secured card from the wallet's onboarding; the account is tracked for teardown. */
export async function openAccount(page: Page, created: Created): Promise<Account> {
  const opened = page.waitForResponse(isPost(`${API_URL}/v1/accounts`));
  await page.getByRole('button', { name: webT('account.onboarding.open') }).click();
  const response = await opened;
  expect(response.status()).toBe(201);
  const account = (await response.json()) as Account;
  created.track('account', account.id);
  await expect(page.getByRole('heading', { name: webT('deposit.title') })).toBeVisible();
  return account;
}

/**
 * Requests a transfer from an amount form (deposit or payment) and approves it at the bank in a
 * new tab. The caller asserts what the app shows once its own poll sees the bank's answer (the
 * first deposit replaces the whole screen with the active card). Returns the bank tab's problems.
 */
export async function payThroughBank(
  page: Page,
  input: {
    scope: Page | Locator;
    kind: 'deposit' | 'repayment';
    submitLabel: string;
    amountCents: bigint;
  },
): Promise<string[]> {
  const { scope } = input;
  const amount = money(input.amountCents);
  const amountLabel = webT(
    input.kind === 'deposit' ? 'deposit.amountLabel' : 'payment.amountLabel',
  );
  await scope.getByLabel(amountLabel).fill(centsAsTyped(input.amountCents));
  await scope.getByRole('button', { name: input.submitLabel }).click();
  const copy = input.kind === 'deposit' ? 'transfer.deposit' : 'transfer.repayment';
  await expect(scope.getByText(webT(`${copy}.waitingTitle`, { amount }))).toBeVisible();
  return approveInBankTab(page, scope.getByRole('link', { name: webT('transfer.approve') }));
}

/** "250.75" as a customer types it (the field's own decimal format). */
function centsAsTyped(cents: bigint): string {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

/** The wallet's "available to spend" figure (the hero) and the limit meter's own figures. */
export function walletFigures(page: Page) {
  const balances = page.getByRole('region', { name: webT('account.balances.title') });
  const usage = page.getByRole('region', { name: webT('account.usage.title') });
  return {
    available: valueOf(balances, webT('account.balances.available')),
    limit: valueOf(usage, webT('account.balances.limit')),
    owed: valueOf(usage, webT('account.balances.owed')),
    held: valueOf(usage, webT('account.balances.onHold')),
    meterAvailable: valueOf(usage, webT('account.balances.available')),
  };
}

/** Adds `quantity` of a product from the store grid (Add, then the stepper's "one more"). */
export async function addToCart(page: Page, sku: string, quantity: number): Promise<void> {
  const item = product(sku);
  await page.getByRole('button', { name: webT('store.addLabel', { product: item.label }) }).click();
  // The grid's stepper comes first in the page (desktop also shows one in the cart panel).
  const stepper = page
    .getByRole('group', { name: webT('store.quantityLabel', { product: item.label }) })
    .first();
  await expect(stepper.getByRole('status')).toHaveText('1');
  for (let count = 2; count <= quantity; count += 1) {
    await stepper
      .getByRole('button', { name: webT('store.increaseLabel', { product: item.label }) })
      .click();
    await expect(stepper.getByRole('status')).toHaveText(String(count));
  }
}

/** From the store to checkout: the cart panel on desktop, the cart bar and its sheet on phones. */
export async function goToCheckout(
  page: Page,
  cart: { items: number; totalCents: bigint },
): Promise<void> {
  if (isPhoneLayout(page)) {
    const items =
      cart.items === 1
        ? webT('store.cart.itemsOne')
        : webT('store.cart.itemsOther', { count: cart.items });
    await page
      .getByRole('button', {
        name: webT('store.cart.open', { items, total: money(cart.totalCents) }),
      })
      .click();
  } else {
    const panel = page.getByRole('complementary', { name: webT('store.cart.title') });
    await expect(valueOf(panel, webT('store.cart.total'))).toHaveText(money(cart.totalCents));
  }
  await page.getByRole('link', { name: webT('store.cart.checkout') }).click();
  await expect(page).toHaveURL(`${WEB_URL}${webPath('/app/checkout')}`);
}

/** Presses Pay and returns the card network's answer (tracked for teardown when it holds money). */
export async function pay(
  page: Page,
  input: { totalCents: bigint; created: Created },
): Promise<CheckoutResult> {
  const answered = page.waitForResponse(isPost(`${NETWORK_URL}/v1/checkout`));
  await page
    .getByRole('button', { name: webT('checkout.confirm', { total: money(input.totalCents) }) })
    .click();
  const response = await answered;
  expect(response.status()).toBe(201);
  const result = (await response.json()) as CheckoutResult;
  if (result.status === 'APPROVED') input.created.track('authorization', result.authorizationId);
  return result;
}
