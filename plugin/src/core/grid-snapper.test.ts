import { describe, it, expect } from 'vitest';
import { snapToGrid } from './grid-snapper';

describe('snapToGrid', () => {
  it('snaps to 4px grid', () => {
    expect(snapToGrid(22, 4)).toBe(24);
    expect(snapToGrid(21, 4)).toBe(20);
    expect(snapToGrid(20, 4)).toBe(20);
    expect(snapToGrid(18, 4)).toBe(20);
  });

  it('snaps to 2px grid', () => {
    expect(snapToGrid(17, 2)).toBe(18);
    expect(snapToGrid(17.5, 2)).toBe(18);
    expect(snapToGrid(16.4, 2)).toBe(16);
  });

  it('snaps to 8px grid', () => {
    expect(snapToGrid(22, 8)).toBe(24);
    expect(snapToGrid(20, 8)).toBe(24);
    expect(snapToGrid(19, 8)).toBe(16);
  });

  it('rounds to nearest integer when gridStep <= 1', () => {
    expect(snapToGrid(22.3, 1)).toBe(22);
    expect(snapToGrid(22.7, 1)).toBe(23);
    expect(snapToGrid(22.5, 0.5)).toBe(23);
  });

  it('rounds .5 up', () => {
    expect(snapToGrid(22, 4)).toBe(24); // 22/4=5.5 → rounds to 6 → 24
  });

  it('handles exact grid values', () => {
    expect(snapToGrid(24, 4)).toBe(24);
    expect(snapToGrid(0, 4)).toBe(0);
  });
});
