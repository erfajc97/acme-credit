import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { env } from '@/app/config/env';
import { currentSearchParam, navigateTo } from '@/app/helpers/navigation';
import { safeReturnTo } from '@/app/helpers/safeReturnTo';
import { useSignInMutation } from '../mutations/useSignInMutation';
import { signInSchema, type SignInInput, type SignInValues } from '../schema';

/**
 * Sign-in form: validates like the API, signs in, then goes back where the admin came from. In
 * demo mode it can fill the seeded demo admin; the admin still presses "Sign in" (never automatic).
 */
export function useSignInForm() {
  const form = useForm<SignInInput, unknown, SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const mutation = useSignInMutation();

  const onSubmit = form.handleSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: () => navigateTo(safeReturnTo(currentSearchParam('returnTo'))),
    });
  });

  const demo = env.demoLogin;
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
    /** Null when this build has no demo login: the button is not rendered. */
    fillDemo,
  };
}
