# FineTune — Typography Auto-Tuning for Figma

## The problem

Designers spend hours manually adjusting line-height and letter-spacing for every font size, weight, and context. The values they pick in Figma rarely match what developers implement in code. Result: visual drift between design and production, broken vertical rhythm, and endless back-and-forth in handoff.

Existing tools like TypeBalance use a closed database of "correct" values — but they don't account for background brightness, baseline grids, or export in platform-native units. Designers get pretty numbers in Figma that don't translate to CSS, iOS, or Android.

## What FineTune does

FineTune is a Figma plugin that automatically calculates optimal **line-height** and **letter-spacing** for any text layer based on:

- **Font family** — 30 hand-tuned profiles (Inter, Roboto, SF Pro, PP Neue Montreal, Druk, etc.) + category-based fallbacks for any font
- **Font size** — regressive scale: ~110% for display (96px+), ~120-130% for medium, ~140% for body, ~155% for caption
- **Font weight** — heavier weights get tighter spacing
- **Background brightness** — auto-detects solid, gradient, and image fills; adjusts for dark/light backgrounds
- **Uppercase** — boosts letter-spacing for all-caps text
- **Baseline grid** — snaps line-height to 4px grid for vertical rhythm

### Multi-layer batch processing

Select a frame with dozens of text layers — FineTune groups them by unique font configuration (family + weight + size), calculates once per group, and shows results as individual cards. Two identical "Inter Medium 16px" layers share one card with a "2x" badge. Apply to all at once.

### Code-ready export

Every calculation exports in platform-native units:

| Platform | Line-height | Letter-spacing |
|----------|------------|----------------|
| **CSS** | `line-height: 1.5` | `letter-spacing: -0.02em` |
| **CSS Fluid** | `clamp(...)` | `clamp(...)` |
| **iOS (Swift)** | `lineHeightMultiple` | `kern` (points) |
| **Android (XML)** | `lineSpacingMultiplier` | `letterSpacing` (sp) |

No more "1% in Figma = what in CSS?" — FineTune does the conversion.

### Auto-apply

Toggle "Auto-apply on selection change" — values are applied instantly when you click any text layer. No extra clicks. The plugin captures the before-state, shows the diff, and applies in one step.

## Line-height scale

FineTune follows the Bringhurst / Material Design 3 regressive paradigm:

| Context | Font size | Target line-height |
|---------|-----------|-------------------|
| Display (large) | 96-128px+ | ~110% |
| Display | 48-64px | ~120% |
| Display (small) | 32-48px | ~125-130% |
| Body | 14-31px | ~140% |
| Caption | ≤13px | ~155% |

Values are snapped to the nearest 4px grid step. For example, 16px body text with 140% target = 22.4px, snapped to 24px (150%). For 14px body: 19.6px → 20px (143%).

## Supported fonts (Tier 1)

Inter, Roboto, Open Sans, Montserrat, Lato, Poppins, Noto Sans, Raleway, Ubuntu, Nunito, Playfair Display, PT Sans, Merriweather, Rubik, Work Sans, DM Sans, Manrope, Space Grotesk, IBM Plex Sans, Jost, SF Pro, PP Neue Montreal, Golos, Graphik, Gilroy, TT Norms Pro, Basis Grotesque, Suisse Int'l, Druk, Helios.

Unsupported fonts automatically use category-based fallback formulas (sans-serif / serif / mono / display). Results are marked with an "approx" badge.

## Architecture

- **Figma sandbox** (main.ts) — accesses document tree, reads font properties, applies values, communicates via `postMessage`
- **UI iframe** (Preact, <4KB) — renders result cards, settings, export tabs
- **Core engine** (calculator.ts) — pure functions, no Figma dependency, testable in isolation
- **Font database** (font-database.ts) — 30 hand-tuned profiles with per-weight adjustments
- **Background analyzer** (bg-analyzer.ts) — walks parent chain, handles solid/gradient/image fills
- **Grid snapper** (grid-snapper.ts) — `Math.round(value / step) * step`
- **Code exporter** (code-exporter.ts) — CSS, CSS Fluid, iOS, Android templates

Build: esbuild with `target: es2017` (Figma sandbox constraint), single HTML output with inlined JS+CSS.

## Roadmap

- **v0.1**: core calculation, auto-apply, multi-font batch, code export
- **v0.2**: Figma Variables writer
- **v2.0** (current): pixel grid snapping, text style sync, changelog panel, well-tuned detection, fixed layout UI, 67 unit tests
- **Next**: custom formula editor, user-defined font profiles, design system sync, Tokens Studio integration
