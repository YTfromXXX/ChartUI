// FamiDance dual battle — the dancer IS the parameter set.
//
// Each Famicom dancer stands on a stage seen at a slight angle. Six joints can be dragged (head,
// both hands, hip, both feet); constraints keep every pose danceable (feet on the floor, limbs
// within reach, head above the hip). The pose is read as the parameters of that symbol's
// synthetic API: arm span → volatility, lean → drift, stance → mean reversion, crouch → chaos
// (jumps and syncopation), hand height → step density. The synthetic API turns each beat's return
// into a dance step (↑ ↓ ← → ★). Everything is synthetic; nothing places real orders.

import { mulberry32 } from '@/lib/retroGrid';

export type P = { x: number; y: number };
export type Joint = 'head' | 'lHand' | 'rHand' | 'hip' | 'lFoot' | 'rFoot';
export type Pose = Record<Joint, P>;
export const JOINTS: Joint[] = ['head', 'lHand', 'rHand', 'hip', 'lFoot', 'rFoot'];
export const JOINT_LABEL: Record<Joint, string> = { head: '頭', lHand: '左手', rHand: '右手', hip: '腰', lFoot: '左足', rFoot: '右足' };

/** Body frame: 120 × 160, floor at y = 150, centre x = 60. */
export const FLOOR = 150; const CX = 60;
const NECK = 12; const ARM = 23; const LEG = 34; // segment lengths (upper = lower)

export const DEFAULT_POSE: Pose = {
  head: { x: 60, y: 46 }, lHand: { x: 34, y: 78 }, rHand: { x: 86, y: 78 },
  hip: { x: 60, y: 98 }, lFoot: { x: 48, y: FLOOR }, rFoot: { x: 72, y: FLOOR },
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
/** Pull `p` toward / away from `o` so that its distance lies in [min, max]. */
function reach(o: P, p: P, min: number, max: number): P {
  const d = dist(o, p) || 1e-6; const t = clamp(d, min, max) / d;
  return { x: o.x + (p.x - o.x) * t, y: o.y + (p.y - o.y) * t };
}

export const neckOf = (pose: Pose): P => {
  const d = dist(pose.head, pose.hip) || 1; return { x: pose.head.x + ((pose.hip.x - pose.head.x) / d) * NECK, y: pose.head.y + ((pose.hip.y - pose.head.y) / d) * NECK };
};

/** Keep any pose danceable. */
export function constrain(p: Pose): Pose {
  const hip = { x: clamp(p.hip.x, 40, 80), y: clamp(p.hip.y, 86, 114) };
  // Head above the hip, at most 35° from vertical, torso 40–56 long.
  let head = reach(hip, p.head, 40, 56);
  const ang = Math.atan2(head.x - hip.x, hip.y - head.y); const a = clamp(ang, -0.61, 0.61); const tl = dist(hip, head);
  head = { x: hip.x + Math.sin(a) * tl, y: hip.y - Math.cos(a) * tl };
  const neck = neckOf({ ...p, head, hip });
  const lHand = reach(neck, p.lHand, 14, ARM * 2 - 1); const rHand = reach(neck, p.rHand, 14, ARM * 2 - 1);
  // Feet on the floor, within leg reach of the hip, left foot left of the right one.
  const span = Math.sqrt(Math.max(0, (LEG * 2 - 1) ** 2 - (FLOOR - hip.y) ** 2));
  let lx = clamp(p.lFoot.x, Math.max(4, hip.x - span), Math.min(116, hip.x + span)); let rx = clamp(p.rFoot.x, Math.max(4, hip.x - span), Math.min(116, hip.x + span));
  if (rx - lx < 8) { const m = (lx + rx) / 2; lx = m - 4; rx = m + 4; }
  return { head, lHand, rHand, hip, lFoot: { x: lx, y: FLOOR }, rFoot: { x: rx, y: FLOOR } };
}

/** Two-bone IK: the middle joint (elbow/knee) for a root, an end, segment length L, bending to `side`. */
export function midJoint(root: P, end: P, L: number, side: 1 | -1): P {
  const d = Math.min(dist(root, end), 2 * L - 0.01); const mx = (root.x + end.x) / 2; const my = (root.y + end.y) / 2;
  const h = Math.sqrt(Math.max(0, L * L - (d / 2) ** 2)); const ux = (end.x - root.x) / (d || 1); const uy = (end.y - root.y) / (d || 1);
  return { x: mx - uy * h * side, y: my + ux * h * side };
}
export const SEG = { ARM, LEG };

export type DanceParams = { sigma: number; drift: number; revert: number; chaos: number; density: number };
export const PARAM_INFO: { key: keyof DanceParams; name: string; from: string; color: string }[] = [
  { key: 'sigma', name: 'ボラティリティ', from: '腕の広がり', color: '#ff8c1a' },
  { key: 'drift', name: 'トレンド', from: '体の傾き', color: '#2fbf4a' },
  { key: 'revert', name: '平均回帰', from: '足の開き', color: '#2b8cf0' },
  { key: 'chaos', name: 'カオス', from: '腰の沈み', color: '#e040fb' },
  { key: 'density', name: 'ステップ密度', from: '手の高さ', color: '#ffd400' },
];

/** Read a pose as synthetic-API parameters (all in 0..1 except drift in −1..1). */
export function paramsOf(p: Pose): DanceParams {
  const neck = neckOf(p);
  const span = dist(p.lHand, p.rHand) / 90; // 0.15 .. 1
  const lean = (p.head.x - p.hip.x) / 32; // −1 .. 1
  const stance = (p.rFoot.x - p.lFoot.x) / 120;
  const crouch = (p.hip.y - 86) / 28;
  const handUp = ((neck.y - p.lHand.y) + (neck.y - p.rHand.y)) / 2 / 45; // −1 .. 1
  return { sigma: clamp(span, 0, 1), drift: clamp(lean, -1, 1), revert: clamp(stance, 0, 1), chaos: clamp(crouch, 0, 1), density: clamp((handUp + 1) / 2, 0, 1) };
}

export type Step = '↑' | '↓' | '←' | '→' | '★';
export const STEPS: Step[] = ['←', '↓', '↑', '→', '★'];
export type Note = { id: number; at: number; step: Step; hit: boolean; judged: '' | 'PERFECT' | 'GOOD' | 'MISS' };

/**
 * The synthetic API for one symbol. Each beat: log-return = drift + σ·z + jump − revert·(distance
 * from the anchor). The return becomes the beat's step; density and chaos add off-beat steps.
 */
export class SynthApi {
  private rand: () => number; private logP: number; private anchor: number; private nextId = 0;
  beat = 0; price: number; history: number[] = [];
  constructor(seed: number, public start: number) { this.rand = mulberry32(seed); this.price = start; this.logP = Math.log(start); this.anchor = this.logP; this.history = [start]; }
  private gauss() { let u = 0; let v = 0; while (u === 0) u = this.rand(); while (v === 0) v = this.rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  /** Generate one beat; returns the notes it produces (times in beats). */
  nextBeat(p: DanceParams): Note[] {
    const vol = 0.002 + p.sigma * 0.018; const z = this.gauss();
    const jump = this.rand() < p.chaos * 0.12 ? (this.rand() < 0.5 ? -1 : 1) * vol * 4 : 0;
    const r = p.drift * vol * 0.3 + vol * z + jump - p.revert * 0.3 * (this.logP - this.anchor);
    this.logP += r; this.price = Math.exp(this.logP); this.history.push(this.price); if (this.history.length > 240) this.history.shift();
    const k = r / vol;
    const main: Step = jump !== 0 || Math.abs(k) > 2 ? '★' : k > 0.5 ? '↑' : k < -0.5 ? '↓' : k >= 0 ? '→' : '←';
    const notes: Note[] = [{ id: this.nextId++, at: this.beat, step: main, hit: false, judged: '' }];
    const extra = (at: number) => notes.push({ id: this.nextId++, at, step: STEPS[Math.floor(this.rand() * 4)], hit: false, judged: '' });
    if (this.rand() < p.density * 0.7) extra(this.beat + 0.5);
    if (this.rand() < p.chaos * 0.5) extra(this.beat + (this.rand() < 0.5 ? 0.25 : 0.75));
    this.beat += 1;
    return notes;
  }
}

/** "What may come next": percentiles of many synthetic paths (not a prediction of real prices). */
export function fan(p: DanceParams, start: number, beats = 32, paths = 200, seed = 1) {
  const rnd = mulberry32(seed); const g = () => { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()); };
  const vol = 0.002 + p.sigma * 0.018; const ends: number[][] = Array.from({ length: beats + 1 }, () => []);
  for (let k = 0; k < paths; k += 1) {
    let lp = 0; ends[0].push(start);
    for (let b = 1; b <= beats; b += 1) {
      const jump = rnd() < p.chaos * 0.12 ? (rnd() < 0.5 ? -1 : 1) * vol * 4 : 0;
      lp += p.drift * vol * 0.3 + vol * g() + jump - p.revert * 0.3 * lp; ends[b].push(start * Math.exp(lp));
    }
  }
  const q = (arr: number[], f: number) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(f * (s.length - 1))]; };
  return ends.map((arr) => ({ p5: q(arr, 0.05), p50: q(arr, 0.5), p95: q(arr, 0.95) }));
}

/** Pose offsets for the step being danced (decays over a quarter beat). */
export function dancePose(base: Pose, step: Step | null, phase: number): Pose {
  if (!step) return base;
  const k = Math.max(0, 1 - phase * 3); const o = (dx: number, dy: number) => ({ x: dx * k, y: dy * k });
  const add = (p: P, d: P) => ({ x: p.x + d.x, y: p.y + d.y });
  const m: Record<Step, Partial<Record<Joint, P>>> = {
    '↑': { lHand: o(-6, -30), rHand: o(6, -30), head: o(0, -4) },
    '↓': { hip: o(0, 12), head: o(0, 10), lHand: o(-4, 14), rHand: o(4, 14) },
    '←': { head: o(-14, 0), hip: o(-6, 0), lHand: o(-18, -10), lFoot: o(-10, 0) },
    '→': { head: o(14, 0), hip: o(6, 0), rHand: o(18, -10), rFoot: o(10, 0) },
    '★': { hip: o(0, -10), head: o(0, -14), lHand: o(-12, -34), rHand: o(12, -34), lFoot: o(-8, 0), rFoot: o(8, 0) },
  };
  const out = { ...base }; for (const j of JOINTS) { const d = m[step][j]; if (d) out[j] = add(base[j], d); }
  // The jump lifts the whole body after the constraint, so the feet may leave the floor briefly.
  const c = constrain(out);
  if (step === '★') { const lift = 14 * k; for (const j of JOINTS) c[j] = { x: c[j].x, y: c[j].y - lift }; }
  return c;
}

/** A slow breath for YogaTime. */
export function breathe(base: Pose, t: number): Pose {
  const s = Math.sin(t * 1.3) * 2.5;
  return { ...base, head: { x: base.head.x, y: base.head.y - s }, lHand: { x: base.lHand.x, y: base.lHand.y - s * 1.4 }, rHand: { x: base.rHand.x, y: base.rHand.y - s * 1.4 } };
}

export const YOGA_POSE: Pose = constrain({ head: { x: 60, y: 44 }, lHand: { x: 52, y: 14 }, rHand: { x: 68, y: 14 }, hip: { x: 60, y: 96 }, lFoot: { x: 56, y: FLOOR }, rFoot: { x: 64, y: FLOOR } });
export const CX_BODY = CX;
