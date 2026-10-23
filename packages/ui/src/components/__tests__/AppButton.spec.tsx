import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppButton } from '../AppButton';

describe('AppButton', () => {
  it('fires onPress when enabled', async () => {
    const onPress = vi.fn();
    render(<AppButton onPress={onPress}>Make a payment</AppButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Make a payment' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('blocks presses and shows the pending label while pending', async () => {
    const onPress = vi.fn();
    render(
      <AppButton onPress={onPress} isPending pendingLabel="Sending…">
        Make a payment
      </AppButton>,
    );
    const button = screen.getByRole('button', { name: 'Sending…' });
    expect(button).toHaveAttribute('data-pending', 'true');
    await userEvent.click(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows its own label when not pending, even with a pending label configured', async () => {
    const onPress = vi.fn();
    render(
      <AppButton onPress={onPress} isPending={false} pendingLabel="Sending…">
        Make a payment
      </AppButton>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Make a payment' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('respects isDisabled and an explicit accessible name', () => {
    render(
      <AppButton isDisabled aria-label="Freeze card" variant="danger" type="submit" fullWidth>
        ❄
      </AppButton>,
    );
    const button = screen.getByRole('button', { name: 'Freeze card' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).not.toHaveAttribute('data-pending');
    expect(button.className.split(' ')).toContain('button--danger');
  });

  it('renders the primary variant by default', () => {
    render(<AppButton>Pay</AppButton>);
    expect(screen.getByRole('button', { name: 'Pay' }).className.split(' ')).toContain(
      'button--primary',
    );
  });

  it('requires a pending label whenever isPending is passed (type-level)', () => {
    // @ts-expect-error: isPending without pendingLabel must not compile (W13).
    render(<AppButton isPending>Pay</AppButton>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
