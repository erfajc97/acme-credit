import type { IncomingMessage } from 'node:http';
import { idempotencyKeySchema } from '@acme/contracts';
import { AppHttpException } from '@acme/nest-core';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

/** The client-generated key every money POST must carry (MO2): a UUID, required. */
export function parseIdempotencyKey(header: string | string[] | undefined): string {
  const value = (Array.isArray(header) ? header[0] : header)?.trim();
  if (!value) throw new AppHttpException('idempotency.key_required', { reason: 'missing' });
  const parsed = idempotencyKeySchema.safeParse(value.toLowerCase());
  if (!parsed.success) {
    throw new AppHttpException('idempotency.key_required', { reason: 'malformed' });
  }
  return parsed.data;
}

/** `@IdempotencyKey() key: string` — the validated `Idempotency-Key` header. */
export const IdempotencyKey = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  parseIdempotencyKey(
    context.switchToHttp().getRequest<IncomingMessage>().headers['idempotency-key'],
  ),
);
