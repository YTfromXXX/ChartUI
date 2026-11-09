export type RegionId = 'header' | 'side' | 'bottom' | 'popup';

export const GRID = 16;

export const REGIONS: Record<RegionId, { label: string; role: string; share: number; hue: number; tint: string }> = {
  header: { label: 'HEADER', role: 'NAV / STATUS', share: 0.25, hue: 190, tint: '#67e8f9' },
  side: { label: 'SIDE MENU', role: 'ROUTES / FILTERS', share: 0.3125, hue: 300, tint: '#f5d0fe' },
  bottom: { label: 'BOTTOM', role: 'TICKER / CONSOLE', share: 0.125, hue: 45, tint: '#fbbf24' },
  popup: { label: 'POPUP', role: 'DIALOG / DETAIL', share: 0.3125, hue: 12, tint: '#fb7185' },
};

// Width of the side menu per row inside the 10 rows between header and bottom.
// The staircase zig-zag sums to 80 cells (31.25% of 256); the popup takes the rest.
const SIDE_WIDTHS = [4, 6, 5, 8, 7, 9, 8, 10, 11, 12];

const HEADER_ROWS = 4;
const BOTTOM_ROWS = 2;

export function regionAt(row: number, col: number): RegionId {
  if (row < HEADER_ROWS) return 'header';
  if (row >= GRID - BOTTOM_ROWS) return 'bottom';
  return col < SIDE_WIDTHS[row - HEADER_ROWS] ? 'side' : 'popup';
}

export function regionCounts(): Record<RegionId, number> {
  const counts: Record<RegionId, number> = { header: 0, side: 0, bottom: 0, popup: 0 };
  for (let r = 0; r < GRID; r += 1) for (let c = 0; c < GRID; c += 1) counts[regionAt(r, c)] += 1;
  return counts;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Per-cell HSL with seeded "accidental" hue/lightness drift; `chaos` 0..1 scales the drift. */
export function cellColors(seed: number, chaos: number): string[] {
  const rand = mulberry32(seed);
  const colors: string[] = [];
  for (let r = 0; r < GRID; r += 1) {
    for (let c = 0; c < GRID; c += 1) {
      const { hue } = REGIONS[regionAt(r, c)];
      const h = (hue + (rand() - 0.5) * 140 * chaos + 360) % 360;
      const s = 70 + (rand() - 0.5) * 40 * chaos;
      const l = 30 + (rand() - 0.5) * 28 * chaos + ((r + c) % 2) * 3;
      colors.push(`hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`);
    }
  }
  return colors;
}
