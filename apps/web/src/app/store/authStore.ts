import type { Session, User } from '@acme/contracts';
import { create } from 'zustand';

/** `unknown` until the session bootstrap answers: gated islands show their skeleton meanwhile. */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  status: SessionStatus;
  /**
   * The customer signed out (vs. a session that expired): the gate then sends them to sign in
   * without a "way back" to the private page they left on purpose.
   */
  endedByUser: boolean;
  setSession: (session: Session) => void;
  clearSession: (options?: { byUser?: boolean }) => void;
}

/**
 * Session state shared by every island (WA3). Memory only (W14): no `persist`, nothing in
 * localStorage or sessionStorage. The refresh token is the API's httpOnly cookie; after a reload
 * the session comes back through the bootstrap refresh. With the ClientRouter the module (and so
 * the session) survives in-app navigation. The initial state is the same on server and client,
 * so reading it in a first render never causes a hydration mismatch (WA2).
 */
export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  status: 'unknown',
  endedByUser: false,
  setSession: ({ accessToken, user }) =>
    set({ accessToken, user, status: 'authenticated', endedByUser: false }),
  // A later 401 of the bootstrap must not turn a sign-out back into an expired session.
  clearSession: (options) =>
    set((state) => ({
      accessToken: null,
      user: null,
      status: 'anonymous',
      endedByUser: options?.byUser ?? (state.status === 'anonymous' && state.endedByUser),
    })),
}));
