// Write quantum/problems/golden-hair.json for "イーサリアムの黄金のアイコンを探せ"（仮）:
// which hairstyle should each of the four figures wear so that the four are easiest to tell apart?
// Variables x[f,s] = 1 when figure f wears style s (4 × 4 = 16 qubits). Cost:
//   Σ_{f<g} Σ_{s,t} IoU(f in s, g in t) · x[f,s]·x[g,t]      (silhouette overlap of every pair)
//   + A · Σ_f (1 − Σ_s x[f,s])²  + A · Σ_s (1 − Σ_f x[f,s])²  (each figure one style, each style once)
// IoU comes from lib/faceContour.ts (the same code as /lab/face-contour and the paper); QAOA p=1 is
// tuned with lib/spinLab.ts's simulator, so the browser, the script and the QPU ask the same question.
// Run: node scripts/export-golden-problem.mjs
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname; const out = mkdtempSync(join(tmpdir(), 'golden-'));
const tsc = join(root, 'node_modules/typescript/bin/tsc');
execFileSync(process.execPath, [tsc, join(root, 'lib/spinLab.ts'), join(root, 'lib/faceContour.ts'), '--outDir', out, '--target', 'es2022', '--module', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'inherit' });
for (const f of ['spinLab.js', 'meshMeta.js', 'faceContour.js']) { try { writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[\w-]+)'/g, "from '$1.js'")); } catch { /* not emitted */ } }
writeFileSync(join(out, 'package.json'), '{"type":"module"}');
const L = await import(pathToFileURL(join(out, 'spinLab.js')).href);
const F = await import(pathToFileURL(join(out, 'faceContour.js')).href);

const FIG = ['ポニーテール', 'ボブ', 'アリミノガール', 'アリミノボーイ']; const STY = ['ponytail', 'bob', 'buns', 'cloud'];
const NX = 90; const NY = 110; const A = 2;
const sil = FIG.map((_, f) => STY.map((s) => F.silhouette(F.headGrid(F.atStep(F.FACES[f], 5), s, NX, NY))));
const v = (f, s) => f * 4 + s; const n = 16;
const linear = Array(n).fill(0); const quad = new Map(); let offset = 0;
const addQ = (i, j, w) => { const k = i < j ? `${i},${j}` : `${j},${i}`; quad.set(k, (quad.get(k) ?? 0) + w); };
for (let f = 0; f < 4; f += 1) for (let g = f + 1; g < 4; g += 1) for (let s = 0; s < 4; s += 1) for (let t = 0; t < 4; t += 1) addQ(v(f, s), v(g, t), F.iou(sil[f][s], sil[g][t]));
// (1 − Σx)² = 1 − Σx + 2 Σ_{i<j} xᵢxⱼ  (x² = x)
const oneHot = (vars) => { offset += A; for (const i of vars) linear[i] -= A; for (let a = 0; a < vars.length; a += 1) for (let b = a + 1; b < vars.length; b += 1) addQ(vars[a], vars[b], 2 * A); };
for (let f = 0; f < 4; f += 1) oneHot([0, 1, 2, 3].map((s) => v(f, s)));
for (let s = 0; s < 4; s += 1) oneHot([0, 1, 2, 3].map((f) => v(f, s)));
const quadratic = [...quad].map(([k, w]) => { const [i, j] = k.split(',').map(Number); return [i, j, Number(w.toFixed(6))]; });
const energyBits = (b) => offset + linear.reduce((e, a, i) => e + (b[i] ? a : 0), 0) + quadratic.reduce((e, [i, j, w]) => e + (b[i] && b[j] ? w : 0), 0);

// Exact answer by brute force (2^16).
let best = { e: Infinity, k: 0 };
for (let k = 0; k < 1 << n; k += 1) { const e = energyBits(Array.from({ length: n }, (_, i) => (k >> i) & 1)); if (e < best.e - 1e-12) best = { e, k }; }
const bits = Array.from({ length: n }, (_, i) => (best.k >> i) & 1);
const read = (b) => FIG.map((name, f) => `${name}=${STY.find((_, s) => b[v(f, s)]) ?? '?'}`).join(' ');

// QAOA p=1: the same state-vector math as lib/spinLab.ts qaoa1 (bits 0/1 passed to the energy),
// copied here because the browser version stops at 12 qubits. Energies are precomputed once.
const N = 1 << n; const E = new Float64Array(N); for (let k = 0; k < N; k += 1) E[k] = energyBits(Array.from({ length: n }, (_, i) => (k >> i) & 1));
const scale = Math.max(...Array.from(E, Math.abs));
function qaoa1(gamma, beta) {
  const re = new Float64Array(N); const im = new Float64Array(N); const a0 = 1 / Math.sqrt(N);
  for (let k = 0; k < N; k += 1) { const ph = -gamma * (E[k] / scale); re[k] = a0 * Math.cos(ph); im[k] = a0 * Math.sin(ph); }
  const c = Math.cos(beta); const sn = Math.sin(beta);
  for (let q = 0; q < n; q += 1) { const bit = 1 << q; for (let k = 0; k < N; k += 1) if (!(k & bit)) { const j = k | bit; const ar = re[k]; const ai = im[k]; const br = re[j]; const bi = im[j]; re[k] = c * ar + sn * bi; im[k] = c * ai - sn * br; re[j] = c * br + sn * ai; im[j] = c * bi - sn * ar; } }
  let expect = 0; let pOpt = 0; for (let k = 0; k < N; k += 1) { const pk = re[k] ** 2 + im[k] ** 2; expect += pk * E[k]; if (Math.abs(E[k] - best.e) < 1e-9) pOpt += pk; }
  return { expect, pOpt };
}
// Same coarse grid as lib/spinLab.ts tuneQaoa (γ in (0, 4π], β in [−π/2, π/2]).
const G = 10; let t = { gamma: 0, beta: 0, expect: Infinity, pOpt: 0 };
for (let i = 1; i <= 2 * G; i += 1) for (let j = -G; j <= G; j += 1) { const g = (i / G) * Math.PI * 2; const b = (j / G) * (Math.PI / 2); const r = qaoa1(g, b); if (r.expect < t.expect) t = { gamma: g, beta: b, ...r }; }
const sim = { expect: t.expect }; const pOpt = t.pOpt;
const LSPIN = L; void LSPIN; // spinLab is compiled alongside only to keep one toolchain
// The assignment the lab page uses now (ponytail, bob, buns, cloud) for comparison.
const designBits = Array.from({ length: n }, (_, i) => (i === v(0, 0) || i === v(1, 1) || i === v(2, 2) || i === v(3, 3) ? 1 : 0));
const labels = FIG.flatMap((name) => STY.map((s) => `${name}:${s}`));
const doc = {
  id: 'golden-hair', title: '黄金のアイコンを探せ（仮）：4 体の髪の主役の割り当て（いちばん見分けやすい組み合わせ）', n, labels,
  qubo: { offset, linear, quadratic }, energy_scale: scale,
  exact: { energy: best.e, bits, reading: read(bits) },
  current_design: { energy: energyBits(designBits), bits: designBits, reading: read(designBits) },
  qaoa: { layers: 1, gamma: t.gamma, beta: t.beta, expect: sim.expect, p_opt: pOpt, browser_probabilities: null },
  penalty: A, source: 'lib/faceContour.ts silhouettes (IoU) + lib/spinLab.ts QAOA simulator; scripts/export-golden-problem.mjs',
};
writeFileSync(join(root, 'quantum/problems/golden-hair.json'), JSON.stringify(doc) + '\n');
console.log('exact', best.e.toFixed(4), read(bits), '| design', energyBits(designBits).toFixed(4), '| QAOA p=1 gamma', t.gamma.toFixed(3), 'beta', t.beta.toFixed(3), '<E>', sim.expect.toFixed(3), 'p(opt)', pOpt.toFixed(5), '| uniform', (24 / 65536).toFixed(5));
