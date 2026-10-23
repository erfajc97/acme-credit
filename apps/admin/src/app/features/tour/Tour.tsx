import AppProviders, { type IslandProps } from '@/app/providers/AppProviders';
import { TourCard } from './components/TourCard';
import { useTour } from './hooks/useTour';

// No services/, mutations/ or types.ts: the tour reads nothing from the API; its steps are data.ts
// and its open step is the shared store (store/tourStore), which the session menu also starts.
function TourIsland() {
  // The card's measuring ref travels on its own: the rest of the view is plain render data.
  const { measureCard, ...tour } = useTour();
  return <TourCard tour={tour} cardRef={measureCard} />;
}

/**
 * The product tour island, in the console shell on every page and persisted across ClientRouter
 * navigations, so a step can open the next section without losing its place (client-only).
 */
export default function Tour({ locale }: IslandProps) {
  return (
    <AppProviders locale={locale}>
      <TourIsland />
    </AppProviders>
  );
}
