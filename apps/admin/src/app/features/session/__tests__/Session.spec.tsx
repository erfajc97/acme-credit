import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Toaster } from 'sonner';
import { navigateTo } from '@/app/helpers/navigation';
import { setActiveLocale, t } from '@/app/i18n';
import { queryClient } from '@/app/lib/queryClient';
import { useAuthStore } from '@/app/store/authStore';
import { useTourStore } from '@/app/store/tourStore';
import { DASHBOARD_KEY } from '@/app/tanstack-queries/adminQueries';
import { SESSION } from '@/test/fixtures';
import { core, server } from '@/test/server';
import Session from '../Session';

// These specs pin the English copy and US formats; Purchases.spec covers the es-MX default.
beforeEach(() => setActiveLocale('en-US'));

vi.mock('@/app/helpers/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/helpers/navigation')>()),
  navigateTo: vi.fn(),
}));

const user = userEvent.setup();

describe('Session island (console bar)', () => {
  beforeEach(() => vi.mocked(navigateTo).mockReset());

  it('keeps its place until the session is known, then shows who is signed in', () => {
    render(<Session locale="en-US" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    act(() => useAuthStore.getState().setSession(SESSION));
    expect(screen.getByText('Grace Hopper')).toBeInTheDocument();
  });

  it('"Take the tour" replays the product tour from its first step, from any page', async () => {
    useAuthStore.getState().setSession(SESSION);
    useTourStore.getState().close();
    render(<Session locale="en-US" />);
    await user.click(screen.getByRole('button', { name: t('session.tour') }));
    expect(useTourStore.getState().index).toBe(0);
  });

  it('signs out: clears the memory session and every cached private response, then leaves', async () => {
    useAuthStore.getState().setSession(SESSION);
    queryClient.setQueryData([DASHBOARD_KEY], { private: true });
    server.use(http.post(core('/auth/logout'), () => new HttpResponse(null, { status: 204 })));
    render(<Session locale="en-US" />);
    await user.click(screen.getByRole('button', { name: t('session.signOut') }));
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/en/signin'));
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, status: 'anonymous' });
    expect(queryClient.getQueryData([DASHBOARD_KEY])).toBeUndefined();
  });

  it('a failed sign-out says so and keeps the session', async () => {
    useAuthStore.getState().setSession(SESSION);
    server.use(http.post(core('/auth/logout'), () => HttpResponse.error()));
    // The page's toaster lives in another island; sonner shows this island's toasts there.
    render(
      <>
        <Session />
        <Toaster />
      </>,
    );
    await user.click(screen.getByRole('button', { name: t('session.signOut') }));
    expect(await screen.findByText(t('session.signOutFailed'))).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(navigateTo).not.toHaveBeenCalled();
  });
});
