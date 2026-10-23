import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { navigateTo } from '@/app/helpers/navigation';
import { TOUR_PENDING_KEY } from '@/app/helpers/tourTrigger';
import { setActiveLocale, t } from '@/app/i18n';
import { useAuthStore } from '@/app/store/authStore';
import { SESSION } from '@/test/fixtures';
import { apiError, core, json, server } from '@/test/server';
import SignIn from '../SignIn';

// These specs pin the English copy and US formats; Purchases.spec covers the es-MX default.
beforeEach(() => setActiveLocale('en-US'));

vi.mock('@/app/helpers/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/helpers/navigation')>()),
  navigateTo: vi.fn(),
}));

/**
 * The build's demo admin (astro:env defaults are off and empty, as in production). Specs set what
 * a demo build would bake in; nothing here is a real or shipped password.
 */
const DEMO_LOGIN = { email: 'demo-admin@example.test', password: `from-env-${'y'.repeat(8)}` };
const demoBuild = vi.hoisted(() => ({ login: null as { email: string; password: string } | null }));
vi.mock('@/app/config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/config/env')>();
  return {
    env: {
      ...actual.env,
      get demoLogin() {
        return demoBuild.login;
      },
    },
  };
});
afterEach(() => {
  demoBuild.login = null;
});

const user = userEvent.setup();

async function fill(email: string, password: string) {
  if (email) await user.type(screen.getByLabelText(t('auth.fields.email')), email);
  if (password) await user.type(screen.getByLabelText(t('auth.fields.password')), password);
  await user.click(screen.getByRole('button', { name: t('auth.signIn.submit') }));
}

describe('SignIn island', () => {
  beforeEach(() => vi.mocked(navigateTo).mockReset());

  it('validates like the API before sending anything', async () => {
    render(<SignIn locale="en-US" />);
    await fill('', '');
    expect(await screen.findByText(t('validation.emailRequired'))).toBeInTheDocument();
    expect(screen.getByText(t('validation.passwordRequired'))).toBeInTheDocument();
    expect(screen.getByLabelText(t('auth.fields.email'))).toHaveAttribute('maxlength', '254');
  });

  it('signs in as an admin (lowercased email), keeps the token in memory and goes back to returnTo', async () => {
    window.history.replaceState(null, '', '/signin?returnTo=%2Faccounts%3Fstatus%3DFROZEN');
    let body: unknown;
    server.use(
      http.post(core('/auth/login'), async ({ request }) => {
        body = await request.json();
        return json(SESSION);
      }),
    );
    render(<SignIn locale="en-US" />);
    await fill(' Grace@Acme.TEST ', 'correct horse');
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/accounts?status=FROZEN'));
    expect(body).toEqual({
      email: 'grace@acme.test',
      password: 'correct horse',
      audience: 'admin',
    });
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'access-1',
      status: 'authenticated',
    });
    // Nothing sensitive is stored (W14): the tab only keeps the one-shot "open the tour" flag.
    expect(Object.keys(window.sessionStorage)).toEqual([TOUR_PENDING_KEY]);
    expect(window.sessionStorage.getItem(TOUR_PENDING_KEY)).toBe('1');
    expect(window.localStorage.length).toBe(0);
  });

  it('a failed sign-in asks for no tour', async () => {
    server.use(http.post(core('/auth/login'), () => apiError(401, 'auth.invalid_credentials')));
    render(<SignIn locale="en-US" />);
    await fill('ada@example.test', 'wrong');
    await screen.findByText(t('errors.auth.invalid_credentials'));
    expect(window.sessionStorage.getItem(TOUR_PENDING_KEY)).toBeNull();
  });

  it('ignores a foreign returnTo (open redirect)', async () => {
    window.history.replaceState(null, '', '/signin?returnTo=https%3A%2F%2Fevil.test');
    server.use(http.post(core('/auth/login'), () => json(SESSION)));
    render(<SignIn locale="en-US" />);
    await fill('ada@example.test', 'pw');
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/en/dashboard'));
  });

  it.each([
    ['auth.invalid_credentials', 401],
    ['common.rate_limited', 429],
  ])('explains %s by its code and keeps what was typed', async (code, status) => {
    server.use(http.post(core('/auth/login'), () => apiError(status, code)));
    render(<SignIn locale="en-US" />);
    await fill('ada@example.test', 'wrong');
    expect(await screen.findByText(t(`errors.${code}`))).toBeInTheDocument();
    expect(screen.getByLabelText(t('auth.fields.email'))).toHaveValue('ada@example.test');
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('a build without a demo login (the production default) shows no demo button', () => {
    render(<SignIn locale="en-US" />);
    expect(screen.getByRole('button', { name: t('auth.signIn.submit') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('auth.signIn.demo') })).not.toBeInTheDocument();
  });

  it('the demo button fills the demo admin from the build env and never submits on its own', async () => {
    demoBuild.login = DEMO_LOGIN;
    let logins = 0;
    server.use(
      http.post(core('/auth/login'), () => {
        logins += 1;
        return json(SESSION);
      }),
    );
    render(<SignIn locale="en-US" />);
    await user.click(screen.getByRole('button', { name: t('auth.signIn.demo') }));
    expect(screen.getByLabelText(t('auth.fields.email'))).toHaveValue(DEMO_LOGIN.email);
    expect(screen.getByLabelText(t('auth.fields.password'))).toHaveValue(DEMO_LOGIN.password);
    expect(logins).toBe(0);
    expect(navigateTo).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: t('auth.signIn.submit') }));
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/en/dashboard'));
    expect(logins).toBe(1);
  });

  it('in Spanish (the default) the demo button reads "Usar cuenta demo"', () => {
    demoBuild.login = DEMO_LOGIN;
    render(<SignIn />);
    expect(screen.getByRole('button', { name: 'Usar cuenta demo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
  });

  it('without an answer, shows the generic sign-in copy', async () => {
    server.use(http.post(core('/auth/login'), () => new Response('down', { status: 502 })));
    render(<SignIn locale="en-US" />);
    await fill('ada@example.test', 'pw');
    expect(await screen.findByText(t('auth.signIn.failed'))).toBeInTheDocument();
  });
});
