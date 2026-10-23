import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeDb, type FakeDb } from '../../../core/__tests__/fake-db';
import type { Env } from '../../../core/config/env';
import { AuthService } from '../auth.service';
import { UsersSeeder } from '../users.seeder';

const NOW = new Date('2026-10-21T12:00:00.000Z');
const env = { REFRESH_TOKEN_TTL_SECONDS: 3_600 } as Env;
const USER = { id: 'u1', email: 'ada@acme.test', fullName: 'Ada', role: 'customer' as const };
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

describe('AuthService', () => {
  let db: FakeDb;
  let hasher: { hash: ReturnType<typeof vi.fn>; verify: ReturnType<typeof vi.fn> };
  let service: AuthService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    db = fakeDb();
    hasher = { hash: vi.fn(async () => 'hash'), verify: vi.fn(async () => true) };
    const tokens = { issue: vi.fn(async () => 'access-token'), ttlSeconds: 900 };
    service = new AuthService(db as never, hasher as never, tokens as never, env);
    db.refreshToken.create.mockResolvedValue({ id: 't1' });
  });

  it('registers a customer and opens a session with a hashed refresh token', async () => {
    db.user.create.mockResolvedValue(USER);
    const issued = await service.register({
      email: USER.email,
      password: 'password1',
      fullName: 'Ada',
    });
    expect(issued.session).toEqual({
      accessToken: 'access-token',
      expiresInSeconds: 900,
      user: USER,
    });
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { email: USER.email, passwordHash: 'hash', fullName: 'Ada', role: 'customer' },
      }),
    );
    const stored = db.refreshToken.create.mock.calls[0]?.[0] as {
      data: { tokenHash: string; expiresAt: Date };
    };
    expect(stored.data.tokenHash).toBe(sha256(issued.refreshToken));
    expect(stored.data.expiresAt).toEqual(new Date(NOW.getTime() + 3_600_000));
  });

  it('answers email_taken on a duplicate and rethrows anything else', async () => {
    db.user.create.mockRejectedValueOnce({ name: 'PrismaClientKnownRequestError', code: 'P2002' });
    await expect(
      service.register({ email: USER.email, password: 'password1', fullName: 'Ada' }),
    ).rejects.toMatchObject({
      code: 'auth.email_taken',
    });
    db.user.create.mockRejectedValueOnce(new Error('db down'));
    await expect(
      service.register({ email: USER.email, password: 'password1', fullName: 'Ada' }),
    ).rejects.toThrow('db down');
  });

  it('logs in only with the right password AND the right app, always verifying', async () => {
    db.user.findUnique.mockResolvedValue({ ...USER, passwordHash: 'stored' });
    await expect(
      service.login({ email: USER.email, password: 'pw', audience: 'customer' }),
    ).resolves.toMatchObject({
      session: { user: USER },
    });
    await expect(
      service.login({ email: USER.email, password: 'pw', audience: 'admin' }),
    ).rejects.toMatchObject({
      code: 'auth.invalid_credentials',
    });
    hasher.verify.mockResolvedValueOnce(false);
    await expect(
      service.login({ email: USER.email, password: 'bad', audience: 'customer' }),
    ).rejects.toMatchObject({
      code: 'auth.invalid_credentials',
    });
    db.user.findUnique.mockResolvedValue(null);
    await expect(
      service.login({ email: 'x@acme.test', password: 'pw', audience: 'customer' }),
    ).rejects.toMatchObject({
      code: 'auth.invalid_credentials',
    });
    expect(hasher.verify).toHaveBeenLastCalledWith(null, 'pw');
  });

  it('rotates a live refresh token within its family', async () => {
    db.refreshToken.findUnique.mockResolvedValue({
      id: 't0',
      familyId: 'f1',
      expiresAt: new Date(NOW.getTime() + 1),
      revokedAt: null,
      user: USER,
    });
    db.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    const issued = await service.refresh('old-token');
    expect(db.refreshToken.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: sha256('old-token') } }),
    );
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 't0', revokedAt: null },
      data: { revokedAt: NOW },
    });
    expect(db.refreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ familyId: 'f1' }) }),
    );
    expect(issued.session.user).toEqual(USER);
  });

  it('expires a missing, unknown or expired token without touching the family', async () => {
    await expect(service.refresh(undefined)).rejects.toMatchObject({
      code: 'auth.session_expired',
    });
    db.refreshToken.findUnique.mockResolvedValueOnce(null);
    await expect(service.refresh('x')).rejects.toMatchObject({ code: 'auth.session_expired' });
    db.refreshToken.findUnique.mockResolvedValueOnce({
      id: 't0',
      familyId: 'f1',
      expiresAt: NOW,
      revokedAt: null,
      user: USER,
    });
    await expect(service.refresh('x')).rejects.toMatchObject({ code: 'auth.session_expired' });
    expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('revokes the whole family when a rotated token is replayed or loses the race', async () => {
    const live = {
      id: 't0',
      familyId: 'f1',
      expiresAt: new Date(NOW.getTime() + 60_000),
      user: USER,
    };
    db.refreshToken.findUnique.mockResolvedValueOnce({ ...live, revokedAt: NOW });
    await expect(service.refresh('stolen')).rejects.toMatchObject({ code: 'auth.session_expired' });
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'f1', revokedAt: null },
      data: { revokedAt: NOW },
    });

    db.refreshToken.findUnique.mockResolvedValueOnce({ ...live, revokedAt: null });
    db.refreshToken.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 3 });
    await expect(service.refresh('raced')).rejects.toMatchObject({ code: 'auth.session_expired' });
    expect(db.refreshToken.create).not.toHaveBeenCalled();
  });

  it('logs out by revoking the family, and ignores a missing or unknown cookie', async () => {
    await service.logout(undefined);
    db.refreshToken.findUnique.mockResolvedValueOnce(null);
    await service.logout('unknown');
    expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
    db.refreshToken.findUnique.mockResolvedValueOnce({ familyId: 'f9' });
    await service.logout('known');
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: 'f9', revokedAt: null },
      data: { revokedAt: NOW },
    });
  });

  it('returns the profile of a live user only', async () => {
    db.user.findUnique.mockResolvedValueOnce(USER).mockResolvedValueOnce(null);
    await expect(service.me('u1')).resolves.toEqual(USER);
    await expect(service.me('gone')).rejects.toMatchObject({ code: 'common.unauthenticated' });
  });
});

describe('UsersSeeder', () => {
  const hasher = { hash: vi.fn(async (password: string) => `hash:${password}`) };

  it('upserts the admin and the demo customer by normalized email, keeping existing passwords', async () => {
    const db = fakeDb();
    await new UsersSeeder(db as never, hasher as never).seed({
      admin: { email: ' Admin@Acme.test ', password: 'admin-password' },
      customer: { email: 'demo@acme.test', password: 'demo-password' },
    });
    expect(db.user.upsert).toHaveBeenCalledTimes(2);
    expect(db.user.upsert).toHaveBeenCalledWith({
      where: { email: 'admin@acme.test' },
      create: {
        email: 'admin@acme.test',
        passwordHash: 'hash:admin-password',
        fullName: 'Acme Admin',
        role: 'admin',
      },
      update: { role: 'admin' },
      select: { id: true },
    });
    expect(db.user.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ role: 'customer', passwordHash: 'hash:demo-password' }),
      }),
    );
  });

  it('creates no demo customer when the env skips it (production without SEED_DEMO_CUSTOMER)', async () => {
    const db = fakeDb();
    await new UsersSeeder(db as never, hasher as never).seed({
      admin: { email: 'admin@acme.test', password: 'admin-password' },
      customer: null,
    });
    expect(db.user.upsert).toHaveBeenCalledTimes(1);
    expect(db.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ role: 'admin' }) }),
    );
  });
});
