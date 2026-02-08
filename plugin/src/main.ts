import {
  calculate,
  detectContext,
  isDarkBackground,
  exportCode,
} from './core';
import type {
  PluginSettings,
  TypographyInput,
  TypographyResult,
  ExportFormat,
  TextContext,
  BgMode,
} from './core';

figma.showUI(__html__, { width: 360, height: 580 });

const DEFAULT_SETTINGS: PluginSettings = {
  gridStep: 4,
  bgMode: 'auto',
  contextOverride: 'auto',
  autoApply: false,
  writeVariables: false,
};

let settings: PluginSettings = { ...DEFAULT_SETTINGS };

async function loadSettings(): Promise<void> {
  const saved = await figma.clientStorage.getAsync('typetune-settings');
  if (saved) {
    settings = { ...DEFAULT_SETTINGS, ...saved };
  }
}

async function saveSettings(): Promise<void> {
  await figma.clientStorage.setAsync('typetune-settings', settings);
}

// --- Text node analysis ---

interface TextLayerInfo {
  nodeId: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: string;
  isUppercase: boolean;
  isDarkBg: boolean;
  currentLineHeight: string;
  currentLetterSpacing: string;
}

function weightFromStyle(style: string): number {
  const s = style.toLowerCase();
  if (s.includes('thin') || s.includes('hairline')) return 100;
  if (s.includes('extralight') || s.includes('ultralight')) return 200;
  if (s.includes('light')) return 300;
  if (s.includes('medium')) return 500;
  if (s.includes('semibold') || s.includes('demibold')) return 600;
  if (s.includes('extrabold') || s.includes('ultrabold')) return 800;
  if (s.includes('bold')) return 700;
  if (s.includes('black') || s.includes('heavy')) return 900;
  return 400;
}

function describeLineHeight(node: TextNode): string {
  const lh = node.lineHeight as LineHeight;
  if (typeof lh === 'symbol') return 'auto';
  if ('unit' in lh) {
    if (lh.unit === 'AUTO') return 'auto';
    if (lh.unit === 'PERCENT') return `${lh.value}%`;
    return `${lh.value}px`;
  }
  return 'auto';
}

function describeLetterSpacing(node: TextNode): string {
  const ls = node.letterSpacing as LetterSpacing;
  if (typeof ls === 'symbol') return '0';
  if ('unit' in ls) {
    if (ls.unit === 'PERCENT') return `${ls.value}%`;
    return `${ls.value}px`;
  }
  return '0';
}

function analyzeTextNode(node: TextNode): TextLayerInfo | null {
  const fontName = node.fontName;
  if (typeof fontName === 'symbol') return null; // mixed fonts

  const fontSize = node.fontSize;
  if (typeof fontSize === 'symbol') return null; // mixed sizes

  const textCase = node.textCase;
  const isUppercase = textCase === 'UPPER';

  const darkBg = settings.bgMode === 'dark'
    ? true
    : settings.bgMode === 'light'
      ? false
      : isDarkBackground(node);

  return {
    nodeId: node.id,
    fontFamily: fontName.family,
    fontSize: fontSize as number,
    fontWeight: weightFromStyle(fontName.style),
    fontStyle: fontName.style,
    isUppercase,
    isDarkBg: darkBg,
    currentLineHeight: describeLineHeight(node),
    currentLetterSpacing: describeLetterSpacing(node),
  };
}

function collectTextNodes(nodes: readonly SceneNode[]): TextNode[] {
  const result: TextNode[] = [];
  for (const node of nodes) {
    if (node.type === 'TEXT') {
      result.push(node);
    } else if ('children' in node) {
      result.push(...collectTextNodes((node as ChildrenMixin).children));
    }
  }
  return result;
}

// --- Apply results ---

async function applyToNode(node: TextNode, result: TypographyResult): Promise<void> {
  // Must load font before modifying text properties
  const fontName = node.fontName;
  if (typeof fontName !== 'symbol') {
    await figma.loadFontAsync(fontName);
  }

  node.lineHeight = { value: result.lineHeightPercent, unit: 'PERCENT' };
  node.letterSpacing = { value: result.letterSpacing, unit: 'PIXELS' };
}

// --- Handle selection ---

function processSelection(): void {
  const selection = figma.currentPage.selection;
  const textNodes = collectTextNodes(selection);

  if (textNodes.length === 0) {
    figma.ui.postMessage({ type: 'no-selection' });
    return;
  }

  const results: Array<{
    info: TextLayerInfo;
    result: TypographyResult;
  }> = [];

  for (const node of textNodes) {
    const info = analyzeTextNode(node);
    if (!info) continue;

    const input: TypographyInput = {
      fontFamily: info.fontFamily,
      fontSize: info.fontSize,
      fontWeight: info.fontWeight,
      fontStyle: info.fontStyle,
      isUppercase: info.isUppercase,
      isDarkBg: info.isDarkBg,
    };

    const result = calculate(input, settings.contextOverride, settings.gridStep);
    results.push({ info, result });
  }

  figma.ui.postMessage({
    type: 'calculation-results',
    results: results.map(r => ({
      nodeId: r.info.nodeId,
      fontInfo: r.result.fontInfo,
      isApproximate: r.result.isApproximate,
      before: {
        lineHeight: r.info.currentLineHeight,
        letterSpacing: r.info.currentLetterSpacing,
      },
      after: {
        lineHeight: r.result.lineHeight,
        lineHeightPercent: r.result.lineHeightPercent,
        lineHeightRaw: r.result.lineHeightRaw,
        letterSpacing: r.result.letterSpacing,
        letterSpacingEm: r.result.letterSpacingEm,
        letterSpacingPercent: r.result.letterSpacingPercent,
      },
      fontSize: r.info.fontSize,
    })),
    settings,
  });
}

// --- Process all text on page ---

function processPage(): void {
  const allText = collectTextNodes(figma.currentPage.children);
  if (allText.length === 0) {
    figma.ui.postMessage({ type: 'no-text-on-page' });
    return;
  }

  // Temporarily set selection to all text nodes and process
  const results: Array<{ nodeId: string; result: TypographyResult }> = [];

  for (const node of allText) {
    const info = analyzeTextNode(node);
    if (!info) continue;

    const input: TypographyInput = {
      fontFamily: info.fontFamily,
      fontSize: info.fontSize,
      fontWeight: info.fontWeight,
      fontStyle: info.fontStyle,
      isUppercase: info.isUppercase,
      isDarkBg: info.isDarkBg,
    };

    results.push({
      nodeId: node.id,
      result: calculate(input, settings.contextOverride, settings.gridStep),
    });
  }

  figma.ui.postMessage({
    type: 'page-scan-results',
    count: results.length,
  });
}

// --- Message handler ---

figma.ui.onmessage = async (msg: { type: string; [key: string]: unknown }) => {
  switch (msg.type) {
    case 'init':
      await loadSettings();
      figma.ui.postMessage({ type: 'settings', settings });
      processSelection();
      break;

    case 'update-settings':
      settings = { ...settings, ...(msg.settings as Partial<PluginSettings>) };
      await saveSettings();
      processSelection();
      break;

    case 'apply-selected': {
      const selection = figma.currentPage.selection;
      const textNodes = collectTextNodes(selection);
      let applied = 0;

      for (const node of textNodes) {
        const info = analyzeTextNode(node);
        if (!info) continue;

        const input: TypographyInput = {
          fontFamily: info.fontFamily,
          fontSize: info.fontSize,
          fontWeight: info.fontWeight,
          fontStyle: info.fontStyle,
          isUppercase: info.isUppercase,
          isDarkBg: info.isDarkBg,
        };

        const result = calculate(input, settings.contextOverride, settings.gridStep);
        await applyToNode(node, result);
        applied++;
      }

      figma.notify(`TypeTune: applied to ${applied} text layer${applied !== 1 ? 's' : ''}`);
      processSelection();
      break;
    }

    case 'apply-page': {
      const allText = collectTextNodes(figma.currentPage.children);
      let applied = 0;

      for (const node of allText) {
        const info = analyzeTextNode(node);
        if (!info) continue;

        const input: TypographyInput = {
          fontFamily: info.fontFamily,
          fontSize: info.fontSize,
          fontWeight: info.fontWeight,
          fontStyle: info.fontStyle,
          isUppercase: info.isUppercase,
          isDarkBg: info.isDarkBg,
        };

        const result = calculate(input, settings.contextOverride, settings.gridStep);
        await applyToNode(node, result);
        applied++;
      }

      figma.notify(`TypeTune: applied to ${applied} text layer${applied !== 1 ? 's' : ''} on page`);
      processSelection();
      break;
    }

    case 'export-code': {
      const { nodeId, format } = msg as { nodeId: string; format: ExportFormat; type: string };
      const node = figma.getNodeById(nodeId);
      if (!node || node.type !== 'TEXT') break;

      const info = analyzeTextNode(node as TextNode);
      if (!info) break;

      const input: TypographyInput = {
        fontFamily: info.fontFamily,
        fontSize: info.fontSize,
        fontWeight: info.fontWeight,
        fontStyle: info.fontStyle,
        isUppercase: info.isUppercase,
        isDarkBg: info.isDarkBg,
      };

      const result = calculate(input, settings.contextOverride, settings.gridStep);
      const code = exportCode(result, info.fontSize, format);

      figma.ui.postMessage({ type: 'export-result', code, format });
      break;
    }

    case 'recalculate':
      processSelection();
      break;
  }
};

// Auto-apply on selection change
figma.on('selectionchange', () => {
  processSelection();
});
