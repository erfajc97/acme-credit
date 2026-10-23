import type { Actor } from '../audit/record-change';

/** Keys are unique per caller (ADR-0004): the user id, or the signed service's name. */
export function idempotencyScope(actor: Actor): string {
  return actor.id ?? actor.type;
}
