import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

const REQUEST_ID_HEADER = 'x-request-id';

/** Accept a caller's id only when it is short and safe to log; otherwise mint one (A15). */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

type WithId = IncomingMessage & { id?: unknown };

export function resolveRequestId(incoming: string | string[] | undefined): string {
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  return candidate && SAFE_REQUEST_ID.test(candidate) ? candidate : randomUUID();
}

/** Assigns the id once and echoes it; reuses an id already on the request. */
export function assignRequestId(request: WithId, response: ServerResponse): string {
  if (typeof request.id === 'string') return request.id;
  const id = resolveRequestId(request.headers[REQUEST_ID_HEADER]);
  request.id = id;
  response.setHeader('X-Request-ID', id);
  return id;
}

/**
 * First middleware of the app, before helmet and the body parser, so errors those raise
 * (malformed JSON, 413) still carry the id in the header and the envelope.
 */
export function requestIdMiddleware(
  request: WithId,
  response: ServerResponse,
  next: () => void,
): void {
  assignRequestId(request, response);
  next();
}

export function requestIdOf(request: { id?: unknown }): string {
  return typeof request.id === 'string' ? request.id : 'unknown';
}
