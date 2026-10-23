import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-SHA256 over `timestamp.METHOD.path.idempotencyKey.rawBody` (P3). The key is signed
 * because it decides whether the receiver applies the call again: a captured request resent
 * under a fresh key would otherwise be a second effect. A call without a key (a GET) signs an
 * empty one. The receiver verifies the exact raw bytes BEFORE parsing them, and rejects a
 * timestamp outside the allowed skew.
 */
export interface SignatureInput {
  secret: string;
  method: string;
  path: string;
  /** The `Idempotency-Key` header as sent, or `''` when the call carries none. */
  idempotencyKey: string;
  rawBody: string;
  timestamp: number;
}

export function computeSignature(input: SignatureInput) {
  const { secret, method, path, idempotencyKey, rawBody, timestamp } = input;
  return createHmac('sha256', secret)
    .update(`${timestamp}.${method.toUpperCase()}.${path}.${idempotencyKey}.${rawBody}`)
    .digest('hex');
}

/** Headers for an outgoing signed request; `timestamp` is unix seconds. */
export function signRequest(input: Omit<SignatureInput, 'timestamp'>, nowSeconds: number) {
  return {
    'X-Signature': computeSignature({ ...input, timestamp: nowSeconds }),
    'X-Signature-Timestamp': String(nowSeconds),
  };
}

export type SignatureCheck = 'valid' | 'missing' | 'stale' | 'mismatch';

/**
 * Keys are UUIDs. A dot in one is refused: it could move bytes between the key and the body
 * fields of the signed string while keeping the same signature.
 */
const FIELD_SEPARATOR = '.';

export function verifySignature(
  input: Omit<SignatureInput, 'timestamp'> & {
    signature: string | undefined;
    timestamp: string | undefined;
    nowSeconds: number;
    maxSkewSeconds: number;
  },
): SignatureCheck {
  const { signature, timestamp, nowSeconds, maxSkewSeconds, ...rest } = input;
  if (!signature || !timestamp || !/^\d{1,12}$/.test(timestamp)) return 'missing';
  if (rest.idempotencyKey.includes(FIELD_SEPARATOR)) return 'missing';
  const sentAt = Number(timestamp);
  if (Math.abs(nowSeconds - sentAt) > maxSkewSeconds) return 'stale';
  const expected = Buffer.from(computeSignature({ ...rest, timestamp: sentAt }), 'hex');
  const received = Buffer.from(signature, 'hex');
  if (received.length !== expected.length) return 'mismatch';
  return timingSafeEqual(received, expected) ? 'valid' : 'mismatch';
}
