import { Skeleton as HeroSkeleton } from '@heroui/react';

export interface SkeletonProps {
  /** Size and radius utilities (tokens only), e.g. "h-6 w-32 rounded-control". */
  className: string;
}

/** A placeholder block; decorative, so hidden from assistive tech (the region says "loading"). */
export function Skeleton({ className }: SkeletonProps) {
  return <HeroSkeleton aria-hidden="true" animationType="pulse" className={className} />;
}
