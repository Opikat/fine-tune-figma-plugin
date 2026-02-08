import type { TypographyResult, ExportFormat } from './types';

export function exportCode(
  result: TypographyResult,
  fontSize: number,
  format: ExportFormat
): string {
  switch (format) {
    case 'css':
      return exportCSS(result, fontSize);
    case 'css-fluid':
      return exportCSSFluid(result, fontSize);
    case 'ios':
      return exportIOS(result, fontSize);
    case 'android':
      return exportAndroid(result, fontSize);
  }
}

function exportCSS(r: TypographyResult, fontSize: number): string {
  const lines = [
    `font-size: ${fontSize}px;`,
    `line-height: ${r.lineHeight}px; /* ${r.lineHeightPercent}% */`,
  ];
  if (r.letterSpacing !== 0) {
    lines.push(`letter-spacing: ${r.letterSpacingEm}em; /* Figma: ${r.letterSpacingPercent}% */`);
  }
  return lines.join('\n');
}

function exportCSSFluid(r: TypographyResult, fontSize: number): string {
  // Generate clamp() assuming mobile=0.875x, desktop=1.125x of base
  const minFs = Math.round(fontSize * 0.875);
  const maxFs = Math.round(fontSize * 1.125);
  const ratio = r.lineHeight / fontSize;
  const minLh = Math.round(minFs * ratio);
  const maxLh = Math.round(maxFs * ratio);

  // vw coefficient: (maxFs - minFs) / (1440 - 375) * 100
  const vwCoeff = Math.round(((maxFs - minFs) / (1440 - 375)) * 10000) / 100;
  const remBase = Math.round((minFs - vwCoeff * 3.75) * 100) / 100;
  const vwCoeffLh = Math.round(((maxLh - minLh) / (1440 - 375)) * 10000) / 100;
  const remBaseLh = Math.round((minLh - vwCoeffLh * 3.75) * 100) / 100;

  const lines = [
    `font-size: clamp(${minFs}px, ${vwCoeff}vw + ${remBase}px, ${maxFs}px);`,
    `line-height: clamp(${minLh}px, ${vwCoeffLh}vw + ${remBaseLh}px, ${maxLh}px);`,
  ];
  if (r.letterSpacing !== 0) {
    lines.push(`letter-spacing: ${r.letterSpacingEm}em;`);
  }
  return lines.join('\n');
}

function exportIOS(r: TypographyResult, fontSize: number): string {
  const lhMultiple = Math.round((r.lineHeight / fontSize) * 100) / 100;
  const kern = r.letterSpacing;

  return `let paragraphStyle = NSMutableParagraphStyle()
paragraphStyle.lineHeightMultiple = ${lhMultiple}
let attributes: [NSAttributedString.Key: Any] = [
    .font: UIFont.systemFont(ofSize: ${fontSize}),
    .kern: ${kern},
    .paragraphStyle: paragraphStyle
]`;
}

function exportAndroid(r: TypographyResult, fontSize: number): string {
  const lhMultiple = Math.round((r.lineHeight / fontSize) * 100) / 100;
  const lsEm = r.letterSpacingEm;

  return `android:textSize="${fontSize}sp"
android:lineSpacingMultiplier="${lhMultiple}"
android:letterSpacing="${lsEm}"`;
}
