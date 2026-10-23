# Brand reference — acme-credit

The values in this file are the source of truth. The theme copies them one to one (web:
`packages/ui/src/theme.css` + HeroUI variables). To change a value, edit this file first, then
the theme, in the same commit.

> **Direction (owner decision, 2026-10-21):** the product keeps the challenge's name, **Acme
> Credit**, and adopts the visual language of **Belozfi** (belozfi.com.mx): their palette, type
> families and the neo-brutalist card style. Their logo and name are NOT used (trademark); the
> wordmark stays "Acme Credit". Default language es-MX with an English toggle; currency USD.

## Design context

- **Product.** Acme Credit's secured credit card and wallet. The customer leaves a security
  deposit (collateral), gets a card whose limit equals that deposit, shops in the in-wallet
  store, pays it back, and gets the deposit back when the account closes in good standing.
- **Audience.**
  - *Customer app* (`apps/web`): people building or rebuilding credit in Mexico and the US,
    mostly on phones. They want clear numbers and zero fine print.
  - *Admin* (`apps/admin`): operations and risk staff on desktop, scanning dense tables.
- **Personality.** Is: bold, friendly, straightforward. Is not: corporate, cold, cluttered.
- **Direction: "Belozfi bold".** Sunny yellow (`#FACE07`) is the action color: pill buttons
  with a solid darker-yellow bottom edge that reads as pressable. Cards are white with a 1.6 px
  outline and a hard offset shadow (4 px, no blur) in ink, yellow or violet. Section bands use
  soft tints (cream, lavender, mint). Headings are Golos Text bold; body is Inter.
- **Principles.**
  1. *Numbers first.* Every amount is exact, aligned and labeled; cents are never hidden.
  2. *One loud thing per screen.* Only the primary action is yellow; everything else is outline
     or text.
  3. *Say what happened to the money.* Each state (on hold, posted, returned, applied) has a word
     and a status chip, never only a color.
  4. *Same system, two densities.* Customer app roomy and touch-first (44 px); admin compact.

## Tokens

### Color

| Token | Light | Dark | Use |
|---|---|---|---|
| `brand-500` | `#FACE07` | `#FACE07` | primary action fill (pill buttons), active tab, highlights |
| `brand-600` | `#F0C000` | `#FBDE44` | primary hover |
| `brand-shadow` | `#D7AD05` | `#B38D03` | the solid 3 px bottom edge of yellow buttons |
| `on-brand` | `#010101` | `#010101` | text and icons on yellow |
| `violet` | `#7940C8` | `#C5A2F6` | links, focus ring, section titles, "secured / collateral" marker |
| `canvas` | `#F2F2F2` | `#0D0D0F` | page background |
| `surface-raised` | `#FFFFFF` | `#18181B` | cards, popovers, inputs, sheets |
| `cream` | `#FFFDEB` | `#26231A` | soft yellow band / selected row |
| `lavender` | `#E0CDFA` | `#2B2140` | soft violet band (how-it-works, info) |
| `mint` | `#D0FAA9` | `#1E2B17` | soft green chip background (approved, posted) |
| `neutral-soft` | `#EDEDED` | `#26262B` | secondary / ghost button fill, segmented controls |
| `neutral-soft-hover` | `#E2E2E2` | `#303036` | hover of `neutral-soft` |
| `ink` | `#010101` | `#FACE07` | card outlines and hard offset shadows (yellow in dark) |
| `fg` | `#0F172A` | `#F4F4F5` | primary text, amounts |
| `muted` | `#555555` | `#A1A1AA` | secondary text, captions |
| `border` | `#E5E5E5` | `#2E2E33` | hairline dividers, ledger rules (decorative) |
| `border-strong` | `#626262` | `#8A8A93` | input and control outlines (UI part, 3:1) |
| `danger` | `#A20042` | `#FF7A9C` | declines, overdue debt, destructive actions |
| `success` | `#17702F` | `#7FD99A` | approved, confirmed, repaid, returned |
| `warning` | `#8A6A00` | `#F5C542` | pending confirmation, holds, frozen card |

Token names avoid HeroUI's own (`accent`, `surface`, `background`): HeroUI keeps its names and
they point at these tokens (Token mapping). Status colors always come with a word or an icon.

### Contrast (measured, WCAG 2.2)

| Pair | Light | Dark | Needs |
|---|---|---|---|
| `fg` / `canvas` | 15.95 | 17.66 | 4.5 |
| `fg` / `surface-raised` | 17.85 | 16.12 | 4.5 |
| `muted` / `canvas` | 6.66 | 7.58 | 4.5 |
| `muted` / `surface-raised` | 7.46 | 6.91 | 4.5 |
| `on-brand` / `brand-500` | 13.81 | 13.81 | 4.5 |
| `on-brand` / `brand-600` | 12.17 | 15.54 | 4.5 |
| `violet` / `surface-raised` (links) | 6.21 | 8.33 | 4.5 |
| `violet` / `canvas` | 5.55 | 9.13 | 4.5 |
| `fg` / `cream` | 17.43 | 14.28 | 4.5 |
| `fg` / `lavender` | 12.14 | 13.70 | 4.5 |
| `fg` / `mint` | 15.24 | 13.52 | 4.5 |
| `border-strong` / `surface-raised` | 6.10 | 5.18 | 3.0 |
| `ink` / `surface-raised` (outlines) | 20.87 | 11.72 | 3.0 |
| `danger` / `surface-raised` | 8.03 | 7.18 | 4.5 |
| `success` / `surface-raised` | 6.19 | 10.37 | 4.5 |
| `warning` / `surface-raised` | 5.07 | 10.92 | 4.5 |

Yellow on the light canvas is 1.35:1: a yellow fill is never the only boundary of a control —
yellow buttons carry black text and the darker bottom edge, yellow cards an ink outline.

### Shape, spacing, depth

- **Spacing.** Tailwind's default 4 px scale. Customer content max width `72rem` on desktop, `100rem` from `2xl` (TV, where the rem scale also steps up on screens ≥ 1800×1000); wallet, card, store and activity fit one screen from `lg` with `clamp()`/`dvh` spacing
  (two-column layouts from `lg`), `40rem` for single forms.
- **Radii.** `radius-card` = `16px` (cards, dialogs, sheets); `radius-control` = `9999px`
  (pill buttons, chips, segmented controls); inputs use `12px` (`radius-field`).
- **Outlines.** Feature cards: `1.6px solid ink` (`border-[1.6px]` is allowed: off-scale).
- **Shadows (hard, no blur).**
  - `shadow-raised` = `4px 4px 0 0 ink` (outlined cards)
  - `shadow-overlay` = `6px 6px 0 0 ink` (dialogs, popovers)
  - `shadow-press` = `0 3px 0 0 brand-shadow` (yellow buttons; pressed = translate 3 px down, no
    shadow)
- **Card visual (signature, owner decision 2026-10-21).** True card proportions (1.586:1),
  `radius-card`, an ink (`on-brand`) outline and a hard offset `shadow-card` (5 px, ink in light,
  violet in dark). Brand-yellow face in both themes with a quiet engraved pattern built from the
  tokens only (`card-face` in `theme.css`: rings from the lower-right corner and one lighter
  diagonal band; ink overlays under 8 %, so ink text keeps 13.8:1). On the face: the wordmark
  (Golos 700) with its square, a "SECURED / GARANTIZADA" pill (yellow on ink), an EMV chip and a
  contactless glyph (icon components), `•••• last4` in mono, the cardholder uppercase with wide
  tracking, "EXPIRES / VENCE MM/YY" and our own mark (two overlapping circles, ink and violet; not
  a real network's logo). Frozen = desaturated face + frosted veil (`card-frost`) + snowflake +
  the "Frozen / Congelada" chip; every text stays legible. Sizes: large (card page), regular,
  compact (checkout), thumb (home summary, decorative). Desktop pointer only: a slight tilt and
  one sweep of light under 250 ms (`card-motion`); none under reduced motion. This pattern is the
  one place a CSS gradient is allowed (never on text, never purple-to-blue).

### Motion

| Token | Value | Use |
|---|---|---|
| `duration-fast` | `150ms` | hover, press, focus, toggle |
| `duration-normal` | `250ms` | dialogs, sheets, page transitions (view transitions) |
| `ease-out` | `cubic-bezier(0.22, 1, 0.36, 1)` | entering |
| `ease-in` | `cubic-bezier(0.55, 0, 1, 0.45)` | leaving |

Page navigation uses Astro's ClientRouter with a short fade/slide (≤ 250 ms). Amounts never
count up. Under `prefers-reduced-motion`, only opacity transitions remain.

## Typography

| Role | Family | Weights | Size / line height (mobile → desktop) |
|---|---|---|---|
| `display` | Golos Text | 600, 700 | h1 `2rem/1.15 → 3.25rem/1.1` · h2 `1.5rem/1.2 → 2.25rem/1.15` · h3 `1.25rem/1.3 → 1.5rem/1.25` |
| `body` | Inter | 400, 500, 600 | body `1rem/1.55` · small `0.875rem/1.45` · caption `0.75rem/1.4` |
| `mono` | IBM Plex Mono | 500 | amounts; hero balance `2.25rem/1.1 → 3rem/1.05` |

- Amounts: `font-mono tabular-nums`, right-aligned in tables; cents at 0.75 em in `muted`.
- Currency through `Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' })` from
  integer cents (es-MX shows `USD 1,250.00`; en-US `$1,250.00`).
- Fonts self-hosted (`@fontsource-variable/golos-text`, `@fontsource-variable/inter`,
  `@fontsource/ibm-plex-mono`), Latin subset, `font-display: swap`; Inter regular preloaded.
  All SIL OFL 1.1.

## Voice and tone

- **Languages.** es-MX (default) and en-US, switchable from the header; the choice is stored
  per device. Every key exists in both locales.
- **Formality.** Friendly and direct; "tú" in Spanish, "you" in English. Short sentences.
- **We sound:** clear, encouraging, honest about money. **Never:** cheerful about debt,
  pushy, jargon-heavy.
- **Use (es / en):** "depósito de garantía" / "security deposit" (first mention adds
  "(colateral)" / "(collateral)"), "disponible para gastar" / "available to spend", "límite de
  crédito" / "credit limit", "en espera" / "on hold", "te lo devolvemos" / "returned to you".
- **Avoid:** "oops", "awesome", "unlock", "instant approval", "free money".
- **Rules.** Errors say what happened and what to do next. Empty states teach the first action.
  Buttons are verbs. Every money message names the amount.

## Imagery and logo

- **Logo.** None. Wordmark "Acme Credit" in Golos Text 700 with a small yellow square mark
  outlined in ink. Never use Belozfi's logo or name.
- **Icons.** Lucide outline, 1.75 px stroke, 16 / 20 / 24.
- **Imagery.** The in-wallet store uses simple flat illustrations or emoji-free icon tiles on
  tinted backgrounds (cream, lavender, mint); no stock photos.

## Do / don't

| Do | Don't |
|---|---|
| One yellow primary action per view | Several yellow buttons competing |
| Outlined white cards with hard ink shadows for key content | Soft blurred shadows, glassmorphism, gradients |
| Show available, on hold and owed side by side in mono | One "balance" number hiding holds |
| Pair every status color with a word | Color as the only signal |
| Tinted section bands (cream / lavender / mint) to group content | Rainbow of tints on one screen |
| Pill buttons and chips; 12 px inputs | Square buttons or pill inputs |
| Keep 44 px touch targets in the customer app | Shrink admin density into the customer app |

Also never: purple-to-blue gradients, neon on dark, gradient text, pure `#000` text on the
canvas (use `fg`), the brand yellow as text on light backgrounds.

## Token mapping

**Web (Tailwind v4, CSS-first; `packages/ui/src/theme.css`, imported by both apps).**

- `@theme` holds the light values as `--color-<token>` (`--color-brand-500`, `--color-violet`,
  `--color-ink`, `--color-cream`, …), `--radius-card`, `--radius-control`, `--radius-field`,
  `--font-display` (Golos Text), `--font-body` / `--font-sans` (Inter), `--font-mono`, the
  motion and type-scale tokens.
- Dark values override the same variables under `[data-theme="dark"]` (set before paint from
  the stored choice or `prefers-color-scheme`; the header toggle cycles light / dark / system).
- Shadows live in `@theme inline` pointing at runtime variables so dark values apply
  (`shadow-raised`, `shadow-overlay`, `shadow-press`).
- HeroUI v3 variables point at these tokens: `--accent` → `brand-500`, `--accent-foreground` →
  `on-brand`, `--focus`/`--link` → `violet`, `--background` → `canvas`, `--surface`/`--overlay`
  /`--field-background` → `surface-raised`, `--default`/`--segment` → `neutral-soft`,
  `--foreground` etc. → `fg`, `--border` → `border`, `--field-border` → `border-strong`,
  `--field-radius` → `radius-field`, `--radius` → `radius-control`, `--field-shadow` → none,
  status colors → status tokens.

Components only ever use token utilities. Literal values never appear outside this file and
`theme.css` (W8).

**Mobile.** No mobile scope.
