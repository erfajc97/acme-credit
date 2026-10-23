import { describe, expect, it } from 'vitest';
import { centsSchema, formatCents, MAX_OPERATION_CENTS, parseMoneyInput } from '../money';

describe('parseMoneyInput', () => {
  it.each([
    ['125.50', 12550n],
    ['125.5', 12550n],
    ['125', 12500n],
    ['0.01', 1n],
    [' 40 ', 4000n],
    ['1,250.00', 125000n],
    ['4.35', 435n],
  ])('%s → %s cents', (input, cents) => {
    expect(parseMoneyInput(input)).toBe(cents);
  });

  it.each(['', '0', '0.00', '-5', '+5', '1e3', '12.345', 'abc', '1.2.3', '.50', '1,25'])(
    'rejects %j',
    (input) => {
      expect(parseMoneyInput(input)).toBeNull();
    },
  );
});

describe('centsSchema', () => {
  it('accepts canonical positive integer strings up to the operation cap', () => {
    expect(centsSchema.safeParse('1').success).toBe(true);
    expect(centsSchema.safeParse(MAX_OPERATION_CENTS.toString()).success).toBe(true);
    expect(centsSchema.safeParse((MAX_OPERATION_CENTS + 1n).toString()).success).toBe(false);
  });

  it.each(['0', '-1', '01', '1.5', '', ' 1'])('rejects %j', (value) => {
    expect(centsSchema.safeParse(value).success).toBe(false);
  });
});

describe('formatCents', () => {
  it('formats cents without floats', () => {
    expect(formatCents(12550n)).toBe('$125.50');
    expect(formatCents('1')).toBe('$0.01');
    expect(formatCents(123456789n)).toBe('$1,234,567.89');
    expect(formatCents(0n)).toBe('$0.00');
    expect(formatCents(-435n)).toBe('-$4.35');
  });
});
