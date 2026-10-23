import type { BrowserContext } from '@playwright/test';

/**
 * The brand splash (once per session) and the product tours (after each sign-in) cover the page and
 * catch clicks. Flows under test start as a returning visitor; the intros have their own specs
 * in the apps. Keys mirror packages/ui/src/splash and each app's tour storage.
 */
export async function skipIntros(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem('acme-splash-played', '1');
      sessionStorage.setItem('acme-tour-skip', '1');
      sessionStorage.setItem('acme-admin-tour-skip', '1');
    } catch {
      // Storage blocked: the apps then treat the intros as already seen.
    }
  });
}
