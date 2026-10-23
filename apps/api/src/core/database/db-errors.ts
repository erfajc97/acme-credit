/**
 * Reads the PostgreSQL SQLSTATE out of what Prisma 7 + @prisma/adapter-pg throw. Shapes copied
 * from real errors (FT18):
 * - a failed statement: `PrismaClientKnownRequestError` with
 *   `meta.driverAdapterError.cause.originalCode` (raw queries are `P2010`);
 * - a failed COMMIT (deferred constraint): `DriverAdapterError` with `cause.originalCode`;
 * - a write conflict on a model query: `P2034`.
 */
const WRITE_CONFLICT_PRISMA_CODE = 'P2034';
const SERIALIZATION_FAILURE = '40001';

interface AdapterCause {
  originalCode?: unknown;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

export function sqlStateOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate = error as {
    code?: unknown;
    cause?: AdapterCause;
    meta?: { driverAdapterError?: { cause?: AdapterCause } };
  };
  const fromMeta = stringOrUndefined(candidate.meta?.driverAdapterError?.cause?.originalCode);
  if (fromMeta) return fromMeta;
  const fromCause = stringOrUndefined(candidate.cause?.originalCode);
  if (fromCause) return fromCause;
  return candidate.code === WRITE_CONFLICT_PRISMA_CODE ? SERIALIZATION_FAILURE : undefined;
}

/** A unique violation (`P2002`) on any index. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'PrismaClientKnownRequestError' &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
