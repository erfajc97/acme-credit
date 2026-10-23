import { http } from 'msw';
import { useAuthStore } from '@/app/store/authStore';
import {
  ACCOUNTS_KEY,
  AUDIT_LOG_KEY,
  DASHBOARD_KEY,
  JOURNAL_KEY,
  PAYOUTS_KEY,
  PURCHASES_KEY,
} from '@/app/tanstack-queries/adminQueries';
import { dashboardFixture, page, SESSION } from '@/test/fixtures';
import { core, json, server } from '@/test/server';
import { ROUTES } from '../endpoints';
import { prefetchRouteData } from '../prefetchRoutes';
import { queryClient } from '../queryClient';

/** Answers every section's first read and records which ones were asked for. */
function countRequests() {
  const seen: string[] = [];
  const record = (name: string, body: Parameters<typeof json>[0]) => () => {
    seen.push(name);
    return json(body);
  };
  server.use(
    http.get(core('/admin/dashboard'), record('dashboard', dashboardFixture())),
    http.get(core('/admin/authorizations'), ({ request }) => {
      seen.push(`purchases:${new URL(request.url).searchParams.toString()}`);
      return json(page([]));
    }),
    http.get(core('/admin/payouts'), ({ request }) => {
      seen.push(`payouts:${new URL(request.url).searchParams.toString()}`);
      return json(page([]));
    }),
    http.get(core('/admin/accounts'), record('accounts', page([]))),
    http.get(core('/admin/ledger'), record('ledger', page([]))),
    http.get(core('/admin/audit-log'), record('audit', page([]))),
  );
  return seen;
}

describe('the shared QueryClient (ClientRouter keeps it across pages)', () => {
  it('keeps data fresh for 30 s and cached for 10 minutes', () => {
    expect(queryClient.getDefaultOptions().queries).toMatchObject({
      staleTime: 30_000,
      gcTime: 600_000,
    });
  });
});

describe('prefetchRouteData (nav link intent warms the next section)', () => {
  it('does nothing without a session or for a route it does not know', async () => {
    const seen = countRequests();
    await prefetchRouteData(ROUTES.accounts);
    useAuthStore.getState().setSession(SESSION);
    await prefetchRouteData(ROUTES.signIn);
    await prefetchRouteData(ROUTES.accountView);
    expect(seen).toEqual([]);
  });

  it('warms each section with exactly the cache entry its screen reads, then skips it while fresh', async () => {
    const seen = countRequests();
    useAuthStore.getState().setSession(SESSION);
    await prefetchRouteData(ROUTES.dashboard);
    await prefetchRouteData(ROUTES.accounts);
    await prefetchRouteData(ROUTES.purchases);
    await prefetchRouteData(ROUTES.payouts);
    await prefetchRouteData(ROUTES.ledger);
    await prefetchRouteData(ROUTES.auditLog);
    expect(seen.sort()).toEqual([
      'accounts',
      'audit',
      'dashboard',
      'ledger',
      'payouts:page=1&pageSize=10',
      'payouts:status=FAILED&page=1&pageSize=10',
      'payouts:status=PENDING&page=1&pageSize=10',
      'purchases:page=1&pageSize=10',
      'purchases:page=1&pageSize=10',
      'purchases:status=APPROVED&page=1&pageSize=10',
    ]);
    expect(queryClient.getQueryData([DASHBOARD_KEY])).toBeDefined();
    // The dashboard's side reads: exactly the entries its hooks read.
    for (const key of [
      [PURCHASES_KEY, 'sample', null],
      [PURCHASES_KEY, 'sample', 'APPROVED'],
      [PAYOUTS_KEY, 'sample', 'PENDING'],
      [PAYOUTS_KEY, 'sample', 'FAILED'],
    ]) {
      expect(queryClient.getQueryData(key), key.join('/')).toEqual(page([]));
    }
    // The lists are warmed as page 1, under exactly the key their screen reads.
    for (const key of [
      [PURCHASES_KEY, 'list', null, null, 1],
      [PAYOUTS_KEY, 'list', null, null, 1],
      [ACCOUNTS_KEY, null, null, 1],
      [JOURNAL_KEY, null, null, 1],
      [AUDIT_LOG_KEY, null, null, 1],
    ]) {
      expect(queryClient.getQueryData(key), key.join('/')).toEqual(page([]));
    }

    await prefetchRouteData(ROUTES.purchases);
    await prefetchRouteData(ROUTES.ledger);
    await prefetchRouteData(ROUTES.payouts);
    expect(seen).toHaveLength(10);
  });

  it('a failed warm-up never rejects: the screen will fetch and show its own error', async () => {
    server.use(http.get(core('/admin/authorizations'), () => new Response(null, { status: 503 })));
    useAuthStore.getState().setSession(SESSION);
    await expect(prefetchRouteData(ROUTES.purchases)).resolves.toBeUndefined();
  });
});
