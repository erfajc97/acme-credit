import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { assignRequestId, requestIdMiddleware, requestIdOf, resolveRequestId } from '../request-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function fakes(headers: Record<string, string> = {}, id?: string) {
  const request = { headers, id } as unknown as IncomingMessage & { id?: unknown };
  const setHeader = vi.fn();
  return { request, response: { setHeader } as unknown as ServerResponse, setHeader };
}

describe('resolveRequestId', () => {
  it('keeps a safe caller id, including the first entry of an array header', () => {
    expect(resolveRequestId('abc-1234')).toBe('abc-1234');
    expect(resolveRequestId(['first-id-01', 'second'])).toBe('first-id-01');
  });

  it('enforces both length bounds (last passing, first failing)', () => {
    expect(resolveRequestId('a'.repeat(8))).toBe('a'.repeat(8));
    expect(resolveRequestId('a'.repeat(7))).toMatch(UUID);
    expect(resolveRequestId('a'.repeat(64))).toBe('a'.repeat(64));
    expect(resolveRequestId('a'.repeat(65))).toMatch(UUID);
  });

  it('mints a uuid for a missing or unsafe id', () => {
    expect(resolveRequestId(undefined)).toMatch(UUID);
    expect(resolveRequestId('bad id\nwith-newline')).toMatch(UUID);
    expect(resolveRequestId('x-1234567<script>')).toMatch(UUID);
  });
});

describe('assignRequestId', () => {
  it('stores the resolved id on the request and echoes it once', () => {
    const { request, response, setHeader } = fakes({ 'x-request-id': 'caller-req-01' });
    expect(assignRequestId(request, response)).toBe('caller-req-01');
    expect(request.id).toBe('caller-req-01');
    expect(setHeader).toHaveBeenCalledWith('X-Request-ID', 'caller-req-01');
  });

  it('reuses an id already assigned without touching the response again', () => {
    const { request, response, setHeader } = fakes({ 'x-request-id': 'other-req-02' }, 'kept-01');
    expect(assignRequestId(request, response)).toBe('kept-01');
    expect(setHeader).not.toHaveBeenCalled();
  });
});

describe('requestIdMiddleware', () => {
  it('assigns the id and continues', () => {
    const { request, response } = fakes();
    const next = vi.fn();
    requestIdMiddleware(request, response, next);
    expect(request.id).toMatch(UUID);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe('requestIdOf', () => {
  it('reads the id or falls back', () => {
    expect(requestIdOf({ id: 'r-1' })).toBe('r-1');
    expect(requestIdOf({})).toBe('unknown');
  });
});
