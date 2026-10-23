import { describe, expect, it } from 'vitest';
import { fakeDb, sqlOf } from '../../../core/__tests__/fake-db';
import { AdminRepository } from '../admin.repository';

describe('AdminRepository.dashboardTotals', () => {
  it('reads every dashboard figure in ONE statement (one round trip, not five)', async () => {
    const db = fakeDb();
    const totals = { accounts_by_status: {}, approved: 0 };
    db.$queryRaw.mockResolvedValue([totals]);
    const since = new Date('2026-10-20T12:00:00.000Z');
    await expect(new AdminRepository(db as never).dashboardTotals(since)).resolves.toBe(totals);
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    const sql = sqlOf(db.$queryRaw.mock.calls[0]);
    for (const table of ['FROM accounts', 'FROM authorizations', 'FROM postings']) {
      expect(sql).toContain(table);
    }
    expect(sql).toContain('created_at >= ?');
    expect(db.$queryRaw.mock.calls[0]?.slice(1)).toEqual([since]);
  });

  it('fails loudly if the aggregate ever returns no row instead of showing zeros', async () => {
    const db = fakeDb();
    db.$queryRaw.mockResolvedValue([]);
    await expect(new AdminRepository(db as never).dashboardTotals(new Date())).rejects.toThrow(
      'the dashboard aggregate returned no row',
    );
  });
});
