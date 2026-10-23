/** The contactless glyph: four widening arcs. Decorative (the card is not tappable here). */
export function ContactlessIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className}>
      <path
        d="M7 9.5a4 4 0 0 1 0 5M10.5 7.5a8 8 0 0 1 0 9M14 5.5a12 12 0 0 1 0 13M17.5 3.5a16 16 0 0 1 0 17"
        className="fill-none stroke-current"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
