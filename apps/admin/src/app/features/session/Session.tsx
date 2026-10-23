import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import SessionMenu from './components/SessionMenu';

// No types.ts: the session types come from @acme/contracts through the auth store.
// The page's Toaster lives in its main island (WA3); sonner shows this island's toasts there.
export default function Session({ locale }: IslandProps) {
  return (
    <AppProviders locale={locale}>
      <SessionMenu />
    </AppProviders>
  );
}
