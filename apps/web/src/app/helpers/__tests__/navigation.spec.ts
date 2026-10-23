import { navigate } from 'astro:transitions/client';
import { setActiveLocale } from '@/app/i18n';
import { localHref, navigateTo } from '../navigation';

vi.mock('astro:transitions/client', () => ({ navigate: vi.fn() }));

describe('navigateTo (ClientRouter: no full reload, the cache and session survive)', () => {
  it('navigates client-side', async () => {
    vi.mocked(navigate).mockResolvedValue(undefined);
    navigateTo('/app/store');
    expect(navigate).toHaveBeenCalledWith('/app/store');
  });

  it('falls back to a full load when the client-side swap fails', async () => {
    const assign = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign });
    vi.mocked(navigate).mockRejectedValue(new Error('chunk failed'));
    navigateTo('/app');
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith('/app'));
    vi.restoreAllMocks();
  });
});

describe('localHref', () => {
  it('keeps the page locale in app links', () => {
    expect(localHref('/app/checkout')).toBe('/app/checkout');
    setActiveLocale('en-US');
    expect(localHref('/app/checkout')).toBe('/en/app/checkout');
  });
});
