import { describe, expect, it } from 'vitest';
import { safeReturnPath } from '../safe-return';

const ORIGIN = 'https://wallet.acme.test';

describe('safeReturnPath (open redirect guard, W14)', () => {
  it.each([
    ['/app', '/app'],
    ['/app/activity?x=1', '/app/activity?x=1'],
    ['/en/purchases?status=DECLINED#top', '/en/purchases?status=DECLINED#top'],
  ])('keeps the same-origin path %j', (value, expected) => {
    expect(safeReturnPath(value, ORIGIN)).toBe(expected);
  });

  // The attacker's links: each one lands on another origin in a browser, or runs script.
  it.each([
    ['protocol-relative', '//evil.com'],
    ['three slashes', '///evil.com'],
    ['an empty host (unparseable)', '//'],
    ['backslash read as a slash', '/\\evil.com'],
    ['backslash after a tab', '/\t\\evil.com'],
    ['tab after the slash (browsers drop it: //evil.com)', '/\t/evil.com'],
    ['leading tab (browsers drop it: //evil.com)', '\t//evil.com'],
    ['newline inside', '/\n/evil.com'],
    ['carriage return inside', '/app\r'],
    ['DEL inside', '/app\u007f'],
    ['NUL inside', '/app\u0000'],
    ['unit separator (the last C0 control) inside', '/app\u001f'],
    ['absolute URL', 'https://evil.com'],
    ['absolute URL of our own origin (paths only)', `${ORIGIN}/app`],
    ['script URL', 'javascript:alert(1)'],
    ['encoded slashes', '%2F%2Fevil.com'],
    ['relative path', 'app'],
    ['empty', ''],
  ])('refuses %s', (_label, value) => {
    expect(safeReturnPath(value, ORIGIN)).toBeNull();
  });

  it('lets a space through (0x20, the first character after the controls), encoded', () => {
    expect(safeReturnPath('/app/activity?q=a b', ORIGIN)).toBe('/app/activity?q=a%20b');
  });

  it('answers the address it checked (as the browser resolves it), not the raw text', () => {
    expect(safeReturnPath('/app/./store/../activity?x=1', ORIGIN)).toBe('/app/activity?x=1');
  });

  it('refuses a missing value', () => {
    expect(safeReturnPath(null, ORIGIN)).toBeNull();
  });
});
