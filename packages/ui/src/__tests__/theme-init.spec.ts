import { themeScriptHash } from '../theme-hash';
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from '../theme-init';

const EXPECTED_HASH = 'sha256-RSK3AdiZLeKScDBPZNDDx6/lhOZElB6Ny7A6PsblWQA=';

describe('THEME_INIT_SCRIPT', () => {
  let listeners: Array<() => void> = [];
  let systemDark = false;

  beforeEach(() => {
    listeners = [];
    systemDark = false;
    delete document.documentElement.dataset.theme;
    localStorage.clear();
    vi.stubGlobal('matchMedia', () => ({
      get matches() {
        return systemDark;
      },
      addEventListener: (_: string, listener: () => void) => listeners.push(listener),
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  const run = () => new Function(THEME_INIT_SCRIPT)();

  it('always sets data-theme, following the system when nothing is stored', () => {
    systemDark = true;
    run();
    expect(document.documentElement.dataset.theme).toBe('dark');
    systemDark = false;
    listeners.forEach((listener) => listener());
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it.each([
    ['light', true, 'light'],
    ['dark', false, 'dark'],
    ['sepia', true, 'dark'],
    ['sepia', false, 'light'],
  ] as const)('stored %s with system dark=%s → %s', (stored, dark, expected) => {
    localStorage.setItem(THEME_STORAGE_KEY, stored);
    systemDark = dark;
    run();
    expect(document.documentElement.dataset.theme).toBe(expected);
  });

  it('ignores system changes while a choice is stored', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    systemDark = false;
    run();
    listeners.forEach((listener) => listener());
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('paints again after a ClientRouter swap replaced the <html> attributes (WA4)', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    run();
    // The swap copies the incoming page's <html> attributes, which carry no theme.
    delete document.documentElement.dataset.theme;
    document.dispatchEvent(new Event('astro:after-swap'));
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    systemDark = true;
    run();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('themeScriptHash', () => {
  it('pins the hash of the shipped script (a script change must update the CSP knowingly)', () => {
    expect(themeScriptHash()).toBe(EXPECTED_HASH);
  });
});
