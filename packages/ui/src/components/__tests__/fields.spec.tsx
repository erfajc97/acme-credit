import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ChoiceGroup } from '../ChoiceGroup';
import { MoneyField } from '../MoneyField';
import { TextField } from '../TextField';

function ControlledMoney({ errorMessage }: { errorMessage?: string }) {
  const [value, setValue] = useState('');
  return (
    <>
      <MoneyField
        label="Amount"
        name="amount"
        currencySymbol="$"
        value={value}
        onChange={setValue}
        description="Between $200.00 and $10,000.00"
        errorMessage={errorMessage}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

describe('TextField', () => {
  it('labels the input and reports typed text as typed', async () => {
    const onChange = vi.fn();
    render(
      <TextField
        label="Email"
        name="email"
        type="email"
        value=""
        onChange={onChange}
        maxLength={254}
      />,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('maxlength', '254');
    expect(input).not.toHaveAttribute('aria-invalid');
    await userEvent.type(input, 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('marks the field invalid and shows the error message', () => {
    render(
      <TextField
        label="Password"
        name="password"
        type="password"
        value="x"
        onChange={vi.fn()}
        errorMessage="Too short"
      />,
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Too short')).toBeInTheDocument();
  });
});

describe('MoneyField', () => {
  it('is a decimal text field (never type=number) and keeps the text exactly as typed', async () => {
    render(<ControlledMoney />);
    const input = screen.getByLabelText('Amount');
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('maxlength', '16');
    expect(screen.getByText('Between $200.00 and $10,000.00')).toBeInTheDocument();
    await userEvent.type(input, '1,250.5');
    expect(screen.getByTestId('value')).toHaveTextContent('1,250.5');
  });
});

describe('ChoiceGroup', () => {
  it('selects one option and names the group', async () => {
    const onChange = vi.fn();
    render(
      <ChoiceGroup
        label="Merchant"
        name="merchant"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'Corner Grocery', description: 'Groceries' },
          { value: 'b', label: 'City Fuel' },
        ]}
        errorMessage="Pick a merchant"
      />,
    );
    expect(screen.getByRole('radiogroup', { name: 'Merchant' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Corner Grocery/ })).toBeChecked();
    expect(screen.getByText('Pick a merchant')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /City Fuel/ }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
