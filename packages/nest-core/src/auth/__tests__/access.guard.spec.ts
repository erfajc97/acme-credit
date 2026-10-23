import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { Public, Roles, Signed } from '../access.decorators';
import { AccessGuard, type AccessAuthenticator } from '../access.guard';

class Marked {
  @Public()
  open(): void {}

  @Roles('admin')
  adminOnly(): void {}

  @Signed('network')
  signed(): void {}

  closed(): void {}
}

@Public()
class PublicController {
  inherited(): void {}
}

function contextFor(
  handler: () => void,
  controller: object,
  request: Record<string, unknown> = { headers: {} },
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a rejection');
}

const authenticator = (role: string | null): AccessAuthenticator => ({
  authenticate: () => Promise.resolve(role ? { id: 'u-1', role } : null),
});

describe('AccessGuard', () => {
  it('lets a handler marked @Public() through, and one whose controller is @Public()', async () => {
    const guard = new AccessGuard(new Reflector());
    await expect(guard.canActivate(contextFor(Marked.prototype.open, Marked))).resolves.toBe(true);
    await expect(
      guard.canActivate(contextFor(PublicController.prototype.inherited, PublicController)),
    ).resolves.toBe(true);
  });

  it('denies an unmarked route with the forbidden code and 403', async () => {
    const guard = new AccessGuard(new Reflector());
    expect(
      await rejection(guard.canActivate(contextFor(Marked.prototype.closed, Marked))),
    ).toMatchObject({
      code: 'common.forbidden',
      status: 403,
    });
  });

  it('roles: 401 without a user, 403 with the wrong role, and attaches the principal', async () => {
    const run = (role: string | null, request: Record<string, unknown> = { headers: {} }) =>
      new AccessGuard(new Reflector(), authenticator(role)).canActivate(
        contextFor(Marked.prototype.adminOnly, Marked, request),
      );
    expect(await rejection(run(null))).toMatchObject({
      code: 'common.unauthenticated',
      status: 401,
    });
    expect(await rejection(run('customer'))).toMatchObject({ code: 'common.forbidden' });
    const request: Record<string, unknown> = { headers: {} };
    await expect(run('admin', request)).resolves.toBe(true);
    expect(request.principal).toEqual({ id: 'u-1', role: 'admin' });
  });

  it('roles and signed routes fail closed when the service did not configure them', async () => {
    const guard = new AccessGuard(new Reflector());
    expect(
      await rejection(guard.canActivate(contextFor(Marked.prototype.adminOnly, Marked))),
    ).toMatchObject({ code: 'common.forbidden' });
    expect(
      await rejection(guard.canActivate(contextFor(Marked.prototype.signed, Marked))),
    ).toMatchObject({ code: 'common.forbidden' });
  });
});

describe('access markers', () => {
  it('refuse a second marker on the same handler', () => {
    expect(() => {
      class Twice {
        @Public()
        @Roles('admin')
        both(): void {}
      }
      return Twice;
    }).toThrow(/Two access markers on both/);
  });

  it('refuse a second marker on the same controller', () => {
    expect(() => {
      @Public()
      @Signed('network')
      class Twice {}
      return Twice;
    }).toThrow(/Two access markers/);
  });
});
