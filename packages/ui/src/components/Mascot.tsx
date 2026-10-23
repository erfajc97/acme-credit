import { MASCOT_POSE_SIZE, MASCOT_POSE_SRC, type MascotPose } from '../mascot/assets';

export type MascotSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type MascotMotion = 'none' | 'float' | 'bob';

export interface MascotProps {
  pose: MascotPose;
  /** xs 40 px · sm 64 · md 96 · lg 144 · xl 224. */
  size?: MascotSize;
  /** A gentle float or a quick bob; the global reduced-motion rule stops both. */
  motion?: MascotMotion;
  /** Only when the mascot carries meaning; decorative by default (alt=""). */
  label?: string;
  loading?: 'eager' | 'lazy';
  className?: string;
}

const SIZE_CLASS: Record<MascotSize, string> = {
  xs: 'size-10',
  sm: 'size-16',
  md: 'size-24',
  lg: 'size-36',
  xl: 'size-56',
};

const MOTION_CLASS: Record<MascotMotion, string> = {
  none: '',
  float: 'animate-mascot-float',
  bob: 'animate-mascot-bob',
};

/** Credi in one pose. A local, fixed-size asset: no safe-image wrapper needed (W13). */
export function Mascot({
  pose,
  size = 'md',
  motion = 'none',
  label,
  loading = 'lazy',
  className = '',
}: MascotProps) {
  return (
    <img
      src={MASCOT_POSE_SRC[pose]}
      alt={label ?? ''}
      width={MASCOT_POSE_SIZE}
      height={MASCOT_POSE_SIZE}
      loading={loading}
      decoding="async"
      draggable={false}
      data-pose={pose}
      className={[SIZE_CLASS[size], 'object-contain select-none', MOTION_CLASS[motion], className]
        .filter(Boolean)
        .join(' ')}
    />
  );
}
