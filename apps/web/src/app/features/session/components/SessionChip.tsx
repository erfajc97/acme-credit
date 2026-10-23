import { useSessionChip } from '../hooks/useSessionChip';

/** Avatar initial (+ first name from sm) linking to the profile; same footprint before the session is known. */
export default function SessionChip() {
  const chip = useSessionChip();
  if (!chip.isVisible) return <div className="size-11" aria-hidden="true" />;
  return (
    <a
      href={chip.href}
      aria-label={chip.label}
      className="inline-flex min-h-11 items-center gap-2 rounded-control border-[1.6px] border-ink bg-surface-raised p-1 text-small font-semibold text-fg transition-colors duration-fast hover:bg-neutral-soft sm:pr-4"
    >
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full bg-brand-500 font-display font-bold text-on-brand"
      >
        {chip.initial}
      </span>
      <span aria-hidden="true" className="hidden max-w-32 truncate sm:inline">
        {chip.firstName}
      </span>
    </a>
  );
}
