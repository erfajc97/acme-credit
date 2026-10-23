import { createHash } from 'node:crypto';

/** JSON with object keys sorted at every level, so key order never changes the hash. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

/** SHA-256 of the route and the canonical body (ADR-0004): same key + other payload → 409. */
export function requestHash(input: { method: string; path: string; body: unknown }): string {
  return createHash('sha256')
    .update(`${input.method.toUpperCase()} ${input.path}\n${canonicalJson(input.body)}`)
    .digest('hex');
}
