import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { usedTranslationKeys } from '../used-keys';

describe('usedTranslationKeys', () => {
  it('collects literal t() keys from source files, skipping tests and other files', () => {
    const root = mkdtempSync(join(tmpdir(), 'keys-'));
    mkdirSync(join(root, 'pages'));
    mkdirSync(join(root, '__tests__'));
    mkdirSync(join(root, 'node_modules'));
    writeFileSync(join(root, 'pages', 'index.astro'), `<h1>{t('app.name')}</h1>{t("meta.title")}`);
    writeFileSync(join(root, 'hook.ts'), `t( 'app.name' ); format('nope.key'); t(dynamic)`);
    writeFileSync(join(root, '__tests__', 'x.spec.ts'), `t('only.in.test')`);
    writeFileSync(join(root, 'notes.md'), `t('only.in.docs')`);
    writeFileSync(join(root, 'node_modules', 'dep.ts'), `t('only.in.dependency')`);
    try {
      expect(usedTranslationKeys(root)).toEqual(['app.name', 'meta.title']);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
