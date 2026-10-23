interface CartBadgeProps {
  count: number;
  label: string;
}

/** A small ink-outlined count on the Store tab; read as "3 en tu carrito" by screen readers. */
export function CartBadge({ count, label }: CartBadgeProps) {
  if (count === 0) return null;
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-control border border-ink bg-brand-500 px-1 font-mono text-caption font-semibold text-on-brand tabular-nums">
      <span aria-hidden="true">{count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
