import { SESSION } from '@/test/fixtures';
import { useAuthStore } from '../authStore';

describe('auth store: who ended the session', () => {
  it('remembers a sign-out even if a later 401 clears the session again', () => {
    useAuthStore.getState().setSession(SESSION);
    useAuthStore.getState().clearSession({ byUser: true });
    useAuthStore.getState().clearSession();
    expect(useAuthStore.getState()).toMatchObject({ status: 'anonymous', endedByUser: true });
  });

  it('an expired session is not a sign-out, and a new session resets the flag', () => {
    useAuthStore.getState().setSession(SESSION);
    useAuthStore.getState().clearSession();
    expect(useAuthStore.getState().endedByUser).toBe(false);
    useAuthStore.getState().clearSession({ byUser: true });
    useAuthStore.getState().setSession(SESSION);
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', endedByUser: false });
  });
});
