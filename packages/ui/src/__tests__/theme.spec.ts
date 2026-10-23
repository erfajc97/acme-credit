import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(resolve(__dirname, '../theme.css'), 'utf8');

function block(selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`missing block ${selector}`);
  return css.slice(start, css.indexOf('}', start));
}

describe('theme.css', () => {
  it('never defines tokens with HeroUI names (accent, surface, background)', () => {
    expect(css).not.toMatch(/--color-(accent|surface|background):/);
  });

  it('gives text fields a visible outline', () => {
    expect(block(':root[data-theme] {')).toMatch(/--field-border-width:\s*1px;/);
  });

  it.each([
    '--accent',
    '--background',
    '--surface',
    '--default',
    '--default-foreground',
    '--surface-secondary',
    '--segment',
    '--field-border',
    '--danger-foreground',
  ])('maps HeroUI %s to a brand token', (name) => {
    expect(block(':root[data-theme] {')).toMatch(new RegExp(`${name}:\\s*var\\(--(color|app)-`));
  });

  it('defines a dark value for every brand color', () => {
    const light = [...block('@theme {').matchAll(/(--color-[\w-]+):/g)].map((m) => m[1]);
    const dark = block(":root[data-theme='dark']");
    for (const token of light) expect(dark).toContain(`${token}:`);
  });

  it('stops infinite animations under reduced motion', () => {
    expect(css).toMatch(/animation-iteration-count:\s*1 !important/);
  });
});
