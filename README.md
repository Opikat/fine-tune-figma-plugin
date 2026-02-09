# FineTune — Typography Auto-Tuning for Figma

Figma plugin that calculates optimal line-height and letter-spacing based on font metrics, weight, size, background brightness, and baseline grid — then exports in code-ready units.

**TypeBalance picks pretty numbers. FineTune picks pretty numbers that work in code.**

## Features

- **30 hand-tuned font profiles** — Inter, Roboto, SF Pro, PP Neue Montreal, Druk, and 25 more. Any unknown font uses category-based fallbacks.
- **Regressive line-height scale** — ~110% for display type, ~140% for body, ~155% for captions. Follows Bringhurst / Material Design 3 paradigm.
- **4px baseline grid snap** — line-height always aligns to vertical rhythm.
- **Background-aware** — auto-detects solid, gradient, and image fills. Adjusts for dark/light.
- **Multi-layer batch** — select a frame with 50 text layers, see deduplicated result cards grouped by font+weight+size. Apply all at once.
- **Auto-apply** — toggle on and values apply instantly when you select text. No extra clicks.
- **Code export** — CSS (`em`), CSS Fluid (`clamp()`), iOS (`kern`/`lineHeightMultiple`), Android (`letterSpacing`/`lineSpacingMultiplier`).

## Quick start

```bash
cd plugin
npm install
npm run build
```

In Figma: **Plugins** > **Development** > **Import plugin from manifest** > select `plugin/manifest.json`.

## Usage

1. Select any text layer or frame containing text layers
2. See calculated values for each unique font configuration
3. Click **Apply to selected** or enable **Auto-apply** in settings
4. Switch export tab (CSS / Fluid / iOS / Android) and copy code

## Line-height scale

| Context | Font size | Target |
|---------|-----------|--------|
| Display (large) | 96-128px+ | ~110% |
| Display | 48-64px | ~120% |
| Display (small) | 32-48px | ~125-130% |
| Body | 14-31px | ~140% |
| Caption | ≤13px | ~155% |

## Settings

- **Auto-apply on selection change** — optimized values are immediately applied to every text layer you select. Disable to preview first.
- **Save to Figma Variables** — creates a "FineTune" variable collection with line-height and letter-spacing tokens. Includes Light and Dark mode variants.

## Docs

- [Product description](docs/product.md) — detailed overview, architecture, roadmap
- [PRD](docs/prd-typography-plugin.md) — requirements, formulas, competitive analysis

## Development

```bash
cd plugin
npm run watch    # rebuild on file changes
npm run build    # production build
```

Build output: `plugin/dist/main.js` + `plugin/dist/ui.html` (single file with inlined JS+CSS).

Target: `es2017` (Figma sandbox constraint — no `??`, `?.`).

## License

MIT
