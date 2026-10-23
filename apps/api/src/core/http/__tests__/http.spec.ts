import { describe, expect, it } from 'vitest';
import { pageWindow, paginate } from '../pagination';
import { actorOf, idempotentRequestOf } from '../request-context';

describe('numbered pagination', () => {
  it('turns page N of size S into OFFSET (N - 1) * S, LIMIT S', () => {
    expect(pageWindow({ page: 1, pageSize: 10 })).toEqual({ skip: 0, take: 10 });
    expect(pageWindow({ page: 2, pageSize: 10 })).toEqual({ skip: 10, take: 10 });
    expect(pageWindow({ page: 4, pageSize: 3 })).toEqual({ skip: 9, take: 3 });
  });

  it('reads the window and the total together and maps only the page rows', async () => {
    const windows: unknown[] = [];
    const page = await paginate({
      query: { page: 3, pageSize: 4 },
      count: () => Promise.resolve(11),
      read: (window) => {
        windows.push(window);
        return Promise.resolve([{ n: 9 }, { n: 10 }, { n: 11 }]);
      },
      map: (row) => `row-${row.n}`,
    });
    expect(windows).toEqual([{ skip: 8, take: 4 }]);
    expect(page).toEqual({
      items: ['row-9', 'row-10', 'row-11'],
      page: 3,
      pageSize: 4,
      total: 11,
      totalPages: 3,
    });
  });

  it('a page past the end is empty with the real total, and an empty list has one page', async () => {
    const past = await paginate({
      query: { page: 9, pageSize: 10 },
      count: () => Promise.resolve(21),
      read: () => Promise.resolve([] as number[]),
      map: (row) => row,
    });
    expect(past).toEqual({ items: [], page: 9, pageSize: 10, total: 21, totalPages: 3 });
    const empty = await paginate({
      query: { page: 1, pageSize: 10 },
      count: () => Promise.resolve(0),
      read: () => Promise.resolve([] as number[]),
      map: (row) => row,
    });
    expect(empty).toEqual({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 });
  });

  it('starts both reads before awaiting either (one round trip, not two)', async () => {
    const started: string[] = [];
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = paginate({
      query: { page: 1, pageSize: 10 },
      count: async () => {
        started.push('count');
        await gate;
        return 1;
      },
      read: async () => {
        started.push('read');
        await gate;
        return [1];
      },
      map: (row) => row,
    });
    expect(started).toEqual(['count', 'read']);
    release();
    await expect(pending).resolves.toMatchObject({ items: [1], total: 1 });
  });
});

describe('request context', () => {
  const base = {
    method: 'POST',
    path: '/v1/accounts',
    headers: {} as Record<string, string | string[] | undefined>,
  };

  it('builds the actor from the principal or the signed caller, with the request id', () => {
    expect(actorOf({ ...base, id: 'r1', principal: { id: 'u1', role: 'customer' } })).toEqual({
      type: 'customer',
      id: 'u1',
      requestId: 'r1',
    });
    expect(actorOf({ ...base, signedBy: 'network' })).toEqual({
      type: 'network',
      id: null,
      requestId: null,
    });
    expect(() => actorOf(base)).toThrow('actor requested on a route without a principal');
  });

  it('requires a UUID Idempotency-Key', () => {
    const key = '11111111-1111-4111-8111-111111111111';
    expect(
      idempotentRequestOf({ ...base, headers: { 'idempotency-key': key.toUpperCase() } }),
    ).toEqual({
      key,
      method: 'POST',
      path: '/v1/accounts',
    });
    expect(idempotentRequestOf({ ...base, headers: { 'idempotency-key': [key] } }).key).toBe(key);
    expect(() => idempotentRequestOf(base)).toThrow(
      expect.objectContaining({ code: 'idempotency.key_required' }),
    );
    expect(() => idempotentRequestOf({ ...base, headers: { 'idempotency-key': '  ' } })).toThrow(
      expect.objectContaining({ code: 'idempotency.key_required' }),
    );
    expect(() => idempotentRequestOf({ ...base, headers: { 'idempotency-key': 'abc' } })).toThrow(
      expect.objectContaining({ code: 'common.validation_failed' }),
    );
  });
});
