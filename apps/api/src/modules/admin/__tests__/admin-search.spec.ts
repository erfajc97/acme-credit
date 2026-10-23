import { describe, expect, it } from 'vitest';
import {
  accountSearch,
  auditLogSearch,
  authorizationSearch,
  journalEntrySearch,
  payoutSearch,
} from '../helpers/admin-search';

/**
 * Which columns each back-office table searches. A column missing here is an operator who
 * pastes an id from a ticket and finds nothing; the real filtering is proven against Postgres
 * in test/integration/admin-search.int-spec.ts.
 */
const TEXT = { contains: 'cafe', mode: 'insensitive' };
const RANGE = {
  gte: 'cafe0000-0000-0000-0000-000000000000',
  lte: 'cafeffff-ffff-ffff-ffff-ffffffffffff',
};
const CUSTOMER = { OR: [{ email: TEXT }, { fullName: TEXT }] };
const NAME = { contains: 'Ada', mode: 'insensitive' };
const NAMED_CUSTOMER = { OR: [{ email: NAME }, { fullName: NAME }] };

describe('admin list search', () => {
  it('without a term no list is narrowed', () => {
    for (const build of [
      accountSearch,
      authorizationSearch,
      payoutSearch,
      journalEntrySearch,
      auditLogSearch,
    ]) {
      expect(build(undefined)).toBeUndefined();
    }
  });

  it('accounts: id and customer', () => {
    expect(accountSearch('cafe')).toEqual({ OR: [{ id: RANGE }, { customer: CUSTOMER }] });
    expect(accountSearch('Ada')).toEqual({ OR: [{ customer: NAMED_CUSTOMER }] });
  });

  it('authorizations: id, merchant and customer', () => {
    expect(authorizationSearch('cafe')).toEqual({
      OR: [{ id: RANGE }, { merchantName: TEXT }, { account: { customer: CUSTOMER } }],
    });
    expect(authorizationSearch('Ada')).toEqual({
      OR: [{ merchantName: NAME }, { account: { customer: NAMED_CUSTOMER } }],
    });
  });

  it('payouts: id, provider reference, provider payment id and customer', () => {
    expect(payoutSearch('cafe')).toEqual({
      OR: [
        { id: RANGE },
        { providerReference: RANGE },
        { providerPaymentId: TEXT },
        { account: { customer: CUSTOMER } },
      ],
    });
  });

  it('ledger: id, account id, kind by name and description', () => {
    expect(journalEntrySearch('cafe')).toEqual({
      OR: [{ id: RANGE }, { accountId: RANGE }, { description: TEXT }],
    });
    expect(journalEntrySearch('COLLATERAL_')).toEqual({
      OR: [
        {
          kind: {
            in: ['collateral_deposit', 'collateral_applied', 'collateral_released'],
          },
        },
        { description: { contains: 'COLLATERAL_', mode: 'insensitive' } },
      ],
    });
  });

  it('audit log: action, entity, actor and request ids as text', () => {
    expect(auditLogSearch('cafe')).toEqual({
      OR: [{ action: TEXT }, { entityId: TEXT }, { actorId: TEXT }, { requestId: TEXT }],
    });
  });
});
