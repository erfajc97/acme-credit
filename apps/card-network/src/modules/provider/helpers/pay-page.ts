import { formatCents, type ProviderPayment } from '@acme/contracts';

export type PayPageLocale = 'es' | 'en';

/** Spanish first: the product's default language (docs/brand.md). */
const DEFAULT_LOCALE: PayPageLocale = 'es';
const LOCALES: readonly PayPageLocale[] = ['es', 'en'];
/** The `lang` / `hreflang` tag and the `Intl` locale of each language. */
const LANGUAGE_TAG: Record<PayPageLocale, string> = { es: 'es-MX', en: 'en-US' };

type StatusCopy = Record<ProviderPayment['status'], string>;

interface PageCopy {
  bank: string;
  pageTitle: string;
  notFoundTitle: string;
  notFound: string;
  notFoundHint: string;
  amount: string;
  simulatorNote: string;
  approve: string;
  decline: string;
  back: string;
  language: string;
  languageName: Record<PayPageLocale, string>;
  purpose: Record<ProviderPayment['purpose'], string>;
  chip: StatusCopy;
  status: StatusCopy;
}

/** Every word the pay page shows, in both languages, in one place. */
const COPY: Record<PayPageLocale, PageCopy> = {
  es: {
    bank: 'Acme Bank (simulador)',
    pageTitle: 'Aprobar pago — Acme Bank (simulador)',
    notFoundTitle: 'Pago no encontrado — Acme Bank (simulador)',
    notFound: 'Pago no encontrado',
    notFoundHint: 'Este enlace de pago no es válido. Inicia el pago de nuevo desde Acme Credit.',
    amount: 'Monto',
    simulatorNote: 'Este es un banco simulado. No se mueve dinero real.',
    approve: 'Aprobar pago',
    decline: 'Rechazar',
    back: 'Volver a Acme Credit',
    language: 'Idioma',
    languageName: { es: 'Español', en: 'English' },
    purpose: {
      deposit: 'Depósito de garantía a Acme Credit',
      repayment: 'Pago de tu tarjeta a Acme Credit',
      payout: 'Transferencia de Acme Credit a tu cuenta',
    },
    chip: { PENDING: 'Pendiente', SUCCEEDED: 'Aprobado', FAILED: 'Rechazado' },
    status: {
      PENDING: 'Esperando tu aprobación',
      SUCCEEDED: 'Pago aprobado',
      FAILED: 'Pago rechazado',
    },
  },
  en: {
    bank: 'Acme Bank (simulator)',
    pageTitle: 'Approve payment — Acme Bank (simulator)',
    notFoundTitle: 'Payment not found — Acme Bank (simulator)',
    notFound: 'Payment not found',
    notFoundHint: 'This payment link is not valid. Start the payment again from Acme Credit.',
    amount: 'Amount',
    simulatorNote: 'This is a simulated bank. No real money moves.',
    approve: 'Approve payment',
    decline: 'Decline',
    back: 'Return to Acme Credit',
    language: 'Language',
    languageName: { es: 'Español', en: 'English' },
    purpose: {
      deposit: 'Security deposit to Acme Credit',
      repayment: 'Card payment to Acme Credit',
      payout: 'Payout from Acme Credit',
    },
    chip: { PENDING: 'Pending', SUCCEEDED: 'Approved', FAILED: 'Declined' },
    status: {
      PENDING: 'Waiting for your approval',
      SUCCEEDED: 'Payment approved',
      FAILED: 'Payment declined',
    },
  },
};

const CHIP_CLASS: StatusCopy = {
  PENDING: 'chip-pending',
  SUCCEEDED: 'chip-approved',
  FAILED: 'chip-declined',
};

export const isPayPageLocale = (value: unknown): value is PayPageLocale =>
  LOCALES.includes(value as PayPageLocale);

/**
 * `?lang=es|en` wins (the page's own switch); otherwise the supported language the browser
 * weights highest in `Accept-Language`; otherwise Spanish.
 */
export function resolvePayPageLocale(input: {
  lang?: string;
  acceptLanguage?: string;
}): PayPageLocale {
  if (isPayPageLocale(input.lang)) return input.lang;
  let best: { locale: PayPageLocale; weight: number } | null = null;
  for (const range of (input.acceptLanguage ?? '').split(',')) {
    const [tag = '', ...params] = range.split(';').map((part) => part.trim());
    const primary = tag.split('-')[0]?.toLowerCase();
    const qParam = params.find((param) => param.startsWith('q='));
    const weight = qParam ? Number(qParam.slice(2)) : 1;
    if (!isPayPageLocale(primary) || !(weight > 0)) continue;
    if (!best || weight > best.weight) best = { locale: primary, weight };
  }
  return best?.locale ?? DEFAULT_LOCALE;
}

const STYLESHEET_PATH = '/provider/assets/pay.css';

/**
 * Served from a route because helmet's CSP (and ours) forbids inline styles and scripts.
 * Values are the brand tokens of docs/brand.md (light, then dark); fonts fall back to system
 * stacks so the page loads nothing external.
 */
export const PAY_PAGE_CSS = `:root{color-scheme:light dark;--canvas:#F2F2F2;--surface:#FFFFFF;--ink:#010101;--fg:#0F172A;--muted:#555555;--brand:#FACE07;--brand-hover:#F0C000;--brand-edge:#D7AD05;--on-brand:#010101;--violet:#7940C8;--neutral-soft:#EDEDED;--border-strong:#626262;--success:#17702F;--mint:#D0FAA9;--danger:#A20042;--warning:#8A6A00;--cream:#FFFDEB;--display:"Golos Text",Avenir,Montserrat,Corbel,"URW Gothic",source-sans-pro,system-ui,sans-serif;--body:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;--mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
@media (prefers-color-scheme:dark){:root{--canvas:#0D0D0F;--surface:#18181B;--ink:#FACE07;--fg:#F4F4F5;--muted:#A1A1AA;--brand-hover:#FBDE44;--brand-edge:#B38D03;--violet:#C5A2F6;--neutral-soft:#26262B;--border-strong:#8A8A93;--success:#7FD99A;--mint:#1E2B17;--danger:#FF7A9C;--warning:#F5C542;--cream:#26231A}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;padding:1rem 1rem 2rem;background:var(--canvas);color:var(--fg);font:400 1rem/1.55 var(--body)}
.lang{max-width:28rem;margin:0 auto .5rem;display:flex;justify-content:flex-end;align-items:center;gap:.125rem;font-size:.875rem;color:var(--muted)}
.lang a{display:inline-flex;align-items:center;min-width:44px;min-height:44px;justify-content:center;border-radius:9999px;font-weight:600}
.lang a[aria-current]{color:var(--fg);text-decoration:none}
main{max-width:28rem;margin:0 auto;padding:1.5rem 1.25rem;background:var(--surface);border:1.6px solid var(--ink);border-radius:16px;box-shadow:4px 4px 0 0 var(--ink)}
h1{display:flex;align-items:center;gap:.5rem;margin:0 0 1.25rem;font:700 1.5rem/1.2 var(--display)}
h2{margin:0 0 .5rem;font:700 1.25rem/1.3 var(--display)}
.mark{flex:none;width:.875rem;height:.875rem;background:var(--brand);border:1.6px solid var(--ink);border-radius:3px}
.purpose{margin:0 0 1rem;font-weight:500}
.label{margin:0;color:var(--muted);font-size:.875rem}
.amount{margin:.25rem 0 1rem;font:500 2.25rem/1.1 var(--mono);font-variant-numeric:tabular-nums;overflow-wrap:anywhere}
.status{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin:0}
.chip{display:inline-block;padding:.125rem .75rem;border:1.6px solid currentColor;border-radius:9999px;font-size:.875rem;font-weight:600}
.chip-pending{color:var(--warning);background:var(--cream)}
.chip-approved{color:var(--success);background:var(--mint)}
.chip-declined{color:var(--danger);background:var(--surface)}
.actions{display:flex;flex-wrap:wrap;gap:.75rem;margin:1.5rem 0 .5rem}
.actions form{display:flex;flex:1 1 9rem}
.btn{flex:1;min-height:44px;padding:.75rem 1.5rem;border-radius:9999px;font:600 1rem/1.2 var(--body);cursor:pointer;transition:transform 150ms cubic-bezier(0.22,1,0.36,1),box-shadow 150ms,background-color 150ms}
.btn-primary{border:0;background:var(--brand);color:var(--on-brand);box-shadow:0 3px 0 0 var(--brand-edge)}
.btn-primary:hover{background:var(--brand-hover)}
.btn-primary:active{transform:translateY(3px);box-shadow:none}
.btn-outline{border:1.6px solid var(--border-strong);background:var(--surface);color:var(--fg)}
.btn-outline:hover{background:var(--neutral-soft)}
.btn-outline:active{transform:translateY(2px)}
a{color:var(--violet);text-underline-offset:2px}
.btn:focus-visible,a:focus-visible{outline:3px solid var(--violet);outline-offset:2px}
.back{margin:1.25rem 0 0;font-weight:600}
.note{margin:.5rem 0 0;color:var(--muted);font-size:.875rem}
.visually-hidden{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@media (min-width:40rem){body{padding:3rem 1.5rem}main{padding:2rem}h1{font-size:1.75rem}.amount{font-size:3rem}}
@media (prefers-reduced-motion:reduce){.btn{transition:none}}
`;

/** Pay pages forbid everything but our stylesheet and same-origin form posts. */
export const PAY_PAGE_CSP =
  "default-src 'none'; style-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

export function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** ES | EN as query-only links, so they keep the current path without knowing it. */
function languageSwitch(locale: PayPageLocale): string {
  const copy = COPY[locale];
  const link = (target: PayPageLocale) => {
    const tag = LANGUAGE_TAG[target];
    const current = target === locale ? ' aria-current="true"' : '';
    return `<a href="?lang=${target}" hreflang="${tag}" lang="${tag}"${current}>${target.toUpperCase()}<span class="visually-hidden"> (${escapeHtml(copy.languageName[target])})</span></a>`;
  };
  return `<nav class="lang" aria-label="${escapeHtml(copy.language)}">${link('es')}<span aria-hidden="true">|</span>${link('en')}</nav>`;
}

function layout(input: {
  title: string;
  body: string;
  webUrl: string;
  locale: PayPageLocale;
}): string {
  const copy = COPY[input.locale];
  return `<!doctype html>
<html lang="${LANGUAGE_TAG[input.locale]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(input.title)}</title>
<link rel="stylesheet" href="${STYLESHEET_PATH}">
</head>
<body>
${languageSwitch(input.locale)}
<main>
<h1><span class="mark" aria-hidden="true"></span>${escapeHtml(copy.bank)}</h1>
${input.body}
<p class="back"><a href="${escapeHtml(`${input.webUrl}/app`)}">${escapeHtml(copy.back)}</a></p>
<p class="note">${escapeHtml(copy.simulatorNote)}</p>
</main>
</body>
</html>
`;
}

function actions(id: string, locale: PayPageLocale): string {
  const copy = COPY[locale];
  const action = (verb: 'approve' | 'decline', label: string, variant: string) =>
    `<form method="post" action="/provider/pay/${escapeHtml(encodeURIComponent(id))}/${verb}?lang=${locale}"><button type="submit" class="btn ${variant}">${escapeHtml(label)}</button></form>`;
  return `<div class="actions">${action('approve', copy.approve, 'btn-primary')}${action('decline', copy.decline, 'btn-outline')}</div>`;
}

/** The bank's hosted page: what is paid, to whom, and Approve / Decline while pending. */
export function renderPayPage(input: {
  payment: ProviderPayment;
  webUrl: string;
  locale: PayPageLocale;
}): string {
  const { payment, locale } = input;
  const copy = COPY[locale];
  const body = `<p class="purpose">${escapeHtml(copy.purpose[payment.purpose])}</p>
<p class="label">${escapeHtml(copy.amount)}</p>
<p class="amount">${escapeHtml(formatCents(payment.amountCents, LANGUAGE_TAG[locale]))}</p>
<p class="status" role="status"><span class="chip ${CHIP_CLASS[payment.status]}">${escapeHtml(copy.chip[payment.status])}</span> ${escapeHtml(copy.status[payment.status])}</p>
${payment.status === 'PENDING' ? actions(payment.id, locale) : ''}`;
  return layout({ title: copy.pageTitle, body, webUrl: input.webUrl, locale });
}

export function renderNotFoundPage(input: { webUrl: string; locale: PayPageLocale }): string {
  const copy = COPY[input.locale];
  const body = `<h2>${escapeHtml(copy.notFound)}</h2>
<p>${escapeHtml(copy.notFoundHint)}</p>`;
  return layout({
    title: copy.notFoundTitle,
    body,
    webUrl: input.webUrl,
    locale: input.locale,
  });
}
