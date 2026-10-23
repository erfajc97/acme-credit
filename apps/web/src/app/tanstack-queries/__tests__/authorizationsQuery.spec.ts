import type { Authorization } from '@acme/contracts';
import { http } from 'msw';
import { queryClient } from '@/app/lib/queryClient';
import {
  accountFixture,
  ACCOUNT_ID,
  activityFixture,
  authorizationDetailFixture,
  authorizationFixture,
  page,
} from '@/test/fixtures';
import { core, json, server } from '@/test/server';
import { ACCOUNT_KEY } from '../accountQuery';
import { ACTIVITY_KEY } from '../activityQuery';
import { AUTHORIZATION_DETAIL_KEY } from '../authorizationDetailQuery';
import { authorizationsQueryOptions, holdsDecidedSince } from '../authorizationsQuery';

const HOLD = authorizationFixture();
const OTHER = authorizationFixture({
  id: 'b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5e',
  status: 'CAPTURED',
  capturedCents: '500',
});

describe('holdsDecidedSince', () => {
  it('is true when a hold seen before is now posted, cancelled or declined', () => {
    expect(holdsDecidedSince([HOLD], [{ ...HOLD, status: 'CAPTURED' }])).toBe(true);
    expect(holdsDecidedSince([HOLD], [{ ...HOLD, status: 'REVERSED' }])).toBe(true);
    expect(holdsDecidedSince([HOLD], [{ ...HOLD, status: 'DECLINED' }])).toBe(true);
  });

  it('is false on the first load, while the hold waits, and for orders already decided', () => {
    expect(holdsDecidedSince(undefined, [HOLD])).toBe(false);
    expect(holdsDecidedSince([HOLD], [HOLD])).toBe(false);
    expect(holdsDecidedSince([OTHER], [{ ...OTHER, status: 'REVERSED' }])).toBe(false);
    expect(holdsDecidedSince([HOLD], [])).toBe(false);
  });
});

/**
 * The bug: the order list polls until the hold posts, then stops; the wallet's account query
 * (staleTime 30 s) kept showing the amount "on hold" and nothing owed, so "Make a payment" had no
 * amount. When a polled hold is decided, the balances changed: account and activity refresh.
 */
describe('the orders poll refreshes the balances when a hold is decided', () => {
  let orders: Authorization[] = [HOLD];

  beforeEach(() => {
    orders = [HOLD];
    server.use(
      http.get(core(`/accounts/${ACCOUNT_ID}/authorizations`), () => json(page(orders))),
      http.get(core('/accounts/me'), () => json(accountFixture())),
      http.get(core(`/accounts/${ACCOUNT_ID}/activity`), () => json(page([activityFixture()]))),
    );
  });

  async function seedBalances() {
    await queryClient.fetchQuery({ queryKey: [ACCOUNT_KEY], queryFn: () => accountFixture() });
    queryClient.setQueryData([ACTIVITY_KEY, ACCOUNT_ID, 1], page([]));
    queryClient.setQueryData(
      [AUTHORIZATION_DETAIL_KEY, ACCOUNT_ID, HOLD.id],
      authorizationDetailFixture(),
    );
  }

  const invalidated = (key: unknown[]) => queryClient.getQueryState(key)?.isInvalidated ?? false;

  it('a posted hold invalidates the account and the activity (by their exported keys)', async () => {
    await seedBalances();
    await queryClient.fetchQuery(authorizationsQueryOptions(ACCOUNT_ID, 1));
    expect(invalidated([ACCOUNT_KEY])).toBe(false);
    orders = [{ ...HOLD, status: 'CAPTURED', capturedCents: HOLD.amountCents }];
    await queryClient.refetchQueries({
      queryKey: authorizationsQueryOptions(ACCOUNT_ID, 1).queryKey,
    });
    expect(invalidated([ACCOUNT_KEY])).toBe(true);
    expect(invalidated([ACTIVITY_KEY, ACCOUNT_ID, 1])).toBe(true);
    expect(invalidated([AUTHORIZATION_DETAIL_KEY, ACCOUNT_ID, HOLD.id])).toBe(true);
  });

  it('a poll that changes nothing leaves the balances alone', async () => {
    await seedBalances();
    await queryClient.fetchQuery(authorizationsQueryOptions(ACCOUNT_ID, 1));
    await queryClient.refetchQueries({
      queryKey: authorizationsQueryOptions(ACCOUNT_ID, 1).queryKey,
    });
    expect(invalidated([ACCOUNT_KEY])).toBe(false);
    expect(invalidated([ACTIVITY_KEY, ACCOUNT_ID, 1])).toBe(false);
  });
});
