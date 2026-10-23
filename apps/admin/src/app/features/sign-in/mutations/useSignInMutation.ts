import { useMutation } from '@tanstack/react-query';
import { toastApiError } from '@/app/helpers/toastApiError';
import { requestTourAfterSignIn } from '@/app/helpers/tourTrigger';
import { useAuthStore } from '@/app/store/authStore';
import { signIn } from '../services/signInService';

export function useSignInMutation() {
  return useMutation({
    mutationFn: signIn,
    onSuccess: (session) => {
      // Every successful sign-in opens the product tour once (helpers/tourTrigger).
      requestTourAfterSignIn(window.sessionStorage);
      useAuthStore.getState().setSession(session);
    },
    onError: (error) => toastApiError(error, 'auth.signIn.failed'),
  });
}
