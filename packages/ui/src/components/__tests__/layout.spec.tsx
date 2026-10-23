import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, renderHook, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DESKTOP_QUERY, FIT_LAYOUT_QUERY, useFitLayout, useMediaQuery } from '../../fit-layout';
import { AppSheet } from '../AppSheet';
import { ChipScroller } from '../ChipScroller';
import { overflowEdges, scrollStep } from '../chipScroll';
import { ScrollPanel } from '../ScrollPanel';
import { SegmentedFilter } from '../SegmentedFilter';
import { installMatchMedia } from './media';

const user = userEvent.setup();
const THEME_CSS = readFileSync(resolve(__dirname, '../../theme.css'), 'utf8').replace(
  /\r\n/g,
  '\n',
);

describe('fit layout query (one rule for CSS and JS)', () => {
  it('the `fit:` Tailwind variant in theme.css uses exactly the query the islands read', () => {
    expect(FIT_LAYOUT_QUERY).toBe('(min-width: 64rem) and (pointer: fine)');
    expect(THEME_CSS).toContain(`@custom-variant fit {\n  @media ${FIT_LAYOUT_QUERY} {`);
  });

  it('useFitLayout is true only from lg WITH a fine pointer: a touch iPad at 1024 px scrolls the page', () => {
    const media = installMatchMedia([DESKTOP_QUERY]);
    const { result, unmount } = renderHook(() => useFitLayout());
    expect(result.current).toBe(false);
    act(() => media.set([DESKTOP_QUERY, FIT_LAYOUT_QUERY]));
    expect(result.current).toBe(true);
    act(() => media.set([]));
    expect(result.current).toBe(false);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });

  it('useMediaQuery is false where matchMedia does not exist', () => {
    const original = window.matchMedia;
    // @ts-expect-error -- jsdom-like environments without matchMedia.
    delete window.matchMedia;
    const { result } = renderHook(() => useMediaQuery(DESKTOP_QUERY));
    expect(result.current).toBe(false);
    window.matchMedia = original;
  });
});

describe('overflowEdges / scrollStep', () => {
  it('reports the side that hides chips, with a 1 px tolerance for sub-pixel widths', () => {
    expect(overflowEdges({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 })).toEqual({
      start: false,
      end: false,
    });
    expect(overflowEdges({ scrollLeft: 0, clientWidth: 300, scrollWidth: 301 })).toEqual({
      start: false,
      end: false,
    });
    expect(overflowEdges({ scrollLeft: 0, clientWidth: 300, scrollWidth: 302 })).toEqual({
      start: false,
      end: true,
    });
    expect(overflowEdges({ scrollLeft: 1, clientWidth: 300, scrollWidth: 600 })).toEqual({
      start: false,
      end: true,
    });
    expect(overflowEdges({ scrollLeft: 2, clientWidth: 300, scrollWidth: 600 })).toEqual({
      start: true,
      end: true,
    });
    expect(overflowEdges({ scrollLeft: 299, clientWidth: 300, scrollWidth: 600 })).toEqual({
      start: true,
      end: false,
    });
    expect(overflowEdges({ scrollLeft: 297, clientWidth: 300, scrollWidth: 600 })).toEqual({
      start: true,
      end: true,
    });
  });

  it('pages by most of the visible width, never less than one chip', () => {
    expect(scrollStep(1000)).toBe(800);
    expect(scrollStep(150)).toBe(120);
    expect(scrollStep(149)).toBe(120);
    expect(scrollStep(152)).toBe(122);
  });
});

function sizeScroller(
  scroller: HTMLElement,
  { clientWidth, scrollWidth }: { clientWidth: number; scrollWidth: number },
) {
  Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: clientWidth });
  Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: scrollWidth });
}

function renderScroller() {
  return render(
    <ChipScroller previousLabel="Previous filters" nextLabel="More filters">
      <span data-testid="chips">chips</span>
    </ChipScroller>,
  );
}

describe('ChipScroller', () => {
  it('scrolls sideways without a visible scrollbar and fades only the side that hides chips', () => {
    installMatchMedia([]);
    renderScroller();
    const scroller = screen.getByTestId('chips').parentElement as HTMLElement;
    expect(scroller).toHaveClass('chip-scroller', 'overflow-x-auto', 'snap-x');
    expect(scroller).not.toHaveAttribute('data-overflow-start');
    sizeScroller(scroller, { clientWidth: 300, scrollWidth: 700 });
    fireEvent.scroll(scroller);
    expect(scroller).toHaveAttribute('data-overflow-end');
    expect(scroller).not.toHaveAttribute('data-overflow-start');
    scroller.scrollLeft = 400;
    fireEvent.scroll(scroller);
    expect(scroller).toHaveAttribute('data-overflow-start');
    expect(scroller).not.toHaveAttribute('data-overflow-end');
  });

  it('touch screens get no arrow buttons (the row is swiped)', () => {
    installMatchMedia([]);
    renderScroller();
    const scroller = screen.getByTestId('chips').parentElement as HTMLElement;
    sizeScroller(scroller, { clientWidth: 300, scrollWidth: 700 });
    fireEvent.scroll(scroller);
    expect(screen.queryByRole('button', { name: 'More filters' })).not.toBeInTheDocument();
  });

  it('a fine pointer gets round prev/next arrows on the overflowing sides that page the row', async () => {
    installMatchMedia(['(pointer: fine)']);
    renderScroller();
    const scroller = screen.getByTestId('chips').parentElement as HTMLElement;
    const scrollBy = vi.fn();
    scroller.scrollBy = scrollBy as unknown as typeof scroller.scrollBy;
    sizeScroller(scroller, { clientWidth: 500, scrollWidth: 1200 });
    fireEvent.scroll(scroller);
    expect(screen.queryByRole('button', { name: 'Previous filters' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'More filters' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 400 });
    scroller.scrollLeft = 300;
    fireEvent.scroll(scroller);
    await user.click(screen.getByRole('button', { name: 'Previous filters' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -400 });
  });

  it('the arrows stay out of the tab order: keyboard users move through the chips themselves', () => {
    installMatchMedia(['(pointer: fine)']);
    renderScroller();
    const scroller = screen.getByTestId('chips').parentElement as HTMLElement;
    sizeScroller(scroller, { clientWidth: 300, scrollWidth: 700 });
    fireEvent.scroll(scroller);
    expect(screen.getByRole('button', { name: 'More filters' })).toHaveAttribute('tabindex', '-1');
  });

  it('re-measures when the window resizes', () => {
    installMatchMedia([]);
    renderScroller();
    const scroller = screen.getByTestId('chips').parentElement as HTMLElement;
    sizeScroller(scroller, { clientWidth: 300, scrollWidth: 700 });
    fireEvent(window, new Event('resize'));
    expect(scroller).toHaveAttribute('data-overflow-end');
  });
});

describe('SegmentedFilter in a ChipScroller', () => {
  it('keeps every chip in one row inside the scroller, each chip a snap point', () => {
    installMatchMedia([]);
    render(
      <SegmentedFilter
        label="Merchant"
        hideLabel
        scroll={{ previousLabel: 'Previous', nextLabel: 'Next' }}
        options={[
          { value: 'all', label: 'All' },
          { value: 'taqueria', label: 'Taquería El Sol' },
        ]}
        value="all"
        onChange={vi.fn()}
      />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Merchant' });
    expect(group).toHaveClass('flex-nowrap', 'w-max');
    expect(group).not.toHaveClass('flex-wrap');
    expect(group.parentElement).toHaveClass('chip-scroller');
    expect(within(group).getByRole('radio', { name: 'Taquería El Sol' })).toHaveClass('snap-start');
    expect(screen.getByText('Merchant')).toHaveClass('sr-only');
  });
});

describe('ScrollPanel', () => {
  it('below the fit layout (phones, tablets, touch) is a plain block: the page scrolls, swipes are never trapped', () => {
    installMatchMedia([DESKTOP_QUERY]);
    render(
      <ScrollPanel label="Orders" className="fit:flex-1">
        <p>rows</p>
      </ScrollPanel>,
    );
    expect(screen.queryByRole('group', { name: 'Orders' })).not.toBeInTheDocument();
    const block = screen.getByText('rows').parentElement as HTMLElement;
    expect(block).not.toHaveAttribute('tabindex');
    expect(block.className).not.toMatch(/(^|\s)(overflow-y-auto|overscroll-contain)/);
    expect(block).toHaveClass('fit:flex-1');
  });

  it('in the fit layout scrolls on its own, contains the wheel and is reachable by keyboard', () => {
    installMatchMedia([DESKTOP_QUERY, FIT_LAYOUT_QUERY]);
    render(
      <ScrollPanel label="Orders">
        <p>rows</p>
      </ScrollPanel>,
    );
    const panel = screen.getByRole('group', { name: 'Orders' });
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(panel).toHaveClass('fit:overflow-y-auto', 'fit:overscroll-contain');
  });
});

describe('AppSheet placement', () => {
  const sheet = (placement?: 'auto') => (
    <AppSheet
      isOpen
      onOpenChange={vi.fn()}
      title="Order"
      closeLabel="Close"
      {...(placement ? { placement } : {})}
    >
      <p>Lines</p>
    </AppSheet>
  );

  it('auto: a bottom sheet on phones and tablets', () => {
    installMatchMedia([]);
    render(sheet('auto'));
    const dialog = screen.getByRole('dialog', { name: 'Order' });
    expect(dialog.closest('[data-placement]')).toHaveAttribute('data-placement', 'bottom');
  });

  it('auto: a side panel from lg', () => {
    installMatchMedia([DESKTOP_QUERY]);
    render(sheet('auto'));
    const dialog = screen.getByRole('dialog', { name: 'Order' });
    expect(dialog.closest('[data-placement]')).toHaveAttribute('data-placement', 'right');
  });

  it('moves focus into the sheet and closes from its translated close button', async () => {
    installMatchMedia([]);
    const onOpenChange = vi.fn();
    render(
      <AppSheet isOpen onOpenChange={onOpenChange} title="Order" closeLabel="Close">
        <p>Lines</p>
      </AppSheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Order' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
