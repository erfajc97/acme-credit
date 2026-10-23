import { SPLASH_TIMING, startSplash } from '../splash/splash-controller';

/** The controller lets the visitor skip the splash and always removes it (~1.6 s, never longer). */
describe('startSplash', () => {
  const root = document.documentElement;
  let splash: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<div data-brand-splash></div>';
    splash = document.querySelector<HTMLElement>('[data-brand-splash]') as HTMLElement;
    root.dataset.splash = 'full';
    window.history.replaceState(null, '', '/app?intro=1#top');
  });

  afterEach(() => {
    vi.useRealTimers();
    delete root.dataset.splash;
  });

  const isGone = () =>
    document.querySelector('[data-brand-splash]') === null && root.dataset.splash === undefined;

  it('does nothing when the gate did not flag this load', () => {
    delete root.dataset.splash;
    startSplash({ root, win: window });
    vi.advanceTimersByTime(10_000);
    expect(splash.isConnected).toBe(true);
    expect(splash.dataset.leaving).toBeUndefined();
  });

  it('starts leaving at the end of the intro and is gone by the fallback', () => {
    startSplash({ root, win: window });
    vi.advanceTimersByTime(SPLASH_TIMING.leaveAtMs - 1);
    expect(splash.dataset.leaving).toBeUndefined();
    vi.advanceTimersByTime(1);
    expect(splash.dataset.leaving).toBe('');
    vi.advanceTimersByTime(SPLASH_TIMING.exitMs + SPLASH_TIMING.graceMs);
    expect(isGone()).toBe(true);
    // The on-demand replay flag leaves the address bar, the rest of it stays.
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/app#top',
    );
  });

  it('never lasts longer than 2 s in total (LCP)', () => {
    expect(
      SPLASH_TIMING.leaveAtMs + SPLASH_TIMING.exitMs + SPLASH_TIMING.graceMs,
    ).toBeLessThanOrEqual(2000);
  });

  it('leaves sooner under reduced motion (a static fade)', () => {
    root.dataset.splash = 'reduced';
    startSplash({ root, win: window });
    vi.advanceTimersByTime(SPLASH_TIMING.reducedLeaveAtMs);
    expect(splash.dataset.leaving).toBe('');
  });

  it('is removed as soon as its fade ends', () => {
    startSplash({ root, win: window });
    vi.advanceTimersByTime(SPLASH_TIMING.leaveAtMs);
    const other = new Event('transitionend');
    Object.assign(other, { propertyName: 'transform' });
    splash.dispatchEvent(other);
    expect(isGone()).toBe(false);
    const fade = new Event('transitionend');
    Object.assign(fade, { propertyName: 'opacity' });
    splash.dispatchEvent(fade);
    expect(isGone()).toBe(true);
  });

  it.each([
    ['Escape', true],
    ['Tab', false],
  ])('the %s key skips: %s', (key, skips) => {
    startSplash({ root, win: window });
    window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    expect(splash.dataset.leaving === '').toBe(skips);
  });

  it('a click anywhere skips it at once', () => {
    startSplash({ root, win: window });
    window.dispatchEvent(new Event('pointerdown'));
    expect(splash.dataset.leaving).toBe('');
    vi.advanceTimersByTime(SPLASH_TIMING.exitMs + SPLASH_TIMING.graceMs);
    expect(isGone()).toBe(true);
  });

  it('a navigation during the splash removes it before the swap', () => {
    startSplash({ root, win: window });
    document.dispatchEvent(new Event('astro:before-swap'));
    expect(isGone()).toBe(true);
  });

  it('cleanup stops every timer and listener', () => {
    const stop = startSplash({ root, win: window });
    stop();
    expect(isGone()).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
