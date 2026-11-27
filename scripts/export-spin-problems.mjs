// Write quantum/problems/{hair,flower}.json from lib/spinLab.ts, so the Qiskit script asks the
// exact same question the browser asks. Includes the browser's own QAOA probabilities as a check.
// Run: npm run quantum:export
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = new URL('..', import.meta.url).pathname; const out = mkdtempSync(join(tmpdir(), 'spin-'));
execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), join(root, 'lib/spinLab.ts'), '--outDir', out, '--target', 'es2022', '--module', 'es2022', '--moduleResolution', 'bundler', '--skipLibCheck'], { stdio: 'inherit' });
for (const f of ['spinLab.js', 'meshMeta.js']) writeFileSync(join(out, f), readFileSync(join(out, f), 'utf8').replace(/from '(\.\/[\w-]+)'/g, "from '$1.js'"));
writeFileSync(join(out, 'package.json'), '{"type":"module"}');
const L = await import(pathToFileURL(join(out, 'spinLab.js')).href);
const cands = L.sampleCandidates(10);
for (const p of [L.hairProblem(cands), L.flowerProblem(cands)]) {
  const q = L.quboOf(p); if (!q.exact) throw new Error(`${p.id} is not quadratic`);
  const best = L.exact(p); const t = L.tuneQaoa(p, 12); const sim = L.qaoa1(p, t.gamma, t.beta);
  const scale = Math.max(...sim.E.map(Math.abs));
  const doc = { id: p.id, title: p.title, n: p.n, labels: p.labels, qubo: { offset: q.offset, linear: q.linear, quadratic: q.quadratic }, energy_scale: scale,
    exact: { energy: best.energy, bits: best.spins }, qaoa: { layers: 1, gamma: t.gamma, beta: t.beta, expect: sim.expect, browser_probabilities: sim.prob.map((x) => Number(x.toFixed(10))) },
    source: 'lib/spinLab.ts on the sample mesh (meshMeta.sampleScene), 10 candidates' };
  writeFileSync(join(root, 'quantum/problems', `${p.id}.json`), JSON.stringify(doc) + '\n');
  console.log(p.id, 'n', p.n, 'terms', q.quadratic.length, 'gamma', t.gamma.toFixed(3), 'beta', t.beta.toFixed(3), '<E>', sim.expect.toFixed(3), 'exact', best.energy.toFixed(3));
}
