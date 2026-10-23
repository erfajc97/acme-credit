/** The frozen marker on the card face (Lucide's snowflake geometry, 1.75 px stroke). Decorative. */
export function SnowflakeIcon({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={className}>
      <path
        d="M2 12h20M12 2v20m8-17-3 3m-10 10-3 3m16 0-3-3M7 7 4 4m6-2 2 2 2-2m-4 20 2-2 2 2M22 10l-2 2 2 2M2 10l2 2-2 2"
        className="fill-none stroke-current"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
