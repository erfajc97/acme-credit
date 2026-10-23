import { matchAny, enumValuesContaining, type SearchTerms } from '../../../core/database/search';
import { JournalKind, type Prisma } from '../../../generated/prisma/client';

/**
 * What the search box (`?q=`) of each back-office table matches (owner request: "every admin
 * table can be searched by id or by a column"). Uuid columns match a full id or a ≥ 4-hex prefix
 * (`terms.idRange`); text columns match case-insensitively anywhere. Undefined without a term.
 */

function customerMatches(terms: SearchTerms): Prisma.UserWhereInput {
  return { OR: [{ email: terms.text }, { fullName: terms.text }] };
}

/** Account id, customer name or email. */
export function accountSearch(q: string | undefined): Prisma.AccountWhereInput | undefined {
  return matchAny<Prisma.AccountWhereInput>(q, (terms) => [
    terms.idRange && { id: terms.idRange },
    { customer: customerMatches(terms) },
  ]);
}

/** Authorization id, merchant name, customer name or email (none for a card with no account). */
export function authorizationSearch(
  q: string | undefined,
): Prisma.AuthorizationWhereInput | undefined {
  return matchAny<Prisma.AuthorizationWhereInput>(q, (terms) => [
    terms.idRange && { id: terms.idRange },
    { merchantName: terms.text },
    { account: { customer: customerMatches(terms) } },
  ]);
}

/** Payout id, our provider reference, the provider's payment id, customer name or email. */
export function payoutSearch(q: string | undefined): Prisma.PayoutWhereInput | undefined {
  return matchAny<Prisma.PayoutWhereInput>(q, (terms) => [
    terms.idRange && { id: terms.idRange },
    terms.idRange && { providerReference: terms.idRange },
    { providerPaymentId: terms.text },
    { account: { customer: customerMatches(terms) } },
  ]);
}

/** Journal entry id, account id, kind (by name) or description. */
export function journalEntrySearch(
  q: string | undefined,
): Prisma.JournalEntryWhereInput | undefined {
  return matchAny<Prisma.JournalEntryWhereInput>(q, (terms) => {
    const kinds = enumValuesContaining(Object.values(JournalKind), terms.text.contains);
    return [
      terms.idRange && { id: terms.idRange },
      terms.idRange && { accountId: terms.idRange },
      kinds.length > 0 && { kind: { in: kinds } },
      { description: terms.text },
    ];
  });
}

/** Action, entity id, actor id or request id (text columns: they hold more than uuids). */
export function auditLogSearch(q: string | undefined): Prisma.AuditLogWhereInput | undefined {
  return matchAny<Prisma.AuditLogWhereInput>(q, (terms) => [
    { action: terms.text },
    { entityId: terms.text },
    { actorId: terms.text },
    { requestId: terms.text },
  ]);
}
