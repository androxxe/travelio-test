# Design notes

The product is a book search, built for a travel company's engineering test. The visual language borrows from Travelio's own palette (their site's `theme-color` is `#E04848`, with `#B71E2B` in their CSS) and from print bookselling: a literary serif, generous margins, and one loud masthead instead of decorative gradients.

## Palette

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `--background` | `#F4F4F2` | page canvas (cool newsprint, deliberately not cream) | — |
| `--surface` | `#FFFFFF` | header, cards, inputs | — |
| `--ink` | `#17181A` | headings, book titles | 16.2:1 on canvas |
| `--muted-foreground` | `#6E6C68` | authors, counts, helper copy | 5.2:1 on white |
| `--line` | `#E2E2DD` | hairlines, cover borders | — |
| `--brand-strong` | `#B71E2B` | result band, primary button, error icon | 6.5:1 with white |
| `--brand` | `#E04848` | hearts, focus rings, active nav dot | 4.0:1 on white — graphics and large text only |
| `--rating` | `#B7791F` | filled stars | 3.6:1 on white (non-text, passes 3:1) |

`#E04848` is never used for small text on white: 4.0:1 fails AA for body copy. Filled buttons therefore use `#B71E2B`, while the brighter red stays on icons and the saved heart.

White at 90% on the red band measures 5.1:1, so the meta line in the band is readable; the earlier 75% version was 4.2:1 and was corrected.

## Typography

- **Newsreader Variable** — page headline, the echoed query in the result band (italic), book titles. Self-hosted via Fontsource.
- **Instrument Sans Variable** — navigation, search field, buttons, author names, counts, stars label. Self-hosted via Fontsource.

Two families, clearly distinct. No monospace metadata labels, no tracked-out uppercase eyebrows, no all-caps section labels. Body line length is capped around 65–70 characters (`max-w-lg`/`max-w-2xl`).

Type scale (approximate): 64px hero (clamp 2.6rem–4.2rem), 34px band query, 17px book title, 16px body, 13px meta, 11px rating count.

## Layout

```
DESKTOP
┌──────────────────────────────────────────────────────────────┐
│ Shelf.                                    Search   Wishlist 3 │  white, hairline
├──────────────────────────────────────────────────────────────┤
│  Find your next read.                                        │
│  Search millions of titles…                                  │
│  [ search field                                  (Search) ]  │
│  Try  Dune   Atomic Habits   design systems                  │
│                                                              │
├──────────────────────────────────────────────────────────────┤ full-bleed oxblood
│  “dune”                                        842 books     │
├──────────────────────────────────────────────────────────────┤
│  [cover]   [cover]   [cover]   [cover]                       │
│  title     title     title     title                         │
│  author    author    author    author                        │
│  ★★★★☆     …                                                │
└──────────────────────────────────────────────────────────────┘
```

```
MOBILE (390px)
┌──────────────────────────┐
│ Shelf.      Search  Wish │
├──────────────────────────┤
│ Find your next read.     │
│ [ search…      (Search) ]│
│ Try chips                │
├──────────────────────────┤
│ “dune”        842 books  │
├──────────────────────────┤
│ [cover]    [cover]       │  2 columns
│ title      title         │
│ author     author        │
└──────────────────────────┘
```

- Content max width: 80rem. Side padding 20px mobile, 32px from `sm`.
- Book grid: 2 / 3 / 4 columns at mobile / `sm` / `xl`; column gap 20–24px, row gap 36px.
- Covers are `2:3` with a 1px `--line` border and one soft shadow. Cards have no bounding box or background — the cover is the card.
- Alignment is left throughout. Nothing is centered except empty/error states, which are intentionally quiet.

## The one bold move

A full-bleed oxblood band opens every result set and carries the query in large italic Newsreader:

> *“harry potter”* — 842 books

The wishlist reuses the same band in ink (`#17181A`) with "Your shelf". Everything around it stays monochrome. This is the memorable element; there is no gradient hero, no glassmorphism, no repeating identical rounded panels.

## Components and states

| Component | States |
|---|---|
| `SearchHero` | idle, 1-character hint, submitted |
| `ResultBand` | brand (search), ink (wishlist), "Searching…" while refetching |
| `BookCard` | default, hover lift, saved heart, pending (disabled), cover error → placeholder |
| `StarRating` | fractional, whole, zero-rating ("No ratings yet"), clamped out-of-range |
| `SkeletonCard` | shimmer grid (8 search, 4 wishlist) |
| `EmptyState` | no query, no results, empty wishlist, 404 |
| `ErrorState` | network/API error with retry, `role="alert"` |

Cover placeholder is a warm paper block (`#EFEDE8`) with a short red rule, a thin book glyph, and the truncated title — not a grey blob and not a broken-image icon.

Motion is limited to: 200ms color transitions on controls, 500ms cover scale on hover, 120ms saved-heart scale, and a smooth scroll to the result band after submit. All of it is disabled under `prefers-reduced-motion: reduce`.

## Accessibility

- Search input has `aria-label="Search books"`, is a real `role="search"` form, and has a visible focus ring (`2px #E04848`, offset 2px).
- Heart buttons use `aria-pressed` and a label that names the book and the action.
- `StarRating` is one `role="img"` with `aria-label="Rated 4.3 out of 5 from 1200 ratings"`; the decorative star glyphs are `aria-hidden`.
- Skip link is the first tab stop.
- Error panels use `role="alert"`; the band meta uses `aria-live="polite"`.
- Cover images are decorative (`alt=""`) because the title is adjacent; the placeholder carries no actionable content.
- No color-only state: saved hearts change shape (filled) as well as color.
- Fallback catalog covers carry a `Demo` badge; the banner above the grid explains why, so demo data is never mistaken for a live Google result.

## What was deliberately avoided

- Cream `#F4F1EA` + terracotta + serif, the current default "bookshop" look.
- Numbered 01/02/03 markers (the content is not a sequence) and all-caps eyebrow labels.
- The SaaS-card kit: identical rounded cards, the same `rgba(0,0,0,.1)` shadow on everything, gradient washes.
- Gold used as decoration — amber appears only where it encodes a rating.
- Dark mode: it would double the state surface for no demo value.
