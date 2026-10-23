import { http, HttpResponse, type JsonBodyType } from 'msw';
import { setupServer } from 'msw/node';
import { SESSION } from './fixtures';

/** URL of a core API path, as the app builds it (astro:env defaults in tests). */
export const core = (path: string) => `http://localhost:3000/v1${path}`;
/** URL of a card network simulator path. */
export const network = (path: string) => `http://localhost:3001/v1${path}`;

/** The API's error envelope (A7), the shape every non-2xx carries. */
export function apiError(status: number, code: string): Response {
  return HttpResponse.json(
    { code, message: 'backend text never shown', requestId: 'req-1' },
    { status },
  );
}

export function json(body: JsonBodyType, status = 200): Response {
  return HttpResponse.json(body, { status });
}

/** A browser holding a valid refresh cookie: the session bootstrap signs in. */
export const signedIn = http.post(core('/auth/refresh'), () => json(SESSION));
/** No refresh cookie: the API answers 401 and the visitor is anonymous. */
export const signedOut = http.post(core('/auth/refresh'), () =>
  apiError(401, 'auth.session_expired'),
);

/** Every request must be handled by the test: an unmocked call fails loudly. */
export const server = setupServer();
