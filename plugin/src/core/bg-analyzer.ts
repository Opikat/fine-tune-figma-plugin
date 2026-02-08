// Analyze the background luminance of a node's parent chain.
// Works in the Figma plugin sandbox where SceneNode types are available.

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isDarkBackground(node: SceneNode): boolean {
  let current: BaseNode | null = node.parent;

  while (current) {
    if ('fills' in current) {
      const fills = (current as GeometryMixin).fills;
      if (Array.isArray(fills)) {
        for (const fill of fills) {
          if (fill.type === 'SOLID' && fill.visible !== false) {
            const { r, g, b } = fill.color;
            return relativeLuminance(r, g, b) < 0.5;
          }
        }
      }
    }
    current = current.parent;
  }

  // Default: assume light background
  return false;
}
