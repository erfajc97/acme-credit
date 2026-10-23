import { z } from 'zod';
import { ACCOUNT_STATUSES, accountSchema, ADMIN_FREEZE_REASONS, FREEZE_REASONS } from './accounts';
import { AUTHORIZATION_STATUSES, authorizationSchema } from './authorizations';
import { idSchema, isoDateTimeSchema, pageQuerySchema } from './common';
import { balanceCentsSchema, centsSchema } from './money';

/** Longest back-office search term (`?q=`), measured after trim. */
export const ADMIN_SEARCH_MAX = 100;

/**
 * The search box of every back-office table: trimmed, 1..ADMIN_SEARCH_MAX characters; an empty
 * or blank box means "no search" (absent), never a 422. Each list decides what `q` matches.
 */
export const adminSearchSchema = z
  .string()
  .trim()
  .max(ADMIN_SEARCH_MAX)
  .transform((term) => (term === '' ? undefined : term))
  .optional();

/** The dashboard lists a handful of ids to start from; `mismatches` says how many there are. */
export const RECONCILIATION_IDS_MAX = 10;

/**
 * Per-account reconciliation (R-08c, ADR-0002): cached `collateralCents` must equal
 * −Σ postings of `collateral:<id>` and `postedDebtCents` Σ postings of `receivable:<id>`.
 */
export const reconciliationSchema = z
  .object({
    accountsChecked: z.number().int().min(0),
    mismatches: z.number().int().min(0),
    mismatchedAccountIds: z.array(idSchema).max(RECONCILIATION_IDS_MAX),
  })
  .strict();

export type Reconciliation = z.infer<typeof reconciliationSchema>;

export const dashboardSchema = z
  .object({
    accountsByStatus: z.record(z.enum(ACCOUNT_STATUSES), z.number().int()),
    collateralHeldCents: balanceCentsSchema,
    creditLimitCents: balanceCentsSchema,
    heldCents: balanceCentsSchema,
    receivableCents: balanceCentsSchema,
    authorizationsLast24h: z
      .object({ approved: z.number().int(), declined: z.number().int() })
      .strict(),
    /** Sum of every posting: always "0" when the ledger balances. */
    ledgerTrialBalanceCents: z.string(),
    reconciliation: reconciliationSchema,
  })
  .strict();

export type Dashboard = z.infer<typeof dashboardSchema>;

export const adminAccountSchema = accountSchema
  .omit({ card: true })
  .extend({
    customer: z.object({ id: idSchema, email: z.string(), fullName: z.string() }).strict(),
    cardLast4: z.string().nullable(),
    freezeReason: z.enum(FREEZE_REASONS).nullable(),
  })
  .strict();

export type AdminAccount = z.infer<typeof adminAccountSchema>;

/** Body of the admin freeze: the reason is optional (`admin_review` when absent). */
export const adminFreezeRequestSchema = z.preprocess(
  // Express leaves `body` undefined when nothing was sent; old clients send `{}`.
  (body) => body ?? {},
  z.object({ reason: z.enum(ADMIN_FREEZE_REASONS).default('admin_review') }).strict(),
);

/** Money sent back to a customer (collateral release, refunds), retried until it lands. */
export const PAYOUT_STATUSES = ['PENDING', 'SENT', 'FAILED'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];
export const PAYOUT_REASONS = ['collateral_release', 'repayment_refund', 'deposit_refund'] as const;

export const adminPayoutSchema = z
  .object({
    id: idSchema,
    accountId: idSchema,
    amountCents: centsSchema,
    reason: z.enum(PAYOUT_REASONS),
    status: z.enum(PAYOUT_STATUSES),
    /** Provider attempts so far; a failed attempt is retried with a new reference. */
    attempts: z.number().int().min(0),
    providerPaymentId: z.string().nullable(),
    /** Short machine reason of the last failed or unanswered attempt. */
    lastError: z.string().nullable(),
    /** When the worker asks the provider again (PENDING only). */
    nextAttemptAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
    sentAt: isoDateTimeSchema.nullable(),
    failedAt: isoDateTimeSchema.nullable(),
    customer: z.object({ id: idSchema, email: z.string(), fullName: z.string() }).strict(),
  })
  .strict();

export type AdminPayout = z.infer<typeof adminPayoutSchema>;

/** `q` matches the payout id (uuid or ≥ 4-hex prefix), provider reference, customer name/email. */
export const adminPayoutsQuerySchema = pageQuerySchema
  .extend({ status: z.enum(PAYOUT_STATUSES).optional(), q: adminSearchSchema })
  .strict();

/** `GET /v1/admin/accounts/:id`: the account plus its payouts, newest first. */
export const adminAccountDetailSchema = adminAccountSchema
  .extend({ payouts: z.array(adminPayoutSchema.omit({ customer: true })) })
  .strict();

export type AdminAccountDetail = z.infer<typeof adminAccountDetailSchema>;

/** `q` matches the account id (uuid or ≥ 4-hex prefix), customer name or email. */
export const adminAccountsQuerySchema = pageQuerySchema
  .extend({ status: z.enum(ACCOUNT_STATUSES).optional(), q: adminSearchSchema })
  .strict();

/** `q` matches the journal entry id (uuid or ≥ 4-hex prefix), kind, description, account id. */
export const adminLedgerQuerySchema = pageQuerySchema.extend({ q: adminSearchSchema }).strict();

/** `entityId`: one entity's history. `q` matches action, entity id, actor id or request id. */
export const adminAuditLogQuerySchema = pageQuerySchema
  .extend({ entityId: z.string().trim().min(1).max(64).optional(), q: adminSearchSchema })
  .strict();

export const auditLogEntrySchema = z
  .object({
    id: idSchema,
    actorType: z.enum(['customer', 'admin', 'network', 'provider', 'system']),
    actorId: z.string().nullable(),
    action: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    requestId: z.string().nullable(),
    data: z.record(z.string(), z.unknown()),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export type AuditLogEntry = z.infer<typeof auditLogEntrySchema>;

/** Global purchases view for operations: every authorization with its customer. */
export const adminAuthorizationSchema = authorizationSchema
  .extend({
    customer: z
      .object({ id: idSchema, email: z.string(), fullName: z.string() })
      .strict()
      .nullable(),
  })
  .strict();

export type AdminAuthorization = z.infer<typeof adminAuthorizationSchema>;

/**
 * `q` matches the authorization id (uuid or ≥ 4-hex prefix), merchant name, customer name or
 * email.
 */
export const adminAuthorizationsQuerySchema = pageQuerySchema
  .extend({ status: z.enum(AUTHORIZATION_STATUSES).optional(), q: adminSearchSchema })
  .strict();

/** One account's purchases in the back office: the same `q` as the global list. */
export const adminAccountAuthorizationsQuerySchema = pageQuerySchema
  .extend({ q: adminSearchSchema })
  .strict();
