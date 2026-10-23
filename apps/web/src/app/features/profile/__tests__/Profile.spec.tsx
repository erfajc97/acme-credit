import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { navigateTo } from '@/app/helpers/navigation';
import { t } from '@/app/i18n';
import { queryClient } from '@/app/lib/queryClient';
import { useAuthStore } from '@/app/store/authStore';
import { useCartStore } from '@/app/store/cartStore';
import { ACCOUNT_KEY } from '@/app/tanstack-queries/accountQuery';
import {
  accountFixture,
  ACCOUNT_ID,
  activityFixture,
  page,
  PENDING_ACCOUNT,
} from '@/test/fixtures';
import { apiError, core, json, server, signedIn } from '@/test/server';
import Profile from '../Profile';

vi.mock('@/app/helpers/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/helpers/navigation')>()),
  navigateTo: vi.fn(),
}));

const user = userEvent.setup();

describe('Profile island: who is signed in and sign out', () => {
  beforeEach(() => vi.mocked(navigateTo).mockReset());

  it('shows the customer and signs out: clears the session, the cache and the cart, then leaves', async () => {
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () => json(accountFixture())),
      http.post(core('/auth/logout'), () => new HttpResponse(null, { status: 204 })),
    );
    useCartStore.getState().add('TAC-PASTOR');
    render(<Profile />);
    expect(await screen.findByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument();
    expect(screen.getByText('ada@example.test')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('session.signOut') }));
    await vi.waitFor(() => expect(navigateTo).toHaveBeenCalledWith('/signin'));
    expect(useAuthStore.getState()).toMatchObject({ accessToken: null, status: 'anonymous' });
    expect(queryClient.getQueryData([ACCOUNT_KEY])).toBeUndefined();
    expect(useCartStore.getState().quantities).toEqual({});
  });

  it('a failed sign-out says so and keeps the session', async () => {
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () => json(accountFixture())),
      http.post(core('/auth/logout'), () => HttpResponse.error()),
    );
    render(<Profile locale="en-US" />);
    await user.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText(t('session.signOutFailed'))).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('without an open account there is nothing to close', async () => {
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () => json(PENDING_ACCOUNT)),
    );
    render(<Profile />);
    expect(await screen.findByText(t('profile.noOpenAccount'))).toBeInTheDocument();
  });

  it('an account that cannot load shows an error with retry', async () => {
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () => apiError(403, 'common.forbidden')),
    );
    render(<Profile />);
    expect(await screen.findByText(t('account.loadFailedTitle'))).toBeInTheDocument();
  });
});

describe('Profile island: close the account', () => {
  it('closes after explaining what happens to the deposit', async () => {
    let closed = false;
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () =>
        json(
          closed
            ? accountFixture({ status: 'CLOSED' })
            : accountFixture({ heldCents: '0', availableCents: '38000' }),
        ),
      ),
      http.post(core(`/accounts/${ACCOUNT_ID}/close`), ({ request }) => {
        closed = request.headers.get('idempotency-key') !== null;
        return json({
          account: accountFixture({ status: 'CLOSED' }),
          settlement: {
            collateralCents: '50000',
            appliedToDebtCents: '12000',
            releasedCents: '38000',
          },
        });
      }),
      http.get(core(`/accounts/${ACCOUNT_ID}/activity`), () =>
        json(page([activityFixture({ type: 'collateral_released', amountCents: '38000' })])),
      ),
    );
    render(<Profile locale="en-US" />);
    await user.click(await screen.findByRole('button', { name: t('profile.closeAction') }));
    const dialog = await screen.findByRole('dialog', { name: t('close.title') });
    expect(dialog).toHaveTextContent(
      t('close.bodyWithDebt', { collateral: '$500.00', applied: '$120.00', returned: '$380.00' }),
    );
    expect(within(dialog).queryByText(/on hold/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t('close.confirm') }));
    expect(
      await screen.findByText(t('close.toast.closed', { amount: '$380.00' })),
    ).toBeInTheDocument();
    expect(await screen.findByText(t('profile.noOpenAccount'))).toBeInTheDocument();
    expect(closed).toBe(true);
  });

  it('warns about holds and explains a refused close by its code, keeping the dialog open', async () => {
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () => json(accountFixture({ postedDebtCents: '0' }))),
      http.post(core(`/accounts/${ACCOUNT_ID}/close`), () =>
        apiError(409, 'account.pending_holds'),
      ),
    );
    render(<Profile locale="en-US" />);
    await user.click(await screen.findByRole('button', { name: t('profile.closeAction') }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent(t('close.bodyNoDebt', { collateral: '$500.00' }));
    expect(
      within(dialog).getByText(t('close.holdsTitle', { amount: '$40.00' })),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: t('close.confirm') }));
    expect(await screen.findByText(t('errors.account.pending_holds'))).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
