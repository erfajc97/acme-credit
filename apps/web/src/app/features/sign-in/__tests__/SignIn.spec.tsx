import { TOUR_PENDING_KEY } from '@/app/helpers/tourTrigger';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { navigateTo } from '@/app/helpers/navigation';
import { t } from '@/app/i18n';
import { useAuthStore } from '@/app/store/authStore';
import { SESSION } from '@/test/fixtures';
import { apiError, core, json, server } from '@/test/server';
import SignIn from '../SignIn';

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

async function fill(email: string, password: string) {
  if (email) await user.type(screen.getByLabelText(t('auth.fields.email')), email);
  if (password) await user.type(screen.getByLabelText(t('auth.fields.password')), password);
  await user.click(screen.getByRole('button', { name: t('auth.signIn.submit') }));
}

describe('SignIn island', () => {
  beforeEach(() => vi.mocked(navigateTo).mockReset());

  it('validates like the API before sending anything', async () => {
    render(<SignIn />);
    await fill('', '');
    expect(await screen.findByText(t('validation.emailRequired'))).toBeInTheDocument();
    expect(screen.getByText(t('validation.passwordRequired'))).toBeInTheDocument();
    expect(screen.getByLabelText(t('auth.fields.email'))).toHaveAttribute('maxlength', '254');
  });

  it('signs in as a customer (lowercased email), keeps the token in memory and goes back to returnTo', async () => {
    window.history.replaceState(null, '', '/signin?returnTo=%2Fapp%2Fstore');
    let body: unknown;
    server.use(
      http.post(core('/auth/login'), async ({ request }) => {
        body = await request.json();
        return json(SESSION);
      }),
    );
    render(<SignIn />);
    await fill(' Ada@Example.TEST ', 'correct horse');
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/app/store'));
    expect(body).toEqual({
      email: 'ada@example.test',
      password: 'correct horse',
      audience: 'customer',
    });
    expect(useAuthStore.getState()).toMatchObject({
      accessToken: 'access-1',
      status: 'authenticated',
    });
    // Nothing about the session is stored: only the one-shot request for the wallet tour.
    expect(Object.keys(window.sessionStorage)).toEqual([TOUR_PENDING_KEY]);
    expect(window.localStorage.length).toBe(0);
  });

  it('ignores a foreign returnTo (open redirect)', async () => {
    window.history.replaceState(null, '', '/signin?returnTo=https%3A%2F%2Fevil.test');
    server.use(http.post(core('/auth/login'), () => json(SESSION)));
    render(<SignIn />);
    await fill('ada@example.test', 'pw');
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/app'));
  });

  it.each([
    ['auth.invalid_credentials', 401],
    ['common.rate_limited', 429],
  ])('explains %s by its code and keeps what was typed', async (code, status) => {
    server.use(http.post(core('/auth/login'), () => apiError(status, code)));
    render(<SignIn />);
    await fill('ada@example.test', 'wrong');
    expect(await screen.findByText(t(`errors.${code}`))).toBeInTheDocument();
    expect(screen.getByLabelText(t('auth.fields.email'))).toHaveValue('ada@example.test');
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('without an answer, shows the generic sign-in copy', async () => {
    server.use(http.post(core('/auth/login'), () => new Response('down', { status: 502 })));
    render(<SignIn />);
    await fill('ada@example.test', 'pw');
    expect(await screen.findByText(t('auth.signIn.failed'))).toBeInTheDocument();
  });
});

describe('SignIn demo helper (PUBLIC_DEMO_MODE)', () => {
  const DEMO_LOGIN = { email: 'demo-customer@example.test', password: `from-env-${'x'.repeat(8)}` };

  beforeEach(() => {
    vi.mocked(navigateTo).mockReset();
    window.history.replaceState(null, '', '/signin');
    Object.assign(demoBuild, { enabled: true, login: DEMO_LOGIN });
  });
  afterEach(() => Object.assign(demoBuild, { enabled: false, login: null }));

  it('a build without a demo login (the production default) shows no demo button', () => {
    Object.assign(demoBuild, { enabled: false, login: null });
    render(<SignIn />);
    expect(screen.getByRole('button', { name: t('auth.signIn.submit') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('auth.signIn.demo') })).not.toBeInTheDocument();
  });

  it('fills the demo customer from the build env and does not submit', async () => {
    let calls = 0;
    server.use(
      http.post(core('/auth/login'), () => {
        calls += 1;
        return json(SESSION);
      }),
    );
    render(<SignIn />);
    await user.click(screen.getByRole('button', { name: t('auth.signIn.demo') }));
    expect(screen.getByLabelText(t('auth.fields.email'))).toHaveValue(DEMO_LOGIN.email);
    expect(screen.getByLabelText(t('auth.fields.password'))).toHaveValue(DEMO_LOGIN.password);
    expect(calls).toBe(0);
    await user.click(screen.getByRole('button', { name: t('auth.signIn.submit') }));
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/app'));
    expect(calls).toBe(1);
  });

  it('on the English page it lands on the English wallet', async () => {
    server.use(http.post(core('/auth/login'), () => json(SESSION)));
    render(<SignIn locale="en-US" />);
    await user.click(screen.getByRole('button', { name: 'Use demo account' }));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/en/app'));
  });
});
