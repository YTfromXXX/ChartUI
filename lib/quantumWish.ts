// Quantum wishes and the .q file.
//
// Lore (shown in every .q header): the Quantum File OS has two founders —
//   emoji 進数 (any base)   : オープンソース
//   emoji 20 進数 (base 20) : オープンソース++
// The shape of a .q record follows the glyph   “”= () => {}{({:}{:})}   : an empty start, a function
// of nothing, an empty object, then a pair of key:value slots inside parentheses — slot a and slot b,
// the two balls. Unobserved, a slot holds "()" (a="()" b="()"). Observed, it holds the pocket
// it landed in, e.g. "(7)". "next" links to the record before it, so wishes form a chain (like git).
//
// What makes a wish yours is WHEN, WHERE and WHICH QUANTUM you wished on, plus the RHYTHM you
// tapped while making it (a rhythm-game flourish: 8 taps on a 4/4 bar, scored PERFECT / GREAT /
// GOOD). All of that goes into the signed content. The security comes from the Ed25519 signature;
// the rhythm is part of what is signed, not a password.
//
// The roulette has 22 pockets. A ball's pocket is drawn from a recorded quantum result (the
// spin-lab QAOA distribution: ideal, noisy rehearsal, or a real IBM run): outcome k → pocket k mod
// 22. The draw itself uses the browser's random numbers, weighted by that distribution. In two-ball
// mode the balls behave like a Bell pair measured with dials at angles θa and θb: they land in the
// same pocket with probability cos²((θa − θb)/2), otherwise on opposite sides of the wheel.

import { canonical } from './meshMetaV2';

export const POCKETS = 22;
/** Base-20 digits: single code points only (no U+FE0F variants), so they hash and compare cleanly. 🌑 is zero. */
export const EMOJI20 = ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘', '🌸', '🌼', '🌻', '🌹', '🌷', '🐟', '🐠', '🐡', '🍬', '🍭', '🎲', '🎯'];
export const GLYPH = '“”= () => {}{({:}{:})}';

export function toEmoji20(bytes: Uint8Array): string {
  let zeros = 0; while (zeros < bytes.length && bytes[zeros] === 0) zeros += 1;
  let n = BigInt(0); for (const b of bytes) n = (n << BigInt(8)) | BigInt(b);
  const digits: string[] = []; const B20 = BigInt(20); while (n > BigInt(0)) { digits.unshift(EMOJI20[Number(n % B20)]); n /= B20; }
  return EMOJI20[0].repeat(zeros) + digits.join('');
}
export function fromEmoji20(s: string): Uint8Array {
  const ds = Array.from(s).map((c) => { const i = EMOJI20.indexOf(c); if (i < 0) throw new Error(`not an emoji-20 digit: ${c}`); return i; });
  let zeros = 0; while (zeros < ds.length && ds[zeros] === 0) zeros += 1;
  let n = BigInt(0); for (const d of ds.slice(zeros)) n = n * BigInt(20) + BigInt(d);
  const out: number[] = []; while (n > BigInt(0)) { out.unshift(Number(n & BigInt(255))); n >>= BigInt(8); }
  return new Uint8Array([...Array(zeros).fill(0), ...out]);
}

// ---------- rhythm ----------
export const BPM = 100; export const TAPS = 8; export const STEPS = 16; // a 4/4 bar in 16th notes
export type Judge = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';
export type Rhythm = { bpm: number; steps: string; offsetsMs: number[]; judges: Judge[]; score: number };
/** Snap taps (ms from the first tap) to the 16th-note grid and judge each like a rhythm game. */
export function readRhythm(tapsMs: number[], bpm = BPM): Rhythm {
  const step = 60000 / bpm / 4; const t0 = tapsMs[0] ?? 0; const grid = Array(STEPS).fill('.'); const offsetsMs: number[] = []; const judges: Judge[] = [];
  for (const t of tapsMs.slice(0, TAPS)) {
    const rel = t - t0; const k = Math.round(rel / step); const off = Math.round(rel - k * step);
    if (k < STEPS) grid[k] = 'x'; offsetsMs.push(off);
    const a = Math.abs(off); judges.push(k >= STEPS ? 'MISS' : a <= 25 ? 'PERFECT' : a <= 50 ? 'GREAT' : a <= 90 ? 'GOOD' : 'MISS');
  }
  const pts: Record<Judge, number> = { PERFECT: 100, GREAT: 70, GOOD: 40, MISS: 0 };
  return { bpm, steps: grid.join(''), offsetsMs, judges, score: judges.reduce((s, j) => s + pts[j], 0) };
}
/** The 16-step pattern as emoji-20 (two bytes → a short emoji word). */
export const rhythmEmoji = (steps: string) => { const v = parseInt(steps.replace(/x/g, '1').replace(/\./g, '0'), 2); return toEmoji20(new Uint8Array([v >> 8, v & 255])); };

// ---------- roulette ----------
export type Source = { id: string; label: string; probabilities: number[] };
/** Weighted draw of an outcome k from a recorded distribution; pocket = k mod 22. */
export function drawPocket(src: Source, u: number) {
  let acc = 0; const total = src.probabilities.reduce((a, b) => a + b, 0) || 1;
  for (let k = 0; k < src.probabilities.length; k += 1) { acc += src.probabilities[k] / total; if (u < acc) return { outcome: k, pocket: k % POCKETS }; }
  const k = src.probabilities.length - 1; return { outcome: k, pocket: k % POCKETS };
}
/** Probability that the second ball lands on the first one's pocket (a Bell pair with dials θa, θb). */
export const sameProb = (thetaA: number, thetaB: number) => Math.cos((thetaA - thetaB) / 2) ** 2;
export function drawPair(src: Source, thetaA: number, thetaB: number, u1: number, u2: number) {
  const a = drawPocket(src, u1); const same = u2 < sameProb(thetaA, thetaB);
  return { a: a.pocket, b: same ? a.pocket : (a.pocket + POCKETS / 2) % POCKETS, outcome: a.outcome, same };
}
/** How likely each pocket is under a source (for the "superposition" ring before observing). */
export const pocketWeights = (src: Source) => { const w = Array(POCKETS).fill(0); src.probabilities.forEach((p, k) => { w[k % POCKETS] += p; }); const t = w.reduce((a, b) => a + b, 0) || 1; return w.map((x) => x / t); };

// ---------- the .q record ----------
export type QRecord = {
  q: '1'; glyph: string; founders: { 'emoji進数': string; 'emoji20進数': string };
  when: string; where: string; quantum: { problem: string; source: string; backend: string; result_sha256: string };
  wish: string; a: string; b: string; angles: { a: number; b: number } | null; // dial angles in milliradians (integers)
  rhythm: { bpm: number; steps: string; emoji: string; score: number; offsets_ms: number[] };
  next: string | null; sig?: { alg: 'Ed25519'; signer: string; sig: string };
};
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => new Uint8Array((h.match(/../g) ?? []).map((x) => parseInt(x, 16)));
const bs = (u: Uint8Array) => u as Uint8Array<ArrayBuffer>;
export const body = (r: QRecord) => { const { sig: _sig, ...rest } = r; void _sig; return canonical(rest); };
export async function sha256(b: Uint8Array) { return new Uint8Array(await crypto.subtle.digest('SHA-256', bs(b))); }
/** The record's name: SHA-256 of its signed body, written in emoji-20. The next record points here. */
export const recordId = async (r: QRecord) => toEmoji20(await sha256(body(r)));

export async function signRecord(r: QRecord, key: CryptoKeyPair): Promise<QRecord> {
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', key.publicKey));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, key.privateKey, bs(body(r))));
  return { ...r, sig: { alg: 'Ed25519', signer: hex(pub), sig: hex(sig) } };
}
export async function verifyRecord(r: QRecord): Promise<boolean> {
  if (!r.sig || r.sig.alg !== 'Ed25519') return false;
  try { const k = await crypto.subtle.importKey('raw', bs(unhex(r.sig.signer)), { name: 'Ed25519' }, false, ['verify']); return await crypto.subtle.verify({ name: 'Ed25519' }, k, bs(unhex(r.sig.sig)), bs(body(r))); } catch { return false; }
}
