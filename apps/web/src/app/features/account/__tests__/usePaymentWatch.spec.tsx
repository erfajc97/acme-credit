import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { PAYMENT_WATCH_MS } from '@/app/helpers/payments';
import { ACCOUNT_KEY } from '@/app/tanstack-queries/accountQuery';
import { ACTIVITY_KEY } from '@/app/tanstack-queries/activityQuery';
import { DEPOSITS_KEY } from '@/app/tanstack-queries/paymentsQuery';
import { ACCOUNT_ID, depositFixture, page } from '@/test/fixtures';
import { core, json, server } from '@/test/server';
import { usePaymentWatch } from '../hooks/usePaymentWatch';

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, ...renderHook(() => usePaymentWatch('deposit', ACCOUNT_ID), { wrapper }) };
}

describe('usePaymentWatch', () => {
  afterEach(() => vi.useRealTimers());

  it('stops waiting after the watch window and resumes on "check again"', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let fetches = 0;
    server.use(
      http.get(core(`/accounts/${ACCOUNT_ID}/deposits`), () => {
        fetches += 1;
        return json(page([depositFixture()]));
      }),
    );
    const { result } = setup();
    await waitFor(() => expect(result.current.state).toBe('pending'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(PAYMENT_WATCH_MS);
    });
    expect(result.current.state).toBe('timedOut');
    const fetchesWhenStopped = fetches;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    // No polling once the window closed (W3 stop condition).
    expect(fetches).toBe(fetchesWhenStopped);
    act(() => result.current.checkAgain());
    expect(result.current.state).toBe('pending');
    await waitFor(() => expect(fetches).toBe(fetchesWhenStopped + 1));
  });

  it('when a polled transfer is decided, refreshes the balances (account + activity) by their keys', async () => {
    let status: 'PENDING' | 'FAILED' = 'PENDING';
    server.use(
      http.get(core(`/accounts/${ACCOUNT_ID}/deposits`), () =>
        json(page([depositFixture({ status })])),
      ),
    );
    const { result, queryClient } = setup();
    queryClient.setQueryData([ACCOUNT_KEY], { seeded: true });
    queryClient.setQueryData([ACTIVITY_KEY, ACCOUNT_ID], { seeded: true });
    await waitFor(() => expect(result.current.state).toBe('pending'));
    act(() => result.current.track(depositFixture().id));
    status = 'FAILED';
    await act(async () => {
      await queryClient.refetchQueries({ queryKey: [DEPOSITS_KEY] });
    });
    expect(result.current.state).toBe('failed');
    expect(queryClient.getQueryState([ACCOUNT_KEY])?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState([ACTIVITY_KEY, ACCOUNT_ID])?.isInvalidated).toBe(true);
    act(() => result.current.reset());
    expect(result.current.state).toBe('idle');
  });

  it('a list that cannot load is an error with retry', async () => {
    server.use(
      http.get(core(`/accounts/${ACCOUNT_ID}/deposits`), () =>
        json({ code: 'common.forbidden', message: 'x', requestId: 'r' }, 403),
      ),
    );
    const { result } = setup();
    await waitFor(() => expect(result.current.isError).toBe(true));
    server.use(http.get(core(`/accounts/${ACCOUNT_ID}/deposits`), () => json(page([]))));
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.state).toBe('idle');
  });
});
