import { useMutation } from '@tanstack/react-query';
import { toastApiError } from '@/app/helpers/toastApiError';
import { requestTourAfterSignIn } from '@/app/helpers/tourTrigger';
import { useAuthStore } from '@/app/store/authStore';
import { signUp } from '../services/signUpService';

export function useSignUpMutation() {
  return useMutation({
    mutationFn: signUp,
    onSuccess: (session) => {
      // Every sign-in shows the wallet tour once (owner: the demo account is shared by reviewers).
      requestTourAfterSignIn(() => window.sessionStorage);
      useAuthStore.getState().setSession(session);
    },
    onError: (error) => toastApiError(error, 'auth.signUp.failed'),
  });
}
