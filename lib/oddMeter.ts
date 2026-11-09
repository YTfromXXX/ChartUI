// Odd-return meter: an original, heuristic measurement for 22-cell instruments.
//
// Each value's deviation from the instrument's center is contained in integer
// honeycomb steps (HEX_STEPS per robust spread unit). Odd steps are stable; a value
// that lands on an even step is pulled toward the neighbouring odd step, and the even
// cell it leaves behind is the "blank singularity" next to it.
// This is a visual/analytic device, not a statistical test or a market signal.

export const HEX_SIDES = 6;
/** 6 sides -> 3 steps on each side of the center per spread unit (micro/macro boundary). */
export const HEX_STEPS = HEX_SIDES / 2;

export type OddCell = {
  index: number;
  value: number;
  /** Robust z-score: (value - median) / (1.4826 * MAD). */
  deviation: number;
  /** Continuous position in honeycomb steps. */
  raw: number;
  /** Integer step the deviation is contained in. */
  step: number;
  /** Nearest odd step the cell returns to. */
  target: number;
  /** Signed distance still to travel to the odd target (0 when already odd). */
  pull: number;
  /** True when the cell sat on an even step: its neighbour is the blank singularity. */
  singular: boolean;
};

export type OddMeasurement = {
  center: number;
  spread: number;
  cells: OddCell[];
  /** Share of cells already on odd steps. */
  oddRatio: number;
  singularCount: number;
  /** Sum of odd targets; always has the parity of the cell count. */
  targetSum: number;
  /** Mean |pull|, in [0, 1]. */
  tension: number;
};

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export function measureOdd(values: number[]): OddMeasurement {
  const finite = values.map((v) => (Number.isFinite(v) ? v : 0));
  if (!finite.length) return { center: 0, spread: 1, cells: [], oddRatio: 0, singularCount: 0, targetSum: 0, tension: 0 };
  const center = median(finite);
  const mad = median(finite.map((v) => Math.abs(v - center))) * 1.4826;
  const mean = finite.reduce((s, v) => s + v, 0) / finite.length;
  const std = Math.sqrt(finite.reduce((s, v) => s + (v - mean) ** 2, 0) / finite.length);
  const spread = mad > 1e-12 ? mad : std > 1e-12 ? std : 1;

  const cells = finite.map((value, index): OddCell => {
    const deviation = (value - center) / spread;
    const raw = deviation * HEX_STEPS;
    const step = Math.round(raw);
    const odd = Math.abs(step % 2) === 1;
    // Even step: return to the odd neighbour on the side the residual leans to.
    const lean = raw - step !== 0 ? Math.sign(raw - step) : Math.sign(deviation) || 1;
    const target = odd ? step : step + lean;
    return { index, value, deviation, raw, step, target, pull: target - raw, singular: !odd };
  });

  const singularCount = cells.filter((c) => c.singular).length;
  return {
    center,
    spread,
    cells,
    oddRatio: 1 - singularCount / cells.length,
    singularCount,
    targetSum: cells.reduce((s, c) => s + c.target, 0),
    tension: Math.min(1, cells.reduce((s, c) => s + Math.abs(c.pull), 0) / cells.length),
  };
}

/** Spiral-galaxy shape for one honeycomb ring cell, from both instruments' odd targets. */
export function galaxyParams(retro: OddCell | undefined, spiral: OddCell | undefined) {
  const r = retro?.target ?? 1;
  const s = spiral?.target ?? 1;
  return {
    arms: 1 + (Math.abs(r) % 4), // 1..4 arms
    twist: 0.35 + Math.min(2.5, Math.abs(s)) * 0.35, // log-spiral tightness
    handedness: s >= 0 ? 1 : -1,
    glow: 1 - Math.min(1, (Math.abs(retro?.pull ?? 0) + Math.abs(spiral?.pull ?? 0)) / 2),
  };
}
