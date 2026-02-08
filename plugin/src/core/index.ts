export { calculate, detectContext } from './calculator';
export { getProfile, getProfileOrFallback, guessCategory, allFontFamilies } from './font-database';
export { snapToGrid } from './grid-snapper';
export { isDarkBackground, relativeLuminance } from './bg-analyzer';
export { exportCode } from './code-exporter';
export type {
  FontProfile, FontCategory, TextContext, BgMode, ExportFormat,
  TypographyInput, TypographyResult, PluginSettings, PluginMessage,
} from './types';
