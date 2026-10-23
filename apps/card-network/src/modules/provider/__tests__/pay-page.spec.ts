import { formatCents, type ProviderPayment } from '@acme/contracts';
import { describe, expect, it } from 'vitest';
import {
  escapeHtml,
  isPayPageLocale,
  PAY_PAGE_CSS,
  renderNotFoundPage,
  renderPayPage,
  resolvePayPageLocale,
} from '../helpers/pay-page';

const WEB_URL = 'http://localhost:4321';

function payment(overrides: Partial<ProviderPayment> = {}): ProviderPayment {
  return {
    id: '5c0e7a1b-2d3f-4a4b-8c5d-6e7f8a9b0c1d',
    reference: 'dep-1',
    amountCents: '125050',
    purpose: 'deposit',
    status: 'PENDING',
    approveUrl: 'http://localhost:3001/provider/pay/5c0e7a1b-2d3f-4a4b-8c5d-6e7f8a9b0c1d',
    createdAt: '2026-10-21T12:00:00.000Z',
    settledAt: null,
    ...overrides,
  };
}

const page = (overrides: Partial<ProviderPayment> = {}, locale: 'es' | 'en' = 'es') =>
  renderPayPage({ payment: payment(overrides), webUrl: WEB_URL, locale });

describe('resolvePayPageLocale', () => {
  it('defaults to Spanish when nothing says otherwise', () => {
    expect(resolvePayPageLocale({})).toBe('es');
    expect(resolvePayPageLocale({ acceptLanguage: '' })).toBe('es');
    expect(resolvePayPageLocale({ acceptLanguage: 'fr-FR,de;q=0.8' })).toBe('es');
  });

  it('lets ?lang=en / ?lang=es win over the Accept-Language header', () => {
    expect(resolvePayPageLocale({ lang: 'en', acceptLanguage: 'es-MX' })).toBe('en');
    expect(resolvePayPageLocale({ lang: 'es', acceptLanguage: 'en-US' })).toBe('es');
  });

  it('ignores an unsupported ?lang and falls back to the header', () => {
    expect(resolvePayPageLocale({ lang: 'fr', acceptLanguage: 'en-US' })).toBe('en');
    expect(resolvePayPageLocale({ lang: 'EN-us' })).toBe('es');
  });

  it('picks the supported language the browser prefers most (q weights, q=0 excluded)', () => {
    expect(resolvePayPageLocale({ acceptLanguage: 'en-US,en;q=0.9,es;q=0.8' })).toBe('en');
    expect(resolvePayPageLocale({ acceptLanguage: 'fr,en;q=0.5,es-MX;q=0.7' })).toBe('es');
    expect(resolvePayPageLocale({ acceptLanguage: 'es;q=0.4,EN-GB;q=0.6' })).toBe('en');
    expect(resolvePayPageLocale({ acceptLanguage: 'en;q=0,es;q=0' })).toBe('es');
    expect(resolvePayPageLocale({ acceptLanguage: 'en;q=0' })).toBe('es');
    expect(resolvePayPageLocale({ acceptLanguage: 'en;q=abc' })).toBe('es');
  });
});

describe('isPayPageLocale', () => {
  it('accepts exactly es and en', () => {
    expect(['es', 'en', 'EN', 'fr', '', undefined].map(isPayPageLocale)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
  });
});

describe('renderPayPage', () => {
  it('renders in Spanish (es-MX) by default: bank, purpose, amount, return link', () => {
    const html = page();
    expect(html).toContain('<html lang="es-MX">');
    expect(html).toContain('Acme Bank (simulador)');
    // es-MX writes the currency code before the amount (USD 1,250.50).
    expect(html).toContain(formatCents('125050', 'es-MX'));
    expect(formatCents('125050', 'es-MX')).toMatch(/^USD\s1,250\.50$/);
    expect(html).toContain('Depósito de garantía a Acme Credit');
    expect(html).toContain(`href="${WEB_URL}/app">Volver a Acme Credit</a>`);
    expect(html).toContain('href="/provider/assets/pay.css"');
  });

  it('renders in English (en-US) when asked', () => {
    const html = page({}, 'en');
    expect(html).toContain('<html lang="en-US">');
    expect(html).toContain('Acme Bank (simulator)');
    expect(html).toContain('$1,250.50');
    expect(html).toContain('Security deposit to Acme Credit');
    expect(html).toContain(`href="${WEB_URL}/app">Return to Acme Credit</a>`);
  });

  it('names each purpose in both languages', () => {
    expect(page({ purpose: 'repayment' })).toContain('Pago de tu tarjeta a Acme Credit');
    expect(page({ purpose: 'payout' })).toContain('Transferencia de Acme Credit a tu cuenta');
    expect(page({ purpose: 'repayment' }, 'en')).toContain('Card payment to Acme Credit');
    expect(page({ purpose: 'payout' }, 'en')).toContain('Payout from Acme Credit');
  });

  it('offers the ES | EN switch, marking the current language', () => {
    const es = page();
    expect(es).toContain('<a href="?lang=es" hreflang="es-MX" lang="es-MX" aria-current="true">');
    expect(es).toContain('<a href="?lang=en" hreflang="en-US" lang="en-US">');
    expect(page({}, 'en')).toContain(
      '<a href="?lang=en" hreflang="en-US" lang="en-US" aria-current="true">',
    );
  });

  it('offers Approve and Decline as plain form posts that keep the language, while PENDING', () => {
    const id = payment().id;
    const es = page();
    expect(es).toContain(`<form method="post" action="/provider/pay/${id}/approve?lang=es">`);
    expect(es).toContain(`<form method="post" action="/provider/pay/${id}/decline?lang=es">`);
    expect(es).toContain('<button type="submit" class="btn btn-primary">Aprobar pago</button>');
    expect(es).toContain('<button type="submit" class="btn btn-outline">Rechazar</button>');
    expect(page({}, 'en')).toContain(
      '<button type="submit" class="btn btn-primary">Approve payment</button>',
    );
    expect(es).toContain('<span class="chip chip-pending">Pendiente</span>');
    expect(es).not.toContain('<script');
    expect(es).not.toContain('<style');
    expect(es).not.toContain('style=');
  });

  it('shows the final status as a worded chip instead of the buttons once settled', () => {
    const approved = page({ status: 'SUCCEEDED' });
    expect(approved).toContain('<span class="chip chip-approved">Aprobado</span>');
    expect(approved).toContain('Pago aprobado');
    expect(approved).not.toContain('<form');
    const declined = page({ status: 'FAILED' }, 'en');
    expect(declined).toContain('<span class="chip chip-declined">Declined</span>');
    expect(declined).toContain('Payment declined');
    expect(declined).not.toContain('<form');
  });

  it('escapes every interpolated value', () => {
    const html = renderPayPage({
      payment: payment(),
      webUrl: 'http://x/"><script>',
      locale: 'es',
    });
    expect(html).not.toContain('"><script>');
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });
});

describe('renderNotFoundPage', () => {
  it('explains the payment was not found, in the asked language, and links back to the app', () => {
    const es = renderNotFoundPage({ webUrl: WEB_URL, locale: 'es' });
    expect(es).toContain('<html lang="es-MX">');
    expect(es).toContain('Pago no encontrado');
    expect(es).toContain(`href="${WEB_URL}/app"`);
    expect(renderNotFoundPage({ webUrl: WEB_URL, locale: 'en' })).toContain('Payment not found');
  });
});

describe('PAY_PAGE_CSS', () => {
  it('carries the brand: canvas, ink outline + hard shadow, yellow pill with its edge, violet focus', () => {
    for (const rule of [
      '--canvas:#F2F2F2',
      '--brand:#FACE07',
      '--brand-edge:#D7AD05',
      '--violet:#7940C8',
      'border:1.6px solid var(--ink)',
      'box-shadow:4px 4px 0 0 var(--ink)',
      'border-radius:16px',
      'box-shadow:0 3px 0 0 var(--brand-edge)',
      'font-variant-numeric:tabular-nums',
      'outline:3px solid var(--violet)',
    ]) {
      expect(PAY_PAGE_CSS).toContain(rule);
    }
    expect(PAY_PAGE_CSS).not.toMatch(/@import|url\(|blur|gradient/);
  });
});
