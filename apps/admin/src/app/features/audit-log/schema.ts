import { z } from 'zod';
import { AUDIT_ENTITY_ID_MAX } from '@/app/helpers/listQuery';

/** The entity filter mirrors the API's AuditLogQueryDto: trimmed, 1–64 characters. */
export const auditFilterSchema = z.object({
  entityId: z
    .string()
    .trim()
    .min(1, 'validation.entityIdRequired')
    .max(AUDIT_ENTITY_ID_MAX, 'validation.entityIdTooLong'),
});

export type AuditFilterInput = z.input<typeof auditFilterSchema>;
export type AuditFilterValues = z.output<typeof auditFilterSchema>;
