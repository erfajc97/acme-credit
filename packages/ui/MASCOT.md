# Credi — mascot, logo mark, splash and walker (`@acme/ui`)

Credi is the brand mascot: a yellow credit card. Everything below is shared by `apps/web` and
`apps/admin`. Assets are imported through Vite `?url` inside the package, so each app gets
hashed `/_astro/` files: nothing to copy into `public/`.

## Logo mark

- `@acme/ui/Wordmark.astro` (`name` prop) now draws the mark (a mini Credi, SVG, tokens only)
  instead of the yellow square. No change needed in consumers.
- `@acme/ui/BrandMark.astro` — the mark alone (`class` sets the size, e.g. `size-7`). Decorative.
- Favicons are generated, not hand-made: `node packages/ui/scripts/render-brand-assets.mjs`
  writes `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`
  and `manifest.webmanifest` into `apps/web/public` and `apps/admin/public` (plus the web's
  `og.png` / `og-en.png`). Source: `assets/brand/mark.svg` (literal colors allowed there).

## Static poses (React and Astro)

```ts
import { Mascot, MASCOT_POSES, MASCOT_POSE_SRC, type MascotPose } from '@acme/ui';
// MascotPose = 'wave' | 'point' | 'celebrate' | 'walk' | 'think'
<Mascot pose="point" size="md" motion="float" />            // decorative (alt="")
<Mascot pose="celebrate" size="lg" label={t('…')} loading="eager" /> // meaningful (named img)
```

- `size`: `xs` 40 px · `sm` 64 · `md` 96 (default) · `lg` 144 · `xl` 224.
- `motion`: `none` (default) · `float` (slow, tour / hero) · `bob` (quick). Classes
  `animate-mascot-float` / `animate-mascot-bob` come from `theme.css`; the global
  reduced-motion rule stops them.
- `loading`: `lazy` (default) or `eager` (above the fold). `className` is appended.
- Astro: `import Mascot from '@acme/ui/Mascot.astro'` with the same props (`class` instead of
  `className`).
- Animated walk: `MASCOT_WALK_LOOP_SRC` (animated WebP with alpha, 320 px, 5 s loop, ~500 kB:
  always lazy + `fetchpriority="low"`) and `MASCOT_WALK_POSTER_SRC` (its first frame, 10 kB, use it
  under reduced motion). `MASCOT_WALK_SIZE = 320`, `MASCOT_POSE_SIZE = 512`.
- Raw files are also exported as `@acme/ui/assets/mascot/<file>` (e.g. `mascot-walk.mp4`, white
  background, no alpha — not used by the shared components).

## Brand splash (first load of a session)

Two pieces in the app's `BaseLayout.astro`:

```astro
---
import BrandSplash from '@acme/ui/BrandSplash.astro';
import SplashGate from '@acme/ui/SplashGate.astro';
---
<head>
  …
  <ThemeScript />
  <SplashGate />        <!-- inline, pre-paint: sets html[data-splash] -->
  <ClientRouter />
</head>
<body>
  <BrandSplash name={t('app.name')} />  <!-- first child of body -->
  <slot />
</body>
```

And in `astro.config.mjs` add the gate's CSP hash next to the theme's:

```js
import { splashGateScriptHash, themeScriptHash } from '@acme/ui/theme-hash';
scriptDirective: { hashes: [themeScriptHash(), splashGateScriptHash()] },
```

Exactly ONE Credi is on screen at any moment: the walker shows its poster until the animated
loop is decoded, then the loop replaces it (`src/mascot/loop-ready.ts`; never both stacked, which
drew "4 arms and 4 legs"); the walker fades out (880–1000 ms) before the waving pose fades in
(1000–1120 ms). Any new mascot surface follows the same rule.

Behaviour: ~1.6 s (mark pops and turns in, letters slide, Credi walks in and waves, fade); once
per browser session (`sessionStorage['acme-splash-played']`, exported as `SPLASH_STORAGE_KEY`);
never on ClientRouter swaps; click / pointer or Esc skips; removed in ≤ 2 s even if a
`transitionend` is missed; reduced motion = the static final composition and a fade;
`?intro=1` (`SPLASH_REPLAY_PARAM`) replays it on demand and is stripped from the URL afterwards.
E2E: set `sessionStorage['acme-splash-played'] = '1'` in an init script to start without it (the
overlay otherwise intercepts the first clicks for up to 1.6 s).

## Walking mascot

```astro
import WalkingMascot from '@acme/ui/WalkingMascot.astro';
<WalkingMascot class="bottom-0" />
```

A fixed, full-width, 4.5rem-tall strip (position it with `class`: `bottom-0`, or above a tab
bar). Credi crosses it in ~12 s every 40 s (first pass after 8 s), pauses on mouse hover, never
takes taps (only fine pointers reach it), `aria-hidden`, hidden under reduced motion.

## Paginator (numbered pagination, shared by web and admin)

```tsx
import { Paginator, type PaginatorLabels } from '@acme/ui';

const labels: PaginatorLabels = {
  nav: t('orders.pages'), // names the <nav> landmark
  previous: t('pagination.previous'),
  next: t('pagination.next'),
  page: (page) => t('pagination.page', { page }), // "Page 4" (button name)
  status: (page, total) => t('pagination.status', { page, total }), // "Page 4 of 20"
};
<Paginator
  page={page}
  totalPages={data.totalPages}
  onPageChange={setPage}
  labels={labels}
  isDisabled={isPlaceholderData}
/>;
```

- Contract: `?page=N&pageSize=10` → `{ items, page, pageSize, total, totalPages }`
  (`packages/contracts/src/common.ts`, `PAGE_SIZE_MAX = 10`). `page` is 1-based.
- From `md` up: `‹ Previous` · `1 … 4 5 6 … 20` · `Next ›` (7 slots once it collapses, so the
  row never jumps; `pageItems({ page, totalPages })` is the pure helper). On phones: `‹` ·
  "Page 4 of 20" (`aria-live="polite"`) · `›`; the arrow buttons keep their names for screen
  readers.
- `<nav aria-label>` landmark, the current page has `aria-current="page"`, every target ≥ 44 px,
  previous/next disabled at the ends, `isDisabled` blocks everything while the next page loads.
- Renders nothing when `totalPages <= 1`. Pressing the current page does not call `onPageChange`.
- The consumer owns the rest: the page lives in the URL (W17, one parser), the query uses
  `placeholderData: keepPreviousData`, focus moves to the list heading after a change, and the
  range summary ("Showing 11–20 of 47") is the list's own copy.
