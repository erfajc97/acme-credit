import { IDEMPOTENCY_HEADER, isErrorCode, sessionSchema, type ErrorCode } from '@acme/contracts';
import type { z } from 'zod';
import { env } from '@/app/config/env';
import { currentLocation, navigateTo } from '@/app/helpers/navigation';
import { signInHref } from '@/app/helpers/safeReturnTo';
import { useAuthStore } from '@/app/store/authStore';
import { ENDPOINTS, localHref, SIGN_IN_PATH } from './endpoints';

/**
 * A failed call, carrying the catalog `code` of the API envelope (A7, W6). The backend `message`
 * is deliberately not kept: it is never shown nor compared. `status` 0 = the request never got an
 * answer (offline, CORS, DNS): the outcome is unknown, not "no".
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode | null;
  readonly details: Record<string, unknown> | undefined;

  constructor(status: number, code: ErrorCode | null, details?: Record<string, unknown>) {
    super(code ?? `http_${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiRequest<T> {
  path: string;
  schema: z.ZodType<T>;
  method?: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Required on every admin action (MO2); see lib/idempotency.ts. */
  idempotencyKey?: string;
}

function buildUrl(path: string, query: ApiRequest<unknown>['query']): string {
  const url = new URL(`${env.apiUrl}/v1${path}`);
  for (const [name, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(name, String(value));
  }
  return url.toString();
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    // A body that is not JSON (a proxy error page) carries no code: the caller gets a coded
    // null and shows the generic copy.
    return undefined;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await readJson(response);
  if (typeof body === 'object' && body !== null && 'code' in body && isErrorCode(body.code)) {
    const details =
      'details' in body && typeof body.details === 'object' && body.details !== null
        ? (body.details as Record<string, unknown>)
        : undefined;
    return new ApiError(response.status, body.code, details);
  }
  return new ApiError(response.status, null);
}

interface SendOptions {
  url: string;
  method: 'GET' | 'POST';
  body: unknown;
  idempotencyKey: string | undefined;
  accessToken: string | null;
}

async function send({ url, method, body, idempotencyKey, accessToken }: SendOptions) {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (idempotencyKey) headers[IDEMPOTENCY_HEADER] = idempotencyKey;
  try {
    return await fetch(url, {
      method,
      headers,
      // The core needs the httpOnly refresh cookie.
      credentials: 'include',
      body: body === undefined ? null : JSON.stringify(body),
    });
  } catch {
    // fetch rejects only when no answer arrived; the request may or may not have been applied.
    throw new ApiError(0, null);
  }
}

let refreshInFlight: Promise<string | null> | null = null;

async function requestSession(): Promise<string | null> {
  const response = await send({
    url: buildUrl(ENDPOINTS.auth.refresh, undefined),
    method: 'POST',
    body: undefined,
    idempotencyKey: undefined,
    accessToken: null,
  });
  // 401/403 is the API saying "no valid refresh cookie": the visitor is anonymous. Anything else
  // (5xx, offline) says nothing about the session, so it reaches the caller as an error.
  if (response.status === 401 || response.status === 403) {
    // Release the unread body: the ClientRouter keeps this document alive after the redirect to
    // sign in, and an unread response stays open forever (the page never reaches network idle).
    await response.body?.cancel();
    useAuthStore.getState().clearSession();
    return null;
  }
  if (!response.ok) throw await toApiError(response);
  const session = sessionSchema.parse(await readJson(response));
  useAuthStore.getState().setSession(session);
  return session.accessToken;
}

/**
 * Single flight: the session bootstrap and every concurrent 401 share ONE refresh request, so the
 * refresh token is rotated once. Resolves with the new access token, or null without a session.
 */
export function refreshSession(): Promise<string | null> {
  refreshInFlight ??= requestSession().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/**
 * The one HTTP door of the console (services only). Parses the answer with the contract schema;
 * on a 401 of an authenticated call it refreshes once (single flight) and retries once.
 */
export async function apiRequest<T>({
  path,
  schema,
  method = 'GET',
  body,
  query,
  idempotencyKey,
}: ApiRequest<T>): Promise<T> {
  const url = buildUrl(path, query);
  const accessToken = useAuthStore.getState().accessToken;
  let response = await send({ url, method, body, idempotencyKey, accessToken });

  if (response.status === 401 && accessToken) {
    const renewed = await refreshSession();
    if (!renewed) {
      navigateTo(signInHref(localHref(SIGN_IN_PATH), currentLocation()));
      throw await toApiError(response);
    }
    response = await send({ url, method, body, idempotencyKey, accessToken: renewed });
  }

  if (!response.ok) throw await toApiError(response);
  return schema.parse(await readJson(response));
}

/** The API's error code of any failure, or null (network error, unexpected shape). */
export function getApiErrorCode(error: unknown): ErrorCode | null {
  return error instanceof ApiError ? error.code : null;
}
