import { THEME_STORAGE_KEY } from './theme-init';

/**
 * The theme the customer picks in the header, stored per device. "system" is the absence of a
 * stored value: the pre-paint script then follows `prefers-color-scheme` (theme-init.ts).
 */
export const THEME_CHOICES = ['light', 'dark', 'system'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export function nextThemeChoice(choice: ThemeChoice): ThemeChoice {
  const index = THEME_CHOICES.indexOf(choice);
  return THEME_CHOICES[(index + 1) % THEME_CHOICES.length] ?? 'system';
}

export function readThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    // Storage blocked (private mode, policy): nothing was stored, so the system decides.
    return 'system';
  }
}

function persist(choice: ThemeChoice): void {
  try {
    if (choice === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // Storage blocked: the choice still applies to this page, it just is not remembered.
  }
}

/** Stores the choice and paints it now (the same rule as the pre-paint script). */
export function applyThemeChoice(choice: ThemeChoice): void {
  persist(choice);
  const dark =
    choice === 'dark' ||
    (choice === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
