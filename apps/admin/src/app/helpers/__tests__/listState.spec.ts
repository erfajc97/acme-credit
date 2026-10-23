import { applyListBackLinks, listHref, rememberListQuery } from '../listMemory';
import {
  ACCOUNTS_LIST,
  AUDIT_ENTITY_ID_MAX,
  AUDIT_LIST,
  LIST_SEARCH_MAX,
  parseAccountsQuery,
  parseAuditQuery,
  parseLedgerQuery,
  parsePayoutsQuery,
  parsePurchasesQuery,
  parseSearchParam,
  PURCHASES_LIST,
  serializeAccountsQuery,
  serializeAuditQuery,
  serializeLedgerQuery,
  serializePayoutsQuery,
  serializePurchasesQuery,
} from '../listQuery';
import { VALIDATION_PARAMS } from '../validationParams';

describe('accounts list query (W17: one parser, one serialiser)', () => {
  it('reads every valid filter and writes them back in one canonical order', () => {
    const query = parseAccountsQuery('?q=%20ada%20&status=FROZEN');
    expect(query).toEqual({ status: 'FROZEN', q: 'ada' });
    expect(serializeAccountsQuery(query)).toBe('?status=FROZEN&q=ada');
  });

  it('keeps the page next to the filters, after them; page 1 is never written', () => {
    expect(parseAccountsQuery('?page=3&status=FROZEN')).toEqual({ status: 'FROZEN', page: 3 });
    expect(serializeAccountsQuery({ page: 3, q: 'ada', status: 'FROZEN' })).toBe(
      '?status=FROZEN&q=ada&page=3',
    );
    expect(serializeAccountsQuery(parseAccountsQuery('?q=ada&page=1'))).toBe('?q=ada');
  });

  it('an old cursor link opens page one of its filters', () => {
    expect(serializeAccountsQuery(parseAccountsQuery('?cursor=c-2&q=ada'))).toBe('?q=ada');
  });

  it('drops only the invalid parameter, never the whole query', () => {
    expect(parseAccountsQuery('?status=DELETED&q=ada')).toEqual({ status: undefined, q: 'ada' });
    expect(parseAccountsQuery('?status=active')).toEqual({ status: undefined, q: undefined });
  });

  it('treats a blank search as no filter', () => {
    expect(parseAccountsQuery('?q=%20%20')).toEqual({ status: undefined, q: undefined });
    expect(serializeAccountsQuery({})).toBe('');
  });

  it('mirrors the API search cap: the last passing length and the first failing one', () => {
    expect(LIST_SEARCH_MAX).toBe(100);
    expect(VALIDATION_PARAMS.searchMax).toBe(100);
    expect(parseAccountsQuery(`?q=${'a'.repeat(100)}`).q).toHaveLength(100);
    expect(parseAccountsQuery(`?q=${'a'.repeat(101)}`).q).toBeUndefined();
  });
});

describe('every list carries its search (q: trimmed, 1–100 characters) before the page', () => {
  const lists = [
    ['purchases', parsePurchasesQuery, serializePurchasesQuery],
    ['payouts', parsePayoutsQuery, serializePayoutsQuery],
    ['ledger', parseLedgerQuery, serializeLedgerQuery],
    ['audit log', parseAuditQuery, serializeAuditQuery],
  ] as const;

  it.each(lists)(
    '%s: reads a trimmed q and writes it back before the page',
    (_, parse, serialize) => {
      const query = parse('?page=2&q=%20e2e-mvk%20');
      expect(query.q).toBe('e2e-mvk');
      expect(serialize(query)).toBe('?q=e2e-mvk&page=2');
    },
  );

  it.each(lists)('%s: blank or longer than 100 is no search; 1 and 100 pass', (_, parse) => {
    expect(parse('?q=%20%20').q).toBeUndefined();
    expect(parse('?q=a').q).toBe('a');
    expect(parse(`?q=${'a'.repeat(100)}`).q).toHaveLength(100);
    expect(parse(`?q=${'a'.repeat(101)}`).q).toBeUndefined();
  });

  it('keeps the audit entity filter next to the search', () => {
    expect(serializeAuditQuery(parseAuditQuery('?q=freeze&entityId=acc-1'))).toBe(
      '?entityId=acc-1&q=freeze',
    );
  });

  it('a history search on the account page goes through the same rule', () => {
    expect(parseSearchParam(' 01a1 ')).toBe('01a1');
    expect(parseSearchParam(null)).toBeUndefined();
    expect(parseSearchParam('')).toBeUndefined();
    expect(parseSearchParam('b'.repeat(101))).toBeUndefined();
  });
});

describe('audit list query', () => {
  it('keeps a trimmed entity id up to the API cap and drops a longer one', () => {
    expect(parseAuditQuery('?entityId=%20acc-1%20')).toEqual({ entityId: 'acc-1' });
    expect(parseAuditQuery(`?entityId=${'e'.repeat(AUDIT_ENTITY_ID_MAX)}`).entityId).toHaveLength(
      64,
    );
    expect(
      parseAuditQuery(`?entityId=${'e'.repeat(AUDIT_ENTITY_ID_MAX + 1)}`).entityId,
    ).toBeUndefined();
    expect(parseAuditQuery('?entityId=')).toEqual({ entityId: undefined });
    expect(serializeAuditQuery({ entityId: 'acc-1' })).toBe('?entityId=acc-1');
    expect(serializeAuditQuery({})).toBe('');
  });

  it('keeps the page after the entity filter', () => {
    expect(parseAuditQuery('?page=2&entityId=acc-1')).toEqual({ entityId: 'acc-1', page: 2 });
    expect(serializeAuditQuery({ entityId: 'acc-1', page: 2 })).toBe('?entityId=acc-1&page=2');
  });
});

describe('list memory (the way back to a list)', () => {
  it('with an empty memory the way back is the plain list', () => {
    expect(listHref(ACCOUNTS_LIST)).toBe('/accounts');
  });

  it('remembers the canonical query while the address is the list (trailing slash included)', () => {
    rememberListQuery(ACCOUNTS_LIST, {
      pathname: '/accounts/',
      search: '?q=ada&status=FROZEN&junk=1',
    });
    expect(listHref(ACCOUNTS_LIST)).toBe('/accounts?status=FROZEN&q=ada');
    expect(listHref(AUDIT_LIST)).toBe('/audit-log');
  });

  it('does not record while the address is another page (a list mounting during Back → Forward)', () => {
    rememberListQuery(ACCOUNTS_LIST, { pathname: '/accounts', search: '?status=ACTIVE' });
    rememberListQuery(ACCOUNTS_LIST, { pathname: '/accounts/view', search: '?id=x' });
    expect(listHref(ACCOUNTS_LIST)).toBe('/accounts?status=ACTIVE');
  });

  it('re-parses what it reads: a tampered memory never reaches a link', () => {
    window.sessionStorage.setItem('acme.admin.list.accounts', '?status=<script>&q=ok');
    expect(listHref(ACCOUNTS_LIST)).toBe('/accounts?q=ok');
  });

  it('falls back to the plain list when storage is blocked', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() =>
      rememberListQuery(ACCOUNTS_LIST, { pathname: '/accounts', search: '?status=ACTIVE' }),
    ).not.toThrow();
    expect(listHref(ACCOUNTS_LIST)).toBe('/accounts');
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it('swaps only the href of the static back links it knows', () => {
    rememberListQuery(AUDIT_LIST, { pathname: '/audit-log', search: '?entityId=acc-1' });
    document.body.innerHTML = [
      '<a data-list-back="auditLog" href="/audit-log">a</a>',
      '<a data-list-back="unknown" href="/x">b</a>',
    ].join('');
    applyListBackLinks(document);
    const [audit, unknown] = document.querySelectorAll('a');
    expect(audit?.getAttribute('href')).toBe('/audit-log?entityId=acc-1');
    expect(unknown?.getAttribute('href')).toBe('/x');
  });
});

describe('purchases list query (W17: the status filter in the URL)', () => {
  it('reads a valid status and writes it back; a stale cursor or junk never reaches the address', () => {
    const query = parsePurchasesQuery('?cursor=c-7&status=DECLINED&junk=1');
    expect(query).toEqual({ status: 'DECLINED' });
    expect(serializePurchasesQuery(query)).toBe('?status=DECLINED');
  });

  it('drops what the API would refuse: an unknown or lower-case status', () => {
    expect(parsePurchasesQuery('?status=PENDING')).toEqual({ status: undefined });
    expect(parsePurchasesQuery('?status=declined')).toEqual({ status: undefined });
    expect(serializePurchasesQuery({})).toBe('');
  });

  it('keeps the page after the status, and drops a page the API would refuse', () => {
    expect(serializePurchasesQuery(parsePurchasesQuery('?page=4&status=DECLINED'))).toBe(
      '?status=DECLINED&page=4',
    );
    expect(parsePurchasesQuery('?page=0')).toEqual({});
  });

  it('accepts every status of the contract', () => {
    for (const status of ['APPROVED', 'DECLINED', 'CAPTURED', 'REVERSED'] as const) {
      expect(parsePurchasesQuery(`?status=${status}`).status).toBe(status);
    }
  });
});

describe('list memory across locales', () => {
  it('records while the address is the list in English too, and links back in the page locale', () => {
    rememberListQuery(PURCHASES_LIST, {
      pathname: '/en/purchases',
      search: '?status=DECLINED&cursor=c-2',
    });
    window.history.replaceState(null, '', '/en/accounts/view?id=x');
    expect(listHref(PURCHASES_LIST)).toBe('/en/purchases?status=DECLINED');
    window.history.replaceState(null, '', '/purchases');
    expect(listHref(PURCHASES_LIST)).toBe('/purchases?status=DECLINED');
  });

  it('an English address that is not the list records nothing', () => {
    rememberListQuery(PURCHASES_LIST, {
      pathname: '/en/purchases-archive',
      search: '?status=DECLINED',
    });
    expect(listHref(PURCHASES_LIST)).toBe('/purchases');
  });
});

describe('ledger list query', () => {
  it('has only a page: 2 and up is written, junk and page 1 are not', () => {
    expect(parseLedgerQuery('?page=5&junk=1')).toEqual({ page: 5 });
    expect(serializeLedgerQuery({ page: 5 })).toBe('?page=5');
    expect(serializeLedgerQuery(parseLedgerQuery('?page=1'))).toBe('');
  });
});
