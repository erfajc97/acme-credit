import celebrateSrc from '../../assets/mascot/mascot-celebrate.webp?url';
import pointSrc from '../../assets/mascot/mascot-point.webp?url';
import thinkSrc from '../../assets/mascot/mascot-think.webp?url';
import walkLoopSrc from '../../assets/mascot/mascot-walk-loop.webp?url';
import walkPosterSrc from '../../assets/mascot/mascot-walk-poster.webp?url';
import walkSrc from '../../assets/mascot/mascot-walk.webp?url';
import waveSrc from '../../assets/mascot/mascot-wave.webp?url';

/**
 * Credi, the brand mascot (a yellow credit card). Imported through Vite `?url`, so every app gets
 * hashed, immutable `/_astro/` files without copying anything into its `public/`.
 */
export const MASCOT_POSES = ['wave', 'point', 'celebrate', 'walk', 'think'] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

export const MASCOT_POSE_SRC: Readonly<Record<MascotPose, string>> = {
  wave: waveSrc,
  point: pointSrc,
  celebrate: celebrateSrc,
  walk: walkSrc,
  think: thinkSrc,
};

/** Square pose files (transparent, bottom-aligned). */
export const MASCOT_POSE_SIZE = 512;

/**
 * The animated walk (WebP with alpha, 5 s loop: walks, stops, waves, walks on). Heavy (~500 kB):
 * always lazy / low priority, never in the critical path; the poster is its first frame.
 */
export const MASCOT_WALK_LOOP_SRC = walkLoopSrc;
export const MASCOT_WALK_POSTER_SRC = walkPosterSrc;
export const MASCOT_WALK_SIZE = 320;
