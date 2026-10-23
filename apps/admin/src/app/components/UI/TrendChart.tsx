export interface TrendChartBar {
  key: string;
  /** The tick under the bar (an hour or a day). */
  label: string;
  approved: number;
  declined: number;
  /** Read on hover / long press: the tick and both counts in words. */
  title: string;
}

export interface TrendChartProps {
  /** What the chart says in one sentence, for assistive tech (the bars are decorative to it). */
  summary: string;
  bars: TrendChartBar[];
  /** The top of the scale, in words ("12 max"), next to the top rule. */
  maxLabel: string;
}

const UNIT = 10;
const BAR = 6;
const HEIGHT = 100;
/** Ticks shown under the bars on any width: the first, every n-th, and the last. */
const MAX_TICKS = 6;

function showsTick(index: number, count: number): boolean {
  const step = Math.ceil(count / MAX_TICKS);
  const last = count - 1;
  // A regular tick too close to the last one would print over it.
  return index === last || (index % step === 0 && last - index >= step);
}

/** The edge ticks hug the edges, so a label wider than its bar never leaves the chart (W9). */
function tickAlign(index: number, count: number): string {
  if (count > 1 && index === 0) return 'text-left';
  if (count > 1 && index === count - 1) return 'text-right';
  return 'text-center';
}

/**
 * Stacked bars, approved below declined, drawn in SVG with token fills only (no chart library):
 * the scale stretches to the width, the hairline rules mark half and full scale, and each bar's
 * <title> names its counts. The legend with the totals lives outside, in words.
 */
export function TrendChart({ summary, bars, maxLabel }: TrendChartProps) {
  const max = Math.max(1, ...bars.map((bar) => bar.approved + bar.declined));
  const width = Math.max(1, bars.length) * UNIT;
  const scale = (value: number) => (value / max) * HEIGHT;
  return (
    <figure role="img" aria-label={summary} className="flex flex-col gap-2">
      <div className="relative">
        <span
          aria-hidden="true"
          className="absolute top-0 right-0 -translate-y-full pb-1 font-mono text-caption text-muted tabular-nums"
        >
          {maxLabel}
        </span>
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${width} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="block h-40 w-full overflow-visible sm:h-48"
        >
          {[0, HEIGHT / 2].map((y) => (
            <line
              key={y}
              x1={0}
              x2={width}
              y1={y}
              y2={y}
              className="stroke-border"
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line
            x1={0}
            x2={width}
            y1={HEIGHT}
            y2={HEIGHT}
            className="stroke-ink"
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          />
          {bars.map((bar, index) => {
            const x = index * UNIT + (UNIT - BAR) / 2;
            const approved = scale(bar.approved);
            const declined = scale(bar.declined);
            return (
              <g key={bar.key}>
                <title>{bar.title}</title>
                <rect
                  x={x}
                  width={BAR}
                  y={HEIGHT - approved}
                  height={approved}
                  className="fill-success"
                />
                <rect
                  x={x}
                  width={BAR}
                  y={HEIGHT - approved - declined}
                  height={declined}
                  className="fill-danger"
                />
              </g>
            );
          })}
        </svg>
      </div>
      <div
        aria-hidden="true"
        className="grid text-caption text-muted"
        style={{ gridTemplateColumns: `repeat(${Math.max(1, bars.length)}, minmax(0, 1fr))` }}
      >
        {bars.map((bar, index) => (
          <span
            key={bar.key}
            className={`whitespace-nowrap tabular-nums ${tickAlign(index, bars.length)}`}
          >
            {showsTick(index, bars.length) ? bar.label : ''}
          </span>
        ))}
      </div>
    </figure>
  );
}
