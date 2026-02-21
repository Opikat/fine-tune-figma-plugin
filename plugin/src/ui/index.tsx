import { h, render, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';

type ExportFormat = 'css' | 'css-fluid' | 'ios' | 'android';

interface Settings {
  autoApply: boolean;
  writeVariables: boolean;
  updateStyles: boolean;
  gridStep: number;
}

interface StyleChange {
  styleName: string;
  before: { lineHeight: string; letterSpacing: string };
  after: { lineHeight: string; letterSpacing: string };
}

interface ResultEntry {
  nodeId: string;
  nodeIds: string[];
  fontInfo: string;
  isApproximate: boolean;
  count: number;
  before: { lineHeight: string; letterSpacing: string };
  after: {
    lineHeight: number;
    lineHeightPercent: number;
    lineHeightRaw: number;
    letterSpacing: number;
    letterSpacingEm: number;
    letterSpacingPercent: number;
  };
  fontSize: number;
  isAlreadyGood: boolean;
}

function copyText(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(ta);
  return ok;
}

function App() {
  const [settings, setSettings] = useState<Settings>({
    autoApply: false,
    writeVariables: false,
    updateStyles: false,
    gridStep: 4,
  });
  const [showHelp, setShowHelp] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showGood, setShowGood] = useState(false);
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [totalLayers, setTotalLayers] = useState(0);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('css');
  const [exportCode, setExportCode] = useState('');
  const [selectedExportIdx, setSelectedExportIdx] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedChangelog, setCopiedChangelog] = useState(false);
  const [hasSelection, setHasSelection] = useState(true);
  const [changelog, setChangelog] = useState('');
  const [styleChanges, setStyleChanges] = useState<StyleChange[]>([]);

  useEffect(() => {
    parent.postMessage({ pluginMessage: { type: 'init' } }, '*');
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const msg = e.data.pluginMessage;
      if (!msg) return;

      switch (msg.type) {
        case 'settings':
          setSettings(msg.settings);
          break;
        case 'calculation-results':
          setResults(msg.results);
          setTotalLayers(msg.totalLayers || msg.results.length);
          setHasSelection(true);
          setSelectedExportIdx(0);
          setStyleChanges([]);
          setChangelog('');
          if (msg.results.length > 0) {
            parent.postMessage({
              pluginMessage: {
                type: 'export-code',
                nodeId: msg.results[0].nodeId,
                format: exportFormat,
              },
            }, '*');
          }
          break;
        case 'no-selection':
          setResults([]);
          setHasSelection(false);
          setExportCode('');
          break;
        case 'export-result':
          setExportCode(msg.code);
          break;
        case 'style-changelog':
          setChangelog(msg.changelog);
          setStyleChanges(msg.changes);
          break;
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [exportFormat]);

  const updateSetting = (key: keyof Settings, value: boolean | number) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    parent.postMessage({ pluginMessage: { type: 'update-settings', settings: { [key]: value } } }, '*');
  };

  const handleApplySelected = () => {
    parent.postMessage({ pluginMessage: { type: 'apply-selected' } }, '*');
  };

  const handleCopyChangelog = () => {
    if (!changelog) return;
    if (copyText(changelog)) {
      setCopiedChangelog(true);
      setTimeout(() => setCopiedChangelog(false), 1500);
    }
  };

  const handleExportTab = (format: ExportFormat) => {
    setExportFormat(format);
    const r = results[selectedExportIdx];
    if (r) {
      parent.postMessage({
        pluginMessage: { type: 'export-code', nodeId: r.nodeId, format },
      }, '*');
    }
  };

  const handleSelectExport = (idx: number) => {
    setSelectedExportIdx(idx);
    const r = results[idx];
    if (r) {
      parent.postMessage({
        pluginMessage: { type: 'export-code', nodeId: r.nodeId, format: exportFormat },
      }, '*');
    }
  };

  const handleCopy = () => {
    if (!exportCode) return;
    if (copyText(exportCode)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // Split results into fixable and well-tuned
  const fixable: Array<{ r: ResultEntry; idx: number }> = [];
  const good: Array<{ r: ResultEntry; idx: number }> = [];
  results.forEach((r, idx) => {
    if (r.isAlreadyGood) good.push({ r, idx });
    else fixable.push({ r, idx });
  });

  const renderCard = (r: ResultEntry, idx: number) => (
    <div
      key={r.nodeId}
      class={`result-card${results.length > 1 && idx === selectedExportIdx ? ' result-card-selected' : ''}${r.isAlreadyGood ? ' result-card-good' : ''}`}
      onClick={() => results.length > 1 && handleSelectExport(idx)}
    >
      <div class="font-info">
        <span class="font-info-name">{r.fontInfo}</span>
        <span class="font-info-badges">
          {r.count > 1 && <span class="count-badge">{r.count}x</span>}
          {r.isAlreadyGood && <span class="good-badge">good</span>}
          {r.isApproximate && !r.isAlreadyGood && <span class="approximate-badge">approx</span>}
        </span>
      </div>
      {r.isAlreadyGood ? (
        <>
          <div class="result-row">
            <span class="result-label">Line-height</span>
            <span class="result-value">{r.before.lineHeight}</span>
          </div>
          <div class="result-row">
            <span class="result-label">Letter-spacing</span>
            <span class="result-value">{r.before.letterSpacing}</span>
          </div>
        </>
      ) : (
        <>
          <div class="result-row">
            <span class="result-label">Line-height</span>
            <span>
              <span class="result-value">{r.after.lineHeight}px</span>
              <span class="result-secondary"> ({r.after.lineHeightPercent}%)</span>
              <span class="result-prev">{r.before.lineHeight}</span>
            </span>
          </div>
          <div class="result-row">
            <span class="result-label">Letter-spacing</span>
            <span>
              <span class="result-value">{r.after.letterSpacing}px</span>
              <span class="result-secondary"> ({r.after.letterSpacingPercent}%)</span>
              <span class="result-prev">{r.before.letterSpacing}</span>
            </span>
          </div>
        </>
      )}
    </div>
  );

  const hasResults = hasSelection && results.length > 0;

  return (
    <>
      {/* === Fixed top: header or empty state === */}
      {!hasSelection ? (
        <div class="main-scroll">
          <div class="empty-state">
            <div class="empty-state-icon">Aa</div>
            <div class="empty-state-text">
              Select text layers to optimize<br />
              line-height and letter-spacing
            </div>
          </div>
        </div>
      ) : results.length === 0 ? (
        <div class="main-scroll">
          <div class="empty-state">
            <div class="empty-state-icon">...</div>
            <div class="empty-state-text">
              No text layers in selection
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Fixed top header */}
          <div class="top-header">
            <div class="section-title">
              {results.length === 1
                ? 'Result'
                : `${results.length} unique style${results.length > 1 ? 's' : ''} (${totalLayers} layer${totalLayers !== 1 ? 's' : ''})`}
            </div>
          </div>

          {/* Scrollable results only */}
          <div class="main-scroll">
            <div class="results-list">
              {fixable.map(({ r, idx }) => renderCard(r, idx))}
            </div>

            {/* Collapsible good section */}
            {good.length > 0 && (
              <>
                <button
                  class="good-toggle"
                  onClick={() => setShowGood(!showGood)}
                >
                  <span>{good.length} well-tuned style{good.length !== 1 ? 's' : ''}</span>
                  <span class={`good-toggle-arrow${showGood ? ' open' : ''}`}>&#9654;</span>
                </button>
                {showGood && (
                  <div class="results-list">
                    {good.map(({ r, idx }) => renderCard(r, idx))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Fixed middle: Apply + Export */}
          <div class="middle-bar">
            {/* Apply button + log badge */}
            <div class="apply-row">
              <button class="btn btn-primary" onClick={handleApplySelected}>
                Apply to selected
              </button>
              {styleChanges.length > 0 && (
                <button class="log-badge" onClick={() => setShowLog(true)}>
                  Log ({styleChanges.length})
                </button>
              )}
            </div>

            <div class="divider" />

            {/* Export */}
            <div class="section">
              <div class="section-title">
                Export
                {results.length > 1 && (
                  <span style="font-weight: 400; text-transform: none; margin-left: 4px">
                    — {results[selectedExportIdx].fontInfo}
                  </span>
                )}
              </div>
              <div class="export-tabs">
                {([
                  ['css', 'CSS'],
                  ['css-fluid', 'Fluid'],
                  ['ios', 'iOS'],
                  ['android', 'Android'],
                ] as [ExportFormat, string][]).map(([fmt, label]) => (
                  <button
                    key={fmt}
                    class={`export-tab${exportFormat === fmt ? ' active' : ''}`}
                    onClick={() => handleExportTab(fmt)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {exportCode && (
                <div class="code-block">
                  {exportCode}
                  <button class="copy-btn" onClick={handleCopy}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* === Settings pinned to bottom === */}
      <div class="bottom-bar">
        <div class="settings-grid">
          <div class="checkbox-row">
            <input type="checkbox" id="autoApply" checked={settings.autoApply}
              onChange={(e) => updateSetting('autoApply', (e.target as HTMLInputElement).checked)} />
            <label for="autoApply">Auto-apply on selection change</label>
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="updateStyles" checked={settings.updateStyles}
              onChange={(e) => updateSetting('updateStyles', (e.target as HTMLInputElement).checked)} />
            <label for="updateStyles">Update text styles</label>
          </div>
          <div class="checkbox-row">
            <input type="checkbox" id="writeVariables" checked={settings.writeVariables}
              onChange={(e) => updateSetting('writeVariables', (e.target as HTMLInputElement).checked)} />
            <label for="writeVariables">Save to Figma Variables</label>
          </div>
        </div>
        <div class="settings-row">
          <span class="settings-row-label">Pixel grid</span>
          <div class="grid-options" style="flex: 0 0 auto; width: 160px">
            {[
              { value: 1, label: 'Off' },
              { value: 2, label: '2' },
              { value: 4, label: '4' },
              { value: 8, label: '8' },
            ].map(opt => (
              <button
                key={opt.value}
                class={`grid-option${settings.gridStep === opt.value ? ' active' : ''}`}
                onClick={() => updateSetting('gridStep', opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <button class="help-link" onClick={() => setShowHelp(true)}>
          How do these settings work?
        </button>
      </div>

      {/* === Log side panel === */}
      {showLog && styleChanges.length > 0 && (
        <>
          <div class="log-overlay" onClick={() => setShowLog(false)} />
          <div class="log-panel">
            <div class="log-panel-header">
              <span class="log-panel-title">Changelog</span>
              <div class="log-panel-actions">
                <button class="log-panel-btn" onClick={handleCopyChangelog}>
                  {copiedChangelog ? 'Copied!' : 'Copy'}
                </button>
                <button class="log-panel-close" onClick={() => setShowLog(false)}>
                  &times;
                </button>
              </div>
            </div>
            <div class="log-panel-body">
              {styleChanges.map(c => (
                <div class="changelog-item" key={c.styleName}>
                  <div class="changelog-name">{c.styleName}</div>
                  <div class="changelog-diff">
                    LH: {c.before.lineHeight} → {c.after.lineHeight}
                  </div>
                  <div class="changelog-diff">
                    LS: {c.before.letterSpacing} → {c.after.letterSpacing}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* === Help modal === */}
      {showHelp && (
        <div class="modal-overlay" onClick={() => setShowHelp(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <div class="modal-header">
              <span class="modal-title">Settings</span>
              <button class="modal-close" onClick={() => setShowHelp(false)}>
                &times;
              </button>
            </div>
            <div class="modal-body">
              <div class="help-item">
                <div class="help-name">Auto-apply on selection change</div>
                <div class="help-desc">
                  Optimized values are immediately applied to every text layer you select — no need to click "Apply". Disable if you want to preview values first.
                </div>
              </div>
              <div class="help-item">
                <div class="help-name">Update text styles</div>
                <div class="help-desc">
                  When a text layer uses a shared text style, the style definition itself is updated — all instances across the file change automatically. A changelog is shown so you can track what changed.
                </div>
              </div>
              <div class="help-item">
                <div class="help-name">Save to Figma Variables</div>
                <div class="help-desc">
                  Creates a "FineTune" variable collection with line-height and letter-spacing tokens that developers can read directly. Includes Light and Dark mode variants.
                </div>
              </div>
              <div class="help-item">
                <div class="help-name">Pixel grid</div>
                <div class="help-desc">
                  Snaps line-height values to a pixel grid for sharper rendering and consistent vertical rhythm. For example, with a 4px grid, line-heights become 20, 24, 28px, etc.
                  For small text (16px and below) the grid step is automatically halved to avoid too-large jumps. "Off" disables grid snapping and rounds to the nearest pixel.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

render(<App />, document.getElementById('app')!);
