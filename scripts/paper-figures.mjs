// Reproduce the numbers and figures of paper/main.tex from the same code the lab page uses.
//   node scripts/paper-figures.mjs
// Steps: compile lib/faceContour.ts with tsc into a temp dir, compute silhouette overlaps (IoU),
// write paper/data/*.json, paper/figures/*.svg and LaTeX table snippets, then print each SVG to PDF
// with the pre-installed Chromium (Playwright) so pdflatex can include them.
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(new URL('..', import.meta.url).pathname);
const tmp = mkdtempSync(join(tmpdir(), 'fc-'));
execSync(`npx tsc ${join(root, 'lib/faceContour.ts')} --outDir ${tmp} --module es2020 --target es2020 --skipLibCheck`, { stdio: 'inherit' });
writeFileSync(join(tmp, 'package.json'), '{"type":"module"}');
const F = await import(pathToFileURL(join(tmp, 'faceContour.js')).href);

const out = (p) => join(root, 'paper', p);
mkdirSync(out('figures'), { recursive: true }); mkdirSync(out('data'), { recursive: true });
const NX = 90; const NY = 110;
const NAMES = ['Ponytail', 'Bob', 'Buns', 'Cloud']; // named by dominant hairstyle (no brand names in the paper)
const STYLES = ['ponytail', 'bob', 'buns', 'cloud'];
const r2 = (v) => Math.round(v * 100) / 100;

// 1. Four figures: faces only vs. with hair (dominant silhouette + detail layer).
const faces = F.FACES.map((f) => F.atStep(f, 5));
const bare = faces.map((p) => F.silhouette(F.headGrid(p, 'none', NX, NY)));
const hair = faces.map((p, i) => F.silhouette(F.headGrid(p, STYLES[i], NX, NY, F.DETAILS[i])));
const pairs = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const fourRows = pairs.map(([a, b]) => ({ a: NAMES[a], b: NAMES[b], faceOnly: r2(F.iou(bare[a], bare[b])), withHair: r2(F.iou(hair[a], hair[b])) }));

// 2. Hairstyles alone: every style on the same reference face (isolates the hair's effect).
const ALL = ['none', 'tower', 'wings', 'bob', 'braids', 'ponytail', 'buns', 'cloud'];
const sils = ALL.map((s) => F.silhouette(F.headGrid(F.BASE, s, NX, NY)));
const styleMatrix = ALL.map((_, i) => ALL.map((__, j) => r2(F.iou(sils[i], sils[j]))));

// 3. Bob variants against the plain bob on the reference face.
const VAR = ['bob', 'bob-asym', 'bob-inward', 'bob-blunt', 'bob-layer'];
const vs = VAR.map((s) => F.silhouette(F.headGrid(F.BASE, s, NX, NY)));
const bobRows = VAR.slice(1).map((s, k) => ({ variant: s, iouVsBob: r2(F.iou(vs[0], vs[k + 1])) }));

const data = { grid: { nx: NX, ny: NY, window: { x: [-1.35, 1.35], y: [-1.3, 1.75] }, threshold: 0.02 }, fourFigures: fourRows, styles: ALL, styleMatrix, bobVariants: bobRows, outline: F.FACES.map((f, i) => ({ figure: NAMES[i], rx: f.rx, ry: f.ry, ratio: r2(f.ry / f.rx) })) };
writeFileSync(out('data/results.json'), JSON.stringify(data, null, 2));

// ---------- figures (SVG; ink, red and grey only; text ≥ 10 px) ----------
const INK = '#1f1f1f'; const RED = '#c8001a'; const GREY = '#a8a29e';
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="Helvetica, Arial, sans-serif"><rect width="${w}" height="${h}" fill="white"/>${body}</svg>`;
const contourPaths = (g, levels, x0, y0, s) => levels.map((lv) => `<path d="${F.contour(g, lv).map(([a, b, c, d]) => `M${(x0 + a * s).toFixed(1)} ${(y0 + b * s).toFixed(1)}L${(x0 + c * s).toFixed(1)} ${(y0 + d * s).toFixed(1)}`).join('')}" fill="none" stroke="${INK}" stroke-width="0.6"/>`).join('');
const silPath = (sil, x0, y0, s, fill) => { const c = []; for (let j = 0; j < NY; j += 1) for (let i = 0; i < NX; i += 1) if (sil[j * NX + i]) c.push(`M${(x0 + i * s).toFixed(1)} ${(y0 + j * s).toFixed(1)}h${s}v${s}h-${s}z`); return `<path d="${c.join('')}" fill="${fill}"/>`; };

// Fig. 1: contour maps of the four figures with hair.
{
  const s = 2; const w = NX * s; let body = '';
  faces.forEach((p, i) => {
    const g = F.headGrid(p, STYLES[i], NX, NY, F.DETAILS[i]); const top = F.extent(g).hi; const lv = Array.from({ length: 10 }, (_, k) => ((k + 1) * top) / 11);
    body += contourPaths(g, lv, 10 + i * (w + 16), 10, s) + `<text x="${10 + i * (w + 16) + w / 2}" y="${NY * s + 30}" font-size="12" text-anchor="middle" fill="${INK}">${NAMES[i]} (${STYLES[i]})</text>`;
  });
  writeFileSync(out('figures/fig1-contours.svg'), svg(10 + 4 * (w + 16), NY * s + 42, body));
}
// Fig. 2: the squint test — small filled silhouettes, faces only (top) and with hair (bottom).
{
  const s = 1; const w = NX * s; let body = '';
  [bare, hair].forEach((row, r) => { row.forEach((sil, i) => { body += silPath(sil, 70 + i * (w + 14), 10 + r * (NY + 18), s, r ? INK : GREY); }); body += `<text x="6" y="${10 + r * (NY + 18) + NY / 2}" font-size="11" fill="${INK}">${r ? 'with hair' : 'face only'}</text>`; });
  NAMES.forEach((n, i) => { body += `<text x="${70 + i * (w + 14) + w / 2}" y="${2 * (NY + 18) + 8}" font-size="10" text-anchor="middle" fill="${INK}">${n}</text>`; });
  writeFileSync(out('figures/fig2-silhouettes.svg'), svg(70 + 4 * (w + 14), 2 * (NY + 18) + 16, body));
}
// Fig. 3: IoU per pair, face only vs. with hair, with the 0.75 line ("too similar").
{
  const W = 520; const H = 250; const L = 60; const B = 200; const T = 20; const bw = 22; const gap = (W - L - 20) / pairs.length;
  const y = (v) => B - (v - 0.5) * ((B - T) / 0.5); let body = '';
  for (const v of [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]) body += `<line x1="${L}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="#e7e5e4"/><text x="${L - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end" fill="${INK}">${v.toFixed(1)}</text>`;
  body += `<line x1="${L}" x2="${W - 10}" y1="${y(0.75)}" y2="${y(0.75)}" stroke="${RED}" stroke-dasharray="4 3"/><text x="${L + 4}" y="${y(0.75) - 4}" font-size="10" fill="${RED}">0.75 = too similar</text>`;
  fourRows.forEach((row, k) => {
    const x = L + 10 + k * gap;
    body += `<rect x="${x}" y="${y(row.faceOnly)}" width="${bw}" height="${B - y(row.faceOnly)}" fill="${GREY}"/><rect x="${x + bw + 3}" y="${y(row.withHair)}" width="${bw}" height="${B - y(row.withHair)}" fill="${INK}"/>`;
    body += `<text x="${x + bw}" y="${B + 14}" font-size="9" text-anchor="middle" fill="${INK}">${row.a.split(' ').pop()}–${row.b.split(' ').pop()}</text>`;
  });
  body += `<text x="${L}" y="${H - 14}" font-size="10" fill="${INK}"><tspan fill="${GREY}">■</tspan> face only   <tspan fill="${INK}">■</tspan> with hair   (IoU of silhouettes; lower = easier to tell apart)</text>`;
  writeFileSync(out('figures/fig3-iou.svg'), svg(W, H, body));
}
// Fig. 4: style × style IoU on the reference face (grey scale, numbers printed).
{
  const c = 46; const L = 80; const T = 70; let body = '';
  ALL.forEach((s, i) => { body += `<text x="${L - 6}" y="${T + i * c + c / 2 + 4}" font-size="10" text-anchor="end" fill="${INK}">${s}</text><text x="${L + i * c + c / 2}" y="${T - 8}" font-size="10" text-anchor="middle" fill="${INK}" transform="rotate(-35 ${L + i * c + c / 2} ${T - 8})">${s}</text>`; });
  styleMatrix.forEach((row, i) => row.forEach((v, j) => { const g = Math.round(255 - (v - 0.4) / 0.6 * 200); const shade = Math.max(40, Math.min(255, g)); body += `<rect x="${L + j * c}" y="${T + i * c}" width="${c - 2}" height="${c - 2}" fill="rgb(${shade},${shade},${shade})"/><text x="${L + j * c + c / 2 - 1}" y="${T + i * c + c / 2 + 3}" font-size="10" text-anchor="middle" fill="${shade < 130 ? 'white' : INK}">${v.toFixed(2)}</text>`; }));
  writeFileSync(out('figures/fig4-style-matrix.svg'), svg(L + ALL.length * c + 10, T + ALL.length * c + 10, body));
}

// LaTeX table snippets.
writeFileSync(out('data/table-four.tex'), fourRows.map((r) => `${r.a} & ${r.b} & ${r.faceOnly.toFixed(2)} & ${r.withHair.toFixed(2)} \\\\`).join('\n') + '\n');
writeFileSync(out('data/table-bob.tex'), bobRows.map((r) => `\\texttt{${r.variant}} & ${r.iouVsBob.toFixed(2)} \\\\`).join('\n') + '\n');
writeFileSync(out('data/table-outline.tex'), data.outline.map((r) => `${r.figure} & ${r.rx.toFixed(2)} & ${r.ry.toFixed(2)} & ${r.ratio.toFixed(2)} \\\\`).join('\n') + '\n');

// SVG → PDF for pdflatex (Chromium prints each figure at its own size).
const { chromium } = createRequire(import.meta.url)('playwright'); // pre-installed globally; require() finds it
const browser = await chromium.launch(); const page = await browser.newPage();
for (const f of ['fig1-contours', 'fig2-silhouettes', 'fig3-iou', 'fig4-style-matrix']) {
  await page.goto(pathToFileURL(out(`figures/${f}.svg`)).href);
  const { w, h } = await page.evaluate(() => { const e = document.querySelector('svg'); return { w: e.width.baseVal.value, h: e.height.baseVal.value }; });
  await page.pdf({ path: out(`figures/${f}.pdf`), width: `${w}px`, height: `${h}px`, printBackground: true, pageRanges: '1' });
}
await browser.close();
console.log(JSON.stringify({ fourFigures: fourRows, bobVariants: bobRows }, null, 1));
