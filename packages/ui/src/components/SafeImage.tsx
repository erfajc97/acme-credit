import { useState, type ReactNode } from 'react';

export interface SafeImageProps {
  src: string;
  /** What the image shows, translated; `""` when it is decorative. */
  alt: string;
  /** Intrinsic size: the box is reserved before the image loads (no layout shift). */
  width: number;
  height: number;
  /** "lazy" (default) below the fold; "eager" for the first visible images. */
  loading?: 'eager' | 'lazy';
  className?: string;
  /** Shown instead of a broken-image icon when the file is missing or fails to load. */
  fallback: ReactNode;
}

/**
 * The only door for images (W13): fixed dimensions, lazy below the fold, async decoding, and a
 * placeholder when the image is missing or broken. A new `src` needs a new `key` at the call site
 * to retry after a failure.
 */
export function SafeImage({
  src,
  alt,
  width,
  height,
  loading = 'lazy',
  className = '',
  fallback,
}: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return fallback;
  return (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
