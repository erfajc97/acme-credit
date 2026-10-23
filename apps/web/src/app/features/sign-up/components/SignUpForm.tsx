import { AppButton } from '@acme/ui';
import { FormTextField } from '@/app/components/FormTextField';
import { AUTH_LIMITS } from '@/app/helpers/authFields';
import { t } from '@/app/i18n';
import { useSignUpForm } from '../hooks/useSignUpForm';

export default function SignUpForm() {
  const form = useSignUpForm();
  return (
    <form method="post" noValidate onSubmit={form.onSubmit} className="flex flex-col gap-5">
      <FormTextField
        control={form.control}
        name="fullName"
        label={t('auth.fields.fullName')}
        autoComplete="name"
        maxLength={AUTH_LIMITS.NAME_MAX}
        isRequired
      />
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
        label={t('auth.fields.newPassword')}
        description={t('auth.fields.newPasswordHint', { min: AUTH_LIMITS.PASSWORD_MIN })}
        autoComplete="new-password"
        maxLength={AUTH_LIMITS.PASSWORD_MAX}
        isRequired
      />
      <AppButton
        type="submit"
        fullWidth
        isDisabled={!form.isReady}
        isPending={form.isPending}
        pendingLabel={t('auth.signUp.submitting')}
      >
        {t('auth.signUp.submit')}
      </AppButton>
      {form.canFillDemo && (
        <div className="border-t border-border pt-4">
          <AppButton
            variant="secondary"
            fullWidth
            isDisabled={!form.isReady}
            onPress={form.fillDemo}
          >
            {t('auth.signUp.demo')}
          </AppButton>
        </div>
      )}
    </form>
  );
}
