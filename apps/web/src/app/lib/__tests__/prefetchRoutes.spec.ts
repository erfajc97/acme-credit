import { http } from 'msw';
import { queryClient } from '@/app/lib/queryClient';
import { useAuthStore } from '@/app/store/authStore';
import { ACCOUNT_KEY } from '@/app/tanstack-queries/accountQuery';
import { ACTIVITY_KEY } from '@/app/tanstack-queries/activityQuery';
import { AUTHORIZATIONS_KEY } from '@/app/tanstack-queries/authorizationsQuery';
import {
  accountFixture,
  ACCOUNT_ID,
  activityFixture,
  authorizationFixture,
  page,
  SESSION,
} from '@/test/fixtures';
import { core, json, server } from '@/test/server';
import { ROUTES } from '../endpoints';
import { prefetchRouteData } from '../prefetchRoutes';

function countRequests() {
  const seen: string[] = [];
  server.use(
    http.get(core(`/accounts/${ACCOUNT_ID}/authorizations`), () => {
      seen.push('authorizations');
      return json(page([authorizationFixture()]));
    }),
    http.get(core(`/accounts/${ACCOUNT_ID}/activity`), () => {
      seen.push('activity');
      return json(page([activityFixture()]));
    }),
  );
  return seen;
}

describe('prefetchRouteData (nav link intent warms the next screen)', () => {
  it('does nothing without a session or without a cached account', async () => {
    const seen = countRequests();
    await prefetchRouteData(ROUTES.activity);
    useAuthStore.getState().setSession(SESSION);
    await prefetchRouteData(ROUTES.activity);
    expect(seen).toEqual([]);
  });

  it('warms orders and movements for Activity, then skips them while fresh', async () => {
    const seen = countRequests();
    useAuthStore.getState().setSession(SESSION);
    queryClient.setQueryData([ACCOUNT_KEY], accountFixture());
    await prefetchRouteData(ROUTES.activity);
    expect(seen.sort()).toEqual(['activity', 'authorizations']);
    // Page 1 of each list: what the screen opens on (its plain address has no page parameter).
    expect(
      queryClient.getQueryData<{ items: unknown[] }>([AUTHORIZATIONS_KEY, ACCOUNT_ID, 1])?.items,
    ).toHaveLength(1);
    expect(queryClient.getQueryData([ACTIVITY_KEY, ACCOUNT_ID, 1])).toBeDefined();
    await prefetchRouteData(ROUTES.activity);
    await prefetchRouteData(ROUTES.app);
    expect(seen).toHaveLength(2);
  });

  it('warms the recent orders for the wallet home; other routes need nothing', async () => {
    const seen = countRequests();
    useAuthStore.getState().setSession(SESSION);
    queryClient.setQueryData([ACCOUNT_KEY], accountFixture());
    await prefetchRouteData(ROUTES.store);
    expect(seen).toEqual([]);
    await prefetchRouteData(ROUTES.app);
    expect(seen).toEqual(['authorizations']);
  });
});

describe('prefetchRouteData for the card page', () => {
  it('refreshes a stale account and leaves a fresh one alone', async () => {
    let reads = 0;
    server.use(
      http.get(core('/accounts/me'), () => {
        reads += 1;
        return json(accountFixture({ status: 'FROZEN' }));
      }),
    );
    useAuthStore.getState().setSession(SESSION);
    queryClient.setQueryData([ACCOUNT_KEY], accountFixture());
    await prefetchRouteData(ROUTES.card);
    expect(reads).toBe(0);
    queryClient.setQueryData([ACCOUNT_KEY], accountFixture(), { updatedAt: Date.now() - 60_000 });
    await prefetchRouteData(ROUTES.card);
    expect(reads).toBe(1);
    expect(queryClient.getQueryData<{ status: string }>([ACCOUNT_KEY])?.status).toBe('FROZEN');
  });
});

describe('prefetchRouteData when the API fails', () => {
  it('a failed warm-up never rejects: the screen will fetch and show its own error', async () => {
    server.use(
      http.get(
        core(`/accounts/${ACCOUNT_ID}/authorizations`),
        () => new Response(null, { status: 503 }),
      ),
    );
    useAuthStore.getState().setSession(SESSION);
    queryClient.setQueryData([ACCOUNT_KEY], accountFixture());
    await expect(prefetchRouteData(ROUTES.app)).resolves.toBeUndefined();
  });
});
