// Spin lab: optimisation problems built from .meshmeta, solved the way an annealer or a small
// gate-based quantum computer would — but simulated on this ordinary computer.
//
// Every problem is a set of spins s_i ∈ {↓ = 0, ↑ = 1} and an energy E(s); lower is better.
//   花 (flower):  which of the mesh's best triangles to keep as the three main stems (真・副・控) —
//                 reward quality, punish picking two that point the same way, and ask for exactly 3.
//   髪 (hair):    a row of strands that each lean left (↓) or right (↑) — neighbours like to flow
//                 the same way (Ising coupling J) while each strand is nudged by its triangle's
//                 normal (field h): the parting falls where the nudges change sign.
//   因数分解:     find p·q = N with p and q written in bits: E = (N − p·q)².
// Solvers:
//   exact      — try all 2ⁿ states (n ≤ 16): the true answer, for checking.
//   annealing  — simulated annealing: flip spins at random, accept worse states with
//                probability e^(−ΔE/T) while the temperature T cools. (A quantum annealer
//                cools a quantum system instead; this is the classical analogue.)
//   QAOA p = 1 — a 2ⁿ-amplitude state-vector simulation (n ≤ 12) of one layer of the Quantum
//                Approximate Optimisation Algorithm: phase e^(−iγE), then mixer e^(−iβX) on
//                every qubit; measuring gives each state with probability |amplitude|².
// None of this is faster than a classical computer — it is a hands-on picture of how a QPU would
// be asked the question, while rendering and play stay on the GPU.

import { analyse, sampleScene, type Tri, type V3 } from './meshMeta';

export type Problem = { id: 'flower' | 'hair' | 'factor'; title: string; n: number; labels: string[]; energy: (s: number[]) => number; read: (s: number[]) => string; note: string };

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const bitsOf = (k: number, n: number) => Array.from({ length: n }, (_, i) => (k >> i) & 1);

// ---------- candidates from .meshmeta ----------
export type Candidate = { label: string; quality: number; normal: V3 };
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const crossV = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** The mesh's ranked triangles (part × A–D) as candidates: quality and facing direction. */
export function candidatesFrom(vs: V3[], ts: Tri[], max = 10): Candidate[] {
  const a = analyse(vs, ts, 40); const out: Candidate[] = [];
  a.tops.forEach((list, part) => list.forEach((t, k) => { const [i, j, l] = a.ts[t.t]; out.push({ label: `P${part + 1}${'ABCD'[k]}`, quality: t.q, normal: unit(crossV(sub(a.vs[j], a.vs[i]), sub(a.vs[l], a.vs[i]))) }); }));
  // Keep a spread: interleave parts so the first `max` are not all from one part.
  const byPart = new Map<string, Candidate[]>(); for (const c of out) { const p = c.label.slice(0, -1); byPart.set(p, [...(byPart.get(p) ?? []), c]); }
  const mixed: Candidate[] = []; for (let k = 0; mixed.length < Math.min(max, out.length); k += 1) for (const list of byPart.values()) if (list[k] && mixed.length < max) mixed.push(list[k]);
  return mixed;
}
export const sampleCandidates = (max = 10) => { const s = sampleScene(); return candidatesFrom(s.vs, s.ts, max); };

// ---------- problems ----------
export function flowerProblem(c: Candidate[], want = 3): Problem {
  const lam = 2; const mu = 0.8;
  return {
    id: 'flower', title: '花：3 本の主枝（真・副・控）を選ぶ', n: c.length, labels: c.map((x) => x.label),
    energy: (s) => {
      let e = 0; let k = 0;
      for (let i = 0; i < s.length; i += 1) if (s[i]) { e -= c[i].quality; k += 1; for (let j = i + 1; j < s.length; j += 1) if (s[j]) { const d = c[i].normal[0] * c[j].normal[0] + c[i].normal[1] * c[j].normal[1] + c[i].normal[2] * c[j].normal[2]; e += mu * Math.max(0, d); } }
      return e + lam * (k - want) ** 2;
    },
    read: (s) => { const on = c.filter((_, i) => s[i]); return on.length ? `${on.map((x, i) => `${['真', '副', '控'][i] ?? '＋'} ${x.label}（q ${x.quality.toFixed(3)}）`).join('・')}` : 'まだ何も選んでいない'; },
    note: '品質 q の高い三角形ほど得点。向き（法線）がそろった 2 本は罰。ちょうど 3 本でないと罰。',
  };
}

export function hairProblem(c: Candidate[], J = 0.6): Problem {
  const h = c.map((x) => x.normal[0] * 1.2 + (x.quality - 0.8)); // the triangle's sideways lean nudges the strand
  return {
    id: 'hair', title: '髪：毛束の流れ（左 ↓ / 右 ↑）と分け目', n: c.length, labels: c.map((_, i) => `束${i + 1}`),
    energy: (s) => { let e = 0; const sp = s.map((x) => (x ? 1 : -1)); for (let i = 0; i < sp.length; i += 1) { e -= h[i] * sp[i]; if (i + 1 < sp.length) e -= J * sp[i] * sp[i + 1]; } return e; },
    read: (s) => { const parts = s.slice(1).map((x, i) => (x !== s[i] ? i + 1 : -1)).filter((i) => i > 0); return `${s.map((x) => (x ? '╱' : '╲')).join('')}　分け目 ${parts.length ? parts.map((p) => `${p}|${p + 1}`).join('・') : 'なし'}`; },
    note: '隣どうしは同じ向きに流れたい（J）。各束は三角形の法線の傾きに押される（h）。',
  };
}

export function factorProblem(N: number): Problem {
  const bits = Math.max(2, Math.ceil(Math.log2(Math.sqrt(N))) + 1); // p and q are odd: their lowest bit is fixed to 1
  const val = (s: number[], off: number) => 1 + s.slice(off, off + bits - 1).reduce((a, b, i) => a + (b << (i + 1)), 0);
  return {
    id: 'factor', title: `因数分解：${N} = p × q`, n: 2 * (bits - 1), labels: [...Array.from({ length: bits - 1 }, (_, i) => `p${i + 1}`), ...Array.from({ length: bits - 1 }, (_, i) => `q${i + 1}`)],
    energy: (s) => { const p = val(s, 0); const q = val(s, bits - 1); return (N - p * q) ** 2; },
    read: (s) => { const p = val(s, 0); const q = val(s, bits - 1); return `p = ${p}, q = ${q}, p·q = ${p * q}${p * q === N ? (p > 1 && q > 1 ? ' ✓' : '（1 との積）') : ''}`; },
    note: '奇数どうしなので最下位ビットは 1 に固定。本物の量子アニーラーでは 4 次の項を 2 次に直す補助スピンが要るが、ここでは省略。',
  };
}

// ---------- solvers ----------
export function exact(p: Problem) {
  if (p.n > 16) throw new Error('too many spins for brute force');
  let best = Infinity; let arg = 0; for (let k = 0; k < 1 << p.n; k += 1) { const e = p.energy(bitsOf(k, p.n)); if (e < best) { best = e; arg = k; } }
  return { energy: best, spins: bitsOf(arg, p.n) };
}

export type AnnealStep = { t: number; T: number; energy: number; spins: number[]; flipped: number; accepted: boolean };
/** Typical size of one spin flip's energy change — the natural starting temperature for this problem. */
export function flipScale(p: Problem, seed = 99) {
  const r = rng(seed); let sum = 0;
  for (let k = 0; k < 60; k += 1) { const s = Array.from({ length: p.n }, () => (r() < 0.5 ? 1 : 0)); const e = p.energy(s); s[Math.floor(r() * p.n)] ^= 1; sum += Math.abs(p.energy(s) - e); }
  return Math.max(1e-6, sum / 60);
}

/** Simulated annealing with a geometric cooling schedule from T0 to T1 (by default scaled to the problem). */
export function anneal(p: Problem, opts: { steps?: number; T0?: number; T1?: number; seed?: number; start?: number[] } = {}) {
  const scale = flipScale(p); const { steps = 600, T0 = scale, T1 = scale / 400, seed = 1 } = opts; const r = rng(seed);
  let s = opts.start ? [...opts.start] : Array.from({ length: p.n }, () => (r() < 0.5 ? 1 : 0)); let e = p.energy(s);
  let best = { energy: e, spins: [...s] }; const trace: AnnealStep[] = [];
  for (let t = 0; t < steps; t += 1) {
    const T = T0 * (T1 / T0) ** (t / (steps - 1)); const i = Math.floor(r() * p.n); s[i] ^= 1; const e2 = p.energy(s); const d = e2 - e;
    const accepted = d <= 0 || r() < Math.exp(-d / T); if (accepted) e = e2; else s[i] ^= 1;
    if (e < best.energy) best = { energy: e, spins: [...s] };
    trace.push({ t, T, energy: e, spins: [...s], flipped: i, accepted });
  }
  return { trace, best };
}

/** Anneal several times from different random starts and keep the best — the simplest way out of a local minimum. */
export function annealBest(p: Problem, runs = 10, opts: { steps?: number; seed?: number } = {}) {
  let best: ReturnType<typeof anneal> | null = null; let hits = 0; const target = p.n <= 16 ? exact(p).energy : -Infinity;
  for (let k = 0; k < runs; k += 1) { const r = anneal(p, { steps: opts.steps ?? 800, seed: (opts.seed ?? 1) * 1000 + k }); if (Math.abs(r.best.energy - target) < 1e-9) hits += 1; if (!best || r.best.energy < best.best.energy) best = r; }
  return { ...(best as ReturnType<typeof anneal>), runs, hits };
}

/** QAOA with p layers (γ₁β₁ … γₚβₚ), state-vector simulated. Returns outcome probabilities and ⟨E⟩. */
export function qaoa(p: Problem, gammas: number[], betas: number[]) {
  if (p.n > 12) throw new Error('state vector limited to 12 qubits here');
  const N = 1 << p.n; const E = Array.from({ length: N }, (_, k) => p.energy(bitsOf(k, p.n)));
  const scale = Math.max(1e-9, Math.max(...E.map(Math.abs)));
  const re = new Float64Array(N).fill(1 / Math.sqrt(N)); const im = new Float64Array(N);
  gammas.forEach((gamma, layer) => {
    for (let k = 0; k < N; k += 1) { const ph = -gamma * (E[k] / scale); const c = Math.cos(ph); const s = Math.sin(ph); const r0 = re[k]; re[k] = r0 * c - im[k] * s; im[k] = r0 * s + im[k] * c; }
    const c = Math.cos(betas[layer]); const sn = Math.sin(betas[layer]);
    for (let q = 0; q < p.n; q += 1) { const bit = 1 << q; for (let k = 0; k < N; k += 1) if (!(k & bit)) { const j = k | bit;
      const ar = re[k]; const ai = im[k]; const br = re[j]; const bi = im[j];
      re[k] = c * ar + sn * bi; im[k] = c * ai - sn * br; re[j] = c * br + sn * ai; im[j] = c * bi - sn * ar; } }
  });
  const prob = Array.from({ length: N }, (_, k) => re[k] ** 2 + im[k] ** 2);
  return { prob, expect: prob.reduce((a, pk, k) => a + pk * E[k], 0), E };
}

/**
 * Tune p layers: start every layer from the best one-layer angles, then coordinate descent with a
 * shrinking step (what the classical optimiser beside a QPU does). `evals` counts circuit runs —
 * on real hardware each one is a job with many shots, which is what the cost estimate multiplies.
 */
export function tuneLayers(p: Problem, layers: number) {
  const one = tuneQaoa(p, 12); let g = Array(layers).fill(0).map((_, i) => one.gamma * (i + 1) / layers); let b = Array(layers).fill(0).map((_, i) => one.beta * (1 - i / (layers + 1)));
  let best = qaoa(p, g, b).expect; let evals = 600; let step = 0.4;
  while (step > 0.01 && evals < 3000) { // capped: each evaluation would be a paid job on hardware
    let improved = false;
    for (let i = 0; i < 2 * layers; i += 1) for (const d of [step, -step]) {
      const g2 = [...g]; const b2 = [...b]; if (i < layers) g2[i] += d; else b2[i - layers] += d;
      const e = qaoa(p, g2, b2).expect; evals += 1; if (e < best - 1e-12) { best = e; g = g2; b = b2; improved = true; }
    }
    if (!improved) step /= 2;
  }
  return { gammas: g, betas: b, expect: best, evals };
}

/** One QAOA layer, state-vector simulated. Returns probabilities of all 2ⁿ outcomes and ⟨E⟩. */
export function qaoa1(p: Problem, gamma: number, beta: number) {
  if (p.n > 12) throw new Error('state vector limited to 12 qubits here');
  const N = 1 << p.n; const E = Array.from({ length: N }, (_, k) => p.energy(bitsOf(k, p.n)));
  const scale = Math.max(1e-9, Math.max(...E.map(Math.abs))); // normalise so γ means the same for every problem
  const re = new Float64Array(N); const im = new Float64Array(N); const a0 = 1 / Math.sqrt(N);
  for (let k = 0; k < N; k += 1) { const ph = -gamma * (E[k] / scale); re[k] = a0 * Math.cos(ph); im[k] = a0 * Math.sin(ph); }
  const c = Math.cos(beta); const sn = Math.sin(beta);
  for (let q = 0; q < p.n; q += 1) { const bit = 1 << q; for (let k = 0; k < N; k += 1) if (!(k & bit)) { const j = k | bit;
    // e^(−iβX) = cos β · I − i sin β · X on qubit q
    const ar = re[k]; const ai = im[k]; const br = re[j]; const bi = im[j];
    re[k] = c * ar + sn * bi; im[k] = c * ai - sn * br; re[j] = c * br + sn * ai; im[j] = c * bi - sn * ar; } }
  const prob = Array.from({ length: N }, (_, k) => re[k] ** 2 + im[k] ** 2);
  return { prob, expect: prob.reduce((a, pk, k) => a + pk * E[k], 0), E };
}

/** Coarse grid search for the γ, β that give the lowest ⟨E⟩ (what a classical optimiser does around a QPU). */
// β must be searched on both sides of 0: with e^(−iγE) then e^(−iβX), lowering ⟨E⟩ needs β < 0 here.
export function tuneQaoa(p: Problem, grid = 16) {
  let best = { gamma: 0, beta: 0, expect: Infinity };
  for (let i = 1; i <= 2 * grid; i += 1) for (let j = -grid; j <= grid; j += 1) { const g = (i / grid) * Math.PI * 2; const b = (j / grid) * (Math.PI / 2); const ex = qaoa1(p, g, b).expect; if (ex < best.expect) best = { gamma: g, beta: b, expect: ex }; }
  return best;
}
export const toBits = bitsOf;
