/**
 * Pre-paint theme script (inlined in each app's BaseLayout). It always sets `data-theme`, from the
 * stored choice or else from `prefers-color-scheme` ("system" = nothing stored), and follows system
 * changes while no choice is stored. HeroUI only switches on `[data-theme="dark"]`, so it must
 * always be set. With Astro's ClientRouter the `<html>` attributes are replaced by the incoming
 * page's on every navigation, so it paints again on `astro:after-swap`, before that page is shown
 * (WA4). The script runs once per full load, so its listeners are added once.
 */
export const THEME_STORAGE_KEY = 'acme-theme';

/** Self-contained source of the inline script; it cannot import anything. */
export const THEME_INIT_SCRIPT = `(() => {
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const read = () => {
    try { return localStorage.getItem('${THEME_STORAGE_KEY}'); } catch { return null; }
  };
  const apply = () => {
    const stored = read();
    root.dataset.theme = stored === 'light' || stored === 'dark' ? stored : media.matches ? 'dark' : 'light';
  };
  apply();
  media.addEventListener('change', apply);
  document.addEventListener('astro:after-swap', apply);
})();`;
