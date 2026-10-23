import { AppButton } from '@acme/ui';
import { FormTextField } from '@/app/components/FormTextField';
import { AUTH_LIMITS } from '@/app/helpers/authFields';
import { t } from '@/app/i18n';
import { useSignInForm } from '../hooks/useSignInForm';

export default function SignInForm() {
  const form = useSignInForm();
  return (
    <form method="post" noValidate onSubmit={form.onSubmit} className="flex flex-col gap-5">
      <FormTextField
        control={form.control}
        name="email"
        type="email"
        label={t('auth.fields.email')}
        autoComplete="email"
        inputMode="email"
        maxLength={AUTH_LIMITS.EMAIL_MAX}
        isRequired
      />
      <FormTextField
        control={form.control}
        name="password"
        type="password"
        label={t('auth.fields.password')}
        autoComplete="current-password"
        maxLength={AUTH_LIMITS.PASSWORD_MAX}
        isRequired
      />
      <AppButton
        type="submit"
        fullWidth
        isPending={form.isPending}
        pendingLabel={t('auth.signIn.submitting')}
      >
        {t('auth.signIn.submit')}
      </AppButton>
      {form.fillDemo && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-4">
          <AppButton variant="secondary" fullWidth onPress={form.fillDemo}>
            {t('auth.signIn.demo')}
          </AppButton>
          <p className="text-center text-caption text-muted">{t('auth.signIn.demoHint')}</p>
        </div>
      )}
    </form>
  );
}
