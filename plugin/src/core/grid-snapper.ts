export function snapToGrid(value: number, gridStep: number): number {
  if (gridStep <= 1) return Math.round(value);
  return Math.round(value / gridStep) * gridStep;
}
