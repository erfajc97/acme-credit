import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { useId } from 'react';
import type { Key } from 'react-aria-components';
import { ChipScroller } from './ChipScroller';

export interface SegmentedOption {
  value: string;
  label: string;
}

export interface SegmentedFilterProps {
  label: string;
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  /** The label stays for assistive tech but is not drawn (the chips speak for themselves). */
  hideLabel?: boolean;
  /**
   * One row that scrolls sideways at every width (ChipScroller: hidden scrollbar, edge fades, snap,
   * arrows with a mouse) instead of wrapping into several rows. The labels name the arrows.
   */
  scroll?: { previousLabel: string; nextLabel: string };
}

/**
 * One choice among a few filter values, all visible (a list filter, not a form field). Built on
 * HeroUI v3's ToggleButtonGroup so arrows, selection and the group's name come from react-aria
 * (W10). Wraps on phones; each option keeps a 44 px target there (W9) and gets compact on desktop.
 */
export function SegmentedFilter({
  label,
  options,
  value,
  onChange,
  hideLabel = false,
  scroll,
}: SegmentedFilterProps) {
  const labelId = useId();
  const onSelectionChange = (keys: Set<Key>) => {
    const [first] = keys;
    // react-aria re-reports the current key when it is pressed again: not a change.
    if (first !== undefined && String(first) !== value) onChange(String(first));
  };
  const group = (
    <ToggleButtonGroup
      aria-labelledby={labelId}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={new Set([value])}
      onSelectionChange={onSelectionChange}
      isDetached
      className={`flex justify-start gap-2 ${scroll ? 'w-max flex-nowrap' : 'flex-wrap'}`}
    >
      {options.map((option) => (
        <ToggleButton
          key={option.value}
          id={option.value}
          className="min-h-11 shrink-0 snap-start rounded-control border-[1.6px] border-border-strong bg-surface-raised px-4 text-small font-semibold text-fg data-hovered:bg-neutral-soft data-selected:border-ink data-selected:bg-fg data-selected:text-canvas lg:min-h-10"
        >
          {option.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span id={labelId} className={hideLabel ? 'sr-only' : 'text-small font-medium text-fg'}>
        {label}
      </span>
      {scroll ? (
        <ChipScroller previousLabel={scroll.previousLabel} nextLabel={scroll.nextLabel}>
          {group}
        </ChipScroller>
      ) : (
        group
      )}
    </div>
  );
}
