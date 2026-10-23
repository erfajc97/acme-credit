import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { navigateTo } from '@/app/helpers/navigation';
import { requestTourAfterSignIn, TOUR_SKIP_KEY } from '@/app/helpers/tourTrigger';
import { setActiveLocale, t } from '@/app/i18n';
import { useAuthStore } from '@/app/store/authStore';
import { useTourStore } from '@/app/store/tourStore';
import { SESSION } from '@/test/fixtures';
import Tour from '../Tour';
import { TOUR_STEPS } from '../data';

vi.mock('@/app/helpers/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/helpers/navigation')>()),
  navigateTo: vi.fn(),
}));

const user = userEvent.setup();

/** jsdom has no layout engine: sizes are observed by a no-op, positions come from each section. */
class NoLayoutResizeObserver {
  observe() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
}

/** A section of the page at a known place on screen (viewport pixels). */
function putSection(id: string, box = { top: 120, left: 280, width: 900, height: 300 }) {
  const section = document.createElement('section');
  section.dataset.tour = id;
  section.textContent = id;
  section.getBoundingClientRect = () =>
    ({ ...box, right: box.left + box.width, bottom: box.top + box.height }) as DOMRect;
  document.body.prepend(section);
  return section;
}

/** What the ClientRouter does on navigateTo: the address changes and the next page swaps in. */
function swapTo(path: string, sectionId: string) {
  window.history.replaceState(null, '', path);
  for (const old of document.querySelectorAll('section[data-tour]')) old.remove();
  putSection(sectionId);
}

const cutout = () => screen.queryByTestId('tour-cutout');

beforeEach(() => {
  setActiveLocale('en-US');
  useTourStore.getState().close();
  vi.mocked(navigateTo).mockReset();
  window.ResizeObserver = NoLayoutResizeObserver as unknown as typeof ResizeObserver;
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  window.innerHeight = 900;
  Object.defineProperty(document.documentElement, 'clientWidth', {
    value: 1440,
    configurable: true,
  });
  document.body.innerHTML = '';
});

function mountTour(path = '/en/dashboard') {
  window.history.replaceState(null, '', path);
  return render(<Tour locale="en-US" />, {
    container: document.body.appendChild(document.createElement('div')),
  });
}

const signIn = () => act(() => useAuthStore.getState().setSession(SESSION));

describe('Tour island: when it opens', () => {
  it('opens after a sign-in, on the figures, spotlit with a cut-out and the card beside them', async () => {
    putSection('kpis');
    requestTourAfterSignIn(window.sessionStorage);
    mountTour();
    signIn();
    const card = await screen.findByRole('dialog', { name: t('tour.steps.kpis.title') });
    expect(card).toHaveTextContent(t('tour.progress', { current: 1, total: 5 }));
    await vi.waitFor(() => expect(cutout()).not.toBeNull());
    expect(cutout()).toHaveStyle({ top: '112px', left: '272px', width: '916px', height: '316px' });
    // The section comes into view at the top of the screen.
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 120 - 24, behavior: 'auto' });
    // Already on the dashboard: no navigation.
    expect(navigateTo).not.toHaveBeenCalled();
  });

  it('a reload (no sign-in) or a session restored by the refresh cookie opens nothing', () => {
    putSection('kpis');
    mountTour();
    signIn();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens once per sign-in: a remount after it (a reload) stays closed, the next sign-in opens it again', async () => {
    putSection('kpis');
    requestTourAfterSignIn(window.sessionStorage);
    const first = mountTour();
    signIn();
    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: t('tour.skip') }));
    first.unmount();
    act(() => useAuthStore.getState().clearSession());

    const reload = mountTour();
    signIn();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    reload.unmount();
    act(() => useAuthStore.getState().clearSession());

    requestTourAfterSignIn(window.sessionStorage);
    mountTour();
    signIn();
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('the E2E bypass keeps it closed after a sign-in', () => {
    window.sessionStorage.setItem(TOUR_SKIP_KEY, '1');
    requestTourAfterSignIn(window.sessionStorage);
    mountTour();
    signIn();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows nothing before the session is known, even when asked', () => {
    requestTourAfterSignIn(window.sessionStorage);
    mountTour();
    act(() => useTourStore.getState().start());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('"Take the tour" from another page opens step 1 and goes to the dashboard', async () => {
    putSection('accounts');
    mountTour('/en/accounts');
    signIn();
    act(() => useTourStore.getState().start());
    expect(
      await screen.findByRole('dialog', { name: t('tour.steps.kpis.title') }),
    ).toBeInTheDocument();
    expect(navigateTo).toHaveBeenCalledWith('/en/dashboard');
  });
});

describe('Tour island: each step opens and spotlights its section', () => {
  it('walks dashboard → purchases → accounts → payouts → audit log, then closes', async () => {
    putSection('kpis');
    mountTour();
    signIn();
    act(() => useTourStore.getState().start());
    await screen.findByRole('dialog', { name: t('tour.steps.kpis.title') });
    const pages = [
      ['/en/purchases', 'purchases'],
      ['/en/accounts', 'accounts'],
      ['/en/payouts', 'payouts'],
      ['/en/audit-log', 'auditLog'],
    ] as const;
    for (const [index, [path, id]] of pages.entries()) {
      await user.click(screen.getByRole('button', { name: t('tour.next') }));
      expect(navigateTo).toHaveBeenLastCalledWith(path);
      // While the next page swaps in, the whole page is dimmed and there is no cut-out.
      expect(cutout()).toBeNull();
      act(() => swapTo(path, id));
      await vi.waitFor(() => expect(cutout()).not.toBeNull());
      expect(
        screen.getByRole('dialog', { name: t(`tour.steps.${TOUR_STEPS[index + 1]?.id}.title`) }),
      ).toBeInTheDocument();
    }
    await user.click(screen.getByRole('button', { name: t('tour.back') }));
    expect(navigateTo).toHaveBeenLastCalledWith('/en/payouts');
    await user.click(screen.getByRole('button', { name: t('tour.next') }));
    await user.click(screen.getByRole('button', { name: t('tour.finish') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cutout()).toBeNull();
  });

  it('recomputes the cut-out when the page scrolls', async () => {
    const section = putSection('kpis');
    mountTour();
    signIn();
    act(() => useTourStore.getState().start());
    await vi.waitFor(() => expect(cutout()).toHaveStyle({ top: '112px' }));
    section.getBoundingClientRect = () =>
      ({ top: 20, left: 280, width: 900, height: 300, right: 1180, bottom: 320 }) as DOMRect;
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await vi.waitFor(() => expect(cutout()).toHaveStyle({ top: '12px' }));
  });

  it('Esc skips the tour from anywhere', async () => {
    putSection('kpis');
    mountTour();
    signIn();
    act(() => useTourStore.getState().start());
    const card = await screen.findByRole('dialog');
    expect(within(card).queryByRole('button', { name: t('tour.back') })).not.toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(useTourStore.getState().index).toBeNull();
  });
});
