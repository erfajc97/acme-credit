import { describe, expect, it } from 'vitest';
import {
  ADMIN_SEARCH_MAX,
  adminAccountAuthorizationsQuerySchema,
  adminAccountsQuerySchema,
  adminAuditLogQuerySchema,
  adminAuthorizationsQuerySchema,
  adminLedgerQuerySchema,
  adminPayoutsQuerySchema,
} from '../admin';

/**
 * Every back-office table has the same search box (`?q=`): one field definition, so the cap and
 * the trim cannot drift between lists (G12). A blank box is "no search", never a 422.
 */
const LISTS = {
  accounts: adminAccountsQuerySchema,
  authorizations: adminAuthorizationsQuerySchema,
  accountAuthorizations: adminAccountAuthorizationsQuerySchema,
  payouts: adminPayoutsQuerySchema,
  ledger: adminLedgerQuerySchema,
  auditLog: adminAuditLogQuerySchema,
};

describe.each(Object.entries(LISTS))('admin list search q (%s)', (_name, schema) => {
  it('accepts a trimmed term and keeps the page defaults', () => {
    expect(schema.parse({ q: '  Ada  ' })).toMatchObject({ q: 'Ada', page: 1, pageSize: 10 });
  });

  it('treats an empty or blank q as absent', () => {
    expect(schema.parse({ q: '' }).q).toBeUndefined();
    expect(schema.parse({ q: '   ' }).q).toBeUndefined();
    expect(schema.parse({}).q).toBeUndefined();
  });

  it('caps q at ADMIN_SEARCH_MAX characters after trim', () => {
    expect(ADMIN_SEARCH_MAX).toBe(100);
    expect(schema.parse({ q: ` ${'a'.repeat(ADMIN_SEARCH_MAX)} ` }).q).toHaveLength(100);
    expect(schema.safeParse({ q: 'a'.repeat(ADMIN_SEARCH_MAX + 1) }).success).toBe(false);
  });

  it('stays strict: an unknown key is rejected', () => {
    expect(schema.safeParse({ q: 'x', search: 'x' }).success).toBe(false);
  });
});

describe('admin list filters next to q', () => {
  it('audit log keeps entityId (trimmed, 1..64)', () => {
    expect(adminAuditLogQuerySchema.parse({ entityId: ' e-1 ', q: 'freeze' })).toMatchObject({
      entityId: 'e-1',
      q: 'freeze',
    });
    expect(adminAuditLogQuerySchema.safeParse({ entityId: 'x'.repeat(64) }).success).toBe(true);
    expect(adminAuditLogQuerySchema.safeParse({ entityId: 'x'.repeat(65) }).success).toBe(false);
    expect(adminAuditLogQuerySchema.safeParse({ entityId: '  ' }).success).toBe(false);
  });

  it('status filters still validate', () => {
    expect(adminPayoutsQuerySchema.safeParse({ status: 'SENT', q: 'x' }).success).toBe(true);
    expect(adminPayoutsQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
    expect(adminAuthorizationsQuerySchema.safeParse({ status: 'NOPE' }).success).toBe(false);
  });
});
