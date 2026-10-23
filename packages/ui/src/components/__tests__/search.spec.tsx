import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DataTable, type DataColumn } from '../DataTable';
import { Panel } from '../Panel';
import { SearchField } from '../SearchField';

function ControlledSearch({
  onSubmit,
  onClear,
  errorMessage,
}: {
  onSubmit: (value: string) => void;
  onClear: () => void;
  errorMessage?: string;
}) {
  const [value, setValue] = useState('ada');
  return (
    <SearchField
      label="Search accounts"
      name="q"
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      onClear={() => {
        setValue('');
        onClear();
      }}
      placeholder="Search by id, name or email…"
      clearLabel="Clear search text"
      maxLength={100}
      errorMessage={errorMessage}
    />
  );
}

describe('SearchField', () => {
  it('is a labelled, named search box in a search landmark: Enter submits, the clear button empties it', async () => {
    const onSubmit = vi.fn();
    const onClear = vi.fn();
    render(<ControlledSearch onSubmit={onSubmit} onClear={onClear} />);
    const box = screen.getByRole('searchbox', { name: 'Search accounts' });
    expect(within(screen.getByRole('search')).getByRole('searchbox')).toBe(box);
    expect(box).toHaveAttribute('name', 'q');
    expect(box).toHaveAttribute('maxlength', '100');
    expect(box).toHaveAttribute('placeholder', 'Search by id, name or email…');
    expect(box).toHaveAttribute('autocomplete', 'off');
    await userEvent.type(box, 'x{Enter}');
    expect(onSubmit).toHaveBeenCalledWith('adax');
    await userEvent.click(screen.getByRole('button', { name: 'Clear search text' }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(box).toHaveValue('');
  });

  it('announces an error and marks the box invalid', () => {
    render(<ControlledSearch onSubmit={vi.fn()} onClear={vi.fn()} errorMessage="Too long" />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Too long')).toBeInTheDocument();
  });
});

interface Row {
  id: string;
  name: string;
  status: string;
  amount: string;
  card: string;
}

const COLUMNS: DataColumn<Row>[] = [
  { id: 'name', header: 'Customer', isPrimary: true, cell: (row) => row.name },
  { id: 'status', header: 'Status', mobile: 'meta', cell: (row) => row.status },
  { id: 'amount', header: 'Amount', mobile: 'end', align: 'end', cell: (row) => row.amount },
  { id: 'card', header: 'Card', cell: (row) => row.card },
];
const ROWS: Row[] = [{ id: 'r1', name: 'Ada', status: 'Active', amount: '$5.00', card: '4242' }];

describe('DataTable compact cards', () => {
  it('puts the end columns beside the title, the meta line unlabelled, the rest as labelled pairs', () => {
    render(
      <DataTable
        caption="Accounts"
        columns={COLUMNS}
        rows={ROWS}
        getRowKey={(row) => row.id}
        density="compact"
      />,
    );
    const card = within(screen.getByRole('list', { name: 'Accounts' })).getByRole('listitem');
    const terms = within(card)
      .getAllByRole('term')
      .map((term) => term.textContent);
    expect(terms).toEqual(['Card']);
    expect(card.firstElementChild).toHaveTextContent('Ada$5.00');
    expect(card.children[1]).toHaveTextContent('Active');
  });

  it('regular cards (the default) keep every detail as a labelled pair', () => {
    render(
      <DataTable caption="Accounts" columns={COLUMNS} rows={ROWS} getRowKey={(row) => row.id} />,
    );
    const card = within(screen.getByRole('list', { name: 'Accounts' })).getByRole('listitem');
    const terms = within(card)
      .getAllByRole('term')
      .map((term) => term.textContent);
    expect(terms).toEqual(['Status', 'Amount', 'Card']);
  });
});

describe('Panel density', () => {
  it('compact tightens the phone padding; regular keeps it', () => {
    const { container, rerender } = render(<Panel density="compact">x</Panel>);
    expect(container.firstElementChild).toHaveClass('p-3', 'sm:p-5');
    rerender(<Panel>x</Panel>);
    expect(container.firstElementChild).toHaveClass('p-5');
    expect(container.firstElementChild).not.toHaveClass('p-3');
  });
});
