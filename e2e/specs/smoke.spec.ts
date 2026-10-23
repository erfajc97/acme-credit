import type { Page } from '@playwright/test';
import { skipIntros } from '../support/intros';
import { expect, test } from '../support/fixtures';
import { ADMIN_URL, WEB_URL } from '../support/urls';
import { watch } from '../support/watch';

const SECURITY_HEADERS = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'content-security-policy': "frame-ancestors 'none'",
};

async function expectSoundPage(page: Page, url: string) {
  const problems = watch(page);
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-theme', /^(light|dark)$/);
  await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveCount(1);
  // fonts.check() is true even for unknown families: assert the face is really loaded.
  const loadedFaces = await page.evaluate(async () => {
    await document.fonts.ready;
    return (await document.fonts.load('700 32px "Golos Text Variable"')).length;
  });
  expect(loadedFaces).toBeGreaterThan(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  expect(problems).toEqual([]);
}

for (const [name, url] of [
  ['customer', WEB_URL],
  ['admin', ADMIN_URL],
] as const) {
  test(`${name} home renders cleanly: one h1, theme, fonts, CSP, no overflow, no errors`, async ({
    page,
  }) => {
    await expectSoundPage(page, url);
  });

  test(`${name} sends the security headers on pages, assets and 404s`, async ({
    page,
    request,
  }) => {
    await page.goto(url);
    const asset = await page.locator('link[rel="stylesheet"]').first().getAttribute('href');
    expect(asset).toMatch(/^\/_astro\//);
    for (const path of ['/', asset ?? '', '/no-such-page']) {
      const response = await request.get(new URL(path, url).toString());
      const headers = response.headers();
      for (const [header, value] of Object.entries(SECURITY_HEADERS)) {
        expect(headers[header], `${header} on ${path}`).toBe(value);
      }
    }
  });
}

test('admin home is not indexable', async ({ page }) => {
  await page.goto(ADMIN_URL);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('follows the system dark preference when no theme is stored, with no errors', async ({
  browser,
}) => {
  const context = await browser.newContext({ colorScheme: 'dark' });
  await skipIntros(context);
  const page = await context.newPage();
  const problems = watch(page);
  await page.goto(WEB_URL);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.waitForLoadState('networkidle');
  expect(problems).toEqual([]);
  await context.close();
});
