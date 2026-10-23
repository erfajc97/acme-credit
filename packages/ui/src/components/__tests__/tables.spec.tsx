import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { DataTable, type DataColumn } from '../DataTable';
import { PostingsTable } from '../PostingsTable';
import { SegmentedFilter } from '../SegmentedFilter';

interface Row {
  id: string;
  name: string;
  owed: string;
}

const columns: DataColumn<Row>[] = [
  { id: 'name', header: 'Customer', cell: (row) => row.name, isPrimary: true },
  { id: 'owed', header: 'Owed', cell: (row) => row.owed, align: 'end' },
];

const rows: Row[] = [
  { id: 'a', name: 'Ada Lovelace', owed: '$120.00' },
  { id: 'b', name: 'Alan Turing', owed: '$7.05' },
];

describe('DataTable', () => {
  it('renders a captioned table with right-aligned amount columns', () => {
    render(
      <DataTable caption="Accounts" columns={columns} rows={rows} getRowKey={(row) => row.id} />,
    );
    const table = screen.getByRole('table', { name: 'Accounts' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Customer', 'Owed']);
    const [, firstRow] = within(table).getAllByRole('row');
    expect(within(firstRow as HTMLElement).getAllByRole('cell')[1]).toHaveTextContent('$120.00');
    expect(within(firstRow as HTMLElement).getAllByRole('cell')[1]).toHaveClass('text-right');
    expect(within(table).getAllByRole('columnheader')[0]).toHaveClass('text-left');
  });

  it('renders the same rows as cards for phones: the primary column as title, the rest as terms', () => {
    render(
      <DataTable caption="Accounts" columns={columns} rows={rows} getRowKey={(row) => row.id} />,
    );
    const cards = within(screen.getByRole('list', { name: 'Accounts' })).getAllByRole('listitem');
    expect(cards).toHaveLength(2);
    expect(cards[1]).toHaveTextContent('Alan Turing');
    expect(within(cards[1] as HTMLElement).getByRole('term')).toHaveTextContent('Owed');
    expect(within(cards[1] as HTMLElement).getByRole('definition')).toHaveTextContent('$7.05');
  });

  it('without a primary column every column is a label/value pair', () => {
    const plain = columns.map((column) => ({
      ...column,
      isPrimary: false,
      align: 'start' as const,
    }));
    render(
      <DataTable
        caption="Plain"
        columns={plain}
        rows={rows.slice(0, 1)}
        getRowKey={(row) => row.id}
      />,
    );
    const card = within(screen.getByRole('list', { name: 'Plain' })).getByRole('listitem');
    expect(within(card).getAllByRole('term')).toHaveLength(2);
    expect(within(card).getAllByRole('definition')[1]).not.toHaveClass('text-right');
  });
});

describe('PostingsTable', () => {
  it('puts debits and credits in their own columns and always shows the ledger account code', () => {
    render(
      <PostingsTable
        caption="Postings"
        accountHeader="Ledger account"
        debitHeader="Debit"
        creditHeader="Credit"
        rows={[
          {
            key: '1',
            name: 'Receivable',
            ledgerAccount: 'receivable:5f3e',
            debit: '$12.50',
            credit: null,
          },
          {
            key: '2',
            name: null,
            ledgerAccount: 'merchant_settlement',
            debit: null,
            credit: '$12.50',
          },
        ]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Postings' });
    const [, debitRow, creditRow] = within(table).getAllByRole('row') as HTMLElement[];
    const debitCells = within(debitRow as HTMLElement).getAllByRole('cell');
    expect(debitCells[0]).toHaveTextContent('Receivablereceivable:5f3e');
    expect(debitCells[1]).toHaveTextContent('$12.50');
    expect(debitCells[2]).toHaveTextContent('');
    const creditCells = within(creditRow as HTMLElement).getAllByRole('cell');
    expect(creditCells[0]).toHaveTextContent('merchant_settlement');
    expect(creditCells[1]).toHaveTextContent('');
    expect(creditCells[2]).toHaveTextContent('$12.50');
  });
});

function FilterHarness({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('all');
  return (
    <SegmentedFilter
      label="Status"
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      options={[
        { value: 'all', label: 'All' },
        { value: 'FROZEN', label: 'Frozen' },
      ]}
    />
  );
}

describe('SegmentedFilter', () => {
  it('is a named group whose selected option follows the value, and reports a new choice', async () => {
    const onChange = vi.fn();
    render(<FilterHarness onChange={onChange} />);
    const group = screen.getByRole('radiogroup', { name: 'Status' });
    expect(within(group).getByRole('radio', { name: 'All' })).toBeChecked();
    await userEvent.click(within(group).getByRole('radio', { name: 'Frozen' }));
    expect(onChange).toHaveBeenCalledWith('FROZEN');
    expect(within(group).getByRole('radio', { name: 'Frozen' })).toBeChecked();
  });

  it('keeps a selection: pressing the selected option again changes nothing', async () => {
    const onChange = vi.fn();
    render(<FilterHarness onChange={onChange} />);
    await userEvent.click(screen.getByRole('radio', { name: 'All' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
