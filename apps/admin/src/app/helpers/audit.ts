import type { AuditLogEntry } from '@acme/contracts';
import { accountHref } from '@/app/lib/endpoints';
import { formatDateTime } from './dates';
import { ACTOR_TYPE } from './statusLabels';

export interface AuditRow {
  id: string;
  time: string;
  actorKey: string;
  /** Who exactly (a user id), when the actor is a person. */
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  /** Accounts open in the console; other entities are shown by id. */
  entityHref: string | null;
  requestId: string | null;
}

export function toAuditRow(entry: AuditLogEntry): AuditRow {
  return {
    id: entry.id,
    time: formatDateTime(entry.createdAt),
    actorKey: ACTOR_TYPE[entry.actorType],
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entityHref: entry.entityType === 'account' ? accountHref(entry.entityId) : null,
    requestId: entry.requestId,
  };
}
