import {
  adminAccountAuthorizationsQuerySchema,
  adminAccountsQuerySchema,
  adminAuditLogQuerySchema,
  adminAuthorizationsQuerySchema,
  adminFreezeRequestSchema,
  adminLedgerQuerySchema,
  adminPayoutsQuerySchema,
} from '@acme/contracts';
import { createZodDto } from 'nestjs-zod';

export class AdminAccountsQueryDto extends createZodDto(adminAccountsQuerySchema) {}

export class AdminAuthorizationsQueryDto extends createZodDto(adminAuthorizationsQuerySchema) {}

export class AdminAccountAuthorizationsQueryDto extends createZodDto(
  adminAccountAuthorizationsQuerySchema,
) {}

export class AdminLedgerQueryDto extends createZodDto(adminLedgerQuerySchema) {}

/** Audit log filter: one entity's history (an account, a deposit, an authorization…) and `q`. */
export class AuditLogQueryDto extends createZodDto(adminAuditLogQuerySchema) {}

export class AdminPayoutsQueryDto extends createZodDto(adminPayoutsQuerySchema) {}

/** Admin freeze: `{}` or no body freezes for `admin_review`; a reason may be given. */
export class AdminFreezeDto extends createZodDto(adminFreezeRequestSchema) {}
