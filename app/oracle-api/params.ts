// Free-form parameter sheet for /oracle-api/experiments (experimental, tune freely).
// The lab sweeps `scale_dial` across the 384 Spiral Candy grid served by
// GET /api/v1/oracle/spiral-grid and compares the snapshots side by side.

export const WAVEFORMS = ['SURGE', 'CONTINUATION', 'RANGE', 'CRASH'] as const;
export type Waveform = (typeof WAVEFORMS)[number];

export const SUITS = ['WANDS', 'CUPS', 'SWORDS', 'PENTACLES'] as const;
export type Suit = (typeof SUITS)[number];

export const SUIT_COLORS: Record<Suit, string> = {
  WANDS: '#f97316',
  CUPS: '#38bdf8',
  SWORDS: '#a78bfa',
  PENTACLES: '#4ade80',
};

export const WAVE_COLORS: Record<Waveform, string> = {
  SURGE: '#22d3ee',
  CONTINUATION: '#a3e635',
  RANGE: '#facc15',
  CRASH: '#fb7185',
};

export const SWEEP = {
  /** Number of evenly spaced dial snapshots requested from the API (inclusive of both ends). */
  steps: 5,
  /** Default dial range; the API clamps to [0, 1]. */
  from: 0,
  to: 1,
  /** Decades the backend shifts ln(a) by over the full dial (spiral_candy_grid.ZOOM_LOG_SPAN = ln 1000). */
  expectedDecadesPerDial: 3,
  /** Candies with RR at or above this are counted as "actionable" in the summary. */
  rrThreshold: 2,
  /** Concurrent API requests during a sweep. */
  concurrency: 3,
};

export type SweepConfig = typeof SWEEP;
