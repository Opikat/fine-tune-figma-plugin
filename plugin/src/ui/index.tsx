import { h, render, Fragment } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';

type BgMode = 'auto' | 'light' | 'dark';
type TextContext = 'display' | 'body' | 'caption';
type ExportFormat = 'css' | 'css-fluid' | 'ios' | 'android';

interface Settings {
  gridStep: number;
  bgMode: BgMode;
  contextOverride: TextContext | 'auto';
  autoApply: boolean;
  writeVariables: boolean;
}

interface ResultEntry {
  nodeId: string;
  fontInfo: string;
  isApproximate: boolean;
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
}

function App() {
  const [settings, setSettings] = useState<Settings>({
    gridStep: 4,
    bgMode: 'auto',
    contextOverride: 'auto',
    autoApply: false,
    writeVariables: false,
  });
  const [results, setResults] = useState<ResultEntry[]>([]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('css');
  const [exportCode, setExportCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [hasSelection, setHasSelection] = useState(true);

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
          setHasSelection(true);
          // Request export for first node
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
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [exportFormat]);

  const updateSetting = useCallback(<K extends keyof Settings>(key: K, value: Settings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    parent.postMessage({ pluginMessage: { type: 'update-settings', settings: { [key]: value } } }, '*');
  }, [settings]);

  const handleApplySelected = () => {
    parent.postMessage({ pluginMessage: { type: 'apply-selected' } }, '*');
  };

  const handleApplyPage = () => {
    parent.postMessage({ pluginMessage: { type: 'apply-page' } }, '*');
  };

  const handleExportTab = (format: ExportFormat) => {
    setExportFormat(format);
    if (results.length > 0) {
      parent.postMessage({
        pluginMessage: {
          type: 'export-code',
          nodeId: results[0].nodeId,
          format,
        },
      }, '*');
    }
  };

  const handleCopy = () => {
    if (!exportCode) return;
    navigator.clipboard.writeText(exportCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const firstResult = results[0];

  return (
    <>
      {/* Controls */}
      <div class="section">
        <div class="controls-row">
          <label>Context:</label>
          <select
            value={settings.contextOverride}
            onChange={(e) => updateSetting('contextOverride', (e.target as HTMLSelectElement).value as TextContext | 'auto')}
          >
            <option value="auto">Auto</option>
            <option value="display">Display</option>
            <option value="body">Body</option>
            <option value="caption">Caption</option>
          </select>

          <label>Grid:</label>
          <select
            value={settings.gridStep}
            onChange={(e) => updateSetting('gridStep', Number((e.target as HTMLSelectElement).value))}
          >
            <option value={1}>Off</option>
            <option value={2}>2px</option>
            <option value={4}>4px</option>
            <option value={8}>8px</option>
          </select>
        </div>

        <div class="controls-row">
          <label>Background:</label>
          <div class="radio-group">
            {(['auto', 'light', 'dark'] as BgMode[]).map((mode) => (
              <label key={mode}>
                <input
                  type="radio"
                  name="bgMode"
                  checked={settings.bgMode === mode}
                  onChange={() => updateSetting('bgMode', mode)}
                />
                {mode === 'auto' ? 'Auto' : mode === 'light' ? 'Light' : 'Dark'}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div class="divider" />

      {/* Results */}
      {!hasSelection ? (
        <div class="empty-state">
          <div class="empty-state-icon">Aa</div>
          <div class="empty-state-text">
            Select text layers to optimize<br />
            line-height and letter-spacing
          </div>
        </div>
      ) : results.length === 0 ? (
        <div class="empty-state">
          <div class="empty-state-icon">...</div>
          <div class="empty-state-text">
            No text layers in selection
          </div>
        </div>
      ) : (
        <>
          <div class="section">
            <div class="section-title">
              Result{results.length > 1 ? ` (${results.length} layers)` : ''}
            </div>
            {firstResult && (
              <div class="result-card">
                <div class="font-info">
                  {firstResult.fontInfo}
                  {firstResult.isApproximate && (
                    <span class="approximate-badge">approx</span>
                  )}
                </div>
                <div class="result-row">
                  <span class="result-label">Line-height</span>
                  <span>
                    <span class="result-value">
                      {firstResult.after.lineHeight}px
                    </span>
                    <span style="color: var(--figma-color-text-secondary, #888); margin-left: 4px">
                      ({firstResult.after.lineHeightPercent}%)
                    </span>
                    <span class="result-prev">
                      {firstResult.before.lineHeight}
                    </span>
                  </span>
                </div>
                <div class="result-row">
                  <span class="result-label">Letter-spacing</span>
                  <span>
                    <span class="result-value">
                      {firstResult.after.letterSpacing}px
                    </span>
                    <span style="color: var(--figma-color-text-secondary, #888); margin-left: 4px">
                      ({firstResult.after.letterSpacingPercent}%)
                    </span>
                    <span class="result-prev">
                      {firstResult.before.letterSpacing}
                    </span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Apply buttons */}
          <div class="btn-group">
            <button class="btn btn-primary" onClick={handleApplySelected}>
              Apply to selected
            </button>
            <button class="btn btn-secondary" onClick={handleApplyPage}>
              Apply to page
            </button>
          </div>

          <div class="divider" />

          {/* Export */}
          <div class="section">
            <div class="section-title">Export</div>
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
        </>
      )}

      <div class="divider" />

      {/* Settings */}
      <div class="section">
        <div class="section-title">Settings</div>
        <div class="checkbox-row">
          <input
            type="checkbox"
            id="writeVariables"
            checked={settings.writeVariables}
            onChange={(e) => updateSetting('writeVariables', (e.target as HTMLInputElement).checked)}
          />
          <label for="writeVariables">Write to Variables</label>
        </div>
        <div class="checkbox-row">
          <input
            type="checkbox"
            id="autoApply"
            checked={settings.autoApply}
            onChange={(e) => updateSetting('autoApply', (e.target as HTMLInputElement).checked)}
          />
          <label for="autoApply">Auto-apply on selection change</label>
        </div>
      </div>
    </>
  );
}

render(<App />, document.getElementById('app')!);
