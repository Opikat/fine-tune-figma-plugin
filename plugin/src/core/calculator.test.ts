import { describe, it, expect } from 'vitest';
import { calculate, detectContext } from './calculator';
import type { TypographyInput } from './types';

function makeInput(overrides: Partial<TypographyInput> = {}): TypographyInput {
  return {
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: 400,
    fontStyle: 'Regular',
    isUppercase: false,
    isDarkBg: false,
    ...overrides,
  };
}

describe('detectContext', () => {
  it('returns display for fontSize >= 32', () => {
    expect(detectContext(32)).toBe('display');
    expect(detectContext(64)).toBe('display');
    expect(detectContext(128)).toBe('display');
  });

  it('returns caption for fontSize <= 11', () => {
    expect(detectContext(11)).toBe('caption');
    expect(detectContext(9)).toBe('caption');
  });

  it('returns body for middle range', () => {
    expect(detectContext(12)).toBe('body');
    expect(detectContext(16)).toBe('body');
    expect(detectContext(24)).toBe('body');
    expect(detectContext(31)).toBe('body');
  });
});

describe('calculate', () => {
  describe('line-height', () => {
    it('returns positive line-height for body text', () => {
      const r = calculate(makeInput({ fontSize: 16 }));
      expect(r.lineHeight).toBeGreaterThan(16);
      expect(r.lineHeight).toBeLessThan(30);
    });

    it('snaps to grid (4px for text > 16px)', () => {
      const r = calculate(makeInput({ fontSize: 20 }), 'auto', 4);
      expect(r.lineHeight % 4).toBe(0);
    });

    it('uses adaptive grid (2px) for small text', () => {
      const r = calculate(makeInput({ fontSize: 13 }), 'auto', 4);
      expect(r.lineHeight % 2).toBe(0);
    });

    it('lineHeightPercent is a whole number', () => {
      const r = calculate(makeInput({ fontSize: 16 }));
      expect(r.lineHeightPercent).toBe(Math.round(r.lineHeightPercent));
    });

    it('display text has tighter line-height than body', () => {
      const display = calculate(makeInput({ fontSize: 64 }));
      const body = calculate(makeInput({ fontSize: 16 }));
      expect(display.lineHeightPercent).toBeLessThan(body.lineHeightPercent);
    });

    it('caption text has more line-height than body', () => {
      const caption = calculate(makeInput({ fontSize: 10 }));
      const body = calculate(makeInput({ fontSize: 16 }));
      expect(caption.lineHeightPercent).toBeGreaterThan(body.lineHeightPercent);
    });

    it('dark background adds extra line-height', () => {
      const light = calculate(makeInput({ isDarkBg: false }));
      const dark = calculate(makeInput({ isDarkBg: true }));
      expect(dark.lineHeightRaw).toBeGreaterThanOrEqual(light.lineHeightRaw);
    });

    it('bold text has slightly less line-height than regular', () => {
      const regular = calculate(makeInput({ fontWeight: 400 }));
      const bold = calculate(makeInput({ fontWeight: 700 }));
      expect(bold.lineHeightRaw).toBeLessThanOrEqual(regular.lineHeightRaw);
    });
  });

  describe('letter-spacing', () => {
    it('letterSpacing has at most 1 decimal place', () => {
      const r = calculate(makeInput());
      const decimals = (r.letterSpacing.toString().split('.')[1] || '').length;
      expect(decimals).toBeLessThanOrEqual(1);
    });

    it('display text gets negative tracking (tightening)', () => {
      const r = calculate(makeInput({ fontSize: 64 }));
      expect(r.letterSpacing).toBeLessThanOrEqual(0);
    });

    it('small text gets positive tracking (loosening)', () => {
      const r = calculate(makeInput({ fontSize: 10 }));
      expect(r.letterSpacing).toBeGreaterThanOrEqual(0);
    });

    it('uppercase adds extra tracking', () => {
      const lower = calculate(makeInput({ isUppercase: false }));
      const upper = calculate(makeInput({ isUppercase: true }));
      expect(upper.letterSpacing).toBeGreaterThan(lower.letterSpacing);
    });

    it('dark background adds extra tracking', () => {
      const light = calculate(makeInput({ isDarkBg: false }));
      const dark = calculate(makeInput({ isDarkBg: true }));
      expect(dark.letterSpacing).toBeGreaterThanOrEqual(light.letterSpacing);
    });
  });

  describe('font profiles', () => {
    it('Inter is exact (not approximate)', () => {
      const r = calculate(makeInput({ fontFamily: 'Inter' }));
      expect(r.isApproximate).toBe(false);
    });

    it('unknown font falls back to approximate', () => {
      const r = calculate(makeInput({ fontFamily: 'FancyUnknownFont' }));
      expect(r.isApproximate).toBe(true);
    });

    it('SF Pro Display uses SF Pro profile via alias', () => {
      const display = calculate(makeInput({ fontFamily: 'SF Pro Display' }));
      expect(display.isApproximate).toBe(false);
    });

    it('Merriweather (serif) has higher base ratio than Inter (sans)', () => {
      const inter = calculate(makeInput({ fontFamily: 'Inter', fontSize: 16 }));
      const merri = calculate(makeInput({ fontFamily: 'Merriweather', fontSize: 16 }));
      expect(merri.lineHeightRaw).toBeGreaterThan(inter.lineHeightRaw);
    });
  });

  describe('context override', () => {
    it('overriding context to display tightens line-height', () => {
      const auto = calculate(makeInput({ fontSize: 16 }), 'auto');
      const forced = calculate(makeInput({ fontSize: 16 }), 'display');
      // Compare raw values (before grid snap) to avoid rounding to same grid step
      expect(forced.lineHeightRaw).toBeLessThan(auto.lineHeightRaw);
    });
  });

  describe('result structure', () => {
    it('contains all required fields', () => {
      const r = calculate(makeInput());
      expect(r).toHaveProperty('lineHeight');
      expect(r).toHaveProperty('lineHeightRaw');
      expect(r).toHaveProperty('lineHeightPercent');
      expect(r).toHaveProperty('letterSpacing');
      expect(r).toHaveProperty('letterSpacingEm');
      expect(r).toHaveProperty('letterSpacingPercent');
      expect(r).toHaveProperty('fontInfo');
      expect(r).toHaveProperty('isApproximate');
    });

    it('fontInfo contains family, size and style', () => {
      const r = calculate(makeInput({ fontFamily: 'Inter', fontSize: 16, fontStyle: 'Regular' }));
      expect(r.fontInfo).toContain('Inter');
      expect(r.fontInfo).toContain('16');
    });
  });

  describe('regression: specific values', () => {
    it('Inter 16px Regular body → reasonable line-height ~22px', () => {
      const r = calculate(makeInput({ fontFamily: 'Inter', fontSize: 16 }));
      expect(r.lineHeight).toBeGreaterThanOrEqual(20);
      expect(r.lineHeight).toBeLessThanOrEqual(24);
    });

    it('SF Pro 13px Regular → ~18px (not 20px with old 4px grid)', () => {
      const r = calculate(makeInput({ fontFamily: 'SF Pro', fontSize: 13 }));
      expect(r.lineHeight).toBe(18);
    });

    it('large display 128px → line-height ~110-115%', () => {
      const r = calculate(makeInput({ fontSize: 128 }));
      expect(r.lineHeightPercent).toBeGreaterThanOrEqual(106);
      expect(r.lineHeightPercent).toBeLessThanOrEqual(120);
    });
  });
});
