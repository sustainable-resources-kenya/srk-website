# SRK design system (v0.1)

A short reference for building pages. The values come from Cole's
"SRK Design System v2". The CSS variables live in `src/styles/tokens.css`. Use
them in components. Don't write raw colors or pixel sizes.

Target: WCAG 2.1 AA. Mobile first at 375px, growing to 1200px.

## Colors

| Token | Name | Hex | May be text? | Used for |
|---|---|---|---|---|
| `--color-ink` | Ink Green | `#0E2A1A` | Yes (15.39:1 on white) | Body text, headings, footer background, focus ring on light |
| `--color-primary` | Deep Green | `#1B6B35` | Yes (6.56:1 on white) | Primary button, links, section labels, tag text |
| `--color-primary-hover` | Deep Green Hover | `#14552A` | Yes (8.89:1 on white) | Hover and pressed text and borders on light backgrounds |
| `--color-muted` | Muted | `#3F4D44` | Yes (8.91:1 on white) | Card descriptions, captions, footer divider |
| `--color-white` | White | `#FFFFFF` | Yes, on dark only | Page and card background, text on Ink |
| `--color-tint` | Leaf Tint | `#F2F6EE` | Background only | Section backgrounds, tags, pull quote, pressed state on dark |
| `--color-line` | Line | `#D5DED6` | **No, decoration only** | Dividers, card borders, photo placeholders |
| `--color-leaf` | Leaf Green | `#6DB33F` | **No, decoration only** | Livelihoods card accent, brand band |
| `--color-river` | River Blue | `#1E7BC4` | **No, decoration only** | Water card accent, brand band |
| `--color-sun` | Sun Orange | `#F4A124` | **No, decoration only** | Hero button fill (Ink text on top), focus ring on dark, quote bar, outline-button border on dark |

Error Red `#B42318` is not a token yet. It is held back until we have a form.

## Type

One family, Noto Sans, in two weights: 400 and 700. It is self-hosted from
`/fonts/` with `font-display: swap`. There is no italic and no 500 or 600.
`em`, `i`, `cite` and `blockquote` are reset to upright text, so use Bold 700
for emphasis.

| Step | Tokens | Mobile | Desktop | Weight |
|---|---|---|---|---|
| H1 | `--text-h1-size` / `--text-h1-line` | 32px / 1.15 | 52px / 1.1 | 700 |
| H2 | `--text-h2-size` / `--text-h2-line` | 26px / 1.2 | 36px / 1.2 | 700 |
| H3 | `--text-h3-size` / `--text-h3-line` | 20px / 1.3 | 24px / 1.3 | 700 |
| Large body | `--text-large-size` / `--text-large-line` | 18px / 1.55 | 20px / 1.55 | 400 |
| Body | `--text-body-size` / `--text-body-line` | 16px / 1.6 | 18px / 1.6 | 400 |
| Small | `--text-small-size` / `--text-small-line` | 14px / 1.5 | 14px / 1.5 | 400 or 700 |

Desktop sizes switch on at **768px**. Cole's file shows only 375px (mobile)
and 1200px (desktop). The 768px breakpoint is our choice, not Cole's.

## Spacing

| Token | Size | Typical use |
|---|---|---|
| `--space-1` | 4px | Icon-to-label gap, tag vertical padding |
| `--space-2` | 8px | Label to heading, gap between buttons in a row |
| `--space-3` | 12px | Tag horizontal padding, stacked mobile buttons |
| `--space-4` | 16px | Mobile page margin, paragraph spacing |
| `--space-5` | 24px | Card inner padding, grid gutter, heading to body |
| `--space-6` | 32px | Desktop page margin, gap between blocks in a section |
| `--space-7` | 48px | Mobile section padding (top and bottom) |
| `--space-8` | 80px | Desktop section padding (top and bottom) |

Corner radii: `--radius-xs` 2px (focused text links, footer links),
`--radius-sm` 4px (menu items), `--radius-md` 6px (buttons),
`--radius-lg` 8px (cards), `--radius-pill` 999px (tags).

## Interactive states

States never rely on color alone. Hover adds an underline or changes the fill,
pressed inverts or tints the fill, and focus adds a ring.

**Focus ring:** 3px solid (`--focus-ring-width`), 3px offset
(`--focus-ring-offset`). Rows in the open mobile menu use an inset ring
(`--focus-ring-offset-inset`, -3px).

### On light backgrounds (White, Leaf Tint)

| Control | Default | Hover | Pressed | Focus ring |
|---|---|---|---|---|
| Primary button | White on Deep Green | White on Deep Green Hover | White on Ink | Ink |
| Secondary button | Deep Green text and 2px border, White fill | Deep Green Hover text and border, Leaf Tint fill | Deep Green Hover text and border, Line fill | Ink |
| Text link | Deep Green, underlined | Deep Green Hover, 3px underline | Ink, 3px underline | Ink |
| Menu item | Ink | Deep Green, 2px underline | Ink on Leaf Tint | Ink |
| Menu button | Ink text and 2px border, White fill | Leaf Tint fill | White on Ink (reads "Close") | Ink |

### On dark backgrounds (Ink)

| Control | Default | Hover | Pressed | Focus ring |
|---|---|---|---|---|
| Hero primary button | Ink on Sun Orange | Ink on White | Ink on Leaf Tint | White |
| Hero secondary button | White text and 2px border | Ink on White | Ink on Leaf Tint | Sun Orange |
| Footer link | White | White, 2px underline | Ink on Sun Orange | Sun Orange |
| Outline button (Sun border) | White text, Sun Orange 2px border | Ink on Sun Orange | Ink on Leaf Tint | White |

## Tap targets

Every link and button must be at least **44 × 44px**. Buttons are 48px tall,
and mobile menu rows are 52px tall.

## Layouts for v0.1

- **Hero: option C.** Text comes first on Leaf Tint, with the photo below.
  Buttons are Primary and Secondary.
- **Project card: option C.** Text only, with a 12px colored accent band on top
  (Leaf Green, Deep Green or River Blue). It loads 0 KB of images.
  **Switch to card option B** (compact, with a small square thumbnail) when SRK
  photos arrive.
- Until photos arrive, placeholders are grey boxes (Line) with a caption.

## Page weight

- Keep each page **under 1 MB**.
- The logo is `/logo.webp` and must stay **under 25 KB**.
- Photos are **750px-wide WebP**.
- Anything below the fold uses `loading="lazy"`.
- Fonts are a Latin subset, self-hosted. Never use Google Fonts.

## Profile PDF

The SRK Organizational Profile PDF is **not published** until SRK confirms it
can be public. Don't add the file or link to it until then.
