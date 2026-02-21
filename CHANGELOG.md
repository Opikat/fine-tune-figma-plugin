# Changelog

## 2.0.0

### Calculation Engine
- Regressive line-height scale based on Bringhurst / Material Design 3 paradigm: ~110% display, ~140% body, ~155% caption
- 30 hand-tuned font profiles (Inter, Roboto, SF Pro, PP Neue Montreal, Druk, etc.) with per-weight adjustments
- Category-based fallbacks (sans-serif / serif / mono / display) for unlisted fonts — marked with "approx" badge
- Adaptive letter-spacing: tighter for large sizes, looser for small; weight-aware adjustments
- Background brightness detection (solid, gradient, image fills) for dark/light context corrections

### Batch Processing
- Multi-layer selection: groups text layers by unique font configuration (family + weight + size)
- Deduplication with "Nx" badges — identical configs share one result card
- "Well-tuned" detection (5% tolerance) — styles already within range shown separately under a collapsible green toggle

### Apply & Sync
- One-click "Apply to selected" for all fixable styles
- Auto-apply mode: values applied instantly on selection change
- Text style updating: modifies shared text style definitions so all instances across the file update automatically
- Figma Variables writer: creates a "FineTune" variable collection with `{font}/{size}/line-height` and `{font}/{size}/letter-spacing` FLOAT tokens
- Changelog side panel with copy support — tracks all before/after changes per session

### Pixel Grid
- Configurable grid snapping: Off, 2px, 4px, 8px
- Adaptive half-step for small text (≤16px) to avoid oversized jumps

### Code Export
- CSS: `line-height`, `letter-spacing` in px/em
- CSS Fluid: `clamp(...)` responsive values
- iOS (Swift): `lineHeightMultiple`, `kern`
- Android (XML): `lineSpacingMultiplier`, `letterSpacing` in sp

### UI
- Fixed 100vh layout: pinned header, scrollable results, fixed apply button, export section, and settings bar
- Result cards with before/after values and percentage annotations
- Settings: auto-apply, update text styles, save to Figma Variables, pixel grid
- Help modal with setting explanations
- Log badge in header row for quick changelog access

### Developer
- 67 unit tests across 5 core modules (calculator, font-database, grid-snapper, bg-analyzer, code-exporter)
- Auto-test on build (`vitest run && node build.mjs`)
- esbuild bundler with es2017 target, single HTML output with inlined JS+CSS
- Preact UI (<4KB)
