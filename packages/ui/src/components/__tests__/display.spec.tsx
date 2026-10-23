import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AmountStat } from '../AmountStat';
import { AmountText, splitAmount } from '../AmountText';
import { ButtonLink, buttonLinkClass } from '../ButtonLink';
import { EmptyState } from '../EmptyState';
import { ErrorState } from '../ErrorState';
import { InlineNotice } from '../InlineNotice';
import { LedgerRow } from '../LedgerRow';
import { Panel } from '../Panel';
import { PaymentCard } from '../PaymentCard';
import { PendingIndicator } from '../PendingIndicator';
import { Skeleton } from '../Skeleton';
import { StatusChip } from '../StatusChip';
import { VaultMeter } from '../VaultMeter';

describe('splitAmount / AmountText', () => {
  it('sets the cents apart and keeps the whole amount as text', () => {
    expect(splitAmount('$1,234.56')).toEqual({ whole: '$1,234', cents: '.56' });
    expect(splitAmount('1.234,56 €'.replace(' €', ''))).toEqual({ whole: '1.234', cents: ',56' });
    expect(splitAmount('$12')).toEqual({ whole: '$12', cents: '' });
    const { container } = render(<AmountText value="$84.20" size="hero" />);
    expect(container).toHaveTextContent('$84.20');
    expect(screen.getByText('.20')).toHaveClass('text-muted');
  });

  it('renders an amount without cents as one piece', () => {
    const { container } = render(<AmountText value="$5" />);
    expect(container.querySelectorAll('span')).toHaveLength(1);
  });
});

describe('AmountStat', () => {
  it('pairs the label and the amount', () => {
    render(
      <dl>
        <AmountStat label="Available to spend" value="$60.00" hint="After holds" size="hero" />
      </dl>,
    );
    expect(screen.getByRole('term')).toHaveTextContent('Available to spend');
    expect(screen.getByRole('definition')).toHaveTextContent('$60.00After holds');
  });
});

describe('ButtonLink', () => {
  it('is a link styled as a button; external links open safely in a new tab', () => {
    render(
      <>
        <ButtonLink href="/signup">Get started</ButtonLink>
        <ButtonLink href="https://bank.test/approve" external variant="secondary" fullWidth>
          Approve
        </ButtonLink>
      </>,
    );
    const internal = screen.getByRole('link', { name: 'Get started' });
    expect(internal).toHaveAttribute('href', '/signup');
    expect(internal).not.toHaveAttribute('target');
    expect(internal.className).toContain('button--primary');
    const external = screen.getByRole('link', { name: 'Approve' });
    expect(external).toHaveAttribute('target', '_blank');
    expect(external).toHaveAttribute('rel', 'noopener noreferrer');
    expect(buttonLinkClass({ variant: 'ghost' })).toContain('button--ghost');
    expect(buttonLinkClass()).toContain('button--lg');
  });
});

describe('states', () => {
  it('EmptyState teaches the first action', () => {
    render(
      <EmptyState
        title="No purchases yet"
        body="Purchases show up here."
        action={<a href="/x">Go</a>}
        icon={<i data-testid="icon" />}
        headingLevel={3}
      />,
    );
    expect(screen.getByRole('heading', { level: 3, name: 'No purchases yet' })).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go' })).toBeInTheDocument();
  });

  it('EmptyState defaults to an h2 without icon or action', () => {
    render(<EmptyState title="Nothing" body="Body" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Nothing' })).toBeInTheDocument();
  });

  it('ErrorState is an alert with a retry', async () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        title="Could not load"
        body="Try again."
        retryLabel="Try again"
        retryingLabel="Trying…"
        onRetry={onRetry}
      />,
    );
    const alert = screen.getByRole('alert');
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ErrorState says it is retrying', () => {
    render(
      <ErrorState
        title="T"
        body="B"
        retryLabel="Try again"
        retryingLabel="Trying…"
        onRetry={vi.fn()}
        isRetrying
      />,
    );
    expect(screen.getByRole('button', { name: 'Trying…' })).toBeInTheDocument();
  });

  it('PendingIndicator announces what it waits for', () => {
    render(<PendingIndicator label="Waiting for the bank" />);
    expect(screen.getByRole('status')).toHaveTextContent('Waiting for the bank');
  });

  it('InlineNotice: danger is an alert, other tones are status', () => {
    const { rerender } = render(
      <InlineNotice tone="danger" title="Declined">
        Details
      </InlineNotice>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('DeclinedDetails');
    rerender(<InlineNotice tone="success" title="Approved" />);
    expect(screen.getByRole('status')).toHaveTextContent('Approved');
    rerender(<InlineNotice tone="neutral" title="Note" />);
    expect(screen.getByRole('status')).toHaveTextContent('Note');
  });
});

describe('surfaces', () => {
  it('Panel is a named region; inset tone uses the soft surface', () => {
    const { rerender } = render(
      <Panel labelledBy="t">
        <h2 id="t">Balances</h2>
      </Panel>,
    );
    expect(screen.getByRole('region', { name: 'Balances' })).toHaveClass('bg-surface-raised');
    rerender(
      <Panel labelledBy="t" tone="inset">
        <h2 id="t">Balances</h2>
      </Panel>,
    );
    expect(screen.getByRole('region', { name: 'Balances' })).toHaveClass('bg-neutral-soft');
  });

  it('Skeleton is decorative', () => {
    const { container } = render(<Skeleton className="h-4 w-24" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('StatusChip always carries a word', () => {
    render(<StatusChip label="On hold" tone="warning" />);
    expect(screen.getByText('On hold').closest('[data-tone]')).toHaveAttribute(
      'data-tone',
      'warning',
    );
  });

  it('PaymentCard masks the number and names it for screen readers', () => {
    render(
      <PaymentCard
        brandName="Acme Credit"
        last4="4242"
        numberLabel="Card ending in 4242"
        expiryLabel="Expires"
        expiry="08/29"
        badge={<span>Frozen</span>}
      />,
    );
    expect(screen.getByText('Card ending in 4242')).toHaveClass('sr-only');
    expect(screen.getByText('•••• 4242')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Frozen')).toBeInTheDocument();
    expect(screen.getByText('08/29')).toBeInTheDocument();
  });

  it('LedgerRow can open what it describes: its text and amount are one link', () => {
    const onClick = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <ul>
        <LedgerRow
          primary="Purchase · Corner Grocery"
          amount="$12.50"
          link={{ href: '?order=1', onClick }}
        />
      </ul>,
    );
    const link = screen.getByRole('link', { name: /Purchase · Corner Grocery/ });
    expect(link).toHaveAttribute('href', '?order=1');
    expect(link).toHaveTextContent('$12.50');
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('LedgerRow shows the amount, status and action', () => {
    render(
      <ul>
        <LedgerRow
          primary="Corner Grocery"
          secondary="Oct 21"
          amount="$12.50"
          status={<span>On hold</span>}
          action={<a href="#v">Cancel</a>}
        />
        <LedgerRow primary="City Fuel" amount="$3.00" />
      </ul>,
    );
    const [first, second] = screen.getAllByRole('listitem');
    expect(first).toHaveTextContent('Corner GroceryOct 21$12.50On holdCancel');
    expect(second).toHaveTextContent('City Fuel$3.00');
  });

  it('VaultMeter names every segment with its amount and sizes the bar by percent', () => {
    const { container } = render(
      <VaultMeter
        label="How your limit is used"
        collateral={{ label: 'Security deposit', amount: '$500.00' }}
        segments={[
          { id: 'owed', label: 'Owed', amount: '$100.00', percent: 20, tone: 'owed' },
          { id: 'held', label: 'On hold', amount: '$50.00', percent: 10, tone: 'held' },
          {
            id: 'available',
            label: 'Available',
            amount: '$350.00',
            percent: 70,
            tone: 'available',
          },
        ]}
      />,
    );
    expect(screen.getByRole('figure', { name: 'How your limit is used' })).toHaveTextContent(
      'Security deposit$500.00',
    );
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual([
      'Owed',
      'On hold',
      'Available',
    ]);
    expect(container.querySelector('[data-segment="held"]')).toHaveStyle({ width: '10%' });
  });
});
