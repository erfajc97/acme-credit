import type { Page } from '@playwright/test';
import { MIN_DEPOSIT_CENTS } from '../../packages/contracts/src/money';
import { STORE_MERCHANTS } from '../../packages/contracts/src/store';
import {
  addToCart,
  appNav,
  goToCheckout,
  newCustomer,
  openAccount,
  pay,
  payThroughBank,
  product,
  signUp,
  walletFigures,
} from '../support/customer';
import { expect, test } from '../support/fixtures';
import { money, webPath, webT } from '../support/i18n';
import { expectNoHorizontalScroll, expectSameDocument, markDocument, valueOf } from '../support/ui';
import { WEB_URL } from '../support/urls';
import { watch } from '../support/watch';

/**
 * F8 / R-01…R-05: the whole life of a secured card, as a customer lives it — deposit, activation
 * with limit = deposit, a purchase inside the limit, a purchase over it declined with its reason,
 * a repayment that restores what is available, and closing with the deposit returned. Amounts are
 * read from the screen at every step; a broken step changes one of them.
 */
const DEPOSIT = MIN_DEPOSIT_CENTS; // USD 200.00: the smallest deposit the policy accepts.
const TACOS = product('TAC-PASTOR'); // USD 8.50, inside the limit
const EARBUDS = product('ELC-EARBUDS'); // 3 × USD 79.99 = USD 239.97, over what is left
const EARBUDS_QUANTITY = 3;
const OVER_LIMIT_TOTAL = EARBUDS.priceCents * BigInt(EARBUDS_QUANTITY);
const AFTER_PURCHASE = DEPOSIT - TACOS.priceCents;
const TACOS_MERCHANT = STORE_MERCHANTS[TACOS.merchant].name;

test.describe.configure({ timeout: 180_000 });

test('customer: sign up → deposit → active card → buy → over-limit decline → repay → close', async ({
  page,
  created,
}) => {
  // A brand-new customer has no account yet: the API answers that with 404 (A7) once, and the
  // wallet shows the onboarding. Any other failure, or a second one, is a problem.
  const problems = watch(page, [{ status: 404, url: /\/v1\/accounts\/me$/, times: 1 }]);
  const bankProblems: string[] = [];
  const nav = (key: string) => appNav(page).getByRole('link', { name: webT(key) });
  const wallet = walletFigures(page);

  await test.step('sign up a fresh customer by typing the form', async () => {
    await signUp(page, newCustomer());
  });

  await test.step('open the card and deposit collateral, approved at the bank in a new tab', async () => {
    await openAccount(page, created);
    bankProblems.push(
      ...(await payThroughBank(page, {
        scope: page,
        kind: 'deposit',
        submitLabel: webT('deposit.submit'),
        amountCents: DEPOSIT,
      })),
    );
  });

  await test.step('the card is active and available = limit = deposit', async () => {
    // The app's poll sees the bank's answer and the screen becomes the active card's wallet.
    await expect(wallet.available).toHaveText(money(DEPOSIT), { timeout: 20_000 });
    await expect(wallet.limit).toHaveText(money(DEPOSIT));
    await expect(wallet.meterAvailable).toHaveText(money(DEPOSIT));
    await expect(wallet.owed).toHaveText(money(0n));
    await expect(page.getByText(webT('status.active'), { exact: true })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  await test.step('buy inside the limit: approved, available goes down by the total', async () => {
    await markDocument(page);
    await nav('nav.store').click();
    await expect(page).toHaveURL(`${WEB_URL}${webPath('/app/store')}`);
    await expectSameDocument(page);
    await expect(storeAvailable(page)).toHaveText(money(DEPOSIT));
    await addToCart(page, TACOS.sku, 1);
    await goToCheckout(page, { items: 1, totalCents: TACOS.priceCents });
    const summary = page.getByRole('region', { name: webT('checkout.summaryTitle') });
    await expect(valueOf(summary, webT('checkout.available'))).toHaveText(money(DEPOSIT));
    await expect(valueOf(summary, webT('checkout.leftAfter'))).toHaveText(money(AFTER_PURCHASE));
    await expect(valueOf(summary, webT('checkout.total'))).toHaveText(money(TACOS.priceCents));
    await expectNoHorizontalScroll(page);

    const result = await pay(page, { totalCents: TACOS.priceCents, created });
    expect(result.status).toBe('APPROVED');
    const receipt = page.getByRole('region', {
      name: webT('checkout.result.approvedTitle', {
        total: money(TACOS.priceCents),
        merchant: result.merchantName,
      }),
    });
    await expect(receipt).toBeVisible();
    await expect(valueOf(receipt, webT('checkout.result.newAvailable'))).toHaveText(
      money(AFTER_PURCHASE),
    );
  });

  await test.step('the hold posts: the wallet shows it owed, not on hold', async () => {
    await markDocument(page);
    await nav('nav.home').click();
    await expect(page).toHaveURL(`${WEB_URL}${webPath('/app')}`);
    await expectSameDocument(page);
    await expect(wallet.available).toHaveText(money(AFTER_PURCHASE));
    const recent = page.getByRole('region', { name: webT('account.recent.title') });
    // The network posts the hold a few seconds after approving it; the list polls until then.
    await expect(recent.getByRole('listitem').filter({ hasText: TACOS_MERCHANT })).toContainText(
      webT('status.posted'),
      {
        timeout: 20_000,
      },
    );
    // The list says "posted", so the balances must say "owed", not "on hold". Known app bug: the
    // order poll never refreshes the account, so the wallet keeps the figures it fetched at
    // checkout (before the capture) and "Make a payment" says nothing is owed, until a reload.
    // Soft, so the rest of the life cycle still runs; it turns green once the app refreshes.
    await expect
      .soft(wallet.owed, 'balances follow the posted order without a reload')
      .toHaveText(money(TACOS.priceCents), {
        timeout: 10_000,
      });
    if (test.info().errors.length > 0) await page.reload();
    await expect(wallet.owed).toHaveText(money(TACOS.priceCents));
    await expect(wallet.held).toHaveText(money(0n));
    await expect(wallet.available).toHaveText(money(AFTER_PURCHASE));
  });

  await test.step('a purchase over what is available is declined with the translated reason', async () => {
    await nav('nav.store').click();
    await expect(page).toHaveURL(`${WEB_URL}${webPath('/app/store')}`);
    await expect(storeAvailable(page)).toHaveText(money(AFTER_PURCHASE));
    await addToCart(page, EARBUDS.sku, EARBUDS_QUANTITY);
    await goToCheckout(page, { items: EARBUDS_QUANTITY, totalCents: OVER_LIMIT_TOTAL });
    const amounts = { total: money(OVER_LIMIT_TOTAL), available: money(AFTER_PURCHASE) };
    await expect(page.getByText(webT('checkout.overLimitBody', amounts))).toBeVisible();

    const result = await pay(page, { totalCents: OVER_LIMIT_TOTAL, created });
    expect(result).toMatchObject({ status: 'DECLINED', declineReason: 'insufficient_funds' });
    await expect(
      page.getByText(webT('checkout.decline.insufficient_funds', amounts)),
    ).toBeVisible();
    await expect(page.getByText(webT('checkout.result.nothingCharged'))).toBeVisible();

    // Nothing moved: the wallet still shows only the first purchase, owed.
    await nav('nav.home').click();
    await expect(page).toHaveURL(`${WEB_URL}${webPath('/app')}`);
    await expect(wallet.available).toHaveText(money(AFTER_PURCHASE));
    await expect(wallet.owed).toHaveText(money(TACOS.priceCents));
  });

  await test.step('repay what is owed at the bank: available is restored', async () => {
    await page.getByRole('button', { name: webT('account.actions.payment') }).click();
    const dialog = page.getByRole('dialog', { name: webT('payment.title') });
    await expect(
      dialog.getByText(webT('payment.amountHint', { owed: money(TACOS.priceCents) })),
    ).toBeVisible();
    bankProblems.push(
      ...(await payThroughBank(page, {
        scope: dialog,
        kind: 'repayment',
        submitLabel: webT('payment.submit'),
        amountCents: TACOS.priceCents,
      })),
    );
    // The app's own poll (every few seconds) sees the bank's answer; no reload.
    await expect(
      dialog.getByText(
        webT('transfer.repayment.confirmedTitle', { amount: money(TACOS.priceCents) }),
      ),
    ).toBeVisible({
      timeout: 20_000,
    });
    await dialog.getByRole('button', { name: webT('common.done') }).click();
    await expect(dialog).toBeHidden();
    await expect(wallet.available).toHaveText(money(DEPOSIT));
    await expect(wallet.owed).toHaveText(money(0n));
  });

  await test.step('close the account from Profile: the whole deposit is returned', async () => {
    await markDocument(page);
    await nav('nav.profile').click();
    await expect(page).toHaveURL(`${WEB_URL}${webPath('/app/profile')}`);
    await expectSameDocument(page);
    await page.getByRole('button', { name: webT('profile.closeAction') }).click();
    const dialog = page.getByRole('dialog', { name: webT('close.title') });
    await expect(
      dialog.getByText(webT('close.bodyNoDebt', { collateral: money(DEPOSIT) })),
    ).toBeVisible();
    await expect(valueOf(dialog, webT('close.appliedLabel'))).toHaveText(money(0n));
    await expect(valueOf(dialog, webT('close.returnedLabel'))).toHaveText(money(DEPOSIT));
    await dialog.getByRole('button', { name: webT('close.confirm') }).click();
    await expect(
      page.getByText(webT('close.toast.closed', { amount: money(DEPOSIT) })),
    ).toBeVisible();
    await expect(page.getByText(webT('profile.noOpenAccount'))).toBeVisible();
    await expectNoHorizontalScroll(page);

    await nav('nav.home').click();
    await expect(page).toHaveURL(`${WEB_URL}${webPath('/app')}`);
    const closed = page.getByRole('region', { name: webT('closed.title') });
    await expect(closed.getByText(webT('status.closed'), { exact: true })).toBeVisible();
    await expect(valueOf(closed, webT('closed.deposit'))).toHaveText(money(DEPOSIT));
    await expect(valueOf(closed, webT('closed.applied'))).toHaveText(money(0n));
    await expect(valueOf(closed, webT('closed.returned'))).toHaveText(money(DEPOSIT));
  });

  expect(problems, 'console errors, page errors or failed responses in the app').toEqual([]);
  expect(bankProblems, 'console errors, page errors or failed responses at the bank').toEqual([]);
});

/** The store's "available to spend" chip (a label and its amount, not a description list). */
function storeAvailable(page: Page) {
  return page
    .getByText(webT('store.available'), { exact: true })
    .locator('xpath=following-sibling::*[1]');
}
