import { create } from 'zustand';

interface TourState {
  /** The open step, or null when the tour is closed. */
  index: number | null;
  start: () => void;
  goTo: (index: number) => void;
  close: () => void;
}

/**
 * Which step of the product tour is open, shared by the tour island (persisted across pages) and
 * the session menu's "Take the tour" (another island, WA3). Memory only: a reload closes it.
 */
export const useTourStore = create<TourState>()((set) => ({
  index: null,
  start: () => set({ index: 0 }),
  goTo: (index) => set({ index }),
  close: () => set({ index: null }),
}));
