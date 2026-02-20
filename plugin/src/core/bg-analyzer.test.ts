import { describe, it, expect } from 'vitest';
import { relativeLuminance } from './bg-analyzer';

describe('relativeLuminance', () => {
  it('white = 1.0', () => {
    expect(relativeLuminance(1, 1, 1)).toBeCloseTo(1.0, 4);
  });

  it('black = 0.0', () => {
    expect(relativeLuminance(0, 0, 0)).toBeCloseTo(0.0, 4);
  });

  it('pure red ≈ 0.2126', () => {
    expect(relativeLuminance(1, 0, 0)).toBeCloseTo(0.2126, 4);
  });

  it('pure green ≈ 0.7152', () => {
    expect(relativeLuminance(0, 1, 0)).toBeCloseTo(0.7152, 4);
  });

  it('pure blue ≈ 0.0722', () => {
    expect(relativeLuminance(0, 0, 1)).toBeCloseTo(0.0722, 4);
  });

  it('mid gray ≈ 0.5', () => {
    expect(relativeLuminance(0.5, 0.5, 0.5)).toBeCloseTo(0.5, 1);
  });

  it('green contributes most to luminance', () => {
    const r = relativeLuminance(1, 0, 0);
    const g = relativeLuminance(0, 1, 0);
    const b = relativeLuminance(0, 0, 1);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
    expect(r).toBeGreaterThan(b);
  });
});
