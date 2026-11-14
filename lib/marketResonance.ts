// "Resonating" market data with our computers (an experiment, not investment advice).
// 1. Daily closes for six coins (CoinGecko's public market_chart, read in the viewer's browser; a synthetic
//    series when the API cannot be reached). Only shapes are used: daily log changes, not price levels.
// 2. Resonance between two coins = the correlation of their daily changes (−1..1), like two coils in tune.
// 3. Max-Cut: split the six into two groups so that the pairs that move LEAST alike are cut apart
//    (weight 1 − correlation). Six coins = six qubits, one QAOA layer — small enough for the IBM free tier,
//    and checked here by brute force (64 cuts) and a local state-vector QAOA.
import { qaoa1, tuneQaoa, type Problem } from '@/lib/spinLab';

export const COINS = [
  { id: 'bitcoin', label: 'BTC' }, { id: 'ethereum', label: 'ETH' }, { id: 'solana', label: 'SOL' },
  { id: 'ripple', label: 'XRP' }, { id: 'cardano', label: 'ADA' }, { id: 'dogecoin', label: 'DOGE' },
];
export type Series = { id: string; label: string; closes: number[] };

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());

/** A synthetic 90-day set: one shared "market" factor plus each coin's own noise (labelled 合成 on screen). */
export function synthetic(seed = 7): Series[] {
  const r = rng(seed); const market = Array.from({ length: 90 }, () => gauss(r) * 0.025);
  const beta = [0.9, 1.0, 1.3, 0.8, 1.1, 1.4]; const own = [0.01, 0.015, 0.035, 0.03, 0.028, 0.045];
  return COINS.map((c, i) => { let v = 100; const closes = [v]; for (let d = 0; d < 90; d += 1) { v *= Math.exp(beta[i] * market[d] + gauss(r) * own[i]); closes.push(v); } return { ...c, closes }; });
}

/** Read 90 daily closes per coin from CoinGecko's public API (in the browser). Throws if unreachable. */
export async function fetchCoinGecko(signal?: AbortSignal): Promise<Series[]> {
  const out: Series[] = [];
  for (const c of COINS) {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${c.id}/market_chart?vs_currency=usd&days=90&interval=daily`, { signal });
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
    const j = (await res.json()) as { prices: [number, number][] };
    out.push({ ...c, closes: j.prices.map((p) => p[1]) });
  }
  return out;
}

export const returns = (xs: number[]) => xs.slice(1).map((v, i) => Math.log(v / xs[i]));
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
export const vol = (xs: number[]) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
export function corr(a: number[], b: number[]) { const n = Math.min(a.length, b.length); const x = a.slice(-n); const y = b.slice(-n); const mx = mean(x); const my = mean(y); let sxy = 0; let sx = 0; let sy = 0; for (let i = 0; i < n; i += 1) { sxy += (x[i] - mx) * (y[i] - my); sx += (x[i] - mx) ** 2; sy += (y[i] - my) ** 2; } return sxy / Math.sqrt(sx * sy || 1); }
export function maxDrawdown(xs: number[]) { let peak = xs[0]; let dd = 0; for (const v of xs) { peak = Math.max(peak, v); dd = Math.max(dd, 1 - v / peak); } return dd; }

export function analyse(series: Series[]) {
  const R = series.map((s) => returns(s.closes));
  const C = R.map((a) => R.map((b) => corr(a, b)));
  return { R, C, vols: R.map(vol), dds: series.map((s) => maxDrawdown(s.closes)) };
}

/** Max-Cut as a spin problem: energy = −Σ (1 − Cij) over pairs placed in different groups. */
export function cutProblem(C: number[][], labels: string[]): Problem {
  const n = labels.length;
  return {
    id: 'flower', title: '共鳴の Max-Cut', n, labels, note: '似た動きのコインを同じ組に',
    energy: (s) => { let e = 0; for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) if (s[i] !== s[j]) e -= 1 - C[i][j]; return e; },
    read: (s) => s.map((b, i) => `${labels[i]}:${b}`).join(' '),
  };
}

export function solveCut(C: number[][], labels: string[]) {
  const p = cutProblem(C, labels); const N = 1 << p.n; const bits = (k: number) => Array.from({ length: p.n }, (_, i) => (k >> i) & 1);
  let best = Infinity; let arg = 0; for (let k = 0; k < N; k += 1) { const e = p.energy(bits(k)); if (e < best - 1e-12) { best = e; arg = k; } }
  const opt = bits(arg); if (opt[0] === 1) opt.forEach((b, i) => { opt[i] = 1 - b; }); // group 0 always holds the first coin
  const t = tuneQaoa(p, 10); const q = qaoa1(p, t.gamma, t.beta);
  const optimal = q.prob.reduce((a, pk, k) => a + (Math.abs(q.E[k] - best) < 1e-9 ? pk : 0), 0); // both labelings of the best cut
  return { groups: opt, energy: best, qaoaOptimal: optimal, randomOptimal: q.E.filter((e) => Math.abs(e - best) < 1e-9).length / N, gamma: t.gamma, beta: t.beta };
}
