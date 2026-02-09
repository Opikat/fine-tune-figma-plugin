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

figma.showUI(__html__, { width: 360, height: 640 });

const GRID_STEP = 4;
const CONTEXT_OVERRIDE: 'auto' = 'auto';

const DEFAULT_SETTINGS: PluginSettings = {
  gridStep: GRID_STEP,
  bgMode: 'auto',
  contextOverride: CONTEXT_OVERRIDE,
  autoApply: false,
  writeVariables: false,
};

let settings: PluginSettings = { ...DEFAULT_SETTINGS };

async function loadSettings(): Promise<void> {
  const saved = await figma.clientStorage.getAsync('finetune-settings');
  if (saved) {
    settings = { ...DEFAULT_SETTINGS, ...saved };
  }
}

async function saveSettings(): Promise<void> {
  await figma.clientStorage.setAsync('finetune-settings', settings);
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
    if (lh.unit === 'PERCENT') return `${Math.round(lh.value * 10) / 10}%`;
    return `${Math.round(lh.value * 100) / 100}px`;
  }
  return 'auto';
}

function describeLetterSpacing(node: TextNode): string {
  const ls = node.letterSpacing as LetterSpacing;
  if (typeof ls === 'symbol') return '0';
  if ('unit' in ls) {
    if (ls.unit === 'PERCENT') return `${Math.round(ls.value * 10) / 10}%`;
    return `${Math.round(ls.value * 100) / 100}px`;
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

  const darkBg = isDarkBackground(node);

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

async function applyGroups(groups: DeduplicatedGroup[]): Promise<number> {
  let applied = 0;

  for (const group of groups) {
    for (const nodeId of group.nodeIds) {
      try {
        const node = figma.getNodeById(nodeId);
        if (node && node.type === 'TEXT') {
          await applyToNode(node, group.result);
          applied++;
        }
      } catch (_) {
        // skip nodes that fail (e.g. can't load font) — continue with the rest
      }
    }
  }

  return applied;
}

// --- Dedup key for unique font configurations ---

function fontKey(info: TextLayerInfo): string {
  return `${info.fontFamily}:${info.fontWeight}:${info.fontSize}`;
}

// --- Handle selection ---

interface DeduplicatedGroup {
  key: string;
  info: TextLayerInfo;
  result: TypographyResult;
  nodeIds: string[];
  count: number;
}

function computeGroups(textNodes: TextNode[]): DeduplicatedGroup[] {
  const groupMap = new Map<string, DeduplicatedGroup>();

  for (const node of textNodes) {
    const info = analyzeTextNode(node);
    if (!info) continue;

    const k = fontKey(info);
    const existing = groupMap.get(k);

    if (existing) {
      existing.nodeIds.push(info.nodeId);
      existing.count++;
      continue;
    }

    const input: TypographyInput = {
      fontFamily: info.fontFamily,
      fontSize: info.fontSize,
      fontWeight: info.fontWeight,
      fontStyle: info.fontStyle,
      isUppercase: info.isUppercase,
      isDarkBg: info.isDarkBg,
    };

    const result = calculate(input, settings.contextOverride, settings.gridStep);
    groupMap.set(k, {
      key: k,
      info,
      result,
      nodeIds: [info.nodeId],
      count: 1,
    });
  }

  // Sort: largest font size first, then by family name
  return Array.from(groupMap.values()).sort((a, b) =>
    b.info.fontSize - a.info.fontSize || a.info.fontFamily.localeCompare(b.info.fontFamily)
  );
}

function sendGroupsToUI(groups: DeduplicatedGroup[], totalLayers: number, applied: boolean): void {
  figma.ui.postMessage({
    type: 'calculation-results',
    results: groups.map(g => ({
      nodeIds: g.nodeIds,
      nodeId: g.nodeIds[0],
      fontInfo: g.result.fontInfo,
      isApproximate: g.result.isApproximate,
      count: g.count,
      applied,
      before: {
        lineHeight: g.info.currentLineHeight,
        letterSpacing: g.info.currentLetterSpacing,
      },
      after: {
        lineHeight: g.result.lineHeight,
        lineHeightPercent: g.result.lineHeightPercent,
        lineHeightRaw: g.result.lineHeightRaw,
        letterSpacing: g.result.letterSpacing,
        letterSpacingEm: g.result.letterSpacingEm,
        letterSpacingPercent: g.result.letterSpacingPercent,
      },
      fontSize: g.info.fontSize,
    })),
    totalLayers,
    uniqueGroups: groups.length,
    settings,
  });
}

function processSelection(): void {
  const selection = figma.currentPage.selection;
  const textNodes = collectTextNodes(selection);

  if (textNodes.length === 0) {
    figma.ui.postMessage({ type: 'no-selection' });
    return;
  }

  const groups = computeGroups(textNodes);
  sendGroupsToUI(groups, textNodes.length, false);
}

async function processAndApply(textNodes: TextNode[]): Promise<number> {
  // 1. Compute groups BEFORE applying — captures original "before" values
  const groups = computeGroups(textNodes);

  // 2. Send preview to UI with correct before/after
  sendGroupsToUI(groups, textNodes.length, true);

  // 3. Apply values to all nodes
  const applied = await applyGroups(groups);
  return applied;
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
      const textNodes = collectTextNodes(figma.currentPage.selection);
      const applied = await processAndApply(textNodes);
      figma.notify(`FineTune: applied to ${applied} text layer${applied !== 1 ? 's' : ''}`);
      break;
    }

    case 'apply-page': {
      const textNodes = collectTextNodes(figma.currentPage.children);
      const applied = await processAndApply(textNodes);
      figma.notify(`FineTune: applied to ${applied} text layer${applied !== 1 ? 's' : ''} on page`);
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
figma.on('selectionchange', async () => {
  const textNodes = collectTextNodes(figma.currentPage.selection);

  if (textNodes.length === 0) {
    figma.ui.postMessage({ type: 'no-selection' });
    return;
  }

  if (settings.autoApply) {
    // Compute groups first (captures "before"), send to UI, then apply
    await processAndApply(textNodes);
  } else {
    processSelection();
  }
});
