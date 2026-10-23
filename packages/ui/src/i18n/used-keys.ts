import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = /\.(astro|ts|tsx)$/;
const CALL = /\bt\(\s*['"]([\w.]+)['"]/g;

/**
 * Every literal key passed to `t('…')` under a source folder (tests excluded), so a test can
 * prove each one exists in every locale (G13). Node-only: used by app specs, never shipped.
 */
export function usedTranslationKeys(root: string): string[] {
  const keys = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name !== '__tests__' && name !== 'node_modules') walk(path);
      } else if (SOURCE.test(name)) {
        for (const match of readFileSync(path, 'utf8').matchAll(CALL)) keys.add(match[1] ?? '');
      }
    }
  };
  walk(root);
  return [...keys].sort();
}
