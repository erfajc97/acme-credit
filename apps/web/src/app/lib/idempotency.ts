import type { ErrorCode } from '@acme/contracts';
import { ApiError } from './apiClient';

const STORAGE_PREFIX = 'acme.idem.';
/** A key outlives reloads for a day: long enough for any retry, short enough to never pile up. */
export const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Codes that mean "the server has not decided yet": retrying with the SAME key is the safe move,
 * so the key is kept (MO2). Every other 4xx is a definitive answer.
 */
const UNDECIDED_CODES: readonly ErrorCode[] = [
  'idempotency.in_progress',
  'operation.in_progress',
  'common.rate_limited',
];

interface StoredKey {
  key: string;
  createdAt: number;
}

/** Fallback when sessionStorage is blocked (private mode, policy): keys live for the tab. */
const memoryStore = new Map<string, string>();

function readSlot(slot: string): string | null {
  try {
    return window.sessionStorage.getItem(slot);
  } catch {
    // Storage blocked: the in-memory copy still covers retries inside this page.
    return memoryStore.get(slot) ?? null;
  }
}

function writeSlot(slot: string, value: string): void {
  memoryStore.set(slot, value);
  try {
    window.sessionStorage.setItem(slot, value);
  } catch {
    // Storage blocked or full: the in-memory copy written above is the fallback.
  }
}

function removeSlot(slot: string): void {
  memoryStore.delete(slot);
  try {
    window.sessionStorage.removeItem(slot);
  } catch {
    // Storage blocked: nothing persisted there, and the memory copy is already gone.
  }
}

/** JSON with sorted keys, so { a, b } and { b, a } are the same intent. */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([name, item]) => `${JSON.stringify(name)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** FNV-1a: a short, stable fingerprint of the payload (not a security hash; it only names a slot). */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** The storage slot of one intent: the action plus the exact payload it sends. */
export function idempotencySlot(action: string, payload: unknown): string {
  return `${STORAGE_PREFIX}${action}:${fingerprint(stableStringify(payload))}`;
}

function parseStored(raw: string | null, now: number): string | null {
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<StoredKey>;
    if (typeof stored.key !== 'string' || typeof stored.createdAt !== 'number') return null;
    return now - stored.createdAt < IDEMPOTENCY_TTL_MS ? stored.key : null;
  } catch {
    // A corrupted slot is treated as absent: a fresh key replaces it.
    return null;
  }
}

/**
 * The key for this intent: the stored one when the same action + payload was tried in the last
 * 24 h (a retry after a timeout, a reload, a re-opened dialog), otherwise a new UUID, persisted
 * BEFORE the request leaves (MO2). A disabled button is not idempotency.
 */
export function acquireIdempotencyKey(action: string, payload: unknown, now = Date.now()): string {
  const slot = idempotencySlot(action, payload);
  const existing = parseStored(readSlot(slot), now);
  if (existing) return existing;
  const key = crypto.randomUUID();
  writeSlot(slot, JSON.stringify({ key, createdAt: now } satisfies StoredKey));
  return key;
}

/** Forgets the key once the server answered for good, so the next identical intent is new. */
export function releaseIdempotencyKey(action: string, payload: unknown): void {
  removeSlot(idempotencySlot(action, payload));
}

/**
 * Did the server decide? A 2xx did; a 4xx did, except "still in progress / slow down". A 5xx or no
 * answer (status 0) is unknown: the effect may have happened, so the key must be reused.
 */
export function isDefinitiveFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status < 400 || error.status >= 500) return false;
  return error.code === null || !UNDECIDED_CODES.includes(error.code);
}

/**
 * Runs one money request with the intent's key: reuses it on retries and drops it after a
 * definitive answer (success or a decided 4xx).
 */
export async function withIdempotencyKey<T>(
  intent: { action: string; payload: unknown },
  request: (idempotencyKey: string) => Promise<T>,
): Promise<T> {
  const key = acquireIdempotencyKey(intent.action, intent.payload);
  try {
    const result = await request(key);
    releaseIdempotencyKey(intent.action, intent.payload);
    return result;
  } catch (error) {
    if (isDefinitiveFailure(error)) releaseIdempotencyKey(intent.action, intent.payload);
    throw error;
  }
}
