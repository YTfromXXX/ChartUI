// Write the resonance Max-Cut problem shown on /mente/game/root-bloom to JSON, so the browser, the Python
// package (cure_oracle.resonance) and the QPU ask the same question:
//   six coins, weight w_ij = 1 − (correlation of daily log changes), cut the pairs that move least alike.
// Data: the page's synthetic 90-day series (seed 7). A live CoinGecko snapshot can be passed later the same way.
// Writes quantum/problems/resonance-maxcut.json and the copy bundled with the package (cure_oracle/data/).
// Run: node scripts/export-resonance-problem.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname; const out = mkdtempSync(join(tmpdir(), 'resonance-'));
const tsc = join(root, 'node_modules/typescript/bin/tsc');
try { execFileSync(process.execPath, [tsc, join(root, 'lib/marketResonance.ts'), join(root, 'lib/spinLab.ts'), '--outDir', out, '--target', 'es2022', '--module', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'pipe' }); } catch { /* the "@/" alias is not resolvable here; files are still emitted and fixed below */ }
for (const f of ['marketResonance.js', 'spinLab.js', 'meshMeta.js']) {
  try { writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '@\/lib\/([\w-]+)'/g, "from './$1.js'").replace(/from '(\.\/[\w-]+)'/g, (m, p) => (p.endsWith('.js') ? m : `from '${p}.js'`))); } catch { /* not emitted */ }
}
writeFileSync(join(out, 'package.json'), '{"type":"module"}');
const R = await import(pathToFileURL(join(out, 'marketResonance.js')).href);

const series = R.synthetic(7); const a = R.analyse(series); const labels = R.COINS.map((c) => c.label);
const cut = R.solveCut(a.C, labels);
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const doc = {
  id: 'resonance-maxcut', version: 1, source: 'synthetic-90d-seed7',
  note: 'Max-Cut on six coins, weight = 1 − correlation of daily log changes. Shapes only; no prices. Not investment advice.',
  labels, n: labels.length,
  weights: a.C.map((row, i) => row.map((c, j) => (i === j ? 0 : r6(1 - c)))),
  correlation: a.C.map((row) => row.map(r6)),
  browser: { best_groups: cut.groups, best_energy: r6(cut.energy), qaoa_p1_optimal: r6(cut.qaoaOptimal), random_optimal: r6(cut.randomOptimal) },
};
const text = `${JSON.stringify(doc, null, 2)}\n`;
for (const dir of [join(root, 'quantum/problems'), join(root, 'cure_oracle/data')]) { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'resonance-maxcut.json'), text); }
console.log(`best cut ${labels.map((l, i) => `${l}:${cut.groups[i]}`).join(' ')}  QAOA p=1 optimal ${(cut.qaoaOptimal * 100).toFixed(1)}% (random ${(cut.randomOptimal * 100).toFixed(1)}%)`);
