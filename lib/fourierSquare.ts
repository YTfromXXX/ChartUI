// A square wave from its Fourier series, the Gibbs overshoot, and Lanczos sigma factors.
//
//   square(x) = (4/π) Σ_{k = 1, 3, 5, …, N} sin(kx) / k
// Near each jump the partial sums overshoot by about 9 % of the jump (Gibbs phenomenon) no matter
// how many terms are added. Multiplying term k by the Lanczos sigma factor
//   σ_k = sinc(k / m) = sin(πk/m) / (πk/m),  m = N + 1
// smooths the ringing away at the cost of a slightly softer edge.

export const sigma = (k: number, m: number) => { const t = (Math.PI * k) / m; return t === 0 ? 1 : Math.sin(t) / t; };
/** Odd harmonics 1, 3, …, up to N (N is the highest harmonic used). */
export const harmonics = (N: number) => Array.from({ length: Math.floor((N + 1) / 2) }, (_, i) => 2 * i + 1);

export function partialSum(x: number, N: number, lanczos = false) {
  const m = N + 1; let s = 0;
  for (const k of harmonics(N)) s += (lanczos ? sigma(k, m) : 1) * Math.sin(k * x) / k;
  return (4 / Math.PI) * s;
}

/** Peak of the partial sum just after the jump at 0, and the overshoot as a share of the jump (2). */
export function overshoot(N: number, lanczos = false, samples = 4000) {
  let peak = -Infinity; for (let i = 1; i <= samples; i += 1) { const x = (i / samples) * Math.PI * 0.5; peak = Math.max(peak, partialSum(x, N, lanczos)); }
  return { peak, share: (peak - 1) / 2 };
}

/** Epicycles: the rotating circles whose tips add up to the partial sum at time t. */
export function epicycles(t: number, N: number, lanczos = false) {
  const m = N + 1; let x = 0; let y = 0; const out: { cx: number; cy: number; r: number; x: number; y: number }[] = [];
  for (const k of harmonics(N)) { const r = (4 / Math.PI) * (lanczos ? sigma(k, m) : 1) / k; const nx = x + r * Math.cos(k * t); const ny = y + r * Math.sin(k * t); out.push({ cx: x, cy: y, r, x: nx, y: ny }); x = nx; y = ny; }
  return out;
}
