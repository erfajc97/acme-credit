import { describe, expect, it } from 'vitest';
import { availableCredit, centsFrom, centsToString, limitForDeposit, minCents } from '../money';

describe('money helpers (P1)', () => {
  it('round-trips cents through the wire format without floats', () => {
    expect(centsFrom('12550')).toBe(12550n);
    expect(centsToString(12550n)).toBe('12550');
    expect(centsFrom('-300')).toBe(-300n);
    expect(centsToString(centsFrom('999999999999999'))).toBe('999999999999999');
  });

  it.each(['0.1', '1e3', '', ' 5', '012', '+5', 'abc'])('refuses %j as cents', (value) => {
    expect(() => centsFrom(value)).toThrow('not an integer cents string');
  });

  it('grants the limit rounded down, so the limit never exceeds the collateral share', () => {
    expect(limitForDeposit(20_000n, 10_000)).toBe(20_000n);
    // 333 × 50.05 % = 166.6665 → 166, never 167 (pins the rounding direction, FT13).
    expect(limitForDeposit(333n, 5_005)).toBe(166n);
    expect(limitForDeposit(1n, 1)).toBe(0n);
  });

  it('accepts the whole ratio range and refuses anything outside it', () => {
    expect(limitForDeposit(100n, 1)).toBe(0n);
    expect(limitForDeposit(100n, 10_000)).toBe(100n);
    expect(() => limitForDeposit(100n, 0)).toThrow('ratio out of range');
    expect(() => limitForDeposit(100n, 10_001)).toThrow('ratio out of range');
    expect(() => limitForDeposit(100n, 1.5)).toThrow('ratio out of range');
  });

  it('computes the available credit and never reports a negative amount', () => {
    expect(
      availableCredit({ creditLimitCents: 10_000n, heldCents: 2_500n, postedDebtCents: 1_000n }),
    ).toBe(6_500n);
    expect(
      availableCredit({ creditLimitCents: 10_000n, heldCents: 9_000n, postedDebtCents: 1_000n }),
    ).toBe(0n);
    expect(availableCredit({ creditLimitCents: 0n, heldCents: 0n, postedDebtCents: 500n })).toBe(
      0n,
    );
  });

  it('picks the smaller amount', () => {
    expect(minCents(3n, 5n)).toBe(3n);
    expect(minCents(5n, 3n)).toBe(3n);
  });
});
