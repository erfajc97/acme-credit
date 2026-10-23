import type { Session, User } from '@acme/contracts';
import { create } from 'zustand';

/** `unknown` until the session bootstrap answers: gated islands show their skeleton meanwhile. */
export type SessionStatus = 'unknown' | 'authenticated' | 'anonymous';

interface AuthState {
  accessToken: string | null;
  user: User | null;
  status: SessionStatus;
  setSession: (session: Session) => void;
  clearSession: () => void;
}

/**
 * Session state shared by every island (WA3). Memory only (W14): no `persist`, nothing in
 * localStorage or sessionStorage. The refresh token is the API's httpOnly cookie; after a reload
 * the session comes back through the bootstrap refresh. The initial state is the same on server
 * and client, so reading it in a first render never causes a hydration mismatch (WA2).
 */
export const useAuthStore = create<AuthState>()((set) => ({
  accessToken: null,
  user: null,
  status: 'unknown',
  setSession: ({ accessToken, user }) => set({ accessToken, user, status: 'authenticated' }),
  clearSession: () => set({ accessToken: null, user: null, status: 'anonymous' }),
}));
