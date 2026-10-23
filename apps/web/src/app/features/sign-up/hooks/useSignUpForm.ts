import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { env } from '@/app/config/env';
import { localHref, navigateTo } from '@/app/helpers/navigation';
import { translateError } from '@/app/helpers/translateError';
import { useHydrated } from '@/app/hooks/useHydrated';
import { t } from '@/app/i18n';
import { getApiErrorCode } from '@/app/lib/apiClient';
import { APP_HOME_PATH } from '@/app/lib/endpoints';
import { demoSignUpValues } from '../helpers/demoValues';
import { useSignUpMutation } from '../mutations/useSignUpMutation';
import { signUpSchema, type SignUpInput, type SignUpValues } from '../schema';

/**
 * Sign-up form: validates like the API; a taken email is marked on its field (W6, W11). In demo
 * mode it can fill unique test data; the customer still presses "Create account".
 */
export function useSignUpForm() {
  const form = useForm<SignUpInput, unknown, SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });
  const mutation = useSignUpMutation();
  const isReady = useHydrated();

  const onSubmit = form.handleSubmit((values) => {
    mutation.mutate(values, {
      onSuccess: () => navigateTo(localHref(APP_HOME_PATH)),
      onError: (error) => {
        if (getApiErrorCode(error) === 'auth.email_taken') {
          form.setError(
            'email',
            { message: translateError('auth.email_taken') },
            { shouldFocus: true },
          );
        }
      },
    });
  });

  const fillDemo = () => {
    const values = demoSignUpValues(Date.now(), t('auth.signUp.demoName'));
    form.setValue('fullName', values.fullName, { shouldDirty: true });
    form.setValue('email', values.email, { shouldDirty: true });
    form.setValue('password', values.password, { shouldDirty: true });
    form.clearErrors();
  };

  return {
    control: form.control,
    onSubmit,
    isPending: mutation.isPending || mutation.isSuccess,
    isReady,
    canFillDemo: env.demo.enabled,
    fillDemo,
  };
}
