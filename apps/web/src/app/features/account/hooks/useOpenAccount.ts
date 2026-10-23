import { useOpenAccountMutation } from '../mutations/useAccountMutations';

/** "Open my secured card": creates the account that then waits for its security deposit. */
export function useOpenAccount() {
  const mutation = useOpenAccountMutation();
  return { open: () => mutation.mutate(), isPending: mutation.isPending };
}
