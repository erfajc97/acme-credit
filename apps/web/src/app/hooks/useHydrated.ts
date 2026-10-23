import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/**
 * False in the server HTML and during hydration, true once React owns the island (WA2 mount gate,
 * no effect). A form rendered with client:load disables its buttons until then, so a press before
 * hydration never falls through to a native POST that would lose what the customer typed.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
