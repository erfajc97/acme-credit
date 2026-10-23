/**
 * Brand splash gate, inlined in <head> (SplashGate.astro) so it decides BEFORE the first paint: on
 * the first load of a browser session it sets `data-splash` on <html> ("full", or "reduced" under
 * prefers-reduced-motion = a static fade), the only thing that makes BrandSplash draw. Without
 * JavaScript, on any later load and on ClientRouter swaps (they replace the <html> attributes and
 * the stored flag is already there) nothing shows. `?intro=1` replays it on demand. Storage blocked:
 * a reload cannot be told from a first view, so it never plays (unless asked).
 */
export const SPLASH_STORAGE_KEY = 'acme-splash-played';
export const SPLASH_REPLAY_PARAM = 'intro';

/** Self-contained source of the inline script; it cannot import anything. */
export const SPLASH_GATE_SCRIPT = `(() => {
  const replay = new URLSearchParams(window.location.search).get('${SPLASH_REPLAY_PARAM}') === '1';
  try {
    if (!replay && window.sessionStorage.getItem('${SPLASH_STORAGE_KEY}')) return;
    window.sessionStorage.setItem('${SPLASH_STORAGE_KEY}', '1');
  } catch {
    // Blocked storage: every load would look like the first one, so only an explicit replay plays.
    if (!replay) return;
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.dataset.splash = reduced ? 'reduced' : 'full';
})();`;
