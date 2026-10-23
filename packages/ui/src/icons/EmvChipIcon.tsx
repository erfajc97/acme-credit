/** The card's EMV chip: a gold contact plate with its etched pads. Decorative. */
export function EmvChipIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 40 30" className={className}>
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="28.5"
        rx="5"
        className="fill-brand-shadow stroke-on-brand"
        strokeWidth="1.5"
      />
      <path
        d="M0.75 10h11m-11 10h11M28 10h11.25M28 20h11.25M12 0.75v28.5M28 0.75v28.5M12 15h16"
        className="fill-none stroke-on-brand"
        strokeWidth="1.25"
        strokeOpacity="0.7"
      />
      <rect
        x="15"
        y="6"
        width="10"
        height="18"
        rx="2.5"
        className="fill-brand-600 stroke-on-brand"
        strokeWidth="1.25"
        strokeOpacity="0.7"
      />
    </svg>
  );
}
