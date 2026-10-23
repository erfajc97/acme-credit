import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { server } from './src/test/server';

// The first island a worker renders compiles HeroUI and the app on the fly; under the parallel
// coverage run that can take longer than RTL's 1 s default for findBy/waitFor. What is asserted
// does not change, only how long a cold start may take to show it.
configure({ asyncUtilTimeout: 5000 });

// jsdom has no layout: scrolling a list back to its top after a page change is a no-op here.
Element.prototype.scrollIntoView = () => undefined;

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));

afterEach(async () => {
  cleanup();
  server.resetHandlers();
  // Islands share the page's QueryClient singleton and the in-memory session: reset both, the
  // stored idempotency keys and list memories, and the address, so no test sees another's state.
  // Imported here (not at the top) so a test file's vi.mock of an app module still applies.
  const [{ queryClient }, { useAuthStore }, { toast }, { setActiveLocale, DEFAULT_LOCALE }] =
    await Promise.all([
      import('./src/app/lib/queryClient'),
      import('./src/app/store/authStore'),
      import('sonner'),
      import('./src/app/i18n'),
    ]);
  // sonner keeps its toasts in a module store that outlives the unmounted Toaster.
  toast.dismiss();
  queryClient.clear();
  useAuthStore.setState({ accessToken: null, user: null, status: 'unknown' });
  setActiveLocale(DEFAULT_LOCALE);
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
});

afterAll(() => server.close());
