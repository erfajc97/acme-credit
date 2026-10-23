import { MAX_DEPOSIT_CENTS, MIN_DEPOSIT_CENTS } from '@acme/contracts';
import { setActiveLocale, t } from '@/app/i18n';
import { accountFixture, activityFixture, PENDING_ACCOUNT } from '@/test/fixtures';
import { TRANSFER_COPY } from '../data';
import { accountViewOf, settlementFromActivity } from '../helpers/accountView';
import { meterSegments } from '../hooks/useAccountOverview';
import { depositFormSchema, paymentFormSchema } from '../schema';

describe('accountViewOf', () => {
  it('maps the life cycle to a screen', () => {
    expect(accountViewOf(null)).toBe('none');
    expect(accountViewOf(PENDING_ACCOUNT)).toBe('pendingCollateral');
    expect(accountViewOf(accountFixture())).toBe('open');
    expect(accountViewOf(accountFixture({ status: 'FROZEN' }))).toBe('open');
    expect(accountViewOf(accountFixture({ status: 'CLOSED' }))).toBe('closed');
  });
});

describe('settlementFromActivity', () => {
  it('adds the applied and returned lines; ignores the rest', () => {
    expect(
      settlementFromActivity([
        activityFixture({ type: 'collateral_applied', amountCents: '12000' }),
        activityFixture({ type: 'collateral_released', amountCents: '38000' }),
        activityFixture({ type: 'purchase', amountCents: '999' }),
      ]),
    ).toEqual({ collateralCents: 50000n, appliedToDebtCents: 12000n, releasedCents: 38000n });
    expect(
      settlementFromActivity([
        activityFixture({ type: 'collateral_released', amountCents: '500' }),
      ]),
    ).toEqual({
      collateralCents: 500n,
      appliedToDebtCents: 0n,
      releasedCents: 500n,
    });
  });

  it('is null without a settlement line', () => {
    expect(settlementFromActivity([])).toBeNull();
    expect(settlementFromActivity([activityFixture()])).toBeNull();
  });
});

describe('meterSegments', () => {
  it('splits the limit into owed · on hold · available with each amount', () => {
    setActiveLocale('en-US');
    expect(
      meterSegments(accountFixture()).map(({ id, amount, percent }) => ({ id, amount, percent })),
    ).toEqual([
      { id: 'owed', amount: '$120.00', percent: 24 },
      { id: 'held', amount: '$40.00', percent: 8 },
      { id: 'available', amount: '$340.00', percent: 68 },
    ]);
  });
});

describe('form schemas (W11: the API limits, last passing and first failing)', () => {
  const depositAmount = (amount: string) => depositFormSchema.safeParse({ amount });

  it('deposit: USD 200.00 to 10,000.00', () => {
    expect(depositAmount('199.99').error?.issues[0]?.message).toBe('validation.depositBelowMin');
    expect(depositAmount('200')).toMatchObject({
      success: true,
      data: { amount: MIN_DEPOSIT_CENTS },
    });
    expect(depositAmount('10,000.00')).toMatchObject({
      success: true,
      data: { amount: MAX_DEPOSIT_CENTS },
    });
    expect(depositAmount('10000.01').error?.issues[0]?.message).toBe('validation.depositAboveMax');
  });

  it('payment: up to what is owed, to the cent', () => {
    const schema = paymentFormSchema(12000n);
    expect(schema.safeParse({ amount: '120.00' })).toMatchObject({
      success: true,
      data: { amount: 12000n },
    });
    expect(schema.safeParse({ amount: '120.01' }).error?.issues[0]?.message).toBe(
      'validation.paymentAboveOwed',
    );
    expect(schema.safeParse({ amount: '0.01' }).success).toBe(true);
  });
});

describe('copy keys held in data (outside t() calls)', () => {
  it('every transfer state and close body has its copy', () => {
    const keys = [
      ...Object.values(TRANSFER_COPY).flatMap((copy) => Object.values(copy)),
      'close.bodyWithDebt',
      'close.bodyNoDebt',
    ];
    for (const key of keys) expect(t(key), key).not.toBe(key);
  });
});
