import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import SignInForm from './components/SignInForm';

// No types.ts: the form's types live in schema.ts (z.input / z.output).
export default function SignIn({ locale }: IslandProps) {
  return (
    <AppProviders locale={locale} withToaster>
      <SignInForm />
    </AppProviders>
  );
}
