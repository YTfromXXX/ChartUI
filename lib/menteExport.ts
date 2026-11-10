// Download what Mente made: a self-contained HTML report in Mente's design (grey stripes, red
// bars, white bold italic type, black tags), the parameters as JSON, and drawings as SVG.

export type ReportSection = { title: string; lines: string[]; svg?: string };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function menteReportHtml(title: string, sections: ReportSection[]): string {
  const body = sections.map((sec) => `
<section>
  <p class="tag">${esc(sec.title)}</p>
  ${sec.lines.map((l) => `<p class="bar">${esc(l)}</p>`).join('\n  ')}
  ${sec.svg ? `<div class="figure">${sec.svg}</div>` : ''}
</section>`).join('\n');
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body { margin: 0; padding: 24px 16px; background: repeating-linear-gradient(180deg, #9a9a9a 0 80px, #d0d0d0 80px 190px); color: #1f1f1f;
    font-family: Futura, "Futura PT", "Jost", "Century Gothic", "Hiragino Sans", sans-serif; }
  main { max-width: 960px; margin: 0 auto; }
  h1 { font: italic 700 44px Georgia, serif; color: #7a0f22; margin: 0 0 8px; }
  .stamp { display: inline-block; background: #000; color: #fff; font-weight: 700; font-style: italic; padding: 2px 8px; }
  section { background: rgba(255,255,255,.7); border: 4px solid #000; padding: 16px; margin: 16px 0; }
  .tag { display: inline-block; background: #000; color: #fff; font-weight: 700; font-style: italic; padding: 2px 8px; margin: 0 0 8px; }
  .bar { background: #d6001c; color: #fff; font-weight: 700; font-style: italic; padding: 4px 8px; margin: 6px 0; line-height: 1.5; }
  .figure svg { width: 100%; height: auto; border: 2px solid #000; background: #fff; }
</style></head>
<body><main>
<h1>Mente</h1>
<p class="stamp">${esc(title)} · ${new Date().toLocaleString('ja-JP')}</p>
${body}
</main></body></html>`;
}

/** Save text as a file in the browser. */
export function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
