import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppSheet } from '../AppSheet';
import { fullButtonClass } from '../buttonStyles';
import { Panel } from '../Panel';
import { PaymentCard } from '../PaymentCard';
import { QuantityStepper } from '../QuantityStepper';
import { SafeImage } from '../SafeImage';

const user = userEvent.setup();

function stepper(value: number, extra: Partial<Parameters<typeof QuantityStepper>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <QuantityStepper
      label="Quantity of Horchata"
      value={value}
      max={20}
      onChange={onChange}
      decreaseLabel="One less"
      increaseLabel="One more"
      {...extra}
    />,
  );
  return { onChange, group: screen.getByRole('group', { name: 'Quantity of Horchata' }) };
}

describe('QuantityStepper (1..20)', () => {
  it('steps by one inside the range and shows the value', async () => {
    const { onChange, group } = stepper(5);
    expect(group).toHaveTextContent('5');
    await user.click(within(group).getByRole('button', { name: 'One more' }));
    await user.click(within(group).getByRole('button', { name: 'One less' }));
    expect(onChange.mock.calls).toEqual([[6], [4]]);
  });

  it('stops at the cap: 19 can grow, 20 cannot', async () => {
    const { onChange } = stepper(19);
    await user.click(screen.getByRole('button', { name: 'One more' }));
    expect(onChange).toHaveBeenCalledWith(20);
    cleanup();
    stepper(20);
    expect(screen.getByRole('button', { name: 'One more' })).toBeDisabled();
  });

  it('at the minimum, "−" is disabled unless it removes the item', async () => {
    stepper(1);
    expect(screen.getByRole('button', { name: 'One less' })).toBeDisabled();
    cleanup();
    const onRemove = vi.fn();
    const { onChange } = stepper(1, { onRemove, removeLabel: 'Remove Horchata' });
    await user.click(screen.getByRole('button', { name: 'Remove Horchata' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('falls back to the decrease name when no remove name is given', () => {
    stepper(1, { onRemove: vi.fn() });
    expect(screen.getByRole('button', { name: 'One less' })).toBeEnabled();
  });
});

describe('AppSheet', () => {
  it('is a named dialog with its body and footer while open', () => {
    render(
      <AppSheet
        isOpen
        onOpenChange={vi.fn()}
        title="Your cart"
        footer={<a href="/checkout">Checkout</a>}
      >
        <p>2 items</p>
      </AppSheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Your cart' });
    expect(dialog).toHaveTextContent('2 items');
    expect(within(dialog).getByRole('link', { name: 'Checkout' })).toBeInTheDocument();
  });

  it('renders nothing while closed', () => {
    render(
      <AppSheet isOpen={false} onOpenChange={vi.fn()} title="Your cart" placement="right">
        <p>2 items</p>
      </AppSheet>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('brand surfaces', () => {
  it.each([
    ['raised', 'shadow-raised'],
    ['cream', 'bg-cream'],
    ['lavender', 'bg-lavender'],
    ['mint', 'bg-mint'],
  ] as const)('Panel tone %s → %s', (tone, className) => {
    render(
      <Panel labelledBy="t" tone={tone}>
        <h2 id="t">Band</h2>
      </Panel>,
    );
    expect(screen.getByRole('region', { name: 'Band' })).toHaveClass(className);
  });

  it('a frozen PaymentCard is desaturated and says so with its chip', () => {
    const { container } = render(
      <PaymentCard
        brandName="Acme Credit"
        last4="4242"
        numberLabel="Card ending in 4242"
        expiryLabel="Expires"
        expiry="08/29"
        badge={<span>Frozen</span>}
        isFrozen
        size="compact"
      />,
    );
    expect(container.firstElementChild).toHaveAttribute('data-frozen', 'true');
    // The face is desaturated; the chip on top keeps its color (a word, never color alone).
    expect(container.querySelector('[data-card-face]')).toHaveClass('grayscale');
    expect(screen.getByText('Frozen').closest('[data-card-face]')).toBeNull();
    expect(screen.getByText('Frozen')).toBeInTheDocument();
  });

  it('primary buttons carry the press edge; secondary is the outlined pill', () => {
    expect(fullButtonClass()).toContain('shadow-press');
    expect(fullButtonClass({ variant: 'secondary', size: 'compact' })).toContain('border-ink');
    expect(fullButtonClass({ variant: 'secondary', size: 'compact' })).toContain('h-11');
  });
});

describe('SafeImage', () => {
  const image = (loading?: 'eager' | 'lazy') => (
    <SafeImage
      src="/products/TAC-PASTOR.svg"
      alt="Tacos al pastor"
      width={640}
      height={400}
      {...(loading ? { loading } : {})}
      className="aspect-16/10"
      fallback={<div data-testid="fallback">tile</div>}
    />
  );

  it('renders the image with fixed dimensions, lazy by default, decoded off the main thread', () => {
    render(image());
    const img = screen.getByRole('img', { name: 'Tacos al pastor' });
    expect(img).toHaveAttribute('src', '/products/TAC-PASTOR.svg');
    expect(img).toHaveAttribute('width', '640');
    expect(img).toHaveAttribute('height', '400');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveClass('aspect-16/10');
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
  });

  it('above the fold it loads eagerly', () => {
    render(image('eager'));
    expect(screen.getByRole('img', { name: 'Tacos al pastor' })).toHaveAttribute(
      'loading',
      'eager',
    );
  });

  it('a missing or broken image shows the placeholder instead of a broken icon', () => {
    render(image());
    fireEvent.error(screen.getByRole('img', { name: 'Tacos al pastor' }));
    expect(screen.queryByRole('img', { name: 'Tacos al pastor' })).not.toBeInTheDocument();
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });
});
