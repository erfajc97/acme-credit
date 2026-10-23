import { defineConfig, devices } from '@playwright/test';
import { LOCALE } from './support/i18n';

// Runs against the stack started by `pnpm docker:up` (globalSetup only waits for it). No retries,
// no fixed sleeps: a flaky spec is a bug to fix.
export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './support/global-setup.ts',
  globalTeardown: './support/global-teardown.ts',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: LOCALE,
    // No business time zone is configured yet (instants are UTC end to end): pin UTC.
    timezoneId: 'UTC',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      grepInvert: /@mobile-only/,
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } },
      grepInvert: /@desktop-only/,
    },
  ],
});
