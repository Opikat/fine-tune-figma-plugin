export type FontCategory = 'sans-serif' | 'serif' | 'mono' | 'display';
export type TextContext = 'display' | 'body' | 'caption';
export type BgMode = 'auto' | 'light' | 'dark';
export type ExportFormat = 'css' | 'css-fluid' | 'ios' | 'android';

export interface FontProfile {
  family: string;
  category: FontCategory;
  baseLineHeightRatio: number;
  baseTrackingRatio: number;
  displayTightening: number;
  uppercaseBoost: number;
  weights: Record<number, {
    lineHeightAdjust: number;
    trackingAdjust: number;
  }>;
}

export interface TypographyInput {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: string;
  isUppercase: boolean;
  isDarkBg: boolean;
}

export interface TypographyResult {
  lineHeight: number;       // px, snapped to grid
  lineHeightRaw: number;    // px, before grid snap
  lineHeightPercent: number; // %
  letterSpacing: number;    // px
  letterSpacingEm: number;  // em (for CSS)
  letterSpacingPercent: number; // % (Figma native)
  fontInfo: string;         // e.g. "Inter · 16px · Regular"
  isApproximate: boolean;   // true if font not in DB (fallback used)
}

export interface PluginSettings {
  gridStep: number;
  bgMode: BgMode;
  contextOverride: TextContext | 'auto';
  autoApply: boolean;
  writeVariables: boolean;
}

export interface PluginMessage {
  type: string;
  [key: string]: unknown;
}
