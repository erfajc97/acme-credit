// Renders the brand's static files from the sources in packages/ui/assets with Playwright's
// Chromium (the copy the e2e package installs): favicons + web manifest for every app, and the
// web's link-preview images (1200×630) in both locales, with copy from the web's i18n files.
// Run: `node packages/ui/scripts/render-brand-assets.mjs` (Node ≥ 22.18 strips the locale types).
// Literal colors are allowed here: these are asset files, not components (W8).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ui = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = resolve(ui, '../..');
const requireFromE2e = createRequire(join(repo, 'e2e/package.json'));
const { chromium } = requireFromE2e('@playwright/test');

const MARK_SVG = join(ui, 'assets/brand/mark.svg');
const WAVE = join(ui, 'assets/mascot/mascot-wave.webp');
const GOLOS = join(
  ui,
  'node_modules/@fontsource-variable/golos-text/files/golos-text-latin-wght-normal.woff2',
);
const INTER = join(
  ui,
  'node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2',
);

const APPS = [
  { dir: 'apps/web', name: 'Acme Credit', shortName: 'Acme Credit' },
  { dir: 'apps/admin', name: 'Acme Credit Admin', shortName: 'Acme Admin' },
];
const ICONS = [
  { file: 'favicon-32.png', size: 32, padded: false },
  { file: 'apple-touch-icon.png', size: 180, padded: true },
  { file: 'icon-192.png', size: 192, padded: true },
  { file: 'icon-512.png', size: 512, padded: true },
];

const markSvg = readFileSync(MARK_SVG, 'utf8');
const fontFaces = `
  @font-face { font-family: 'Golos'; src: url('${pathToFileURL(GOLOS)}') format('woff2'); font-weight: 400 900; }
  @font-face { font-family: 'Inter'; src: url('${pathToFileURL(INTER)}') format('woff2'); font-weight: 100 900; }`;

/** Home-screen icons sit on the cream tint (iOS fills transparency with black). */
function iconHtml(size, padded) {
  const inner = padded ? Math.round(size * 0.72) : size;
  return `<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${padded ? '#FFFDEB' : 'transparent'}">
    <div style="width:${inner}px;height:${inner}px">${markSvg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></body></html>`;
}

function ogHtml({ title, lead, name, cta }) {
  return `<html><head><style>${fontFaces}
    body { margin:0; width:1200px; height:630px; background:#FACE07; font-family:'Inter'; color:#010101; overflow:hidden; position:relative; }
    .rings { position:absolute; inset:0; background: repeating-radial-gradient(circle at 105% 115%, transparent 0 26px, rgba(1,1,1,.06) 26px 28px); }
    .panel { position:absolute; left:56px; top:56px; width:700px; height:518px; box-sizing:border-box; background:#FFFFFF; border:3px solid #010101; border-radius:28px; box-shadow:12px 12px 0 0 #010101; padding:52px 56px; display:flex; flex-direction:column; gap:24px; }
    .brand { display:flex; align-items:center; gap:16px; font-family:'Golos'; font-weight:700; font-size:40px; letter-spacing:-0.02em; }
    .brand svg { width:56px; height:56px; }
    h1 { margin:0; font-family:'Golos'; font-weight:700; font-size:58px; line-height:1.06; letter-spacing:-0.025em; color:#0F172A; }
    p { margin:0; font-size:26px; line-height:1.4; color:#555555; }
    .pill { margin-top:auto; align-self:flex-start; background:#FACE07; border:3px solid #010101; border-radius:999px; padding:12px 28px; font-family:'Golos'; font-weight:700; font-size:24px; box-shadow:0 5px 0 0 #D7AD05; }
    .mascot { position:absolute; right:-10px; bottom:-6px; width:470px; height:470px; transform:rotate(4deg); }
  </style></head><body><div class="rings"></div>
    <div class="panel"><div class="brand">${markSvg}<span>${name}</span></div><h1>${title}</h1><p>${lead}</p><span class="pill">${cta}</span></div>
    <img class="mascot" src="${pathToFileURL(WAVE)}" /></body></html>`;
}

async function shot(browser, { html, width, height, out, transparent }) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const file = join(tmpdir(), `acme-brand-${process.pid}.html`);
  writeFileSync(file, html);
  await page.goto(pathToFileURL(file).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out, omitBackground: transparent, type: 'png' });
  await page.close();
}

const loadLocale = async (file, exportName) =>
  (await import(pathToFileURL(join(repo, 'apps/web/src/app/i18n/locales', file)).href))[exportName];

const browser = await chromium.launch();
try {
  for (const app of APPS) {
    const pub = join(repo, app.dir, 'public');
    mkdirSync(pub, { recursive: true });
    copyFileSync(MARK_SVG, join(pub, 'favicon.svg'));
    for (const icon of ICONS) {
      await shot(browser, {
        html: iconHtml(icon.size, icon.padded),
        width: icon.size,
        height: icon.size,
        out: join(pub, icon.file),
        transparent: !icon.padded,
      });
    }
    const manifest = {
      name: app.name,
      short_name: app.shortName,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
      theme_color: '#FACE07',
      background_color: '#F2F2F2',
      display: 'standalone',
    };
    writeFileSync(join(pub, 'manifest.webmanifest'), `${JSON.stringify(manifest, null, 2)}\n`);
  }

  const locales = [
    { messages: await loadLocale('es-MX.ts', 'esMX'), out: 'og.png' },
    { messages: await loadLocale('en-US.ts', 'enUS'), out: 'og-en.png' },
  ];
  for (const { messages, out } of locales) {
    await shot(browser, {
      html: ogHtml({
        title: messages.landing.title,
        lead: messages.og.lead,
        name: messages.app.name,
        cta: messages.landing.ctaPrimary,
      }),
      width: 1200,
      height: 630,
      out: join(repo, 'apps/web/public', out),
      transparent: false,
    });
  }
} finally {
  await browser.close();
}
