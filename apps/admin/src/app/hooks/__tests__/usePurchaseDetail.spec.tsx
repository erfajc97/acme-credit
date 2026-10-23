import { act, renderHook } from '@testing-library/react';
import type { MouseEvent } from 'react';
import { setActiveLocale } from '@/app/i18n';
import { adminAuthorizationFixture } from '@/test/fixtures';
import { usePurchaseDetail } from '../usePurchaseDetail';

const ORDER = adminAuthorizationFixture();
const OTHER_ID = 'f6a7b8c9-d0e1-4f2a-8b3c-4d5e6f7a8b92';
const customerOf = () => ({ name: 'Ada Lovelace', email: 'ada@example.test' });

function clickEvent(overrides: Partial<MouseEvent> = {}) {
  return {
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as MouseEvent;
}

beforeEach(() => {
  setActiveLocale('es-MX');
  window.history.replaceState(null, '', '/purchases?status=APPROVED');
});

describe('usePurchaseDetail (the deep-linkable purchase sheet, ?purchase=<id>)', () => {
  it('is closed without the parameter, and links each purchase next to the list filters', () => {
    const { result } = renderHook(() => usePurchaseDetail([ORDER], customerOf));
    expect(result.current).toMatchObject({ isOpen: false, detail: null });
    expect(result.current.hrefFor(ORDER.id)).toBe(`?status=APPROVED&purchase=${ORDER.id}`);
  });

  it('a plain click opens it as a new history entry (Back closes it), keeping the filters', () => {
    const { result } = renderHook(() => usePurchaseDetail([ORDER], customerOf));
    const event = clickEvent();
    act(() => result.current.onLinkClick(ORDER.id)(event));
    expect(event.preventDefault).toHaveBeenCalled();
    expect(window.location.search).toBe(`?status=APPROVED&purchase=${ORDER.id}`);
    expect(result.current.isOpen).toBe(true);
    expect(result.current.detail?.merchant).toBe('Taquería El Sol');
    expect(result.current.detail?.customer?.name).toBe('Ada Lovelace');

    act(() => window.history.back());
  });

  it('a modified click (new tab) is left to the browser', () => {
    const { result } = renderHook(() => usePurchaseDetail([ORDER], customerOf));
    const event = clickEvent({ ctrlKey: true });
    act(() => result.current.onLinkClick(ORDER.id)(event));
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(window.location.search).toBe('?status=APPROVED');
  });

  it('closing removes only the parameter, in place', () => {
    window.history.replaceState(null, '', `/purchases?status=APPROVED&purchase=${ORDER.id}`);
    const { result } = renderHook(() => usePurchaseDetail([ORDER], customerOf));
    const length = window.history.length;
    act(() => result.current.close());
    expect(window.location.search).toBe('?status=APPROVED');
    expect(window.history.length).toBe(length);
    expect(result.current.isOpen).toBe(false);
  });

  it('a link to a purchase that is not on this page opens as "not found", not as another one', () => {
    window.history.replaceState(null, '', `/purchases?purchase=${OTHER_ID}`);
    const { result } = renderHook(() => usePurchaseDetail([ORDER], customerOf));
    expect(result.current).toMatchObject({
      isOpen: true,
      detail: null,
      isNotFound: true,
      isLoading: false,
    });
  });

  it('while the page loads it is loading, not "not found"', () => {
    window.history.replaceState(null, '', `/purchases?purchase=${ORDER.id}`);
    const { result } = renderHook(() => usePurchaseDetail(undefined, customerOf));
    expect(result.current).toMatchObject({ isOpen: true, isLoading: true, isNotFound: false });
  });
});
