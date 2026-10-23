import { MIN_DEPOSIT_CENTS } from '../../packages/contracts/src/money';
import { STORE_MERCHANTS } from '../../packages/contracts/src/store';
import { consoleNav, dataRow, postedStorePurchase, signInToAdmin } from '../support/admin';
import { product } from '../support/customer';
import { expect, test } from '../support/fixtures';
import { adminPath, adminT, money } from '../support/i18n';
import { expectNoHorizontalScroll, expectSameDocument, markDocument, valueOf } from '../support/ui';
import { ADMIN_URL } from '../support/urls';
import { watch } from '../support/watch';

/**
 * F8 / R-51 (and R-08e, R-52 from the console): a purchase made in the customer's store shows up
 * in the operator console — on the dashboard, in Purchases with its items, and on the customer's
 * account with its journal entries and audit rows — and an operator's freeze is audited.
 */
const TACOS = product('TAC-PASTOR');
const QUANTITY = 2;
const TOTAL = TACOS.priceCents * BigInt(QUANTITY); // USD 17.00
const MERCHANT = STORE_MERCHANTS[TACOS.merchant].name;

test.describe.configure({ timeout: 120_000 });

test('admin: dashboard → purchase with its items → account ledger and audit → freeze / unfreeze', async ({
  page,
  playwright,
  created,
}) => {
  const api = await playwright.request.newContext();
  const { customer, account, purchase } =
    await test.step('a fresh customer buys in the store (API)', () =>
      postedStorePurchase(api, { created, sku: TACOS.sku, quantity: QUANTITY }));
  await api.dispose();

  // An operator's first visit probes the session once (expected 401, see watch()).
  const problems = watch(page);
  const capturedLabel = adminT('status.authorization.CAPTURED');

  await test.step('sign in with the seeded operator from .env', async () => {
    await signInToAdmin(page);
  });

  await test.step('the dashboard lists the purchase among the recent ones', async () => {
    // A table from lg, cards below it (DataTable): either way one row names the customer.
    const recent = page.getByRole('region', { name: adminT('dashboard.recentPurchasesTitle') });
    const row = recent.locator(':is(tr, li):visible').filter({ hasText: customer.fullName });
    await expect(row).toContainText(MERCHANT);
    await expect(row).toContainText(money(TOTAL));
    await expect(row).toContainText(capturedLabel);
    await expectNoHorizontalScroll(page);
  });

  await test.step('Purchases shows it with its items', async () => {
    await markDocument(page);
    await (await consoleNav(page)).getByRole('link', { name: adminT('nav.purchases') }).click();
    await expect(page).toHaveURL(`${ADMIN_URL}${adminPath('/purchases')}`);
    await expectSameDocument(page);
    const row = dataRow(page, customer.email);
    await expect(row).toContainText(MERCHANT);
    await expect(row).toContainText(capturedLabel);
    await row.getByText(adminT('orders.showItems', { count: 1 })).click();
    const items = row.getByRole('list', {
      name: adminT('orders.itemsCaption', { merchant: MERCHANT }),
    });
    await expect(items).toContainText(
      adminT('orders.line', { quantity: QUANTITY, name: TACOS.name.en }),
    );
    await expect(items).toContainText(adminT('orders.unit', { unit: money(TACOS.priceCents) }));
    await expect(items).toContainText(money(TOTAL));
    await expectNoHorizontalScroll(page);

    await row.getByRole('link', { name: customer.fullName }).click();
    await expect(page).toHaveURL(`${ADMIN_URL}${adminPath('/accounts/view')}?id=${account.id}`);
    await expectSameDocument(page);
  });

  await test.step('the account shows balances, the journal entries and the audit rows', async () => {
    const balances = page.getByRole('region', { name: adminT('accountDetail.balancesTitle') });
    await expect(valueOf(balances, adminT('accountDetail.limit')).first()).toHaveText(
      money(MIN_DEPOSIT_CENTS),
    );
    await expect(valueOf(balances, adminT('accountDetail.owed')).first()).toHaveText(money(TOTAL));
    await expect(valueOf(balances, adminT('accountDetail.available')).first()).toHaveText(
      money(MIN_DEPOSIT_CENTS - TOTAL),
    );

    const journal = page.getByRole('region', { name: adminT('accountDetail.journal.title') });
    const capture = journal
      .getByRole('listitem')
      .filter({ hasText: adminT('journal.kind.purchase_capture') });
    await expect(capture).toContainText(MERCHANT);
    await expect(capture).toContainText(money(TOTAL));
    await expect(capture).toContainText(adminT('journal.balanced'));
    const deposit = journal
      .getByRole('listitem')
      .filter({ hasText: adminT('journal.kind.collateral_deposit') });
    await expect(deposit).toContainText(money(MIN_DEPOSIT_CENTS));

    const audit = page.getByRole('region', { name: adminT('accountDetail.audit.title') });
    await expect(dataRow(page, 'account.opened', audit)).toContainText(adminT('actor.customer'));
    await expect(dataRow(page, 'account.activated', audit)).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  await test.step('freeze and unfreeze the card: each action is an audit row by the admin', async () => {
    const audit = page.getByRole('region', { name: adminT('accountDetail.audit.title') });
    const actions = page.getByRole('region', { name: adminT('accountDetail.actionsTitle') });
    for (const action of ['freeze', 'unfreeze'] as const) {
      await actions.getByRole('button', { name: adminT(`accountDetail.${action}.action`) }).click();
      const dialog = page.getByRole('dialog', { name: adminT(`accountDetail.${action}.title`) });
      await dialog.getByRole('button', { name: adminT(`accountDetail.${action}.action`) }).click();
      await expect(dialog).toBeHidden();
      await expect(
        page.getByText(adminT(`accountDetail.${action}.done`, { name: customer.fullName })),
      ).toBeVisible();
      const row = dataRow(page, action === 'freeze' ? 'account.frozen' : 'account.unfrozen', audit);
      await expect(row).toContainText(adminT('actor.admin'));
    }
  });

  await test.step('the audit log, filtered by the purchase, shows its approval and capture', async () => {
    await markDocument(page);
    await (await consoleNav(page)).getByRole('link', { name: adminT('nav.auditLog') }).click();
    await expect(page).toHaveURL(`${ADMIN_URL}${adminPath('/audit-log')}`);
    await expectSameDocument(page);
    await page.getByLabel(adminT('auditLog.filter.label')).fill(purchase.authorizationId);
    await page.getByRole('button', { name: adminT('auditLog.filter.submit') }).click();
    await expect(page).toHaveURL(new RegExp(`entityId=${purchase.authorizationId}`));
    // The list keeps the previous rows (dimmed) until the filtered page arrives: match the id too.
    for (const action of ['authorization.approved', 'authorization.captured']) {
      const row = dataRow(page, action).filter({ hasText: purchase.authorizationId });
      await expect(row).toContainText(adminT('actor.network'));
    }
    await expectNoHorizontalScroll(page);
  });

  expect(problems, 'console errors, page errors or failed responses in the console').toEqual([]);
});
