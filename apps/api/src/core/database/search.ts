/**
 * The back-office search box (`?q=`, `adminSearchSchema`): one term turned into a Prisma `OR`.
 *
 * Ids are Postgres `uuid` columns, and `uuid` has no LIKE (Prisma's `startsWith` is not offered
 * on them). Instead of a generated text column or pg_trgm, a hex prefix is turned into the uuid
 * RANGE holding every id that starts with it: `0193` → `01930000-…` .. `0193ffff-…`. Postgres
 * orders uuids byte by byte, which is the order of their hex text, so the range is exact, needs
 * no migration and is served by the primary key index. A full uuid is the range of one value.
 */

/** Below 4 hex digits a prefix matches too much to be useful (and "cab"/"ace" are words). */
const ID_PREFIX_MIN = 4;
const UUID_HEX_LENGTH = 32;
/** Where the dashes of a canonical uuid sit, counted in hex digits before them. */
const UUID_GROUPS = [8, 4, 4, 4, 12];

export interface UuidRange {
  gte: string;
  lte: string;
}

export interface SearchTerms {
  /** For text columns: contains, ignoring case. */
  text: { contains: string; mode: 'insensitive' };
  /** For uuid columns, when the term is a full uuid or a hex prefix of ≥ 4 digits. */
  idRange: UuidRange | undefined;
}

function toCanonicalUuid(hex: string): string {
  const groups: string[] = [];
  let offset = 0;
  for (const size of UUID_GROUPS) {
    groups.push(hex.slice(offset, offset + size));
    offset += size;
  }
  return groups.join('-');
}

/** The uuid range of every id starting with `term`, or undefined when it is no uuid prefix. */
export function uuidPrefixRange(term: string): UuidRange | undefined {
  const typed = term.toLowerCase();
  const hex = typed.replace(/-/g, '');
  if (!/^[0-9a-f]+$/.test(hex)) return undefined;
  if (hex.length < ID_PREFIX_MIN || hex.length > UUID_HEX_LENGTH) return undefined;
  const lowest = toCanonicalUuid(hex.padEnd(UUID_HEX_LENGTH, '0'));
  // Dashes are optional, but where they are typed they must sit where the uuid has them.
  if (typed.includes('-') && !lowest.startsWith(typed)) return undefined;
  return { gte: lowest, lte: toCanonicalUuid(hex.padEnd(UUID_HEX_LENGTH, 'f')) };
}

export function searchTerms(term: string): SearchTerms {
  return { text: { contains: term, mode: 'insensitive' }, idRange: uuidPrefixRange(term) };
}

/** Enum columns have no ILIKE either: the values whose name contains the term. */
export function enumValuesContaining<Value extends string>(
  values: readonly Value[],
  term: string,
): Value[] {
  const needle = term.toLowerCase();
  return values.filter((value) => value.toLowerCase().includes(needle));
}

/**
 * `{ OR: [...] }` of the conditions a list matches the term against, or undefined without a
 * term. A condition that does not apply to this term (`terms.idRange && …`) is skipped.
 */
export function matchAny<Where>(
  term: string | undefined,
  build: (terms: SearchTerms) => (Where | false | undefined)[],
): { OR: Where[] } | undefined {
  if (term === undefined) return undefined;
  const conditions = build(searchTerms(term)).filter(
    (condition): condition is Where => condition !== false && condition !== undefined,
  );
  return { OR: conditions };
}
