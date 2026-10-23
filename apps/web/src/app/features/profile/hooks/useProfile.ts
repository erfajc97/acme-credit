import { tourReplayHref } from '@/app/helpers/navigation';
import { useDisclosure } from '@/app/hooks/useDisclosure';
import { useAuthStore } from '@/app/store/authStore';
import { useAccountQuery } from '@/app/tanstack-queries/accountQuery';
import { useSignOutMutation } from '../mutations/useProfileMutations';

/** Profile: who is signed in, sign out, and closing the account (only while one is open). */
export function useProfile() {
  const user = useAuthStore((state) => state.user);
  const account = useAccountQuery();
  const signOutMutation = useSignOutMutation();
  const closeDialog = useDisclosure();
  const data = account.data ?? null;
  const closable = data && (data.status === 'ACTIVE' || data.status === 'FROZEN') ? data : null;

  return {
    name: user?.fullName ?? '',
    email: user?.email ?? '',
    tourHref: tourReplayHref(),
    signOut: () => signOutMutation.mutate(),
    isSigningOut: signOutMutation.isPending || signOutMutation.isSuccess,
    account: {
      isLoading: account.isLoading,
      isError: account.isError,
      // refetch never rejects: a failure lands in the query state, shown by the error branch.
      retry: () => void account.refetch(),
      isRetrying: account.isFetching,
      closable,
    },
    closeDialog,
  };
}
