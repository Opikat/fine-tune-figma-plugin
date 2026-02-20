import { describe, it, expect } from 'vitest';
import { exportCode } from './code-exporter';
import type { TypographyResult } from './types';

function makeResult(overrides: Partial<TypographyResult> = {}): TypographyResult {
  return {
    lineHeight: 24,
    lineHeightRaw: 23.5,
    lineHeightPercent: 150,
    letterSpacing: 0.2,
    letterSpacingEm: 0.0125,
    letterSpacingPercent: 1.3,
    fontInfo: 'Inter · 16px · Regular',
    isApproximate: false,
    ...overrides,
  };
}

describe('exportCode', () => {
  describe('CSS', () => {
    it('includes font-size and line-height', () => {
      const code = exportCode(makeResult(), 16, 'css');
      expect(code).toContain('font-size: 16px');
      expect(code).toContain('line-height: 24px');
      expect(code).toContain('150%');
    });

    it('includes letter-spacing when non-zero', () => {
      const code = exportCode(makeResult({ letterSpacing: 0.2 }), 16, 'css');
      expect(code).toContain('letter-spacing');
      expect(code).toContain('em');
    });

    it('omits letter-spacing when zero', () => {
      const code = exportCode(makeResult({ letterSpacing: 0 }), 16, 'css');
      expect(code).not.toContain('letter-spacing');
    });
  });

  describe('CSS Fluid', () => {
    it('uses clamp()', () => {
      const code = exportCode(makeResult(), 16, 'css-fluid');
      expect(code).toContain('clamp(');
      expect(code).toContain('vw');
    });
  });

  describe('iOS', () => {
    it('uses NSMutableParagraphStyle', () => {
      const code = exportCode(makeResult(), 16, 'ios');
      expect(code).toContain('NSMutableParagraphStyle');
      expect(code).toContain('lineHeightMultiple');
      expect(code).toContain('.kern');
    });
  });

  describe('Android', () => {
    it('uses android XML attributes', () => {
      const code = exportCode(makeResult(), 16, 'android');
      expect(code).toContain('android:textSize="16sp"');
      expect(code).toContain('android:lineSpacingMultiplier');
      expect(code).toContain('android:letterSpacing');
    });
  });
});
