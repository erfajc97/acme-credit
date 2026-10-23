/** A chevron pointing to the start or the end of a row (Lucide's geometry, 2 px stroke). Decorative. */
export function ChevronIcon({
  direction,
  className = '',
}: {
  direction: 'start' | 'end';
  className?: string;
}) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className}>
      <path
        d={direction === 'start' ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'}
        className="fill-none stroke-current"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
