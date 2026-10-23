import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { DEFAULT_LOCALE, setActiveLocale, t, type Locale } from '@/app/i18n';
import { queryClient } from '@/app/lib/queryClient';

/** Props every island root accepts. */
export interface IslandProps {
  /** The page's locale (from the URL, Astro i18n routing); the island renders in it. */
  locale?: Locale | undefined;
  /** Exactly one island per page hosts the Toaster (WA3): the page's main island. */
  withToaster?: boolean;
}

interface AppProvidersProps extends IslandProps {
  children: ReactNode;
}

/**
 * Wraps every island root (WA3): islands are separate React trees, so each mounts the providers;
 * all share the module-level QueryClient. The page's locale is set before the children render, so
 * every string, amount and date of the island is in the page's language. Toasts are unstyled by
 * sonner and painted with token classes only (W8).
 */
export default function AppProviders({
  children,
  locale = DEFAULT_LOCALE,
  withToaster = false,
}: AppProvidersProps) {
  setActiveLocale(locale);
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {withToaster && (
        <Toaster
          position="bottom-right"
          containerAriaLabel={t('a11y.notifications')}
          toastOptions={{
            unstyled: true,
            classNames: {
              toast:
                'flex w-full items-start gap-3 rounded-card border-[1.6px] border-ink bg-surface-raised p-4 text-small text-fg shadow-overlay',
              error: 'bg-surface-raised text-danger',
              success: 'bg-mint',
              warning: 'bg-cream',
              title: 'font-semibold',
            },
          }}
        />
      )}
    </QueryClientProvider>
  );
}
