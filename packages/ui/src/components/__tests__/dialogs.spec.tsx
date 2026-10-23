import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppModal } from '../AppModal';
import { ConfirmDialog } from '../ConfirmDialog';

describe('AppModal', () => {
  it('renders a named dialog only while open', () => {
    const { rerender } = render(
      <AppModal isOpen={false} onOpenChange={vi.fn()} title="Make a payment">
        <p>Body</p>
      </AppModal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(
      <AppModal isOpen onOpenChange={vi.fn()} title="Make a payment" footer={<span>Footer</span>}>
        <p>Body</p>
      </AppModal>,
    );
    expect(screen.getByRole('dialog', { name: 'Make a payment' })).toHaveTextContent('Body');
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });
});

describe('ConfirmDialog', () => {
  it('confirms or cancels', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        isOpen
        onOpenChange={onOpenChange}
        title="Close your account?"
        confirmLabel="Close account"
        cancelLabel="Keep it open"
        pendingLabel="Closing…"
        onConfirm={onConfirm}
        tone="danger"
      >
        <p>Your debt is paid from the deposit.</p>
      </ConfirmDialog>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Close account' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Keep it open' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('blocks both buttons while pending', () => {
    render(
      <ConfirmDialog
        isOpen
        onOpenChange={vi.fn()}
        title="Freeze?"
        confirmLabel="Freeze"
        cancelLabel="Cancel"
        pendingLabel="Freezing…"
        onConfirm={vi.fn()}
        isPending
      >
        <p>Body</p>
      </ConfirmDialog>,
    );
    expect(screen.getByRole('button', { name: 'Freezing…' })).toHaveAttribute(
      'data-pending',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
