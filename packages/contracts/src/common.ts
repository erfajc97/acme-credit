import { z } from 'zod';

/** Header carrying the client-generated idempotency key on every money POST (MO2, ADR-0004). */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

export const idempotencyKeySchema = z.uuid();

export const idSchema = z.uuid();

export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/** Owner decision: every list is numbered pages of at most 10 rows. */
export const PAGE_SIZE_DEFAULT = 10;
export const PAGE_SIZE_MAX = 10;
/** Bounds the OFFSET a client can make the database walk past (page × size rows). */
export const PAGE_NUMBER_MAX = 100_000;

/**
 * A positive integer from a query string (strict digits: no sign, exponent, decimals or blanks),
 * or a number from a typed client. Seven digits covers every bound below.
 */
function positiveIntParam(max: number) {
  return z
    .union([
      z.number(),
      z
        .string()
        .regex(/^[0-9]{1,7}$/)
        .transform(Number),
    ])
    .pipe(z.number().int().min(1).max(max));
}

/** Numbered pagination for every list, newest first (`createdAt desc, id desc`). */
export const pageQuerySchema = z
  .object({
    page: positiveIntParam(PAGE_NUMBER_MAX).default(1),
    pageSize: positiveIntParam(PAGE_SIZE_MAX).default(PAGE_SIZE_DEFAULT),
  })
  .strict();

export type PageQuery = z.infer<typeof pageQuerySchema>;

/** At least 1, so an empty list still has a page 1 to show. */
export function totalPagesOf({ total, pageSize }: { total: number; pageSize: number }): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** A page past `totalPages` is not an error: it has no items and the real `total`. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z
    .object({
      items: z.array(item),
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(PAGE_SIZE_MAX),
      total: z.number().int().min(0),
      totalPages: z.number().int().min(1),
    })
    .strict();
}
