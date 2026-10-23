import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { setActiveLocale, t } from '@/app/i18n';
import { navigateTo } from '@/app/helpers/navigation';
import { requestTourAfterSignIn, TOUR_PENDING_KEY } from '@/app/helpers/tourTrigger';
import { SPOTLIGHT_PADDING, TALL_TARGET_SHARE, TOUR_STEPS } from '../data';
import ProductTour from '../ProductTour';

vi.mock('@/app/helpers/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/helpers/navigation')>()),
  navigateTo: vi.fn(),
}));

const user = userEvent.setup();

/** The home's figures (rendered by the Account island in the app) the tour waits for. */
function renderHomeFigures() {
  const figures = document.createElement('section');
  figures.dataset.tour = 'available';
  figures.textContent = 'available';
  document.body.append(figures);
  return figures;
}

class NoopResizeObserver {
  observe() {}
  disconnect() {}
}

describe('ProductTour (first-login wallet tour)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Every case starts right after a sign-in unless it says otherwise.
    requestTourAfterSignIn(() => sessionStorage);
    window.history.replaceState(null, '', '/en/app');
    vi.stubGlobal('ResizeObserver', NoopResizeObserver);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vi.mocked(navigateTo).mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    // Unmount the islands first: React still owns its containers and the tour's portal.
    cleanup();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    setActiveLocale('es-MX');
  });

  const dialog = () => screen.findByRole('dialog', { name: t(TOUR_STEPS[0]?.title ?? '') });

  it('waits for the home figures, then greets with Credi and takes the sign-in request', async () => {
    render(<ProductTour locale="en-US" />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    act(() => {
      renderHomeFigures();
    });
    const welcome = await dialog();
    expect(within(welcome).getByText(t('tour.welcomeBody'))).toBeInTheDocument();
    expect(within(welcome).getByTestId('tour-progress')).toHaveTextContent(
      t('tour.progress', { current: 1, total: TOUR_STEPS.length }),
    );
    expect(sessionStorage.getItem(TOUR_PENDING_KEY)).toBeNull();
    // The first step's main action has focus (WAI-ARIA dialog) and there is no "Back".
    expect(within(welcome).getByRole('button', { name: t('tour.next') })).toHaveFocus();
    expect(within(welcome).queryByRole('button', { name: t('tour.back') })).not.toBeInTheDocument();
  });

  it('starts after every sign-in (the demo account is shared), never on a reload of the same login', async () => {
    renderHomeFigures();
    const first = render(<ProductTour locale="en-US" />);
    expect(await dialog()).toBeInTheDocument();
    first.unmount();
    // A reload, a ClientRouter visit or a session restored by the refresh cookie: no request.
    const reload = render(<ProductTour locale="en-US" />);
    await act(async () => undefined);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    reload.unmount();
    // Signed out, then signed in again (the next reviewer): the sign-in asks again.
    requestTourAfterSignIn(() => sessionStorage);
    render(<ProductTour locale="en-US" />);
    expect(await dialog()).toBeInTheDocument();
  });

  it('the E2E bypass (sessionStorage acme-tour-skip) keeps it closed', async () => {
    sessionStorage.setItem('acme-tour-skip', '1');
    renderHomeFigures();
    render(<ProductTour locale="en-US" />);
    await act(async () => undefined);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('replays with ?tour=1 without a sign-in (Profile › tutorial), and leaves the URL', async () => {
    sessionStorage.clear();
    renderHomeFigures();

    window.history.replaceState(null, '', '/en/app?tour=1#top');
    render(<ProductTour locale="en-US" />);
    expect(await dialog()).toBeInTheDocument();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/en/app#top',
    );
  });

  it('walks every step with Next and Back, then ends with Credi celebrating', async () => {
    renderHomeFigures();
    render(<ProductTour locale="en-US" />);
    await dialog();
    await user.click(screen.getByRole('button', { name: t('tour.next') }));
    expect(screen.getByRole('dialog', { name: t('tour.cardTitle') })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t('tour.back') }));
    expect(screen.getByRole('dialog', { name: t('tour.welcomeTitle') })).toBeInTheDocument();
    for (let step = 1; step < TOUR_STEPS.length; step += 1) {
      await user.click(screen.getByRole('button', { name: t('tour.next') }));
    }
    const end = screen.getByRole('dialog', { name: t('tour.doneTitle') });
    expect(within(end).queryByRole('button', { name: t('tour.skip') })).not.toBeInTheDocument();
    expect(end.parentElement?.querySelector('img[data-pose="celebrate"]')).not.toBeNull();
    await user.click(within(end).getByRole('button', { name: t('tour.done') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('the keyboard drives it: → next, ← back, Esc leaves', async () => {
    renderHomeFigures();
    render(<ProductTour locale="en-US" />);
    await dialog();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('dialog', { name: t('tour.cardTitle') })).toBeInTheDocument();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('dialog', { name: t('tour.welcomeTitle') })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Tab stays inside the dialog (it is modal)', async () => {
    renderHomeFigures();
    render(<ProductTour locale="en-US" />);
    const welcome = await dialog();
    const skip = within(welcome).getByRole('button', { name: t('tour.skip') });
    const next = within(welcome).getByRole('button', { name: t('tour.next') });
    await user.tab();
    expect(skip).toHaveFocus();
    await user.tab({ shift: true });
    expect(next).toHaveFocus();
  });

  it('"Skip" leaves at once and the page gets its focus back', async () => {
    const trigger = document.createElement('a');
    trigger.href = '#x';
    document.body.append(trigger);
    trigger.focus();
    renderHomeFigures();
    render(<ProductTour locale="en-US" />);
    await user.click(within(await dialog()).getByRole('button', { name: t('tour.skip') }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('a press on the dimmed page does nothing', async () => {
    renderHomeFigures();
    render(<ProductTour locale="en-US" />);
    await dialog();
    await user.click(screen.getByTestId('tour'));
    expect(screen.getByRole('dialog', { name: t('tour.welcomeTitle') })).toBeInTheDocument();
  });

  it('a step whose target is on screen gets the outlined spotlight; the intro has none', async () => {
    const figures = renderHomeFigures();
    figures.getBoundingClientRect = () =>
      ({ top: 100, left: 100, width: 300, height: 120 }) as DOMRect;
    render(<ProductTour locale="en-US" />);
    await dialog();
    expect(screen.getByTestId('tour-spotlight')).not.toHaveAttribute('data-target');
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('dialog', { name: t('tour.availableTitle') })).toBeInTheDocument();
    expect(screen.getByTestId('tour-spotlight')).toHaveAttribute('data-target');
  });

  it('a step on another page opens it through the ClientRouter, then spotlights its section in the middle of the screen', async () => {
    renderHomeFigures();
    render(<ProductTour locale="en-US" />);
    await dialog();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(navigateTo).not.toHaveBeenCalled();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('dialog', { name: t('tour.storeTitle') })).toBeInTheDocument();
    expect(navigateTo).toHaveBeenCalledWith('/en/app/store');
    expect(screen.getByTestId('tour-spotlight')).not.toHaveAttribute('data-target');
    // The store page arrives (the ClientRouter swap, then its island renders the grid).
    const products = document.createElement('ul');
    products.dataset.tour = 'store-products';
    products.getBoundingClientRect = () =>
      ({ top: 300, left: 40, width: 600, height: 400 }) as DOMRect;
    act(() => {
      document.body.append(products);
    });
    await waitFor(() =>
      expect(screen.getByTestId('tour-spotlight')).toHaveAttribute('data-target'),
    );
    expect(products.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('a section taller than the screen share is shown from its top and framed only down to it', async () => {
    renderHomeFigures();
    render(<ProductTour locale="en-US" />);
    await dialog();
    const orders = document.createElement('section');
    orders.dataset.tour = 'activity-orders';
    orders.getBoundingClientRect = () =>
      ({ top: 100, left: 20, width: 500, height: 2000 }) as DOMRect;
    document.body.append(orders);
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('dialog', { name: t('tour.activityTitle') })).toBeInTheDocument();
    expect(orders.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    const spotlight = screen.getByTestId('tour-spotlight');
    // jsdom's screen is 768 px tall: 55 % of it plus the padding on both sides.
    expect(parseFloat(spotlight.style.height)).toBeCloseTo(
      768 * TALL_TARGET_SHARE + 2 * SPOTLIGHT_PADDING,
    );
  });
});
