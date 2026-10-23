import { expect, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import type { Account, Authorization, CheckoutResult } from '../../packages/contracts/src';
import { MIN_DEPOSIT_CENTS } from '../../packages/contracts/src/money';
import {
  approveAtBank,
  checkout,
  myAccount,
  myAuthorizations,
  openAccount,
  registerCustomer,
  requestDeposit,
  type NewCustomer,
} from './api';
import { newCustomer, product } from './customer';
import { requireEnv } from './env';
import type { Created } from './fixtures';
import { adminPath, adminT } from './i18n';
import { isPhoneLayout, waitForHydration } from './ui';
import { ADMIN_URL, API_URL } from './urls';

export interface StorePurchase {
  customer: NewCustomer;
  account: Account;
  purchase: CheckoutResult;
}

/**
 * A fresh customer with an active card and one posted store purchase, made through the same HTTP
 * doors the customer app uses (the customer journey itself is the customer spec's subject).
 */
export async function postedStorePurchase(
  api: APIRequestContext,
  input: { created: Created; sku: string; quantity: number },
): Promise<StorePurchase> {
  const customer = newCustomer();
  const { accessToken: token } = await registerCustomer(api, customer);
  const opened = await openAccount(api, token);
  input.created.track('account', opened.id);
  const deposit = await requestDeposit(api, {
    token,
    accountId: opened.id,
    amountCents: MIN_DEPOSIT_CENTS,
  });
  await approveAtBank(api, deposit.checkout.approveUrl);
  // The bank's webhook confirms the deposit asynchronously; the card is active once it lands.
  await expect
    .poll(async () => (await myAccount(api, token)).status, { timeout: 20_000 })
    .toBe('ACTIVE');
  const account = await myAccount(api, token);
  if (!account.card) throw new Error('e2e: an active account without a card');
  const purchase = await checkout(api, {
    cardToken: account.card.token,
    merchant: product(input.sku).merchant,
    items: [{ sku: input.sku, quantity: input.quantity }],
  });
  expect(purchase.status).toBe('APPROVED');
  input.created.track('authorization', purchase.authorizationId);
  // The network posts (captures) the hold a few seconds later; the ledger entry exists after that.
  const statusOf = async (): Promise<Authorization['status'] | undefined> =>
    (await myAuthorizations(api, { token, accountId: account.id })).find(
      (item) => item.id === purchase.authorizationId,
    )?.status;
  await expect.poll(statusOf, { timeout: 20_000 }).toBe('CAPTURED');
  return { customer, account, purchase };
}

/** Operator sign-in through the console's form, with the seeded admin from the root .env. */
export async function signInToAdmin(page: Page): Promise<void> {
  await page.goto(`${ADMIN_URL}${adminPath('/signin')}`);
  const email = page.getByLabel(adminT('auth.fields.email'));
  await waitForHydration(email);
  await email.fill(requireEnv('SEED_ADMIN_EMAIL'));
  await page.getByLabel(adminT('auth.fields.password')).fill(requireEnv('SEED_ADMIN_PASSWORD'));
  const answered = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' && response.url() === `${API_URL}/v1/auth/login`,
  );
  await page.getByRole('button', { name: adminT('auth.signIn.submit') }).click();
  // The status says why a sign-in did not land (429: the throttle is shared by every client).
  expect((await answered).status(), 'admin sign-in answer').toBe(200);
  await expect(page).toHaveURL(`${ADMIN_URL}${adminPath('/dashboard')}`);
}

/** The console's section links (one row that scrolls sideways on phones, the side bar from lg). */
/**
 * The console's sections. Below lg they live in the hamburger drawer, so it is opened first
 * (the drawer closes itself after a link is followed).
 */
export async function consoleNav(page: Page) {
  const menu = page.getByRole('button', { name: adminT('nav.menu') });
  if (await menu.isVisible()) await menu.click();
  return page.getByRole('navigation', { name: adminT('a11y.mainNav') });
}

/**
 * The row of a data table that mentions `text`: a table row from lg, a card (list item) on phones,
 * where the console renders tables as cards (W9).
 */
export function dataRow(page: Page, text: string, within: Page | Locator = page) {
  return within.getByRole(isPhoneLayout(page) ? 'listitem' : 'row').filter({ hasText: text });
}
