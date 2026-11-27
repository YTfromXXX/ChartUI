// Orbit of the Cure mover (SPIRAL EYE pet). Placeholder states act as intervention
// patterns; the odd-return field measured on the retro grid widens the range and adds
// free-curve harmonics so the mover leaves the narrow fixed ellipse.

import type { PlaceholderState } from '@/lib/cureApiStore';

export type OddField = {
  /** Combined odd-return pulls of the instruments (one per measured cell). */
  pulls: number[];
  /** Mean |pull| in [0, 1]. */
  tension: number;
  /** Share of cells already on odd steps. */
  oddRatio: number;
  updatedAt: number;
};

/** Half-extent available in the SPIRAL EYE viewBox (640 × 310, origin at the center). */
export const ORBIT_BOUNDS = { rx: 300, ry: 142 };
const BASE = { rx: 135, ry: 78 };
const HARMONICS = 6;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const superCos = (a: number, p: number) => Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** p;
const superSin = (a: number, p: number) => Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** p;

export function orbitPoint(phase: number, pattern: PlaceholderState, field: OddField | null, time = 0) {
  const span = field ? 0.35 + 0.65 * clamp(field.tension * 2, 0, 1) : 0;
  let rx = BASE.rx + (ORBIT_BOUNDS.rx - BASE.rx) * span * 0.75;
  let ry = BASE.ry + (ORBIT_BOUNDS.ry - BASE.ry) * span * 0.75;
  let x = Math.cos(phase);
  let y = Math.sin(phase);
  let harmonicGain = pattern === 'idle' ? 0 : 0.14;

  switch (pattern) {
    case '⚪︎':
      ry = Math.min(ORBIT_BOUNDS.ry, rx * 0.55);
      break;
    case '◻︎':
      x = superCos(phase, 0.3);
      y = superSin(phase, 0.3);
      break;
    case '(expand)': {
      const breath = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(time * 0.35));
      rx = ORBIT_BOUNDS.rx * breath;
      ry = ORBIT_BOUNDS.ry * breath;
      break;
    }
    case '(extend)':
      rx = ORBIT_BOUNDS.rx;
      ry *= 0.7;
      harmonicGain = 0.26;
      break;
    default:
      break;
  }

  let px = x * rx;
  let py = y * ry;
  const pulls = field?.pulls ?? [];
  for (let j = 0; j < Math.min(HARMONICS, pulls.length); j += 1) {
    const k = j + 2;
    px += pulls[j] * harmonicGain * rx * Math.cos(k * phase + j);
    py += pulls[j] * harmonicGain * ry * Math.sin(k * phase - j);
  }
  return { x: clamp(px, -ORBIT_BOUNDS.rx, ORBIT_BOUNDS.rx), y: clamp(py, -ORBIT_BOUNDS.ry, ORBIT_BOUNDS.ry) };
}

/** SVG path of one full orbit (no noise), for drawing the free-curve track. */
export function orbitPath(pattern: PlaceholderState, field: OddField | null, time = 0, samples = 180) {
  const points: string[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const { x, y } = orbitPoint((i / samples) * Math.PI * 2, pattern, field, time);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M${points.join(' L')}Z`;
}
