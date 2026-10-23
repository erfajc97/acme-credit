import type { Page } from '@playwright/test';

/** A failed response a page is expected to get, and how many times (its console echo included). */
export interface ExpectedFailure {
  status: number;
  url: RegExp;
  /** At most this many; one more is a problem. Unbounded when absent. */
  times?: number;
}

/**
 * An anonymous visit to a private page probes the session once with POST /v1/auth/refresh; its
 * 401 (and the browser's own "failed to load resource" line for it) is the expected answer.
 */
const ANONYMOUS_SESSION_PROBE: ExpectedFailure = { status: 401, url: /\/v1\/auth\/refresh$/ };

/**
 * Collects console errors, page errors and failed responses from BEFORE navigation starts.
 * Call it right after the page exists; assert `expect(problems).toEqual([])` at the end. Each
 * expected failure also excuses the browser's console line for it ("status of <code>").
 */
export function watch(page: Page, expected: ExpectedFailure[] = []): string[] {
  const allowed = [ANONYMOUS_SESSION_PROBE, ...expected].map((rule) => ({ ...rule, seen: 0 }));
  const problems: string[] = [];
  const echoes = new Map<number, number>();
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const status = /status of (\d{3})/.exec(message.text())?.[1];
    const pending = status ? (echoes.get(Number(status)) ?? 0) : 0;
    if (status && pending > 0) echoes.set(Number(status), pending - 1);
    else problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    const status = response.status();
    if (status < 400) return;
    const rule = allowed.find(
      (candidate) =>
        candidate.status === status &&
        candidate.url.test(response.url()) &&
        (candidate.times === undefined || candidate.seen < candidate.times),
    );
    if (!rule) {
      problems.push(`${status} ${response.url()}`);
      return;
    }
    rule.seen += 1;
    echoes.set(status, (echoes.get(status) ?? 0) + 1);
  });
  return problems;
}
