import { act, render, screen } from '@testing-library/react';
import { useCartStore } from '@/app/store/cartStore';
import CartCount from '../CartCount';

describe('CartCount island (Store tab badge)', () => {
  it('shows nothing for an empty cart and follows the shared cart store', () => {
    const { container } = render(<CartCount />);
    expect(container).toBeEmptyDOMElement();
    act(() => {
      useCartStore.getState().add('TAC-PASTOR');
      useCartStore.getState().add('TAC-PASTOR');
      useCartStore.getState().add('TAC-HORCH');
    });
    expect(screen.getByText('3 en tu carrito')).toHaveClass('sr-only');
  });

  it('names the count in English on English pages', () => {
    useCartStore.getState().add('HOM-LAMP');
    render(<CartCount locale="en-US" />);
    expect(screen.getByText('1 in your cart')).toBeInTheDocument();
  });
});
