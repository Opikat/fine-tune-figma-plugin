// Analyze the background luminance of a node's parent chain.
// Handles solid fills, gradients (average of color stops), and
// image fills (assume neutral — treat as light background).

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function averageLuminanceOfFills(fills: ReadonlyArray<Paint>): number | null {
  let totalLum = 0;
  let count = 0;

  for (const fill of fills) {
    if (fill.visible === false) continue;

    if (fill.type === 'SOLID') {
      totalLum += relativeLuminance(fill.color.r, fill.color.g, fill.color.b);
      count++;
    } else if (
      fill.type === 'GRADIENT_LINEAR' ||
      fill.type === 'GRADIENT_RADIAL' ||
      fill.type === 'GRADIENT_ANGULAR' ||
      fill.type === 'GRADIENT_DIAMOND'
    ) {
      // Average luminance across all gradient color stops
      let stopLum = 0;
      const stops = fill.gradientStops;
      for (const stop of stops) {
        stopLum += relativeLuminance(stop.color.r, stop.color.g, stop.color.b);
      }
      if (stops.length > 0) {
        totalLum += stopLum / stops.length;
        count++;
      }
    } else if (fill.type === 'IMAGE') {
      // Can't sample image pixels in plugin sandbox — assume neutral (0.5)
      totalLum += 0.5;
      count++;
    }
  }

  if (count === 0) return null;
  return totalLum / count;
}

export function isDarkBackground(node: SceneNode): boolean {
  let current: BaseNode | null = node.parent;

  while (current) {
    if ('fills' in current) {
      const fills = (current as GeometryMixin).fills;
      if (Array.isArray(fills) && fills.length > 0) {
        const lum = averageLuminanceOfFills(fills);
        if (lum !== null) {
          return lum < 0.5;
        }
      }
    }
    current = current.parent;
  }

  // Default: assume light background
  return false;
}
