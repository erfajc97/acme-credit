import type { ReactNode } from 'react';

export type NoticeTone = 'neutral' | 'success' | 'warning' | 'danger';

/** A full outline + a soft tint per tone (no side stripe), and a marker that is not only color. */
const TONE_CLASS: Record<NoticeTone, { box: string; title: string; mark: string }> = {
  neutral: { box: 'border-border-strong bg-lavender', title: 'text-fg', mark: 'i' },
  success: { box: 'border-success bg-mint', title: 'text-success', mark: '✓' },
  warning: { box: 'border-warning bg-cream', title: 'text-warning', mark: '!' },
  danger: { box: 'border-danger bg-surface-raised', title: 'text-danger', mark: '!' },
};

export interface InlineNoticeProps {
  tone: NoticeTone;
  title: string;
  children?: ReactNode;
}

/**
 * A result or notice rendered in the page (W5: not a toast). A danger notice is an alert; the
 * rest are polite status updates (W10).
 */
export function InlineNotice({ tone, title, children }: InlineNoticeProps) {
  const style = TONE_CLASS[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex gap-3 rounded-card border-[1.6px] p-4 ${style.box}`}
    >
      <span
        aria-hidden="true"
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-[1.6px] border-current font-display text-small font-bold ${style.title}`}
      >
        {style.mark}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className={`font-semibold ${style.title}`}>{title}</p>
        {children && <div className="text-small text-fg">{children}</div>}
      </div>
    </div>
  );
}
