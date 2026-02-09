import type { FontProfile, TextContext, TypographyInput, TypographyResult } from './types';
import { getProfileOrFallback, guessCategory } from './font-database';
import { snapToGrid } from './grid-snapper';

export function detectContext(fontSize: number): TextContext {
  if (fontSize >= 32) return 'display';
  if (fontSize <= 13) return 'caption';
  return 'body';
}

function getContextMultiplier(context: TextContext, fontSize: number): number {
  switch (context) {
    case 'display': {
      // Regressive scale: larger display text → tighter line-height
      // With baseRatio ~1.4: 32px → ~130%, 48px → ~120%, 96px → ~112%, 128px+ → ~110%
      const maxMul = 0.93; // at 32px → 1.4 * 0.93 = 130%
      const minMul = 0.79; // at 128px+ → 1.4 * 0.79 = 110%
      if (fontSize >= 128) return minMul;
      const t = (fontSize - 32) / 96;
      return maxMul - t * (maxMul - minMul);
    }
    case 'caption':
      return 1.1;
    case 'body':
    default:
      return 1.0;
  }
}

function getSizeScale(fontSize: number): number {
  if (fontSize <= 12) return 0.008;
  if (fontSize <= 24) return 0.0;
  if (fontSize <= 48) {
    const t = (fontSize - 24) / 24;
    return -0.01 * t;
  }
  // >= 49
  const t = Math.min((fontSize - 48) / 48, 1);
  return -0.01 - 0.02 * t;
}

function getWeightAdjust(profile: FontProfile, weight: number): { lhAdj: number; trAdj: number } {
  const weights = Object.keys(profile.weights).map(Number).sort((a, b) => a - b);
  if (weights.length === 0) {
    // Fallback: linear interpolation based on weight distance from 400
    const delta = (weight - 400) / 400;
    return { lhAdj: -delta * 0.03, trAdj: -delta * 0.008 };
  }

  // Find the two nearest weights for interpolation
  let lower = weights[0];
  let upper = weights[weights.length - 1];
  for (const w of weights) {
    if (w <= weight) lower = w;
    if (w >= weight && upper === weights[weights.length - 1]) upper = w;
  }

  if (lower === upper || weight <= lower) {
    const adj = profile.weights[lower];
    return { lhAdj: adj.lineHeightAdjust, trAdj: adj.trackingAdjust };
  }
  if (weight >= upper) {
    const adj = profile.weights[upper];
    return { lhAdj: adj.lineHeightAdjust, trAdj: adj.trackingAdjust };
  }

  // Interpolate
  const t = (weight - lower) / (upper - lower);
  const lowerAdj = profile.weights[lower];
  const upperAdj = profile.weights[upper];
  return {
    lhAdj: lowerAdj.lineHeightAdjust + t * (upperAdj.lineHeightAdjust - lowerAdj.lineHeightAdjust),
    trAdj: lowerAdj.trackingAdjust + t * (upperAdj.trackingAdjust - lowerAdj.trackingAdjust),
  };
}

export function calculate(
  input: TypographyInput,
  contextOverride: TextContext | 'auto' = 'auto',
  gridStep: number = 4
): TypographyResult {
  const { fontFamily, fontSize, fontWeight, fontStyle, isUppercase, isDarkBg } = input;

  const category = guessCategory(fontStyle || fontFamily);
  const { profile, isApproximate } = getProfileOrFallback(fontFamily, category);

  const context = contextOverride === 'auto' ? detectContext(fontSize) : contextOverride;
  const contextMul = getContextMultiplier(context, fontSize);
  const { lhAdj, trAdj } = getWeightAdjust(profile, fontWeight);

  // --- Line height ---
  const bgLineAdj = isDarkBg ? 1.015 : 1.0;
  const lineHeightRaw = fontSize * profile.baseLineHeightRatio * contextMul * (1 + lhAdj) * bgLineAdj;
  const lineHeight = snapToGrid(lineHeightRaw, gridStep);
  const lineHeightPercent = Math.round((lineHeight / fontSize) * 1000) / 10;

  // --- Letter spacing ---
  const sizeScale = getSizeScale(fontSize);
  const displayAdj = context === 'display' ? profile.displayTightening : 0;
  const caseAdj = isUppercase ? profile.uppercaseBoost : 0;
  const bgTrackAdj = isDarkBg ? 0.015 : 0;

  const trackingRatio = profile.baseTrackingRatio + sizeScale + displayAdj + trAdj + caseAdj + bgTrackAdj;
  const letterSpacing = Math.round(fontSize * trackingRatio * 100) / 100;
  const letterSpacingEm = Math.round(trackingRatio * 10000) / 10000;
  const letterSpacingPercent = Math.round(trackingRatio * 1000) / 10;

  const fontInfo = `${fontFamily} · ${fontSize}px · ${fontStyle || `w${fontWeight}`}`;

  return {
    lineHeight,
    lineHeightRaw: Math.round(lineHeightRaw * 100) / 100,
    lineHeightPercent,
    letterSpacing,
    letterSpacingEm,
    letterSpacingPercent,
    fontInfo,
    isApproximate,
  };
}
