import { navigateTo } from '@/app/helpers/navigation';
import { localHref, SIGN_IN_PATH } from '@/app/lib/endpoints';
import { useAuthStore } from '@/app/store/authStore';
import { useTourStore } from '@/app/store/tourStore';
import { useSignOutMutation } from '../mutations/useSignOutMutation';

/** The console's session area: who is signed in, the tour replay and the sign-out action. */
export function useSessionMenu() {
  const user = useAuthStore((state) => state.user);
  const mutation = useSignOutMutation();
  const signOut = () =>
    mutation.mutate(undefined, { onSuccess: () => navigateTo(localHref(SIGN_IN_PATH)) });
  return {
    isVisible: user !== null,
    userName: user?.fullName ?? '',
    userEmail: user?.email ?? '',
    signOut,
    // Replays the product tour from its first step, wherever the admin is (features/tour).
    startTour: () => useTourStore.getState().start(),
    isPending: mutation.isPending || mutation.isSuccess,
  };
}
