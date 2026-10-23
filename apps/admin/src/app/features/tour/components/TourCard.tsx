import { AppButton, Mascot } from '@acme/ui';
import { t } from '@/app/i18n';
import type { TourView } from '../hooks/useTour';
import { TourSpotlight } from './TourSpotlight';

/**
 * One step of the tour: the spotlight on its section and a card anchored beside it, with Credi
 * in the step's pose, where the admin is, and Back / Next / Skip. Esc skips. Until the section is
 * on the page the card waits at the bottom of the screen.
 */
interface TourCardProps {
  tour: TourView;
  /** Measures the card so the layout leaves room for it. */
  cardRef: (card: HTMLElement | null) => void;
}

export function TourCard({ tour, cardRef }: TourCardProps) {
  const { step, layout } = tour;
  if (!step) return null;
  const position = layout
    ? { top: layout.card.top, left: layout.card.left, width: layout.card.width }
    : undefined;
  return (
    <>
      <TourSpotlight layout={layout} />
      <section
        ref={cardRef}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        data-side={layout?.side ?? 'waiting'}
        style={position}
        className={`fixed z-50 flex flex-col gap-3 rounded-card border-[1.6px] border-ink bg-surface-raised p-4 text-fg shadow-overlay ${position ? 'max-w-[calc(100vw-1.5rem)]' : 'inset-x-3 bottom-4 sm:inset-x-auto sm:right-6 sm:w-104'}`}
      >
        <div className="flex items-start gap-3">
          <Mascot
            key={step.id}
            pose={step.pose}
            size="sm"
            motion="float"
            loading="eager"
            className="shrink-0"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <p
              className="text-caption font-semibold tracking-wide text-violet uppercase"
              aria-live="polite"
            >
              {step.progress}
            </p>
            <h2 id="tour-title" className="font-display text-h3 font-bold">
              {step.title}
            </h2>
            <p id="tour-body" className="text-small text-fg">
              {step.body}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <AppButton variant="ghost" size="compact" onPress={tour.close}>
            {t('tour.skip')}
          </AppButton>
          <div className="flex gap-2">
            {!step.isFirst && (
              <AppButton variant="secondary" size="compact" onPress={tour.back}>
                {t('tour.back')}
              </AppButton>
            )}
            <AppButton
              key={step.id}
              variant="primary"
              size="compact"
              onPress={tour.next}
              focusOnMount
            >
              {step.isLast ? t('tour.finish') : t('tour.next')}
            </AppButton>
          </div>
        </div>
      </section>
    </>
  );
}
