// The wave die. Six cells in a 2 × 3 grid, each always carving its own wave:
//
//   [~~~~][~~~~][~~~~]
//   [~~~~][~~~~][~~~~]
//
// Cell k vibrates at a Pythagorean-tuned frequency (1, 9/8, 81/64, 4/3, 3/2, 27/16 × base) with its
// own phase. The face placed in a cell takes that cell's wave. A roll at time t gives the face whose
// wave is highest at that instant; the second die rolls 1/φ s later. Dragging faces between cells
// changes when each face peaks and, a little, how often: over random moments the faster cells are on
// top slightly more often (about 18 % for the 3/2 and 27/16 cells against 15–16 % for the slower
// ones), so the layout is a small, visible choice rather than a hidden bias.

export const CELLS = 6;
export const BASE_HZ = 0.55;
export const RATIOS: { r: number; label: string }[] = [
  { r: 1, label: '1/1' }, { r: 9 / 8, label: '9/8' }, { r: 81 / 64, label: '81/64' },
  { r: 4 / 3, label: '4/3' }, { r: 3 / 2, label: '3/2' }, { r: 27 / 16, label: '27/16' },
];
export const PHI = (1 + Math.sqrt(5)) / 2;
export const DEFAULT_LAYOUT = [1, 2, 3, 4, 5, 6]; // face shown in each cell, row-major

export const freqOf = (cell: number) => BASE_HZ * RATIOS[cell].r;
/** Wave height of a cell at time t (ms), in −1 … 1. */
export const wave = (cell: number, tMs: number) => Math.sin(2 * Math.PI * freqOf(cell) * (tMs / 1000) + (2 * Math.PI * cell) / CELLS);

/** The cell whose wave is highest at time t. */
export function topCell(tMs: number) {
  let best = 0; let v = -Infinity;
  for (let c = 0; c < CELLS; c += 1) { const w = wave(c, tMs); if (w > v) { v = w; best = c; } }
  return best;
}

/** Roll two dice from the layout at time t: the second die reads the waves 1/φ s later. */
export function rollWave(layout: number[], tMs: number): { faces: [number, number]; cells: [number, number] } {
  const a = topCell(tMs); const b = topCell(tMs + 1000 / PHI);
  return { faces: [layout[a], layout[b]], cells: [a, b] };
}

/** Progress of one cell: where its wave is in its cycle, and when it next crests. */
export function cellProgress(cell: number, tMs: number) {
  const f = freqOf(cell);
  const cycle = ((((f * tMs) / 1000 + cell / CELLS + 0.25) % 1) + 1) % 1; // 0 at a trough, 0.5 at the crest
  const toCrest = (((0.5 - cycle) % 1) + 1) % 1;
  return { phase: cycle, nextCrestMs: (toCrest / f) * 1000, periodMs: 1000 / f, height: wave(cell, tMs) };
}

/** Share of random moments at which each cell is on top (checks that layouts stay fair). */
export function fairness(samples = 20000, seed = 7) {
  let s = seed >>> 0; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  const counts = new Array(CELLS).fill(0);
  for (let i = 0; i < samples; i += 1) counts[topCell(rnd() * 3.6e6)] += 1;
  return counts.map((c) => c / samples);
}
