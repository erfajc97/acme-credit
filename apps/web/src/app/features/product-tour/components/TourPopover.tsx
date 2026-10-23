import { AppButton, Mascot, type MascotPose } from '@acme/ui';
import type { KeyboardEvent, RefObject } from 'react';
import { t } from '@/app/i18n';
import type { PopoverPlacement, SheetEdge, TourLayout } from '../types';
import { TourProgress } from './TourProgress';

interface TourPopoverProps {
  stepId: string;
  pose: MascotPose;
  title: string;
  body: string;
  progress: { current: number; total: number; label: string; announcement: string };
  ids: { titleId: string; bodyId: string };
  isFirst: boolean;
  isLast: boolean;
  layout: TourLayout;
  /** Null on the sheet layout (pinned to an edge by CSS). */
  placement: PopoverPlacement | null;
  sheetEdge: SheetEdge;
  popoverRef: RefObject<HTMLDivElement | null>;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

const SHEET_EDGE: Record<SheetEdge, string> = {
  top: 'inset-x-3 top-3',
  bottom: 'inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))]',
};

/**
 * One step: a modal dialog card next to its target (a sheet on phones, resting away from the
 * target), guided by Credi — peeking over the card's top edge, or small in the sheet's header.
 */
export function TourPopover({
  stepId,
  pose,
  title,
  body,
  progress,
  ids,
  isFirst,
  isLast,
  layout,
  placement,
  sheetEdge,
  popoverRef,
  onNext,
  onBack,
  onSkip,
  onKeyDown,
}: TourPopoverProps) {
  const isSheet = layout === 'sheet';
  return (
    <div
      ref={popoverRef}
      data-layout={layout}
      className={['fixed z-61', isSheet ? SHEET_EDGE[sheetEdge] : 'top-0 left-0 w-88 pt-14'].join(
        ' ',
      )}
      style={
        placement
          ? { transform: `translate3d(${placement.left}px, ${placement.top}px, 0)` }
          : undefined
      }
    >
      {!isSheet && (
        <Mascot
          key={pose}
          pose={pose}
          size="sm"
          motion="float"
          loading="eager"
          className="absolute top-0 right-5"
        />
      )}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a modal dialog
          owns its keys (WAI-ARIA dialog pattern): arrows, Escape and the Tab trap. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ids.titleId}
        aria-describedby={ids.bodyId}
        data-testid="tour-dialog"
        onKeyDown={onKeyDown}
        className="flex flex-col gap-3 rounded-card border-[1.6px] border-ink bg-surface-raised p-4 shadow-overlay sm:p-5"
      >
        <p className="sr-only" aria-live="polite">
          {progress.announcement}
        </p>
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            {isSheet && <Mascot key={pose} pose={pose} size="xs" loading="eager" />}
            <TourProgress
              current={progress.current}
              total={progress.total}
              label={progress.label}
            />
          </span>
          {!isLast && (
            <AppButton variant="ghost" size="compact" onPress={onSkip}>
              {t('tour.skip')}
            </AppButton>
          )}
        </div>
        <div key={stepId} className="flex flex-col gap-1.5">
          <h2 id={ids.titleId} className="font-display text-h3 font-bold">
            {title}
          </h2>
          <p id={ids.bodyId} className="text-small text-muted">
            {body}
          </p>
        </div>
        <div key={`${stepId}-actions`} className="flex items-center justify-end gap-2">
          {!isFirst && (
            <AppButton variant="secondary" size="compact" onPress={onBack}>
              {t('tour.back')}
            </AppButton>
          )}
          <AppButton size="compact" onPress={onNext} focusOnMount>
            {isLast ? t('tour.done') : t('tour.next')}
          </AppButton>
        </div>
      </div>
    </div>
  );
}
