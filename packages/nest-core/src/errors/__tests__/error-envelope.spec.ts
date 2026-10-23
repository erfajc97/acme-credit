import { HttpException } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppHttpException } from '../app-http.exception';
import { mapError } from '../error-envelope';

const RID = 'req-test-01';

function prismaError(code: string) {
  return Object.assign(new Error('prisma'), { name: 'PrismaClientKnownRequestError', code });
}

function httpError(status: number, expose: boolean) {
  return Object.assign(new Error('http'), { status, statusCode: status, expose });
}

describe('mapError', () => {
  it('maps an AppHttpException to its status, code and details', () => {
    const mapped = mapError(new AppHttpException('common.conflict', { accountId: 'a1' }), RID);
    expect(mapped.status).toBe(409);
    expect(mapped.unexpected).toBe(false);
    expect(mapped.envelope).toMatchObject({
      code: 'common.conflict',
      details: { accountId: 'a1' },
      requestId: RID,
    });
    expect(mapped.envelope.message.length).toBeGreaterThan(0);
  });

  it('omits empty details', () => {
    expect(mapError(new AppHttpException('common.not_found', {}), RID).envelope).not.toHaveProperty(
      'details',
    );
  });

  it('maps zod validation errors to 422 with issue paths and no input echo', () => {
    const result = z.object({ amount: z.string() }).safeParse({ amount: 5 });
    if (result.success) throw new Error('fixture must fail');
    const mapped = mapError(new ZodValidationException(result.error), RID);
    expect(mapped.status).toBe(422);
    expect(mapped.envelope.details).toEqual({ issues: [{ path: 'amount', code: 'invalid_type' }] });
  });

  it.each([
    [400, 'common.validation_failed', 422],
    [401, 'common.unauthenticated', 401],
    [403, 'common.forbidden', 403],
    [404, 'common.not_found', 404],
    [405, 'common.not_found', 404],
    [409, 'common.conflict', 409],
    [413, 'common.payload_too_large', 413],
    [415, 'common.validation_failed', 422],
    [422, 'common.validation_failed', 422],
    [429, 'common.rate_limited', 429],
  ] as const)('maps framework HTTP %i to %s', (httpStatus, code, status) => {
    const mapped = mapError(new HttpException('x', httpStatus), RID);
    expect(mapped).toMatchObject({ status, unexpected: false, envelope: { code } });
  });

  it('maps exposed client errors from Express middleware (body-parser)', () => {
    expect(mapError(httpError(413, true), RID)).toMatchObject({
      status: 413,
      envelope: { code: 'common.payload_too_large' },
      unexpected: false,
    });
    expect(mapError(httpError(400, true), RID).envelope.code).toBe('common.validation_failed');
  });

  it('treats unexposed, server-side or unmapped statuses as unexpected', () => {
    expect(mapError(httpError(413, false), RID)).toMatchObject({ status: 500, unexpected: true });
    expect(mapError(httpError(503, true), RID)).toMatchObject({ status: 500, unexpected: true });
    expect(mapError(httpError(418, true), RID)).toMatchObject({ status: 500, unexpected: true });
    expect(mapError(new HttpException('teapot', 418), RID)).toMatchObject({ unexpected: true });
    expect(mapError({ status: '413', expose: true }, RID).unexpected).toBe(true);
  });

  it.each([
    ['P2002', 'common.conflict', 409],
    ['P2025', 'common.not_found', 404],
    ['P2000', 'common.validation_failed', 422],
  ] as const)('maps Prisma %s to %s', (prismaCode, code, status) => {
    expect(mapError(prismaError(prismaCode), RID)).toMatchObject({ status, envelope: { code } });
  });

  it('needs the Prisma error name, not only a Prisma-looking code', () => {
    const lookalike = Object.assign(new Error('x'), { code: 'P2002' });
    expect(mapError(lookalike, RID)).toMatchObject({ status: 500, unexpected: true });
  });

  it('treats an unknown Prisma code as unexpected', () => {
    expect(mapError(prismaError('P9999'), RID)).toMatchObject({ status: 500, unexpected: true });
  });

  it('answers anything else as a generic 500 without leaking the message', () => {
    const mapped = mapError(new Error('db password is hunter2'), RID);
    expect(mapped).toMatchObject({ status: 500, unexpected: true });
    expect(JSON.stringify(mapped.envelope)).not.toContain('hunter2');
    expect(mapError('a string', RID).envelope.code).toBe('common.internal');
    expect(mapError(null, RID).envelope.code).toBe('common.internal');
  });
});
