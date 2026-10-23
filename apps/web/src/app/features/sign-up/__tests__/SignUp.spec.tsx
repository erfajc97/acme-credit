import { TOUR_PENDING_KEY } from '@/app/helpers/tourTrigger';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { navigateTo } from '@/app/helpers/navigation';
import { t } from '@/app/i18n';
import { useAuthStore } from '@/app/store/authStore';
import { SESSION } from '@/test/fixtures';
import { apiError, core, json, server } from '@/test/server';
import SignUp from '../SignUp';

vi.mock('@/app/helpers/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/helpers/navigation')>()),
  navigateTo: vi.fn(),
}));

/**
 * The build's demo values (astro:env defaults are off and empty, as in production). Each spec
 * sets what its build would bake in; nothing here is a real or shipped password.
 */
const demoBuild = vi.hoisted(() => ({
  enabled: false,
  login: null as { email: string; password: string } | null,
}));
vi.mock('@/app/config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/config/env')>();
  return { env: { ...actual.env, demo: demoBuild } };
});

const user = userEvent.setup();

async function fill({ name, email, password }: { name: string; email: string; password: string }) {
  await user.type(screen.getByLabelText(t('auth.fields.fullName')), name);
  await user.type(screen.getByLabelText(t('auth.fields.email')), email);
  await user.type(screen.getByLabelText(t('auth.fields.newPassword')), password);
  await user.click(screen.getByRole('button', { name: t('auth.signUp.submit') }));
}

describe('SignUp island', () => {
  beforeEach(() => vi.mocked(navigateTo).mockReset());

  it('needs a password of at least the API minimum (7 fails, 8 passes)', async () => {
    let calls = 0;
    server.use(
      http.post(core('/auth/register'), () => {
        calls += 1;
        return json(SESSION, 201);
      }),
    );
    render(<SignUp />);
    expect(screen.getByText(t('auth.fields.newPasswordHint', { min: 8 }))).toBeInTheDocument();
    await fill({ name: 'Ada Lovelace', email: 'ada@example.test', password: '1234567' });
    expect(
      await screen.findByText(t('validation.passwordTooShort', { passwordMin: 8 })),
    ).toBeInTheDocument();
    expect(calls).toBe(0);
    await user.type(screen.getByLabelText(t('auth.fields.newPassword')), '8');
    await user.click(screen.getByRole('button', { name: t('auth.signUp.submit') }));
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/app'));
    expect(calls).toBe(1);
    expect(useAuthStore.getState().user?.fullName).toBe('Ada Lovelace');
    // A new customer lands on the wallet with its tour (one-shot request, per sign-in).
    expect(window.sessionStorage.getItem(TOUR_PENDING_KEY)).toBe('1');
  });

  it('marks a taken email on its field and toasts it', async () => {
    server.use(http.post(core('/auth/register'), () => apiError(409, 'auth.email_taken')));
    render(<SignUp />);
    await fill({ name: 'Ada', email: 'ada@example.test', password: 'long enough' });
    expect(await screen.findAllByText(t('errors.auth.email_taken'))).toHaveLength(2);
    expect(screen.getByLabelText(t('auth.fields.email'))).toHaveAttribute('aria-invalid', 'true');
  });

  it('other failures only toast', async () => {
    server.use(http.post(core('/auth/register'), () => apiError(400, 'common.validation_failed')));
    render(<SignUp />);
    await fill({ name: 'Ada', email: 'ada@example.test', password: 'long enough' });
    expect(await screen.findByText(t('errors.common.validation_failed'))).toBeInTheDocument();
    expect(screen.getByLabelText(t('auth.fields.email'))).not.toHaveAttribute('aria-invalid');
  });

  it('without an answer, shows the generic sign-up copy', async () => {
    server.use(http.post(core('/auth/register'), () => new Response(null, { status: 503 })));
    render(<SignUp />);
    await fill({ name: 'Ada', email: 'ada@example.test', password: 'long enough' });
    expect(await screen.findByText(t('auth.signUp.failed'))).toBeInTheDocument();
  });
});

describe('SignUp demo helper (PUBLIC_DEMO_MODE)', () => {
  beforeEach(() => {
    vi.mocked(navigateTo).mockReset();
    demoBuild.enabled = true;
  });
  afterEach(() => {
    demoBuild.enabled = false;
  });

  it('demo mode off (the production default) shows no fill button', () => {
    demoBuild.enabled = false;
    render(<SignUp />);
    expect(screen.queryByRole('button', { name: t('auth.signUp.demo') })).not.toBeInTheDocument();
  });

  it('fills a unique test e-mail, a fresh random password and a name, without submitting', async () => {
    let calls = 0;
    server.use(
      http.post(core('/auth/register'), () => {
        calls += 1;
        return json(SESSION, 201);
      }),
    );
    vi.spyOn(Date, 'now').mockReturnValue(1_761_000_000_000);
    render(<SignUp />);
    await user.click(screen.getByRole('button', { name: t('auth.signUp.demo') }));
    expect(screen.getByLabelText(t('auth.fields.fullName'))).toHaveValue('Cliente Demo');
    expect(screen.getByLabelText(t('auth.fields.email'))).toHaveValue(
      'demo+1761000000000@acme.test',
    );
    const password = (screen.getByLabelText(t('auth.fields.newPassword')) as HTMLInputElement)
      .value;
    expect(password).toHaveLength(20);
    await user.click(screen.getByRole('button', { name: t('auth.signUp.demo') }));
    expect(screen.getByLabelText(t('auth.fields.newPassword'))).not.toHaveValue(password);
    expect(calls).toBe(0);
    vi.restoreAllMocks();
    await user.click(screen.getByRole('button', { name: t('auth.signUp.submit') }));
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/app'));
    expect(calls).toBe(1);
  });
});
