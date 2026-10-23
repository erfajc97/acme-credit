import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppSheet } from '../AppSheet';
import { PaymentCard } from '../PaymentCard';
import { ToggleSwitch } from '../ToggleSwitch';

const card = {
  brandName: 'Acme Credit',
  last4: '4242',
  numberLabel: 'Card ending in 4242',
  expiryLabel: 'Expires',
  expiry: '10/30',
};

describe('PaymentCard (the signature card)', () => {
  it('regular: prints the cardholder, the secured pill, the masked number and the expiry', () => {
    const { container } = render(
      <PaymentCard {...card} holderName="Ada Lovelace" securedLabel="Secured" />,
    );
    expect(screen.getByText('Ada Lovelace')).toHaveClass('uppercase');
    expect(screen.getByText('Secured')).toBeInTheDocument();
    expect(screen.getByText('•••• 4242')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Card ending in 4242')).toHaveClass('sr-only');
    expect(screen.getByText('10/30')).toBeInTheDocument();
    expect(container.firstElementChild).not.toHaveAttribute('data-frozen');
    expect(container.querySelector('[data-card-face]')).not.toHaveClass('grayscale');
    expect(container.firstElementChild).toHaveClass('card-motion');
  });

  it('compact: no cardholder line (the checkout names the card already)', () => {
    render(<PaymentCard {...card} size="compact" holderName="Ada Lovelace" />);
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
    expect(screen.getByText('•••• 4242')).toBeInTheDocument();
  });

  it('thumb: a decorative face only, frosted when frozen', () => {
    const { container, rerender } = render(<PaymentCard {...card} size="thumb" />);
    const thumb = container.firstElementChild;
    expect(thumb).toHaveAttribute('aria-hidden', 'true');
    expect(thumb).toHaveTextContent('');
    expect(container.querySelector('.card-frost')).toBeNull();
    rerender(<PaymentCard {...card} size="thumb" isFrozen />);
    expect(container.querySelector('.card-frost')).not.toBeNull();
    expect(container.querySelector('[data-card-face]')).toHaveClass('grayscale');
  });

  it('a frozen regular card keeps every text legible above the veil', () => {
    const { container } = render(<PaymentCard {...card} isFrozen badge={<span>Frozen</span>} />);
    expect(container.querySelector('.card-frost')).not.toBeNull();
    expect(screen.getByText('•••• 4242')).toBeVisible();
  });
});

describe('ToggleSwitch', () => {
  it('is a named switch with its description, and reports the requested state', async () => {
    const onChange = vi.fn();
    render(
      <ToggleSwitch
        label="Freeze card"
        description="New purchases are declined."
        isSelected={false}
        onChange={onChange}
      />,
    );
    const control = screen.getByRole('switch', { name: 'Freeze card' });
    expect(control).not.toBeChecked();
    expect(control).toHaveAccessibleDescription('New purchases are declined.');
    await userEvent.click(control);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('reflects a selected state and can be disabled', () => {
    render(<ToggleSwitch label="Freeze card" isSelected onChange={vi.fn()} isDisabled />);
    const control = screen.getByRole('switch', { name: 'Freeze card' });
    expect(control).toBeChecked();
    expect(control).toBeDisabled();
  });
});

describe('AppSheet close button', () => {
  it('offers a named close button when given a label', async () => {
    const onOpenChange = vi.fn();
    render(
      <AppSheet isOpen onOpenChange={onOpenChange} title="Your cart" closeLabel="Close">
        <p>Lines</p>
      </AppSheet>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('focus handoff props', () => {
  it('AppButton and the stepper "+" can take focus when they mount', async () => {
    const { AppButton } = await import('../AppButton');
    const { QuantityStepper } = await import('../QuantityStepper');
    const { unmount } = render(
      <AppButton focusOnMount onPress={vi.fn()}>
        Add
      </AppButton>,
    );
    expect(screen.getByRole('button', { name: 'Add' })).toHaveFocus();
    unmount();
    render(
      <QuantityStepper
        label="Qty"
        value={1}
        max={5}
        onChange={vi.fn()}
        decreaseLabel="Less"
        increaseLabel="More"
        focusIncreaseOnMount
      />,
    );
    expect(screen.getByRole('button', { name: 'More' })).toHaveFocus();
  });
});

describe('PaymentCard large', () => {
  it('is the card page hero: wider frame, the cardholder printed', () => {
    const { container } = render(<PaymentCard {...card} size="large" holderName="Ada Lovelace" />);
    expect(container.firstElementChild).toHaveClass('max-w-md');
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
  });
});
