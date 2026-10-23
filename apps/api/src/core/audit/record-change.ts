import type { ActorType, Prisma } from '../../generated/prisma/client';
import type { Tx } from '../database/transaction';

/** Who caused a change, and the request it came from (A15). */
export interface Actor {
  type: ActorType;
  id: string | null;
  requestId: string | null;
}

export const SYSTEM_ACTOR: Actor = { type: 'system', id: null, requestId: null };

export interface Change {
  /** `entity.verb`, e.g. `deposit.confirmed`; also the outbox event type. */
  action: string;
  entityType: string;
  entityId: string;
  /** Ids, enums and amounts as strings only: no personal data (OB3). */
  data: Prisma.InputJsonObject;
}

/**
 * Every state change writes its audit row AND its outbox event in the caller's transaction
 * (R-08e, P2): both exist if and only if the change committed.
 */
export async function recordChange(tx: Tx, actor: Actor, change: Change): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorType: actor.type,
      actorId: actor.id,
      action: change.action,
      entityType: change.entityType,
      entityId: change.entityId,
      requestId: actor.requestId,
      data: change.data,
    },
    select: { id: true },
  });
  await tx.outboxEvent.create({
    data: {
      type: change.action,
      payload: {
        entityType: change.entityType,
        entityId: change.entityId,
        requestId: actor.requestId,
        data: change.data,
      },
    },
    select: { id: true },
  });
}
