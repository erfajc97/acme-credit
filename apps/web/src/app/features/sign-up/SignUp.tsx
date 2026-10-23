import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import SignUpForm from './components/SignUpForm';

// No types.ts: the form's types live in schema.ts (z.input / z.output).
export default function SignUp({ locale }: Pick<IslandProps, 'locale'>) {
  return (
    <AppProviders locale={locale} withToaster>
      <SignUpForm />
    </AppProviders>
  );
}
