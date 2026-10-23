interface TourProgressProps {
  current: number;
  total: number;
  /** "2 de 7". */
  label: string;
}

/** One dot per step (the current one a short yellow bar) and "2 of 7". */
export function TourProgress({ current, total, label }: TourProgressProps) {
  return (
    <span className="flex items-center gap-2.5">
      <span aria-hidden="true" className="flex items-center gap-1">
        {Array.from({ length: total }, (_, index) => (
          <span
            key={index}
            className={[
              'h-2 rounded-full border border-ink transition-all duration-fast ease-out',
              index + 1 === current ? 'w-5 bg-brand-500' : 'w-2',
              index + 1 < current ? 'bg-ink' : '',
              index + 1 > current ? 'bg-surface-raised' : '',
            ].join(' ')}
          />
        ))}
      </span>
      <span className="font-mono text-caption text-muted tabular-nums" data-testid="tour-progress">
        {label}
      </span>
    </span>
  );
}
