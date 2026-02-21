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
  updateStyles: false,
};

let settings: PluginSettings = { ...DEFAULT_SETTINGS };
let lastGroups: DeduplicatedGroup[] = [];

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
  currentLineHeightPx: number;
  currentLetterSpacingPx: number;
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

function getLineHeightPx(node: TextNode): number {
  const lh = node.lineHeight as LineHeight;
  const fs = (typeof node.fontSize === 'symbol') ? 16 : node.fontSize as number;
  if (typeof lh === 'symbol') return fs * 1.2; // mixed → assume default
  if ('unit' in lh) {
    if (lh.unit === 'AUTO') return fs * 1.2; // Figma auto ≈ 120%
    if (lh.unit === 'PERCENT') return fs * lh.value / 100;
    return lh.value; // PIXELS
  }
  return fs * 1.2;
}

function getLetterSpacingPx(node: TextNode): number {
  const ls = node.letterSpacing as LetterSpacing;
  const fs = (typeof node.fontSize === 'symbol') ? 16 : node.fontSize as number;
  if (typeof ls === 'symbol') return 0;
  if ('unit' in ls) {
    if (ls.unit === 'PERCENT') return fs * ls.value / 100;
    return ls.value; // PIXELS
  }
  return 0;
}

function analyzeTextNode(node: TextNode): TextLayerInfo | null {
  const fontName = node.fontName;
  if (typeof fontName === 'symbol') return null; // mixed fonts

  const fontSize = node.fontSize;
  if (typeof fontSize === 'symbol') return null; // mixed sizes

  let isUppercase = false;
  try {
    const textCase = node.textCase;
    isUppercase = textCase === 'UPPER';
  } catch (_) {
    // textCase may throw on some nodes
  }

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
    currentLineHeightPx: getLineHeightPx(node),
    currentLetterSpacingPx: getLetterSpacingPx(node),
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
  if (typeof fontName === 'symbol') {
    console.warn('[FineTune] node', node.id, 'has mixed fonts, skipping');
    return;
  }

  await figma.loadFontAsync(fontName);
  node.lineHeight = { value: result.lineHeightPercent, unit: 'PERCENT' };
  node.letterSpacing = { value: result.letterSpacing, unit: 'PIXELS' };
}

async function applyGroups(groups: DeduplicatedGroup[], styledNodeIds: Set<string>): Promise<number> {
  let applied = 0;

  for (const group of groups) {
    // Skip groups that are already within tolerance
    if (group.isAlreadyGood) continue;

    for (const node of group.nodes) {
      // Skip nodes whose style was already updated — they inherit new values
      if (styledNodeIds.has(node.id)) {
        applied++;
        continue;
      }
      try {
        await applyToNode(node, group.result);
        applied++;
      } catch (e) {
        console.error('[FineTune] applyGroups failed for node', node.id, e);
      }
    }
  }

  return applied;
}

// --- Style update + changelog ---

interface StyleChange {
  styleName: string;
  before: { lineHeight: string; letterSpacing: string };
  after: { lineHeight: string; letterSpacing: string };
}

function describeStyleLineHeight(style: TextStyle): string {
  const lh = style.lineHeight as LineHeight;
  if (typeof lh === 'symbol') return 'auto';
  if ('unit' in lh) {
    if (lh.unit === 'AUTO') return 'auto';
    if (lh.unit === 'PERCENT') return `${Math.round(lh.value * 10) / 10}%`;
    return `${Math.round(lh.value * 100) / 100}px`;
  }
  return 'auto';
}

function describeStyleLetterSpacing(style: TextStyle): string {
  const ls = style.letterSpacing as LetterSpacing;
  if (typeof ls === 'symbol') return '0';
  if ('unit' in ls) {
    if (ls.unit === 'PERCENT') return `${Math.round(ls.value * 10) / 10}%`;
    return `${Math.round(ls.value * 100) / 100}px`;
  }
  return '0';
}

interface StyleUpdateResult {
  changes: StyleChange[];
  styledNodeIds: Set<string>;
}

async function updateTextStyles(groups: DeduplicatedGroup[]): Promise<StyleUpdateResult> {
  const changes: StyleChange[] = [];
  const updatedStyleIds = new Set<string>();
  const styledNodeIds = new Set<string>();

  for (const group of groups) {
    for (const textNode of group.nodes) {
      const nodeId = textNode.id;
      try {
        const styleId = textNode.textStyleId;
        if (typeof styleId === 'symbol' || !styleId) continue; // mixed or no style

        // If this style was already updated, just mark node as styled
        if (updatedStyleIds.has(styleId)) {
          styledNodeIds.add(nodeId);
          continue;
        }

        const style = figma.getStyleById(styleId);
        if (!style || style.type !== 'TEXT') continue; // can't update — let applyGroups handle it

        const textStyle = style as TextStyle;
        const beforeLH = describeStyleLineHeight(textStyle);
        const beforeLS = describeStyleLetterSpacing(textStyle);

        // Load font before modifying style
        const fontName = textStyle.fontName;
        if (fontName) {
          await figma.loadFontAsync(fontName);
        }

        textStyle.lineHeight = { value: group.result.lineHeightPercent, unit: 'PERCENT' };
        textStyle.letterSpacing = { value: group.result.letterSpacing, unit: 'PIXELS' };
        updatedStyleIds.add(styleId);
        // Only mark node as styled AFTER the style was successfully updated
        styledNodeIds.add(nodeId);

        changes.push({
          styleName: textStyle.name,
          before: { lineHeight: beforeLH, letterSpacing: beforeLS },
          after: {
            lineHeight: `${group.result.lineHeightPercent}%`,
            letterSpacing: `${group.result.letterSpacing}px`,
          },
        });
      } catch (e) {
        console.error('[FineTune] updateTextStyles failed for node', nodeId, e);
      }
    }
  }

  return { changes, styledNodeIds };
}

function formatChangelog(changes: StyleChange[]): string {
  if (changes.length === 0) return '';
  const date = new Date().toISOString().slice(0, 10);
  const lines = [`## FineTune changelog — ${date}\n`];
  for (const c of changes) {
    lines.push(`### ${c.styleName}`);
    lines.push(`- Line-height: ${c.before.lineHeight} → ${c.after.lineHeight}`);
    lines.push(`- Letter-spacing: ${c.before.letterSpacing} → ${c.after.letterSpacing}`);
    lines.push('');
  }
  return lines.join('\n');
}

// --- Dedup key for unique font configurations ---

function fontKey(info: TextLayerInfo): string {
  return `${info.fontFamily}:${info.fontWeight}:${info.fontSize}:${info.isDarkBg ? 'd' : 'l'}:${info.isUppercase ? 'U' : 'l'}`;
}

// --- Handle selection ---

interface DeduplicatedGroup {
  key: string;
  info: TextLayerInfo;
  result: TypographyResult;
  nodeIds: string[];
  nodes: TextNode[];
  count: number;
  isAlreadyGood: boolean;
}

function checkAlreadyGood(info: TextLayerInfo, result: TypographyResult): boolean {
  const lhTarget = result.lineHeight;
  const lsTarget = result.letterSpacing;
  const lhCurrent = info.currentLineHeightPx;
  const lsCurrent = info.currentLetterSpacingPx;

  // Line-height: within 5% of target
  const lhOk = lhTarget > 0
    ? Math.abs(lhCurrent - lhTarget) / lhTarget <= 0.05
    : Math.abs(lhCurrent - lhTarget) < 0.5;

  // Letter-spacing: within 5% or ±0.2px for small values
  const lsThreshold = Math.max(0.2, Math.abs(lsTarget) * 0.05);
  const lsOk = Math.abs(lsCurrent - lsTarget) <= lsThreshold;

  return lhOk && lsOk;
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
      existing.nodes.push(node);
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
      nodes: [node],
      count: 1,
      isAlreadyGood: checkAlreadyGood(info, result),
    });
  }

  // Sort: largest font size first, then by family name
  return Array.from(groupMap.values()).sort((a, b) =>
    b.info.fontSize - a.info.fontSize || a.info.fontFamily.localeCompare(b.info.fontFamily)
  );
}

function sendGroupsToUI(groups: DeduplicatedGroup[], totalLayers: number, applied: boolean): void {
  lastGroups = groups;
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
      isAlreadyGood: g.isAlreadyGood,
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

async function processAndApply(textNodes: TextNode[]): Promise<{ applied: number; changes: StyleChange[] }> {
  const groups = computeGroups(textNodes);
  const fixableCount = groups.filter(g => !g.isAlreadyGood).length;
  const goodCount = groups.filter(g => g.isAlreadyGood).length;
  console.log(`[FineTune] ${groups.length} groups: ${fixableCount} fixable, ${goodCount} good`);

  for (const g of groups) {
    console.log(`[FineTune]   ${g.result.fontInfo}: LH ${g.info.currentLineHeightPx.toFixed(1)}→${g.result.lineHeight}px, LS ${g.info.currentLetterSpacingPx.toFixed(2)}→${g.result.letterSpacing}px ${g.isAlreadyGood ? '(good)' : '(fix)'}`);
  }

  sendGroupsToUI(groups, textNodes.length, true);

  let styledNodeIds = new Set<string>();

  if (settings.updateStyles) {
    const result = await updateTextStyles(groups);
    styledNodeIds = result.styledNodeIds;
    console.log('[FineTune] styled nodes:', styledNodeIds.size);
  }

  const applied = await applyGroups(groups, styledNodeIds);
  console.log('[FineTune] applied to', applied, 'nodes');

  // 5. Build changelog for ALL applied groups (not just style updates)
  const changes: StyleChange[] = [];
  for (const group of groups) {
    if (group.isAlreadyGood) continue;
    changes.push({
      styleName: group.result.fontInfo,
      before: { lineHeight: group.info.currentLineHeight, letterSpacing: group.info.currentLetterSpacing },
      after: { lineHeight: `${group.result.lineHeightPercent}%`, letterSpacing: `${group.result.letterSpacing}px` },
    });
  }

  if (changes.length > 0) {
    const changelog = formatChangelog(changes);
    figma.ui.postMessage({ type: 'style-changelog', changelog, changes });
  }

  return { applied, changes };
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
      try {
        const selection = figma.currentPage.selection;
        console.log('[FineTune] apply-selected: selection has', selection.length, 'top-level nodes');
        const textNodes = collectTextNodes(selection);
        console.log('[FineTune] found', textNodes.length, 'text nodes');

        if (textNodes.length === 0) {
          figma.notify('FineTune: No text layers in selection');
          break;
        }

        const { applied } = await processAndApply(textNodes);

        if (applied === 0) {
          figma.notify('FineTune: All styles are already well-tuned');
        } else {
          figma.notify(`FineTune: ${applied} layer${applied !== 1 ? 's' : ''} tuned`);
        }
      } catch (e) {
        console.error('[FineTune] apply-selected error:', e);
        figma.notify('FineTune: Error — check console', { error: true });
      }
      break;
    }

    case 'export-code': {
      const { nodeId, format } = msg as { nodeId: string; format: ExportFormat; type: string };
      // Find group by nodeId from cached groups (avoids getNodeById which fails with dynamic-page)
      const group = lastGroups.find(function(g) { return g.nodeIds.indexOf(nodeId) !== -1; });
      if (!group) break;

      const code = exportCode(group.result, group.info.fontSize, format);
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
    await processAndApply(textNodes);
  } else {
    processSelection();
  }
});
