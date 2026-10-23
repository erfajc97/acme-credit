import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Paginator, pageItems, type PaginatorLabels } from '../Paginator';

const labels: PaginatorLabels = {
  nav: 'Orders pages',
  previous: 'Previous page',
  next: 'Next page',
  page: (page) => `Page ${page}`,
  status: (page, total) => `Page ${page} of ${total}`,
};

describe('pageItems', () => {
  it('lists every page while they fit in seven slots (the last total without a gap)', () => {
    expect(pageItems({ page: 1, totalPages: 7 })).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('collapses both ends around the current page: 1 … 4 5 6 … 20', () => {
    expect(pageItems({ page: 5, totalPages: 20 })).toEqual([
      1,
      'gap-start',
      4,
      5,
      6,
      'gap-end',
      20,
    ]);
  });

  it('keeps seven slots near the start, so the row does not jump while paging', () => {
    expect(pageItems({ page: 1, totalPages: 8 })).toEqual([1, 2, 3, 4, 5, 'gap-end', 8]);
    expect(pageItems({ page: 4, totalPages: 20 })).toEqual([1, 2, 3, 4, 5, 'gap-end', 20]);
  });

  it('keeps seven slots near the end', () => {
    expect(pageItems({ page: 17, totalPages: 20 })).toEqual([1, 'gap-start', 16, 17, 18, 19, 20]);
    expect(pageItems({ page: 20, totalPages: 20 })).toEqual([1, 'gap-start', 16, 17, 18, 19, 20]);
  });

  it('switches to the middle window one page past the start window', () => {
    expect(pageItems({ page: 5, totalPages: 9 })).toEqual([1, 'gap-start', 4, 5, 6, 'gap-end', 9]);
    expect(pageItems({ page: 16, totalPages: 20 })).toEqual([
      1,
      'gap-start',
      15,
      16,
      17,
      'gap-end',
      20,
    ]);
  });
});

describe('Paginator', () => {
  it('is a labelled nav landmark that marks the current page', () => {
    render(<Paginator page={5} totalPages={20} onPageChange={vi.fn()} labels={labels} />);
    const nav = screen.getByRole('navigation', { name: 'Orders pages' });
    const current = within(nav).getByRole('button', { name: 'Page 5' });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: 'Page 4' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByText('Page 5 of 20')).toBeInTheDocument();
    expect(within(nav).getAllByText('…')).toHaveLength(2);
  });

  it('reports the page the user picks, the previous and the next one', async () => {
    const onPageChange = vi.fn();
    render(<Paginator page={5} totalPages={20} onPageChange={onPageChange} labels={labels} />);
    await userEvent.click(screen.getByRole('button', { name: 'Page 20' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange.mock.calls).toEqual([[20], [4], [6]]);
  });

  it('does not report the page the user is already on', async () => {
    const onPageChange = vi.fn();
    render(<Paginator page={5} totalPages={20} onPageChange={onPageChange} labels={labels} />);
    await userEvent.click(screen.getByRole('button', { name: 'Page 5' }));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('disables previous on the first page and next on the last', () => {
    const { rerender } = render(
      <Paginator page={1} totalPages={3} onPageChange={vi.fn()} labels={labels} />,
    );
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeEnabled();
    rerender(<Paginator page={3} totalPages={3} onPageChange={vi.fn()} labels={labels} />);
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  it('renders nothing for a single page (or none)', () => {
    const { container, rerender } = render(
      <Paginator page={1} totalPages={1} onPageChange={vi.fn()} labels={labels} />,
    );
    expect(container).toBeEmptyDOMElement();
    rerender(<Paginator page={1} totalPages={0} onPageChange={vi.fn()} labels={labels} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('blocks every control while a page is loading', () => {
    render(<Paginator page={2} totalPages={3} onPageChange={vi.fn()} labels={labels} isDisabled />);
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
  });
});

describe('Paginator density', () => {
  it('compact hugs its content on phones and keeps 44 px arrows; regular spreads the row', () => {
    const { rerender } = render(
      <Paginator
        page={2}
        totalPages={5}
        onPageChange={vi.fn()}
        labels={labels}
        density="compact"
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Orders pages' });
    expect(nav).not.toHaveClass('justify-between');
    const previous = within(nav).getByRole('button', { name: /Previous/ });
    expect(previous).toHaveClass('min-h-11', 'min-w-11', 'max-md:px-0');
    rerender(<Paginator page={2} totalPages={5} onPageChange={vi.fn()} labels={labels} />);
    expect(screen.getByRole('navigation', { name: 'Orders pages' })).toHaveClass('justify-between');
  });
});
