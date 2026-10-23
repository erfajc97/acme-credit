import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { TourOverlay } from './components/TourOverlay';
import { TourPopover } from './components/TourPopover';
import { useProductTour } from './hooks/useProductTour';

// No services/, mutations/ or queries: the tour only reads the page around it (the DOM).
function ProductTourView() {
  const tour = useProductTour();
  if (!tour.step) return null;
  const arrangement = tour.arrangement;
  return (
    <TourOverlay
      spotlight={arrangement?.spotlight ?? { top: 0, left: 0, width: 0, height: 0 }}
      hasTarget={tour.hasTarget}
      onMouseDown={tour.onBackdropMouseDown}
    >
      <TourPopover
        stepId={tour.step.id}
        pose={tour.step.pose}
        title={tour.title}
        body={tour.body}
        progress={tour.progress}
        ids={tour.ids}
        isFirst={tour.isFirst}
        isLast={tour.isLast}
        layout={arrangement?.layout ?? 'floating'}
        placement={arrangement?.placement ?? null}
        sheetEdge={arrangement?.sheetEdge ?? 'bottom'}
        popoverRef={tour.popoverRef}
        onNext={tour.next}
        onBack={tour.back}
        onSkip={tour.close}
        onKeyDown={tour.onKeyDown}
      />
    </TourOverlay>
  );
}

/**
 * The wallet tour: Credi walks the customer through the card, what is available, the store, the
 * activity and the card settings, opening each page and spotlighting its section. Mounted in the
 * persisted app shell (AppLayout, transition:persist) so it survives the ClientRouter swaps between
 * its steps; a fixed layer above the shell and its tab bar (no portal: a swap replaces <body>).
 */
export default function ProductTour({ locale }: Pick<IslandProps, 'locale'>) {
  return (
    <AppProviders locale={locale}>
      <ProductTourView />
    </AppProviders>
  );
}
