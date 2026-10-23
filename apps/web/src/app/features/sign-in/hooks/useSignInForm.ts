import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { env } from '@/app/config/env';
import { currentSearchParam, localHref, navigateTo } from '@/app/helpers/navigation';
import { safeReturnTo } from '@/app/helpers/safeReturnTo';
import { useHydrated } from '@/app/hooks/useHydrated';
import { APP_HOME_PATH } from '@/app/lib/endpoints';
import { useSignInMutation } from '../mutations/useSignInMutation';
import { signInSchema, type SignInInput, type SignInValues } from '../schema';

/**
 * Sign-in form: validates like the API, signs in, then goes back where the customer came from.
 * In demo mode it can fill the seeded demo customer; the customer still presses "Sign in".
 */
export function useSignInForm() {
  const form = useForm<SignInInput, unknown, SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const mutation = useSignInMutation();
  const isReady = useHydrated();

  const onSubmit = form.handleSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: () =>
        navigateTo(safeReturnTo(currentSearchParam('returnTo'), localHref(APP_HOME_PATH))),
    });
  });

  const demo = env.demo.login;
  const fillDemo = demo
    ? () => {
        form.setValue('email', demo.email, { shouldDirty: true });
        form.setValue('password', demo.password, { shouldDirty: true });
        form.clearErrors();
      }
    : null;

  return {
    control: form.control,
    onSubmit,
    isPending: mutation.isPending || mutation.isSuccess,
    isReady,
    /** Null when this build has no demo login: the button is not rendered. */
    fillDemo,
  };
}
