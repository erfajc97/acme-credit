import { createHash } from 'node:crypto';

/** Fixed namespace of this simulator; changing it would change every derived key. */
const NAMESPACE = Buffer.from('3b0f6c1e9d2a4f7e8c5b1a0d6e4f2c19', 'hex');

/**
 * UUID v5 (SHA-1, RFC 4122) of `name`. Background calls (capture, reversal, webhook) derive
 * their Idempotency-Key from the fact they deliver, so every retry — even after a restart —
 * sends the same key and the core applies the effect once (P3).
 */
export function deterministicUuid(name: string): string {
  const bytes = createHash('sha1').update(NAMESPACE).update(name, 'utf8').digest().subarray(0, 16);
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x50, 6);
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
