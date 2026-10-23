import type { TourLayout } from '../helpers/tourLayout';

const DIM = 'pointer-events-auto fixed tour-dim';

/**
 * The page dimmed around the section a step talks about: four panels frame the cut-out (a hole
 * the section shows through), with a violet ring on its edge. Until the section is on the page
 * (navigating, loading) the whole page is dimmed. Decorative: the card says what is lit.
 */
export function TourSpotlight({ layout }: { layout: TourLayout | null }) {
  if (!layout) return <div aria-hidden="true" className={`${DIM} inset-0 z-40`} />;
  const { top, left, width, height } = layout.spot;
  const bottom = top + height;
  return (
    <div aria-hidden="true" data-testid="tour-spotlight">
      <div className={`${DIM} inset-x-0 top-0 z-40`} style={{ height: top }} />
      <div className={`${DIM} inset-x-0 bottom-0 z-40`} style={{ top: bottom }} />
      <div className={`${DIM} left-0 z-40`} style={{ top, height, width: left }} />
      <div className={`${DIM} right-0 z-40`} style={{ top, height, left: left + width }} />
      <div
        data-testid="tour-cutout"
        className="pointer-events-none fixed z-40 rounded-card outline-3 outline-violet"
        style={{ top, left, width, height }}
      />
    </div>
  );
}
