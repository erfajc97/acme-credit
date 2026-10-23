import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { queryClient } from '@/app/lib/queryClient';
import { useAuthStore } from '@/app/store/authStore';
import { ACCOUNT_ID, authorizationFixture, OTHER_ACCOUNT_ID, page, SESSION } from '@/test/fixtures';
import { core, json, server } from '@/test/server';
import { useAccountAuthorizationsQuery } from '../adminQueries';

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** Account A's page 1 answers at once; any other read waits until the test lets it go. */
function accountsApi() {
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  server.use(
    http.get(core(`/admin/accounts/${ACCOUNT_ID}/authorizations`), async ({ request }) => {
      if (new URL(request.url).searchParams.get('page') !== '1') await held;
      return json(page([authorizationFixture()], { total: 11 }));
    }),
    http.get(core(`/admin/accounts/${OTHER_ACCOUNT_ID}/authorizations`), async () => {
      await held;
      return json(page([]));
    }),
  );
  return () => release();
}

describe('an account history keeps its previous page only for the same account', () => {
  beforeEach(() => act(() => useAuthStore.getState().setSession(SESSION)));

  it('the next page of the same account keeps the current rows on screen while it loads', async () => {
    const release = accountsApi();
    const { result, rerender } = renderHook(
      ({ page: requested }: { page: number }) =>
        useAccountAuthorizationsQuery(ACCOUNT_ID, { page: requested }),
      { wrapper, initialProps: { page: 1 } },
    );
    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
    rerender({ page: 2 });
    expect(result.current.isPlaceholderData).toBe(true);
    expect(result.current.data?.page).toBe(1);
    release();
  });

  it("another account never shows the previous account's rows as a placeholder", async () => {
    const release = accountsApi();
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useAccountAuthorizationsQuery(id, {}),
      { wrapper, initialProps: { id: ACCOUNT_ID } },
    );
    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
    rerender({ id: OTHER_ACCOUNT_ID });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isLoading).toBe(true);
    release();
  });
});
