import type { ReactNode } from 'react';
import { ContactlessIcon } from '../icons/ContactlessIcon';
import { EmvChipIcon } from '../icons/EmvChipIcon';
import { SnowflakeIcon } from '../icons/SnowflakeIcon';

export type PaymentCardSize = 'large' | 'regular' | 'compact' | 'thumb';

export interface PaymentCardProps {
  brandName: string;
  /** Last four digits; the rest is masked. */
  last4: string;
  /** Screen-reader name of the number, e.g. "Card ending in 4242". */
  numberLabel: string;
  expiryLabel: string;
  /** "MM/YY". */
  expiry: string;
  /** A status chip shown on the face, e.g. "Frozen". */
  badge?: ReactNode;
  /** A frozen card is desaturated under a frosted veil (its chip says why, never the color alone). */
  isFrozen?: boolean;
  /**
   * "large" is the card page's hero; "regular" the full card; "compact" the small card of the
   * checkout summary; "thumb" a tiny
   * decorative face for summaries that name the card in text next to it (it is aria-hidden).
   */
  size?: PaymentCardSize;
  /** Printed uppercase on the face, e.g. the signed-in customer's name. */
  holderName?: string | undefined;
  /** The small pill on the face, e.g. "SECURED" / "GARANTIZADA". */
  securedLabel?: string | undefined;
}

const FRAME =
  'relative isolate aspect-[1.586] overflow-hidden border-[1.6px] border-on-brand text-on-brand';

/** Per size: the frame's width and padding and the scale of each element on the face. */
const LOOK: Record<
  Exclude<PaymentCardSize, 'thumb'>,
  Record<'frame' | 'wordmark' | 'chip' | 'contactless' | 'number' | 'holder', string>
> = {
  large: {
    frame: 'max-w-md p-5 sm:p-6',
    wordmark: 'text-h3 sm:text-h3-lg',
    chip: 'h-8 w-11 sm:h-10 sm:w-14',
    contactless: 'size-6 sm:size-7',
    number: 'text-h3-lg sm:text-h2',
    holder: 'text-caption sm:text-small',
  },
  regular: {
    frame: 'max-w-sm p-5',
    wordmark: 'text-h3',
    chip: 'h-8 w-11',
    contactless: 'size-6',
    number: 'text-h3-lg',
    holder: 'text-caption',
  },
  compact: {
    frame: 'max-w-64 p-3.5',
    wordmark: 'text-small',
    chip: 'h-6 w-8',
    contactless: 'size-5',
    number: 'text-body',
    holder: 'text-caption',
  },
};

/** Our own network-style mark: two overlapping circles, ink and violet. Not a real network's logo. */
function NetworkMark({ small = false }: { small?: boolean }) {
  const circle = small ? 'size-3' : 'size-6';
  const overlap = small ? '-ml-1.5' : '-ml-2.5';
  return (
    <span aria-hidden="true" className="flex items-center">
      <span className={`${circle} rounded-full border-[1.6px] border-on-brand bg-on-brand`} />
      <span
        className={`${circle} ${overlap} rounded-full border-[1.6px] border-on-brand bg-violet opacity-90`}
      />
    </span>
  );
}

/** The veil of a frozen card: frosted, with a snowflake; the text underneath stays legible. */
function FrostVeil({ small = false }: { small?: boolean }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 card-frost">
      <SnowflakeIcon
        className={`absolute text-on-brand opacity-60 ${small ? 'top-1 right-1 size-4' : 'right-4 bottom-12 size-14'}`}
      />
    </span>
  );
}

/**
 * The payment card (docs/brand.md › Card visual): a brand-yellow face with an engraved pattern,
 * an ink outline and a hard offset shadow, the EMV chip, the contactless glyph, the wordmark, the
 * "secured" pill, the cardholder, `•••• last4` in mono, the expiry and our two-circle mark. Ink on
 * yellow everywhere (13.8:1). Frozen = desaturated face + frosted veil + its chip. On a desktop
 * pointer it tilts slightly with one sweep of light (reduced motion: none).
 */
export function PaymentCard({
  brandName,
  last4,
  numberLabel,
  expiryLabel,
  expiry,
  badge,
  isFrozen = false,
  size = 'regular',
  holderName,
  securedLabel,
}: PaymentCardProps) {
  const face = `card-face absolute inset-0 -z-10 ${isFrozen ? 'grayscale' : ''}`;
  if (size === 'thumb') {
    return (
      <div
        aria-hidden="true"
        data-frozen={isFrozen || undefined}
        className={`${FRAME} w-16 shrink-0 rounded-md`}
      >
        <span data-card-face className={face} />
        <EmvChipIcon className="absolute top-2.5 left-2 h-2.5 w-3.5" />
        <span className="absolute right-1.5 bottom-1.5">
          <NetworkMark small />
        </span>
        {isFrozen && <FrostVeil small />}
      </div>
    );
  }
  const look = LOOK[size];
  const isCompact = size === 'compact';
  return (
    <div
      data-frozen={isFrozen || undefined}
      className={`${FRAME} card-motion flex w-full flex-col justify-between rounded-card shadow-card ${look.frame}`}
    >
      <span data-card-face className={face} />
      {isFrozen && <FrostVeil small={isCompact} />}

      <div className="relative z-20 flex items-start justify-between gap-2">
        <span
          className={`flex items-center gap-2 font-display font-bold tracking-tight whitespace-nowrap ${look.wordmark}`}
        >
          <span
            aria-hidden="true"
            className="size-3 border-[1.6px] border-on-brand bg-surface-raised"
          />
          {brandName}
        </span>
        <span className="flex flex-col items-end gap-1.5">
          {securedLabel && (
            <span className="rounded-control bg-on-brand px-2 py-0.5 text-caption font-bold tracking-widest text-brand-500 uppercase">
              {securedLabel}
            </span>
          )}
          {badge}
        </span>
      </div>

      <div aria-hidden="true" className="relative flex items-center gap-2">
        <EmvChipIcon className={look.chip} />
        <ContactlessIcon className={look.contactless} />
      </div>

      <div className="relative flex flex-col gap-1">
        <p className={`font-mono font-medium tracking-widest tabular-nums ${look.number}`}>
          <span className="sr-only">{numberLabel}</span>
          <span aria-hidden="true">•••• {last4}</span>
        </p>
        <div className="flex items-end justify-between gap-3">
          <span className="flex min-w-0 flex-col">
            {holderName && !isCompact && (
              <span className={`truncate font-semibold tracking-widest uppercase ${look.holder}`}>
                {holderName}
              </span>
            )}
            <span className="flex items-baseline gap-1.5 text-caption">
              <span className="font-semibold tracking-wider uppercase">{expiryLabel}</span>
              <span className="font-mono text-small font-medium">{expiry}</span>
            </span>
          </span>
          <NetworkMark small={isCompact} />
        </div>
      </div>
    </div>
  );
}
