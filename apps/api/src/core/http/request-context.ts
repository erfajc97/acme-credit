import { AppHttpException, type Principal } from '@acme/nest-core';
import { idempotencyKeySchema } from '@acme/contracts';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { ActorType } from '../../generated/prisma/client';
import type { Actor } from '../audit/record-change';
import type { IdempotentRequest as IdempotentRequestInput } from '../idempotency/idempotency.service';

interface ContextRequest {
  id?: unknown;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  principal?: Principal;
  signedBy?: string;
}

const ACTOR_TYPES: readonly ActorType[] = ['customer', 'admin', 'network', 'provider'];

function asActorType(value: string | undefined): ActorType {
  const match = ACTOR_TYPES.find((type) => type === value);
  if (!match) throw new Error('actor requested on a route without a principal or signature');
  return match;
}

/** Builds the audit actor from the access guard's result and the request id (A15). */
export function actorOf(request: ContextRequest): Actor {
  const requestId = typeof request.id === 'string' ? request.id : null;
  if (request.principal) {
    return { type: asActorType(request.principal.role), id: request.principal.id, requestId };
  }
  return { type: asActorType(request.signedBy), id: null, requestId };
}

/**
 * The `Idempotency-Key` of a money POST (MO2): required, a UUID. Missing → 422
 * `idempotency.key_required`; malformed → 422 `common.validation_failed`.
 */
export function idempotentRequestOf(request: ContextRequest): IdempotentRequestInput {
  const raw = request.headers['idempotency-key'];
  const key = Array.isArray(raw) ? raw[0] : raw;
  if (key === undefined || key.trim() === '')
    throw new AppHttpException('idempotency.key_required');
  const parsed = idempotencyKeySchema.safeParse(key.trim().toLowerCase());
  if (!parsed.success) {
    throw new AppHttpException('common.validation_failed', {
      issues: [{ path: 'Idempotency-Key', code: 'invalid_format' }],
    });
  }
  return { key: parsed.data, method: request.method, path: request.path };
}

export const CurrentActor = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  actorOf(context.switchToHttp().getRequest<ContextRequest>()),
);

export const IdempotentRequest = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  idempotentRequestOf(context.switchToHttp().getRequest<ContextRequest>()),
);
