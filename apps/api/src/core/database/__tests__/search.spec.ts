import { describe, expect, it } from 'vitest';
import { enumValuesContaining, matchAny, searchTerms, uuidPrefixRange } from '../search';

const ID = '0193ab12-cdef-7abc-8def-0123456789ab';

/**
 * The back-office search box (`?q=`). Ids are Postgres `uuid` columns, which have no LIKE: a hex
 * prefix becomes the uuid RANGE that holds every id starting with it, so an operator can paste
 * the first characters shown in a table and the index still serves the query.
 */
describe('uuidPrefixRange', () => {
  it('a full uuid is an exact match (the range has one value)', () => {
    expect(uuidPrefixRange(ID)).toEqual({ gte: ID, lte: ID });
    expect(uuidPrefixRange(ID.toUpperCase())).toEqual({ gte: ID, lte: ID });
    expect(uuidPrefixRange(ID.replace(/-/g, ''))).toEqual({ gte: ID, lte: ID });
  });

  it('a hex prefix of 4 characters is the smallest prefix searched', () => {
    expect(uuidPrefixRange('0193')).toEqual({
      gte: '01930000-0000-0000-0000-000000000000',
      lte: '0193ffff-ffff-ffff-ffff-ffffffffffff',
    });
    expect(uuidPrefixRange('019')).toBeUndefined();
  });

  it('a prefix with dashes where the uuid has them is accepted', () => {
    expect(uuidPrefixRange('0193ab12-cd')).toEqual({
      gte: '0193ab12-cd00-0000-0000-000000000000',
      lte: '0193ab12-cdff-ffff-ffff-ffffffffffff',
    });
    expect(uuidPrefixRange('0193ab12-')).toEqual({
      gte: '0193ab12-0000-0000-0000-000000000000',
      lte: '0193ab12-ffff-ffff-ffff-ffffffffffff',
    });
  });

  it('anything that is not a uuid prefix searches no id', () => {
    expect(uuidPrefixRange('01-93ab')).toBeUndefined();
    expect(uuidPrefixRange('Ada Lovelace')).toBeUndefined();
    expect(uuidPrefixRange('0193g')).toBeUndefined();
    expect(uuidPrefixRange(`${ID}0`)).toBeUndefined();
  });
});

describe('searchTerms', () => {
  it('text columns match case-insensitively anywhere; ids by prefix range', () => {
    expect(searchTerms('cafe')).toEqual({
      text: { contains: 'cafe', mode: 'insensitive' },
      idRange: {
        gte: 'cafe0000-0000-0000-0000-000000000000',
        lte: 'cafeffff-ffff-ffff-ffff-ffffffffffff',
      },
    });
  });

  it('a name searches only the text columns', () => {
    const terms = searchTerms('Ada');
    expect(terms).toEqual({ text: { contains: 'Ada', mode: 'insensitive' } });
    expect(terms.idRange).toBeUndefined();
  });
});

describe('enumValuesContaining', () => {
  const KINDS = ['collateral_deposit', 'purchase_capture', 'repayment'] as const;

  it('returns the enum values whose name contains the term, ignoring case', () => {
    expect(enumValuesContaining(KINDS, 'COLLATERAL')).toEqual(['collateral_deposit']);
    expect(enumValuesContaining(KINDS, 'ep')).toEqual(['collateral_deposit', 'repayment']);
    expect(enumValuesContaining(KINDS, 'nothing')).toEqual([]);
  });
});

describe('matchAny', () => {
  it('no term → no filter (the list is not narrowed)', () => {
    expect(matchAny(undefined, () => [{ a: 1 }])).toBeUndefined();
  });

  it('a term → OR of the conditions the list builds, skipping those that do not apply', () => {
    expect(
      matchAny('Ada', (terms) => [
        { name: terms.text },
        terms.idRange && { id: terms.idRange },
        false,
      ]),
    ).toEqual({ OR: [{ name: { contains: 'Ada', mode: 'insensitive' } }] });
  });
});
