import { navigate } from 'astro:transitions/client';
import { setActiveLocale } from '@/app/i18n';
import { accountHref, localHref } from '@/app/lib/endpoints';
import { navigateTo } from '../navigation';
import { safeReturnTo } from '../safeReturnTo';

vi.mock('astro:transitions/client', () => ({ navigate: vi.fn() }));

describe('navigateTo (ClientRouter: no full reload, the cache and session survive)', () => {
  it('navigates client-side', () => {
    vi.mocked(navigate).mockResolvedValue(undefined);
    navigateTo('/purchases');
    expect(navigate).toHaveBeenCalledWith('/purchases');
  });

  it('falls back to a full load when the client-side swap fails', async () => {
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign });
    vi.mocked(navigate).mockRejectedValue(new Error('chunk failed'));
    navigateTo('/ledger');
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/ledger'));
    vi.restoreAllMocks();
  });
});

describe('links in the page locale', () => {
  it('keeps console links, account links and the sign-in fallback in the page language', () => {
    expect(localHref('/ledger')).toBe('/ledger');
    expect(accountHref('a b')).toBe('/accounts/view?id=a%20b');
    expect(safeReturnTo(null)).toBe('/dashboard');
    setActiveLocale('en-US');
    expect(localHref('/ledger')).toBe('/en/ledger');
    expect(accountHref('a b')).toBe('/en/accounts/view?id=a%20b');
    expect(safeReturnTo('//evil.test')).toBe('/en/dashboard');
    // Browsers drop the tab, so this reads as //evil.com (the open redirect).
    expect(safeReturnTo('/\t/evil.com')).toBe('/en/dashboard');
    expect(safeReturnTo('/en/purchases?status=DECLINED')).toBe('/en/purchases?status=DECLINED');
  });
});
