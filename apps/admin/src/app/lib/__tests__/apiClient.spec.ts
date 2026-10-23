import { adminAccountSchema } from '@acme/contracts';
import { http, HttpResponse } from 'msw';
import { z } from 'zod';
import { navigateTo } from '@/app/helpers/navigation';
import { fetchAccount } from '@/app/services/adminApi';
import { useAuthStore } from '@/app/store/authStore';
import { ACCOUNT_ID, adminAccountFixture, SESSION } from '@/test/fixtures';
import { apiError, core, json, server } from '@/test/server';
import { ApiError, apiRequest, getApiErrorCode, refreshSession } from '../apiClient';
import { shouldRetryQuery } from '../queryClient';

vi.mock('@/app/helpers/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/helpers/navigation')>()),
  navigateTo: vi.fn(),
}));

const ACCOUNT_PATH = `/admin/accounts/${ACCOUNT_ID}`;

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
      http.post(core(`${ACCOUNT_PATH}/freeze`), ({ request }) => {
        seen = request;
        return json(adminAccountFixture({ status: 'FROZEN' }));
      }),
    );
    const account = await apiRequest({
      path: `${ACCOUNT_PATH}/freeze`,
      method: 'POST',
      schema: adminAccountSchema,
      idempotencyKey: 'key-1',
      query: { limit: 5, cursor: undefined },
    });
    expect(account.status).toBe('FROZEN');
    expect(seen?.headers.get('authorization')).toBe('Bearer access-0');
    expect(seen?.headers.get('idempotency-key')).toBe('key-1');
    expect(new URL(seen?.url ?? '').search).toBe('?limit=5');
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({
      credentials: 'include',
      method: 'POST',
      body: null,
    });
    fetchSpy.mockRestore();
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
            details: { field: 'q' },
          },
          { status: 400 },
        ),
      ),
    );
    await expect(apiRequest({ path: '/x', schema: z.unknown() })).rejects.toMatchObject({
      code: 'common.validation_failed',
      details: { field: 'q' },
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

  it('on a 401 refreshes once and retries once with the new token', async () => {
    signIn('expired');
    const tokens: (string | null)[] = [];
    server.use(
      http.get(core(ACCOUNT_PATH), ({ request }) => {
        tokens.push(request.headers.get('authorization'));
        return request.headers.get('authorization') === 'Bearer access-1'
          ? json(adminAccountFixture())
          : apiError(401, 'auth.session_expired');
      }),
      http.post(core('/auth/refresh'), () => json(SESSION)),
    );
    await expect(
      apiRequest({ path: ACCOUNT_PATH, schema: adminAccountSchema }),
    ).resolves.toMatchObject({ status: 'ACTIVE' });
    expect(tokens).toEqual(['Bearer expired', 'Bearer access-1']);
    expect(useAuthStore.getState().accessToken).toBe('access-1');
  });

  it('retries only once: a second 401 reaches the caller', async () => {
    signIn('expired');
    let calls = 0;
    server.use(
      http.get(core(ACCOUNT_PATH), () => {
        calls += 1;
        return apiError(401, 'auth.session_expired');
      }),
      http.post(core('/auth/refresh'), () => json(SESSION)),
    );
    await expect(
      apiRequest({ path: ACCOUNT_PATH, schema: adminAccountSchema }),
    ).rejects.toMatchObject({ status: 401 });
    expect(calls).toBe(2);
  });

  it('shares ONE refresh between concurrent 401s (single flight)', async () => {
    signIn('expired');
    let refreshes = 0;
    server.use(
      http.get(core(ACCOUNT_PATH), ({ request }) =>
        request.headers.get('authorization') === 'Bearer access-1'
          ? json(adminAccountFixture())
          : apiError(401, 'auth.session_expired'),
      ),
      http.post(core('/auth/refresh'), async () => {
        refreshes += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return json(SESSION);
      }),
    );
    await Promise.all([
      apiRequest({ path: ACCOUNT_PATH, schema: adminAccountSchema }),
      apiRequest({ path: ACCOUNT_PATH, schema: adminAccountSchema }),
      apiRequest({ path: ACCOUNT_PATH, schema: adminAccountSchema }),
    ]);
    expect(refreshes).toBe(1);
    // The flight is over: a later refresh is a new request.
    await refreshSession();
    expect(refreshes).toBe(2);
  });

  it('without a session left, clears it and sends the admin to sign in with a way back', async () => {
    signIn('expired');
    window.history.replaceState(null, '', '/accounts?status=FROZEN');
    server.use(
      http.get(core(ACCOUNT_PATH), () => apiError(401, 'auth.session_expired')),
      http.post(core('/auth/refresh'), () => apiError(401, 'auth.session_expired')),
    );
    await expect(
      apiRequest({ path: ACCOUNT_PATH, schema: adminAccountSchema }),
    ).rejects.toMatchObject({ status: 401 });
    expect(useAuthStore.getState().status).toBe('anonymous');
    expect(navigateTo).toHaveBeenCalledWith('/signin?returnTo=%2Faccounts%3Fstatus%3DFROZEN');
  });

  it('never refreshes for an anonymous 401 (nothing to repair)', async () => {
    server.use(http.post(core('/auth/login'), () => apiError(401, 'auth.invalid_credentials')));
    await expect(
      apiRequest({ path: '/auth/login', method: 'POST', body: {}, schema: z.unknown() }),
    ).rejects.toMatchObject({ code: 'auth.invalid_credentials' });
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

describe('fetchAccount', () => {
  it('maps 404 to "no such account" and lets other failures through', async () => {
    signIn();
    server.use(http.get(core(ACCOUNT_PATH), () => apiError(404, 'common.not_found')));
    await expect(fetchAccount(ACCOUNT_ID)).resolves.toBeNull();
    server.use(http.get(core(ACCOUNT_PATH), () => apiError(500, 'common.internal')));
    await expect(fetchAccount(ACCOUNT_ID)).rejects.toMatchObject({ code: 'common.internal' });
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

describe('refreshSession without a session', () => {
  // Regression: the 401 body was never read. With the ClientRouter the document survives the
  // redirect to sign in, so the browser kept that response open forever and the page never
  // reached network idle (the E2E smoke timed out on `networkidle`).
  it.each([401, 403])('answers anonymous on %i and releases the response body', async (status) => {
    const answers: Response[] = [];
    const realFetch = globalThis.fetch;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (...args) => {
      const response = await realFetch(...args);
      answers.push(response);
      return response;
    });
    try {
      server.use(http.post(core('/auth/refresh'), () => apiError(status, 'auth.session_expired')));
      await expect(refreshSession()).resolves.toBeNull();
      expect(useAuthStore.getState().status).toBe('anonymous');
      expect(answers).toHaveLength(1);
      expect(answers[0]?.bodyUsed).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
