import { describe, it, expect } from 'vitest';
import {
  getProfile,
  getProfileOrFallback,
  guessCategory,
  allFontFamilies,
} from './font-database';

describe('getProfile', () => {
  it('returns exact profile for known fonts', () => {
    expect(getProfile('Inter')).not.toBeNull();
    expect(getProfile('Roboto')).not.toBeNull();
    expect(getProfile('SF Pro')).not.toBeNull();
    expect(getProfile('Merriweather')).not.toBeNull();
  });

  it('is case-insensitive', () => {
    expect(getProfile('inter')).not.toBeNull();
    expect(getProfile('INTER')).not.toBeNull();
    expect(getProfile('sf pro')).not.toBeNull();
  });

  it('returns null for unknown fonts', () => {
    expect(getProfile('NonExistentFont')).toBeNull();
    expect(getProfile('')).toBeNull();
  });

  describe('aliases', () => {
    it('SF Pro Display → SF Pro', () => {
      const display = getProfile('SF Pro Display');
      const base = getProfile('SF Pro');
      expect(display).not.toBeNull();
      expect(display!.family).toBe(base!.family);
    });

    it('SF Pro Text → SF Pro', () => {
      const text = getProfile('SF Pro Text');
      expect(text).not.toBeNull();
      expect(text!.family).toBe('SF Pro');
    });

    it('Roboto Flex → Roboto', () => {
      const flex = getProfile('Roboto Flex');
      expect(flex).not.toBeNull();
      expect(flex!.family).toBe('Roboto');
    });

    it('Noto Sans JP → Noto Sans', () => {
      const jp = getProfile('Noto Sans JP');
      expect(jp).not.toBeNull();
      expect(jp!.family).toBe('Noto Sans');
    });

    it('IBM Plex Mono → IBM Plex Sans', () => {
      const mono = getProfile('IBM Plex Mono');
      expect(mono).not.toBeNull();
      expect(mono!.family).toBe('IBM Plex Sans');
    });
  });
});

describe('getProfileOrFallback', () => {
  it('returns exact profile with isApproximate=false for known fonts', () => {
    const { profile, isApproximate } = getProfileOrFallback('Inter');
    expect(isApproximate).toBe(false);
    expect(profile.family).toBe('Inter');
  });

  it('returns fallback with isApproximate=true for unknown fonts', () => {
    const { profile, isApproximate } = getProfileOrFallback('UnknownFont');
    expect(isApproximate).toBe(true);
    expect(profile.family).toBe('__fallback__');
  });

  it('uses category for fallback selection', () => {
    const sans = getProfileOrFallback('Unknown', 'sans-serif');
    const serif = getProfileOrFallback('Unknown', 'serif');
    const mono = getProfileOrFallback('Unknown', 'mono');

    expect(sans.profile.category).toBe('sans-serif');
    expect(serif.profile.category).toBe('serif');
    expect(mono.profile.category).toBe('mono');
  });

  it('defaults to sans-serif when no category given', () => {
    const { profile } = getProfileOrFallback('Unknown');
    expect(profile.category).toBe('sans-serif');
  });
});

describe('guessCategory', () => {
  it('detects mono fonts', () => {
    expect(guessCategory('SF Mono')).toBe('mono');
    expect(guessCategory('Fira Code')).toBe('mono');
  });

  it('detects serif fonts', () => {
    expect(guessCategory('PT Serif')).toBe('serif');
    expect(guessCategory('Merriweather')).toBe('sans-serif'); // no "serif" in name
  });

  it('does not confuse sans-serif with serif', () => {
    expect(guessCategory('Noto Sans')).toBe('sans-serif');
    expect(guessCategory('IBM Plex Sans')).toBe('sans-serif');
  });

  it('detects display fonts', () => {
    expect(guessCategory('Playfair Display')).toBe('display');
  });

  it('defaults to sans-serif', () => {
    expect(guessCategory('Inter')).toBe('sans-serif');
    expect(guessCategory('Roboto')).toBe('sans-serif');
  });
});

describe('allFontFamilies', () => {
  it('contains at least 30 fonts', () => {
    expect(allFontFamilies.length).toBeGreaterThanOrEqual(30);
  });

  it('includes key fonts', () => {
    expect(allFontFamilies).toContain('Inter');
    expect(allFontFamilies).toContain('SF Pro');
    expect(allFontFamilies).toContain('Roboto');
    expect(allFontFamilies).toContain('Merriweather');
  });
});

describe('font profile data integrity', () => {
  it('all profiles have valid baseLineHeightRatio (1.0-1.6)', () => {
    for (const family of allFontFamilies) {
      const p = getProfile(family)!;
      expect(p.baseLineHeightRatio, `${family} baseLineHeightRatio`).toBeGreaterThanOrEqual(1.0);
      expect(p.baseLineHeightRatio, `${family} baseLineHeightRatio`).toBeLessThanOrEqual(1.6);
    }
  });

  it('all profiles have weight 400 entry', () => {
    for (const family of allFontFamilies) {
      const p = getProfile(family)!;
      if (Object.keys(p.weights).length > 0) {
        expect(p.weights[400], `${family} missing weight 400`).toBeDefined();
      }
    }
  });

  it('weight 400 has zero adjustments (baseline)', () => {
    for (const family of allFontFamilies) {
      const p = getProfile(family)!;
      if (p.weights[400]) {
        expect(p.weights[400].lineHeightAdjust, `${family} w400 lhAdj`).toBe(0);
        expect(p.weights[400].trackingAdjust, `${family} w400 trAdj`).toBe(0);
      }
    }
  });
});
