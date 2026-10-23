import { accountSchema } from '@acme/contracts';
import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { navigateTo } from '@/app/helpers/navigation';
import { fetchMyAccount } from '@/app/services/accountsApi';
import { useAuthStore } from '@/app/store/authStore';
import { accountFixture, SESSION } from '@/test/fixtures';
import { apiError, core, json, network, server } from '@/test/server';
import { ApiError, apiRequest, getApiErrorCode, refreshSession } from '../apiClient';
import { shouldRetryQuery } from '../queryClient';

vi.mock('@/app/helpers/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/helpers/navigation')>()),
  navigateTo: vi.fn(),
}));

function signIn(accessToken = 'access-0') {
  useAuthStore.getState().setSession({ ...SESSION, accessToken });
}

describe('apiRequest', () => {
  beforeEach(() => vi.mocked(navigateTo).mockReset());

  it('sends the bearer token, the cookie and the idempotency key, and parses with the contract', async () => {
    signIn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    let seen: Request | undefined;
    server.use(
      http.post(core('/accounts'), ({ request }) => {
        seen = request;
        return json(accountFixture(), 201);
      }),
    );
    const account = await apiRequest({
      path: '/accounts',
      method: 'POST',
      schema: accountSchema,
      idempotencyKey: 'key-1',
    });
    expect(account.id).toBe(accountFixture().id);
    expect(seen?.headers.get('authorization')).toBe('Bearer access-0');
    expect(seen?.headers.get('idempotency-key')).toBe('key-1');
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include', method: 'POST' });
    fetchSpy.mockRestore();
  });

  it('calls the card network without the bearer token or cookies, with the query string', async () => {
    signIn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    let seen: Request | undefined;
    server.use(
      http.get(network('/purchases'), ({ request }) => {
        seen = request;
        return json({ ok: true });
      }),
    );
    await apiRequest({
      target: 'network',
      path: '/purchases',
      schema: z.unknown(),
      query: { limit: 5, cursor: undefined },
    });
    expect(seen?.headers.get('authorization')).toBeNull();
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ credentials: 'omit', body: null });
    fetchSpy.mockRestore();
    expect(new URL(seen?.url ?? '').search).toBe('?limit=5');
  });

  it('turns the error envelope into its catalog code and never keeps the backend message', async () => {
    server.use(http.post(core('/auth/login'), () => apiError(401, 'auth.invalid_credentials')));
    const error = await apiRequest({
      path: '/auth/login',
      method: 'POST',
      body: {},
      schema: z.unknown(),
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: 'auth.invalid_credentials' });
    expect(String((error as ApiError).message)).not.toContain('backend text');
    expect(getApiErrorCode(error)).toBe('auth.invalid_credentials');
    expect(getApiErrorCode(new Error('x'))).toBeNull();
  });

  it('keeps the details of an envelope', async () => {
    server.use(
      http.get(core('/x'), () =>
        HttpResponse.json(
          {
            code: 'common.validation_failed',
            message: 'm',
            requestId: 'r',
            details: { field: 'email' },
          },
          { status: 400 },
        ),
      ),
    );
    await expect(apiRequest({ path: '/x', schema: z.unknown() })).rejects.toMatchObject({
      code: 'common.validation_failed',
      details: { field: 'email' },
    });
  });

  it.each([
    ['a code outside the catalog', HttpResponse.json({ code: 'made.up' }, { status: 409 })],
    ['a body that is not JSON', new HttpResponse('<html>bad gateway</html>', { status: 502 })],
    ['an empty body', new HttpResponse(null, { status: 500 })],
    ['a JSON body without code', HttpResponse.json(['x'], { status: 500 })],
  ])('maps %s to a null code (generic copy)', async (_name, response) => {
    server.use(http.get(core('/x'), () => response));
    await expect(apiRequest({ path: '/x', schema: z.unknown() })).rejects.toMatchObject({
      code: null,
    });
  });

  it('reports a request that got no answer as status 0 (unknown, not "no")', async () => {
    server.use(http.get(core('/x'), () => HttpResponse.error()));
    await expect(apiRequest({ path: '/x', schema: z.unknown() })).rejects.toMatchObject({
      status: 0,
      code: null,
    });
  });

  it('answers 204 with no body', async () => {
    server.use(http.post(core('/auth/logout'), () => new HttpResponse(null, { status: 204 })));
    await expect(
      apiRequest({ path: '/auth/logout', method: 'POST', schema: z.undefined() }),
    ).resolves.toBeUndefined();
  });

  it('on a 401 refreshes once and retries once with the new token', async () => {
    signIn('expired');
    const tokens: (string | null)[] = [];
    server.use(
      http.get(core('/accounts/me'), ({ request }) => {
        tokens.push(request.headers.get('authorization'));
        return request.headers.get('authorization') === 'Bearer access-1'
          ? json(accountFixture())
          : apiError(401, 'auth.session_expired');
      }),
      http.post(core('/auth/refresh'), () => json(SESSION)),
    );
    await expect(
      apiRequest({ path: '/accounts/me', schema: accountSchema }),
    ).resolves.toMatchObject({ status: 'ACTIVE' });
    expect(tokens).toEqual(['Bearer expired', 'Bearer access-1']);
    expect(useAuthStore.getState().accessToken).toBe('access-1');
  });

  it('retries only once: a second 401 reaches the caller', async () => {
    signIn('expired');
    let calls = 0;
    server.use(
      http.get(core('/accounts/me'), () => {
        calls += 1;
        return apiError(401, 'auth.session_expired');
      }),
      http.post(core('/auth/refresh'), () => json(SESSION)),
    );
    await expect(apiRequest({ path: '/accounts/me', schema: accountSchema })).rejects.toMatchObject(
      { status: 401 },
    );
    expect(calls).toBe(2);
  });

  it('shares ONE refresh between concurrent 401s (single flight)', async () => {
    signIn('expired');
    let refreshes = 0;
    server.use(
      http.get(core('/accounts/me'), ({ request }) =>
        request.headers.get('authorization') === 'Bearer access-1'
          ? json(accountFixture())
          : apiError(401, 'auth.session_expired'),
      ),
      http.post(core('/auth/refresh'), async () => {
        refreshes += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return json(SESSION);
      }),
    );
    await Promise.all([
      apiRequest({ path: '/accounts/me', schema: accountSchema }),
      apiRequest({ path: '/accounts/me', schema: accountSchema }),
      apiRequest({ path: '/accounts/me', schema: accountSchema }),
    ]);
    expect(refreshes).toBe(1);
    // The flight is over: a later refresh is a new request.
    await refreshSession();
    expect(refreshes).toBe(2);
  });

  it('without a session left, clears it and sends the customer to sign in with a way back', async () => {
    signIn('expired');
    window.history.replaceState(null, '', '/app/activity?x=1');
    server.use(
      http.get(core('/accounts/me'), () => apiError(401, 'auth.session_expired')),
      http.post(core('/auth/refresh'), () => apiError(401, 'auth.session_expired')),
    );
    await expect(apiRequest({ path: '/accounts/me', schema: accountSchema })).rejects.toMatchObject(
      { status: 401 },
    );
    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(navigateTo).toHaveBeenCalledWith('/signin?returnTo=%2Fapp%2Factivity%3Fx%3D1');
  });

  it('never refreshes for an anonymous 401 (nothing to repair)', async () => {
    server.use(http.post(core('/auth/login'), () => apiError(401, 'auth.invalid_credentials')));
    await expect(
      apiRequest({ path: '/auth/login', method: 'POST', body: {}, schema: z.unknown() }),
    ).rejects.toMatchObject({
      code: 'auth.invalid_credentials',
    });
    expect(navigateTo).not.toHaveBeenCalled();
  });
});

describe('refreshSession', () => {
  it('a refresh that fails for another reason reaches the caller and keeps the status unknown', async () => {
    server.use(http.post(core('/auth/refresh'), () => apiError(503, 'common.internal')));
    await expect(refreshSession()).rejects.toMatchObject({ status: 503 });
    expect(useAuthStore.getState().status).toBe('unknown');
  });

  it('403 means anonymous too', async () => {
    server.use(http.post(core('/auth/refresh'), () => apiError(403, 'common.forbidden')));
    await expect(refreshSession()).resolves.toBeNull();
    expect(useAuthStore.getState().status).toBe('anonymous');
  });
});

describe('fetchMyAccount', () => {
  it('maps 404 to "no account yet" and lets other failures through', async () => {
    signIn();
    server.use(http.get(core('/accounts/me'), () => apiError(404, 'common.not_found')));
    await expect(fetchMyAccount()).resolves.toBeNull();
    server.use(http.get(core('/accounts/me'), () => apiError(500, 'common.internal')));
    await expect(fetchMyAccount()).rejects.toMatchObject({ code: 'common.internal' });
  });
});

describe('shouldRetryQuery', () => {
  it('never retries a 4xx, retries an unknown outcome once', () => {
    expect(shouldRetryQuery(0, new ApiError(404, 'common.not_found'))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(400, null))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(499, null))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(500, 'common.internal'))).toBe(true);
    expect(shouldRetryQuery(0, new ApiError(0, null))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError(0, null))).toBe(false);
    expect(shouldRetryQuery(0, new ApiError(399, null))).toBe(true);
  });
});
