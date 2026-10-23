import { applyThemeChoice, nextThemeChoice, readThemeChoice, THEME_CHOICES } from '../theme-choice';
import { THEME_STORAGE_KEY } from '../theme-init';

describe('theme choice (light / dark / system, per device)', () => {
  let systemDark = false;

  beforeEach(() => {
    systemDark = false;
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    vi.stubGlobal('matchMedia', () => ({ matches: systemDark, addEventListener: vi.fn() }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('cycles light → dark → system → light', () => {
    expect(THEME_CHOICES).toEqual(['light', 'dark', 'system']);
    expect(nextThemeChoice('light')).toBe('dark');
    expect(nextThemeChoice('dark')).toBe('system');
    expect(nextThemeChoice('system')).toBe('light');
  });

  it('reads "system" when nothing (or something unknown) is stored', () => {
    expect(readThemeChoice()).toBe('system');
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readThemeChoice()).toBe('system');
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readThemeChoice()).toBe('dark');
  });

  it('stores light and dark, and paints them at once', () => {
    systemDark = true;
    applyThemeChoice('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    applyThemeChoice('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('"system" removes the stored value and follows the OS again', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    systemDark = true;
    applyThemeChoice('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement.dataset.theme).toBe('dark');
    systemDark = false;
    applyThemeChoice('system');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('still paints the choice when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    applyThemeChoice('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(readThemeChoice()).toBe('system');
    applyThemeChoice('system');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
