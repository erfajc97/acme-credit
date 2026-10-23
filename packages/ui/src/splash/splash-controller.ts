import { SPLASH_REPLAY_PARAM } from './splash-gate';

/**
 * Timeline of the brand splash (BrandSplash.astro CSS): the intro plays for `leaveAtMs`, then the
 * overlay fades out in `exitMs`. `graceMs` covers a missed `transitionend` (background tab). The
 * total stays ≤ 2 s so the page underneath is never hidden long enough to hurt LCP.
 */
export const SPLASH_TIMING = {
  leaveAtMs: 1300,
  reducedLeaveAtMs: 600,
  exitMs: 300,
  graceMs: 300,
} as const;

interface SplashOptions {
  root: HTMLElement;
  win: Window;
}

/**
 * Drives the splash the gate flagged: leave on time, skip on a click or Esc (the press is not
 * swallowed, the overlay stops catching the pointer at once), remove the node and the flag once it
 * faded, and drop an on-demand `?intro=1` from the address bar so a reload does not replay it.
 * Returns the cleanup (also run before a ClientRouter swap). No-op when the gate did not flag.
 */
export function startSplash({ root, win }: SplashOptions): () => void {
  const doc = root.ownerDocument;
  const splash = doc.querySelector<HTMLElement>('[data-brand-splash]');
  const mode = root.dataset.splash;
  if (!splash || !mode) return () => undefined;

  const timers: number[] = [];
  let isDone = false;

  const forgetReplayRequest = () => {
    const url = new URL(win.location.href);
    if (!url.searchParams.has(SPLASH_REPLAY_PARAM)) return;
    url.searchParams.delete(SPLASH_REPLAY_PARAM);
    win.history.replaceState(win.history.state, '', url.pathname + url.search + url.hash);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') leave();
  };
  const onFaded = (event: Event) => {
    if (event.target === splash && (event as TransitionEvent).propertyName === 'opacity') finish();
  };

  function finish() {
    if (isDone) return;
    isDone = true;
    timers.forEach((timer) => win.clearTimeout(timer));
    win.removeEventListener('keydown', onKeyDown, true);
    win.removeEventListener('pointerdown', leave, true);
    doc.removeEventListener('astro:before-swap', finish);
    splash?.removeEventListener('transitionend', onFaded);
    splash?.remove();
    delete root.dataset.splash;
    forgetReplayRequest();
  }

  function leave() {
    if (isDone || splash?.dataset.leaving !== undefined) return;
    if (splash) splash.dataset.leaving = '';
    timers.push(win.setTimeout(finish, SPLASH_TIMING.exitMs + SPLASH_TIMING.graceMs));
  }

  const leaveAt = mode === 'reduced' ? SPLASH_TIMING.reducedLeaveAtMs : SPLASH_TIMING.leaveAtMs;
  timers.push(win.setTimeout(leave, leaveAt));
  splash.addEventListener('transitionend', onFaded);
  win.addEventListener('keydown', onKeyDown, true);
  win.addEventListener('pointerdown', leave, true);
  doc.addEventListener('astro:before-swap', finish);
  return finish;
}
