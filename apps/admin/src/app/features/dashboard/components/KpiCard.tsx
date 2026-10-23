import { ArrowRight, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Icon } from '@/app/components/UI/Icon';
import type { KpiTone } from '../types';

const TILE: Record<KpiTone, string> = {
  neutral: 'bg-neutral-soft text-fg',
  violet: 'bg-lavender text-violet',
  warning: 'bg-cream text-warning',
  danger: 'bg-surface-raised text-danger border-[1.6px] border-danger',
  success: 'bg-mint text-success',
};

interface KpiCardProps {
  id: string;
  label: string;
  icon: LucideIcon;
  tone: KpiTone;
  children: ReactNode;
  link?: { href: string; label: string } | undefined;
}

/**
 * One key figure: an outlined card with the hard ink shadow (docs/brand.md), an icon tile whose
 * tint says what kind of figure it is (never the only signal: the label says it), the figure big,
 * and what it means underneath. A card that leads somewhere ends with that link.
 */
export function KpiCard({ id, label, icon, tone, children, link }: KpiCardProps) {
  return (
    <section
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-2 rounded-card border-[1.6px] border-ink bg-surface-raised p-3 shadow-raised sm:gap-3 sm:p-4 md:p-5"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <span
          aria-hidden="true"
          className={`flex size-7 shrink-0 items-center justify-center rounded-field sm:size-9 ${TILE[tone]}`}
        >
          <Icon icon={icon} size={20} />
        </span>
        <h3 id={id} className="min-w-0 text-small font-semibold text-fg">
          {label}
        </h3>
      </div>
      <div className="flex grow flex-col gap-1.5">{children}</div>
      {link && (
        <a
          href={link.href}
          className="-mb-2 inline-flex min-h-11 items-center gap-1 self-start text-caption font-semibold text-violet underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-violet sm:text-small"
        >
          {link.label}
          <Icon icon={ArrowRight} size={16} />
        </a>
      )}
    </section>
  );
}
