import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { t } from '@/app/i18n';
import { useCartStore } from '@/app/store/cartStore';
import { accountFixture, PENDING_ACCOUNT } from '@/test/fixtures';
import { apiError, core, json, server, signedIn } from '@/test/server';
import { plain } from '@/test/text';
import Store from '../Store';

const user = userEvent.setup();

function withCard(account = accountFixture()) {
  server.use(
    signedIn,
    http.get(core('/accounts/me'), () => json(account)),
  );
}

const grid = () => screen.findByRole('list', { name: t('store.pageTitle') });
const cartPanel = () => screen.getByRole('complementary', { name: t('store.cart.title') });

describe('Store island', () => {
  beforeEach(() => window.history.replaceState(null, '', '/app/store'));
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('pages the catalog 10 at a time (?page=), counts it, and Back returns to page 1', async () => {
    withCard();
    render(<Store locale="en-US" />);
    expect(within(await grid()).getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('Showing 1–10 of 12')).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: t('store.pagesLabel') });
    await user.click(within(nav).getByRole('button', { name: 'Page 2' }));
    expect(within(await grid()).getAllByRole('listitem')).toHaveLength(2);
    expect(window.location.search).toBe('?page=2');
    expect(screen.getByText('Showing 11–12 of 12')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t('store.productsTitle') })).toHaveFocus();
    window.history.back();
    expect(await screen.findByText('Showing 1–10 of 12')).toBeInTheDocument();
  });

  it('a filter change starts its results on page 1, and a page past the end shows the last page', async () => {
    window.history.replaceState(null, '', '/app/store?page=7');
    withCard();
    render(<Store locale="en-US" />);
    expect(within(await grid()).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Showing 11–12 of 12')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Electro Hub' }));
    expect(window.location.search).toBe('');
    expect(
      screen.queryByRole('navigation', { name: t('store.pagesLabel') }),
    ).not.toBeInTheDocument();
  });

  it('shows every product in the page language with its price, and what is available', async () => {
    withCard();
    render(<Store />);
    const products = within(await grid()).getAllByRole('listitem');
    // 12 products, 10 per page: the first page.
    expect(products).toHaveLength(10);
    expect(products[0]).toHaveTextContent('Orden de tacos al pastor');
    expect(plain(products[0]?.textContent)).toContain('USD 8.50');
    expect(plain(screen.getByText(t('store.available')).parentElement?.textContent)).toContain(
      'USD 340.00',
    );
  });

  it('shows each product illustration by SKU (16:10, eager only on the first row) and its category tile when it fails', async () => {
    withCard();
    render(<Store />);
    const products = within(await grid()).getAllByRole('listitem');
    const first = products[0] as HTMLElement;
    const image = within(first).getByRole('img', { name: 'Orden de tacos al pastor' });
    expect(image).toHaveAttribute('src', '/products/TAC-PASTOR.svg');
    expect(image).toHaveAttribute('width', '640');
    expect(image).toHaveAttribute('height', '400');
    expect(image).toHaveAttribute('loading', 'eager');
    expect(within(products[2] as HTMLElement).getByRole('img')).toHaveAttribute('loading', 'eager');
    expect(within(products[3] as HTMLElement).getByRole('img')).toHaveAttribute('loading', 'lazy');
    fireEvent.error(image);
    expect(within(first).queryByRole('img')).not.toBeInTheDocument();
    expect(within(first).getByTestId('product-fallback')).toBeInTheDocument();
  });

  it('filters by merchant and by category, with an empty state for a combination without products', async () => {
    withCard();
    render(<Store locale="en-US" />);
    await grid();
    await user.click(screen.getByRole('radio', { name: 'Electro Hub' }));
    expect(
      within(await grid())
        .getAllByRole('listitem')
        .map((item) => item.querySelector('h3')?.textContent),
    ).toEqual(['Wireless earbuds', '65 W fast charger', 'Portable speaker']);
    await user.click(screen.getByRole('radio', { name: 'Food' }));
    expect(screen.getByText(t('store.noProductsTitle'))).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'All merchants' }));
    expect(within(await grid()).getAllByRole('listitem')).toHaveLength(3);
  });

  it('adds to the cart, steps the quantity and totals it in the cart panel', async () => {
    withCard();
    render(<Store />);
    await grid();
    await user.click(
      screen.getByRole('button', { name: t('store.addLabel', { product: 'Agua de horchata' }) }),
    );
    await user.click(
      screen.getAllByRole('button', {
        name: t('store.increaseLabel', { product: 'Agua de horchata' }),
      })[0] as HTMLElement,
    );
    expect(useCartStore.getState().quantities).toEqual({ 'TAC-HORCH': 2 });
    const panel = cartPanel();
    expect(panel).toHaveTextContent(t('store.cart.fromMerchant', { merchant: 'Taquería El Sol' }));
    expect(plain(panel.textContent)).toContain('USD 7.00');
    expect(within(panel).getByRole('link', { name: t('store.cart.checkout') })).toHaveAttribute(
      'href',
      '/app/checkout',
    );
  });

  it('hands focus to the stepper after Add and back to Add after removing, and says so', async () => {
    withCard();
    render(<Store />);
    const products = await grid();
    const horchata = within(products).getByRole('button', {
      name: t('store.addLabel', { product: 'Agua de horchata' }),
    });
    await user.click(horchata);
    const card = within(products).getByRole('group', {
      name: t('store.quantityLabel', { product: 'Agua de horchata' }),
    });
    expect(
      within(card).getByRole('button', {
        name: t('store.increaseLabel', { product: 'Agua de horchata' }),
      }),
    ).toHaveFocus();
    expect(screen.getByText(t('store.added', { product: 'Agua de horchata' }))).toHaveAttribute(
      'aria-live',
      'polite',
    );
    await user.click(
      within(card).getByRole('button', {
        name: t('store.removeLabel', { product: 'Agua de horchata' }),
      }),
    );
    expect(
      within(products).getByRole('button', {
        name: t('store.addLabel', { product: 'Agua de horchata' }),
      }),
    ).toHaveFocus();
    expect(
      screen.getByText(t('store.removed', { product: 'Agua de horchata' })),
    ).toBeInTheDocument();
  });

  it('a filter change never moves focus back into the grid', async () => {
    withCard();
    render(<Store locale="en-US" />);
    await grid();
    await user.click(
      screen.getByRole('button', { name: t('store.addLabel', { product: 'Horchata' }) }),
    );
    const electro = screen.getByRole('radio', { name: 'Electro Hub' });
    await user.click(electro);
    await user.click(screen.getByRole('radio', { name: t('store.allMerchants') }));
    expect(
      within(await grid()).getByRole('button', {
        name: t('store.increaseLabel', { product: 'Horchata' }),
      }),
    ).not.toHaveFocus();
  });

  it('asks before switching merchants and keeps the cart when the customer says no', async () => {
    withCard();
    useCartStore.getState().add('TAC-PASTOR');
    render(<Store />);
    await grid();
    await user.click(
      screen.getByRole('button', { name: t('store.addLabel', { product: 'Bocina portátil' }) }),
    );
    const dialog = await screen.findByRole('dialog', { name: t('store.switch.title') });
    expect(dialog).toHaveTextContent(
      t('store.switch.body', {
        current: 'Taquería El Sol',
        next: 'Electro Hub',
        items: '1 artículo',
      }),
    );
    await user.click(within(dialog).getByRole('button', { name: t('store.switch.cancel') }));
    expect(useCartStore.getState()).toMatchObject({
      merchant: 'taqueria',
      quantities: { 'TAC-PASTOR': 1 },
    });
    await user.click(
      screen.getByRole('button', { name: t('store.addLabel', { product: 'Bocina portátil' }) }),
    );
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: t('store.switch.confirm'),
      }),
    );
    expect(useCartStore.getState()).toMatchObject({
      merchant: 'electro',
      quantities: { 'ELC-SPEAKER': 1 },
    });
  });

  it('removes a line at quantity 1 and empties the cart', async () => {
    withCard();
    useCartStore.getState().add('HOM-LAMP');
    render(<Store />);
    await grid();
    const panel = cartPanel();
    await user.click(
      within(panel).getByRole('button', {
        name: t('store.removeLabel', { product: 'Lámpara de escritorio' }),
      }),
    );
    expect(within(panel).getByText(t('store.cart.emptyTitle'))).toBeInTheDocument();
  });

  it('opens the cart sheet from the phone cart bar', async () => {
    withCard();
    useCartStore.getState().add('MKT-COFFEE');
    render(<Store />);
    await grid();
    await user.click(screen.getByRole('button', { name: /Ver carrito/ }));
    const sheet = await screen.findByRole('dialog', { name: t('store.cart.title') });
    expect(within(sheet).getByRole('link', { name: t('store.cart.checkout') })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: t('common.close') })).toBeInTheDocument();
  });

  it('without an active card points back to the wallet', async () => {
    withCard(PENDING_ACCOUNT);
    render(<Store />);
    expect(await screen.findByText(t('store.noCardTitle'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t('common.backToAccount') })).toHaveAttribute(
      'href',
      '/app',
    );
  });

  it('shows an error with retry when the account cannot load', async () => {
    server.use(
      signedIn,
      http.get(core('/accounts/me'), () => apiError(403, 'common.forbidden')),
    );
    render(<Store />);
    expect(await screen.findByText(t('account.loadFailedTitle'))).toBeInTheDocument();
  });
});
