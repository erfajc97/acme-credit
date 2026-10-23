import {
  EMAIL_MAX,
  ERROR_CODES,
  loginRequestSchema,
  MAX_OPERATION_CENTS,
  NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  registerRequestSchema,
} from '@acme/contracts';
import { setActiveLocale, t } from '@/app/i18n';
import { plain } from '@/test/text';
import { amountTextField } from '../amountField';
import { currentPasswordField, emailField, fullNameField, newPasswordField } from '../authFields';
import { formatDateTime } from '../dates';
import { formatAmount, percentOf } from '../money';
import { currentLocation, currentSearchParam } from '../navigation';
import {
  latestPending,
  PAYMENT_POLL_MS,
  paymentPollInterval,
  safeApproveUrl,
  settledSince,
  type TrackedPayment,
} from '../payments';
import { safeReturnTo, signInHref } from '../safeReturnTo';
import { activityStatus, AUTHORIZATION_STATUS, PAYMENT_STATUS } from '../statusLabels';
import { translateError } from '../translateError';
import { validationParams } from '../validationParams';

const payment = (id: string, status: TrackedPayment['status']): TrackedPayment => ({
  id,
  amountCents: '25000',
  status,
  checkout: { paymentId: `pay-${id}`, approveUrl: 'http://localhost:3001/pay' },
  createdAt: '2026-10-21T10:00:00.000Z',
});

describe('money', () => {
  it('formats integer cents without floats, cents never hidden, in the page locale (always USD)', () => {
    expect(plain(formatAmount('12550'))).toBe('USD 125.50');
    expect(plain(formatAmount(100_000_000n))).toBe('USD 1,000,000.00');
    setActiveLocale('en-US');
    expect(formatAmount('12550')).toBe('$125.50');
    expect(formatAmount(5n)).toBe('$0.05');
    expect(formatAmount(100_000_000n)).toBe('$1,000,000.00');
  });

  it('percentOf truncates to basis points, clamps to 0–100 and survives an empty limit', () => {
    expect(percentOf('4000', '50000')).toBe(8);
    expect(percentOf('1', '30000')).toBe(0); // 0.33 bp truncates to 0 (display only)
    expect(percentOf('2', '3')).toBe(66.66);
    expect(percentOf('60000', '50000')).toBe(100);
    expect(percentOf('-5', '50000')).toBe(0);
    expect(percentOf('10', '0')).toBe(0);
    expect(percentOf('50000', '50000')).toBe(100);
  });
});

describe('amountTextField (W11: never auto-corrected)', () => {
  const parse = (text: string) => amountTextField.safeParse(text);
  it.each([
    ['250', 25000n],
    [' 1,250.5 ', 125050n],
    ['0.01', 1n],
  ])('accepts %j as %s cents', (text, cents) => {
    expect(parse(text)).toMatchObject({ success: true, data: cents });
  });

  it.each([
    ['', 'validation.amountRequired'],
    ['   ', 'validation.amountRequired'],
    ['12.345', 'validation.amountInvalid'],
    ['-5', 'validation.amountInvalid'],
    ['1e3', 'validation.amountInvalid'],
    ['0', 'validation.amountInvalid'],
    ['abc', 'validation.amountInvalid'],
  ])('rejects %j with %s', (text, message) => {
    const result = parse(text);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it('caps at the largest single operation: last passing and first failing value', () => {
    expect(parse('1000000.00')).toMatchObject({ success: true, data: MAX_OPERATION_CENTS });
    expect(parse('1000000.01').error?.issues[0]?.message).toBe('validation.amountTooLarge');
  });
});

describe('auth fields mirror the API DTOs (G12 twin doors)', () => {
  const longEmail = (length: number) =>
    `${'a'.repeat(length - 'x@example.test'.length + 1)}@example.test`;

  it('email: trimmed and lowercased; the last passing and first failing length match the contract', () => {
    expect(emailField.parse('  Ada@Example.TEST ')).toBe('ada@example.test');
    for (const length of [EMAIL_MAX, EMAIL_MAX + 1]) {
      const email = longEmail(length);
      expect(email).toHaveLength(length);
      expect(emailField.safeParse(email).success).toBe(
        loginRequestSchema.shape.email.safeParse(email).success,
      );
    }
    expect(emailField.safeParse(longEmail(EMAIL_MAX)).success).toBe(true);
    expect(emailField.safeParse(longEmail(EMAIL_MAX + 1)).error?.issues[0]?.message).toBe(
      'validation.emailTooLong',
    );
    expect(emailField.safeParse('').error?.issues[0]?.message).toBe('validation.emailRequired');
    expect(emailField.safeParse('not-an-email').error?.issues[0]?.message).toBe(
      'validation.emailInvalid',
    );
  });

  it('new password: same bounds as register', () => {
    const cases = [
      'a'.repeat(PASSWORD_MIN - 1),
      'a'.repeat(PASSWORD_MIN),
      'a'.repeat(PASSWORD_MAX),
      'a'.repeat(PASSWORD_MAX + 1),
    ];
    expect(cases.map((value) => newPasswordField.safeParse(value).success)).toEqual([
      false,
      true,
      true,
      false,
    ]);
    expect(
      cases.map((value) => registerRequestSchema.shape.password.safeParse(value).success),
    ).toEqual([false, true, true, false]);
  });

  it('current password: required, same max as login', () => {
    expect(currentPasswordField.safeParse('').error?.issues[0]?.message).toBe(
      'validation.passwordRequired',
    );
    expect(currentPasswordField.safeParse('a'.repeat(PASSWORD_MAX)).success).toBe(true);
    expect(
      currentPasswordField.safeParse('a'.repeat(PASSWORD_MAX + 1)).error?.issues[0]?.message,
    ).toBe('validation.passwordTooLong');
  });

  it('full name: trimmed, required, same max as register', () => {
    expect(fullNameField.parse('  Ada  ')).toBe('Ada');
    expect(fullNameField.safeParse('   ').error?.issues[0]?.message).toBe(
      'validation.nameRequired',
    );
    expect(fullNameField.safeParse('a'.repeat(NAME_MAX)).success).toBe(true);
    expect(fullNameField.safeParse('a'.repeat(NAME_MAX + 1)).success).toBe(false);
    expect(registerRequestSchema.shape.fullName.safeParse('a'.repeat(NAME_MAX + 1)).success).toBe(
      false,
    );
  });

  it('validation copy interpolates the shared caps', () => {
    expect(t('validation.passwordTooShort', validationParams())).toBe(
      `Usa al menos ${PASSWORD_MIN} caracteres.`,
    );
    expect(plain(t('validation.depositBelowMin', validationParams()))).toContain('USD 200.00');
    setActiveLocale('en-US');
    expect(t('validation.passwordTooShort', validationParams())).toBe(
      `Use at least ${PASSWORD_MIN} characters.`,
    );
    expect(t('validation.depositBelowMin', validationParams())).toContain('$200.00');
    expect(t('validation.depositAboveMax', validationParams())).toContain('$10,000.00');
  });
});

describe('payments', () => {
  it('latestPending finds the newest pending transfer', () => {
    expect(latestPending(undefined)).toBeNull();
    expect(latestPending([payment('a', 'CONFIRMED')])).toBeNull();
    expect(
      latestPending([payment('a', 'FAILED'), payment('b', 'PENDING'), payment('c', 'PENDING')])?.id,
    ).toBe('b');
  });

  it('polls only while pending AND inside the watch window (W3 stop condition)', () => {
    const pending = [payment('a', 'PENDING')];
    expect(paymentPollInterval(pending, 1000, 999)).toBe(PAYMENT_POLL_MS);
    expect(paymentPollInterval(pending, 1000, 1000)).toBe(false);
    expect(paymentPollInterval([payment('a', 'CONFIRMED')], 1000, 0)).toBe(false);
    expect(paymentPollInterval(undefined, 1000, 0)).toBe(false);
  });

  it('settledSince sees a pending transfer decided, and nothing else', () => {
    expect(settledSince([payment('a', 'PENDING')], [payment('a', 'CONFIRMED')])).toBe(true);
    expect(settledSince([payment('a', 'PENDING')], [payment('a', 'FAILED')])).toBe(true);
    expect(settledSince([payment('a', 'PENDING')], [payment('a', 'PENDING')])).toBe(false);
    expect(settledSince([payment('a', 'CONFIRMED')], [payment('a', 'CONFIRMED')])).toBe(false);
    expect(settledSince(undefined, [payment('a', 'CONFIRMED')])).toBe(false);
    expect(settledSince([payment('a', 'PENDING')], [payment('b', 'CONFIRMED')])).toBe(false);
  });

  it('safeApproveUrl only links http(s) pages', () => {
    expect(safeApproveUrl('https://bank.test/approve/1')).toBe('https://bank.test/approve/1');
    expect(safeApproveUrl('http://localhost:3001/pay/1')).toBe('http://localhost:3001/pay/1');
    expect(safeApproveUrl('javascript:alert(1)')).toBeNull();
    expect(safeApproveUrl('data:text/html,x')).toBeNull();
    expect(safeApproveUrl('not a url')).toBeNull();
    expect(safeApproveUrl(undefined)).toBeNull();
  });
});

describe('safeReturnTo (open redirect guard)', () => {
  it.each([
    ['/app/activity?x=1', '/app/activity?x=1'],
    [null, '/app'],
    ['https://evil.test', '/app'],
    ['//evil.test', '/app'],
    ['/\\evil.test', '/app'],
    ['app', '/app'],
    // Browsers drop tabs and newlines, so these read as //evil.com (the open redirect).
    ['/\t/evil.com', '/app'],
    ['\t//evil.com', '/app'],
    ['/\n/evil.com', '/app'],
    ['javascript:alert(1)', '/app'],
    ['%2F%2Fevil.com', '/app'],
  ])('%j → %j', (value, expected) => {
    expect(safeReturnTo(value)).toBe(expected);
  });

  it('builds the sign-in link with an encoded way back', () => {
    expect(signInHref('/signin', '/app?a=1')).toBe('/signin?returnTo=%2Fapp%3Fa%3D1');
  });
});

describe('navigation helpers (read at event time)', () => {
  it('reads the current path, query and one parameter', () => {
    window.history.replaceState(null, '', '/signin?returnTo=%2Fapp%2Fpurchase');
    expect(currentLocation()).toBe('/signin?returnTo=%2Fapp%2Fpurchase');
    expect(currentSearchParam('returnTo')).toBe('/app/purchase');
    expect(currentSearchParam('missing')).toBeNull();
  });
});

describe('status words (never color alone)', () => {
  it('maps every authorization and payment status to a word that exists', () => {
    for (const label of [
      ...Object.values(AUTHORIZATION_STATUS),
      ...Object.values(PAYMENT_STATUS),
    ]) {
      expect(t(label.labelKey)).not.toBe(label.labelKey);
    }
    expect(AUTHORIZATION_STATUS.APPROVED).toEqual({ labelKey: 'status.onHold', tone: 'warning' });
    expect(AUTHORIZATION_STATUS.CAPTURED.labelKey).toBe('status.posted');
  });

  it('activity statuses: known ones (any case) get their word, unknown ones "Recorded"', () => {
    expect(activityStatus('posted')).toEqual({ labelKey: 'status.posted', tone: 'neutral' });
    expect(activityStatus('CONFIRMED').tone).toBe('success');
    expect(activityStatus('RELEASED').labelKey).toBe('status.released');
    expect(activityStatus('APPLIED').labelKey).toBe('status.applied');
    expect(activityStatus('SOMETHING_NEW')).toEqual({
      labelKey: 'status.recorded',
      tone: 'neutral',
    });
  });
});

describe('errors by code (W6)', () => {
  it('every catalog code has its copy', () => {
    for (const code of ERROR_CODES) {
      const key = translateError(code);
      expect(key).toBe(`errors.${code}`);
      expect(t(key), code).not.toBe(key);
    }
    expect(t('errors.unknown')).not.toBe('errors.unknown');
  });
});

describe('dates', () => {
  it('formats an instant in the locale (TZ pinned to UTC in tests)', () => {
    expect(plain(formatDateTime('2026-10-21T16:05:00.000Z'))).toBe('21 oct 2026, 4:05 p.m.');
    setActiveLocale('en-US');
    expect(plain(formatDateTime('2026-10-21T16:05:00.000Z'))).toBe('Oct 21, 2026, 4:05 PM');
  });
});
