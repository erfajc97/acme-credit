import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Every answer of these APIs is private (balances, card tokens, purchases) or an error about a
 * caller: no shared cache (CDN, proxy) and no browser cache may store it (A5). Set before any
 * handler or error filter runs, so 4xx/5xx carry it too.
 */
export function noStoreMiddleware(
  _request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
): void {
  response.setHeader('Cache-Control', 'private, no-store');
  next();
}
