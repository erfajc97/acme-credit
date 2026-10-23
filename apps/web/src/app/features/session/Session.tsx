import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import SessionChip from './components/SessionChip';

// No services/, mutations/ or types.ts: it only reads the in-memory session (auth store); signing
// out lives in the profile feature.
// The page's Toaster lives in its main island (WA3).
export default function Session({ locale }: Pick<IslandProps, 'locale'>) {
  return (
    <AppProviders locale={locale}>
      <SessionChip />
    </AppProviders>
  );
}
