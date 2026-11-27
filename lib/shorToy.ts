// Shor's algorithm in miniature: why period finding factors a number, simulated exactly.
//
// Pick a coprime to N. The sequence a^x mod N repeats with some period r. A quantum computer puts
// x into a superposition of 0 … Q−1 (Q = 2^q ≥ N²), computes a^x mod N into a second register,
// and measuring that register leaves the first in an equal mix of x₀, x₀+r, x₀+2r, …. The quantum
// Fourier transform turns that comb into sharp peaks at multiples of Q/r; one measurement plus the
// continued-fraction expansion of k/Q gives r. Then gcd(a^(r/2) ± 1, N) are factors (when r is even
// and a^(r/2) ≢ −1). Here the QFT output is computed classically (a DFT), so it only works for tiny N.

export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
export function powmod(a: number, e: number, m: number) { let r = 1; let x = a % m; let k = e; while (k > 0) { if (k & 1) r = (r * x) % m; x = (x * x) % m; k >>= 1; } return r; }
export const order = (a: number, N: number) => { let r = 1; let v = a % N; while (v !== 1) { v = (v * a) % N; r += 1; if (r > N) return -1; } return r; };

/** Probabilities of measuring k after the QFT, given the second register read value a^x0 mod N (x0 = 0 → value 1). */
export function qftPeaks(a: number, N: number) {
  let q = 1; while ((1 << q) < N * N) q += 1; const Q = 1 << q;
  const xs: number[] = []; for (let x = 0; x < Q; x += 1) if (powmod(a, x, N) === 1) xs.push(x); // the comb x₀ = 0, r, 2r, …
  const prob = new Float64Array(Q); const norm = 1 / (xs.length * Q);
  for (let k = 0; k < Q; k += 1) { let re = 0; let im = 0; for (const x of xs) { const ph = (2 * Math.PI * x * k) / Q; re += Math.cos(ph); im += Math.sin(ph); } prob[k] = (re * re + im * im) * norm; }
  return { Q, q, prob: Array.from(prob) };
}

/** Continued fractions of k/Q: the smallest denominator ≤ N whose fraction is within 1/(2Q). */
export function denominator(k: number, Q: number, N: number) {
  let [h0, h1, k0, k1] = [0, 1, 1, 0]; let a = k; let b = Q;
  while (b) { const t = Math.floor(a / b); [h0, h1] = [h1, t * h1 + h0]; [k0, k1] = [k1, t * k1 + k0]; if (k1 > N) break; if (Math.abs(k / Q - h1 / k1) < 1 / (2 * Q)) return k1; [a, b] = [b, a - t * b]; }
  return k0 || 1;
}

export type ShorRun = { a: number; r: number; measured: number; guess: number; factors: [number, number] | null; why: string };
export function shor(N: number, a: number, rnd: () => number): ShorRun {
  const g = gcd(a, N); if (g !== 1) return { a, r: 0, measured: -1, guess: 0, factors: [g, N / g], why: `gcd(${a}, ${N}) = ${g}：量子なしで割れた（運がいい）` };
  const { Q, prob } = qftPeaks(a, N); let u = rnd(); let k = 0; for (; k < Q - 1; k += 1) { u -= prob[k]; if (u <= 0) break; }
  // k/Q ≈ j/r; if j shares a factor with r the fraction reduces and we get a divisor of r, so
  // also try small multiples of the denominator (the usual classical post-processing).
  const d = denominator(k, Q, N); let guess = d; for (let m = 1; d * m <= N; m += 1) if (powmod(a, d * m, N) === 1) { guess = d * m; break; }
  const r = order(a, N);
  if (powmod(a, guess, N) !== 1) return { a, r, measured: k, guess, factors: null, why: `測定値 ${k}/${Q} から周期 ${guess} を推定 — 外れ（本当は ${r}）。もう一度測る` };
  if (guess % 2) return { a, r, measured: k, guess, factors: null, why: `周期 ${guess} が奇数 — 別の a でやり直す` };
  const h = powmod(a, guess / 2, N); if (h === N - 1) return { a, r, measured: k, guess, factors: null, why: `a^(r/2) ≡ −1 — 別の a でやり直す` };
  const f = gcd(h - 1, N); const f2 = gcd(h + 1, N);
  return { a, r, measured: k, guess, factors: [f, f2], why: `周期 ${guess}：gcd(${a}^${guess / 2} − 1, ${N}) = ${f}、gcd(${a}^${guess / 2} + 1, ${N}) = ${f2}` };
}
