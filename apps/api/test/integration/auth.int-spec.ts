import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, testEnv, type Harness } from './support/harness';

let h: Harness;

beforeAll(async () => {
  h = await startHarness();
});

afterAll(async () => {
  await h.close();
});

function refreshCookie(setCookie: string[] | string | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = cookies.find((value) => value.startsWith('acme_rt='));
  if (!cookie) throw new Error('no refresh cookie');
  return cookie;
}

const cookiePair = (cookie: string) => cookie.split(';')[0] ?? '';

describe('register, login and the refresh cookie', () => {
  it('registers a customer with a session and an httpOnly SameSite=Strict refresh cookie', async () => {
    const email = `new-${randomUUID()}@acme.test`;
    const res = await h.http
      .post('/v1/auth/register')
      .send({ email: email.toUpperCase(), password: 'x'.repeat(8), fullName: '  Ada Lovelace ' });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body).sort()).toEqual(['accessToken', 'expiresInSeconds', 'user']);
    expect(res.body.expiresInSeconds).toBe(900);
    expect(Object.keys(res.body.user).sort()).toEqual(['email', 'fullName', 'id', 'role']);
    expect(res.body.user).toMatchObject({ email, fullName: 'Ada Lovelace', role: 'customer' });
    const cookie = refreshCookie(res.headers['set-cookie']);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/v1/auth');

    const me = await h.http
      .get('/v1/me')
      .set('Authorization', `Bearer ${res.body.accessToken as string}`);
    expect(me.status).toBe(200);
    expect(me.body).toEqual(res.body.user);

    const twice = await h.http
      .post('/v1/auth/register')
      .send({ email, password: 'y'.repeat(8), fullName: 'Copy' });
    expect(twice.status).toBe(409);
    expect(twice.body).toMatchObject({ code: 'auth.email_taken' });
  });

  it('needs at least 8 password characters (boundary pair)', async () => {
    const short = await h.http
      .post('/v1/auth/register')
      .send({ email: `short-${randomUUID()}@acme.test`, password: 'x'.repeat(7), fullName: 'S' });
    expect(short.status).toBe(422);
    expect(short.body).toMatchObject({ code: 'common.validation_failed' });
  });

  it('logs the seeded admin into the admin app only (role must match the audience)', async () => {
    const credentials = {
      email: testEnv('SEED_ADMIN_EMAIL'),
      password: testEnv('SEED_ADMIN_PASSWORD'),
    };
    const admin = await h.http.post('/v1/auth/login').send({ ...credentials, audience: 'admin' });
    expect(admin.status).toBe(200);
    expect(admin.body.user).toMatchObject({ role: 'admin' });

    const wrongApp = await h.http
      .post('/v1/auth/login')
      .send({ ...credentials, audience: 'customer' });
    expect(wrongApp.status).toBe(401);
    expect(wrongApp.body).toMatchObject({ code: 'auth.invalid_credentials' });

    const wrongPassword = await h.http
      .post('/v1/auth/login')
      .send({ email: credentials.email, password: 'not-the-password', audience: 'admin' });
    expect(wrongPassword.body).toMatchObject({ code: 'auth.invalid_credentials' });
    const unknown = await h.http
      .post('/v1/auth/login')
      .send({ email: 'nobody@acme.test', password: 'whatever1', audience: 'admin' });
    expect(unknown.body).toMatchObject({ code: 'auth.invalid_credentials' });
  });

  it('rotates the refresh token; replaying a rotated one revokes the whole family', async () => {
    const login = await h.http.post('/v1/auth/login').send({
      email: testEnv('SEED_CUSTOMER_EMAIL'),
      password: testEnv('SEED_CUSTOMER_PASSWORD'),
      audience: 'customer',
    });
    expect(login.status).toBe(200);
    const original = cookiePair(refreshCookie(login.headers['set-cookie']));

    const rotated = await h.http.post('/v1/auth/refresh').set('Cookie', original);
    expect(rotated.status).toBe(200);
    expect(rotated.body.user).toMatchObject({ email: testEnv('SEED_CUSTOMER_EMAIL') });
    const next = cookiePair(refreshCookie(rotated.headers['set-cookie']));
    expect(next).not.toBe(original);

    const replay = await h.http.post('/v1/auth/refresh').set('Cookie', original);
    expect(replay.status).toBe(401);
    expect(replay.body).toMatchObject({ code: 'auth.session_expired' });
    // The thief's replay also killed the legitimate successor.
    const successor = await h.http.post('/v1/auth/refresh').set('Cookie', next);
    expect(successor.body).toMatchObject({ code: 'auth.session_expired' });

    const none = await h.http.post('/v1/auth/refresh');
    expect(none.body).toMatchObject({ code: 'auth.session_expired' });
  });

  it('logs out with 204, clearing the cookie and revoking the session', async () => {
    const login = await h.http.post('/v1/auth/login').send({
      email: testEnv('SEED_CUSTOMER_EMAIL'),
      password: testEnv('SEED_CUSTOMER_PASSWORD'),
      audience: 'customer',
    });
    const cookie = cookiePair(refreshCookie(login.headers['set-cookie']));
    const out = await h.http.post('/v1/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(204);
    expect(refreshCookie(out.headers['set-cookie'])).toContain('Expires=Thu, 01 Jan 1970');
    const after = await h.http.post('/v1/auth/refresh').set('Cookie', cookie);
    expect(after.body).toMatchObject({ code: 'auth.session_expired' });
  });

  it('rejects /me without a valid bearer token', async () => {
    const res = await h.http.get('/v1/me').set('Authorization', 'Bearer forged.token.value');
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ code: 'common.unauthenticated' });
  });
});
