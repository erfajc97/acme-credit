import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toastApiError } from '@/app/helpers/toastApiError';
import { useAuthStore } from '@/app/store/authStore';
import { signOut } from '../services/sessionService';

export function useSignOutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      useAuthStore.getState().clearSession();
      // Drop every cached private response before leaving (nothing of this admin stays).
      queryClient.clear();
    },
    onError: (error) => toastApiError(error, 'session.signOutFailed'),
  });
}
