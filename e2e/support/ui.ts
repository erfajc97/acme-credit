import { expect, type Locator, type Page } from '@playwright/test';
import { watch } from './watch';

/** Below Tailwind's `lg` both apps show the phone layout (tab bar, cart sheet, cards for tables). */
const LG_PX = 1024;

export function isPhoneLayout(page: Page): boolean {
  return (page.viewportSize()?.width ?? LG_PX) < LG_PX;
}

/**
 * The value of a description-list term (`<dt>label</dt><dd>value</dd>`): how both apps print
 * every labelled amount. The label is matched exactly (it may sit in a span inside the `dt`, next
 * to a hint); the caller scopes it to one region.
 */
export function valueOf(scope: Locator | Page, term: string): Locator {
  return scope
    .getByText(term, { exact: true })
    .locator('xpath=ancestor-or-self::dt[1]/following-sibling::dd[1]');
}

/** Marks the current document; `expectSameDocument` later proves no full page load happened. */
export async function markDocument(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as unknown as { __e2eDocument?: boolean }).__e2eDocument = true;
  });
}

/** True only when the page was swapped in place (Astro ClientRouter), not reloaded. */
export async function expectSameDocument(page: Page): Promise<void> {
  const kept = await page.evaluate(
    () => (window as unknown as { __e2eDocument?: boolean }).__e2eDocument === true,
  );
  expect(kept, 'navigation stayed in the same document (ClientRouter swap, no full reload)').toBe(
    true,
  );
}

/**
 * Waits until React has attached its props to a server-rendered control: typing into an island
 * before it hydrates is wiped when React takes the field over.
 */
export async function waitForHydration(control: Locator): Promise<void> {
  await expect
    .poll(
      () =>
        control.evaluate((node) =>
          Object.keys(node).some((key) => key.startsWith('__reactProps$')),
        ),
      {
        message: 'the island hydrated',
        timeout: 15_000,
      },
    )
    .toBe(true);
}

/** No horizontal scroll at the page's width (W9). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
}

/**
 * Follows a link that opens the simulated bank in a new tab and approves the transfer there, the
 * way a customer does. The bank's copy lives in the card-network service (not exported), so its
 * Approve button is found through the form that posts to the approve route, and success is proven
 * by the form going away (the page only offers it while the payment is pending).
 */
export async function approveInBankTab(page: Page, link: Locator): Promise<string[]> {
  let problems: string[] = [];
  // The watcher attaches in the predicate, as the tab is created, before its first response.
  const opened = page.context().waitForEvent('page', {
    predicate: (tab) => {
      problems = watch(tab);
      return true;
    },
  });
  await link.click();
  const bank = await opened;
  await bank.waitForLoadState('domcontentloaded');
  const approveForm = bank.locator('form[action*="/approve"]');
  await approveForm.getByRole('button').click();
  await expect(approveForm).toHaveCount(0);
  await expect(bank.getByRole('status')).toBeVisible();
  await bank.close();
  return problems;
}
