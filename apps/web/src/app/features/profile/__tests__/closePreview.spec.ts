import { accountFixture } from '@/test/fixtures';
import { closePreviewOf } from '../helpers/closePreview';

describe('closePreviewOf (what closing does to the deposit)', () => {
  it('pays what is owed from the deposit first and returns the rest', () => {
    expect(closePreviewOf(accountFixture())).toEqual({
      collateralCents: 50000n,
      appliedToDebtCents: 12000n,
      returnedCents: 38000n,
      heldCents: 4000n,
    });
  });

  it('never applies more than the deposit, and nothing when nothing is owed', () => {
    expect(closePreviewOf(accountFixture({ postedDebtCents: '50000' })).returnedCents).toBe(0n);
    expect(closePreviewOf(accountFixture({ postedDebtCents: '50001' })).appliedToDebtCents).toBe(
      50000n,
    );
    expect(closePreviewOf(accountFixture({ postedDebtCents: '0' })).returnedCents).toBe(50000n);
  });
});
