import esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const watch = process.argv.includes('--watch');

const commonMain = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/main.js',
  format: 'iife',
  target: 'es2017',
};

const commonUI = {
  entryPoints: ['src/ui/index.tsx'],
  bundle: true,
  outfile: 'dist/ui.js',
  format: 'iife',
  target: 'es2017',
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
};

function buildHtml() {
  mkdirSync('dist', { recursive: true });
  const js = readFileSync('dist/ui.js', 'utf8');
  const css = readFileSync('src/ui/styles.css', 'utf8');
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>${css}</style>
</head>
<body>
<div id="app"></div>
<script>${js}</script>
</body>
</html>`;
  writeFileSync('dist/ui.html', html);
}

if (watch) {
  const [mainCtx, uiCtx] = await Promise.all([
    esbuild.context(commonMain),
    esbuild.context(commonUI),
  ]);
  await Promise.all([mainCtx.rebuild(), uiCtx.rebuild()]);
  buildHtml();
  console.log('Initial build complete, watching...');
  await Promise.all([mainCtx.watch(), uiCtx.watch()]);
} else {
  await Promise.all([
    esbuild.build(commonMain),
    esbuild.build(commonUI),
  ]);
  buildHtml();
  console.log('Build complete');
}
