// 22 retro-grid blocks: the same region and colour rules as the 16 × 16 retro grid
// (HEADER 4 rows, BOTTOM 2 rows, SIDE MENU staircase, POP UP remainder; region hue plus
// seeded drift), but every block has its own pixel arrangement, plus a "sandstorm" layer
// driven by a cipher-style hash stream and the Cure-API experiment clock.
//
// Uniqueness: block k rotates the staircase widths by ⌊k/2⌋ (index 10 uses the reversed
// sequence) and mirrors left/right on odd k (the right column). Rotation, reversal and
// mirroring keep every region's cell count, so all 22 blocks share the exact region
// shares (25 / 31.25 / 31.25 / 12.5 %) while no two layouts are equal.

import { GRID, REGIONS, mulberry32, type RegionId } from '@/lib/retroGrid';

const BASE_SIDE_WIDTHS = [4, 6, 5, 8, 7, 9, 8, 10, 11, 12];
const HEADER_ROWS = 4;
const BOTTOM_ROWS = 2;

export type BlockLayout = { sideWidths: number[]; mirror: boolean };

export function blockLayout(index: number): BlockLayout {
  const r = Math.floor(index / 2);
  const sideWidths = r < BASE_SIDE_WIDTHS.length
    ? [...BASE_SIDE_WIDTHS.slice(r), ...BASE_SIDE_WIDTHS.slice(0, r)]
    : [...BASE_SIDE_WIDTHS].reverse();
  return { sideWidths, mirror: index % 2 === 1 };
}

export function regionAtLayout(row: number, col: number, layout: BlockLayout): RegionId {
  if (row < HEADER_ROWS) return 'header';
  if (row >= GRID - BOTTOM_ROWS) return 'bottom';
  const c = layout.mirror ? GRID - 1 - col : col;
  return c < layout.sideWidths[row - HEADER_ROWS] ? 'side' : 'popup';
}

/** Region id of every cell (row-major, GRID × GRID). */
export function layoutRegions(layout: BlockLayout): RegionId[] {
  const out: RegionId[] = [];
  for (let r = 0; r < GRID; r += 1) for (let c = 0; c < GRID; c += 1) out.push(regionAtLayout(r, c, layout));
  return out;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100; const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Same colour rule as retroGrid.cellColors (region hue + seeded drift), as RGB, for a layout. */
export function blockColors(seed: number, chaos: number, regions: RegionId[]): [number, number, number][] {
  const rand = mulberry32(seed);
  return regions.map((region, index) => {
    const r = Math.floor(index / GRID); const c = index % GRID;
    const h = (REGIONS[region].hue + (rand() - 0.5) * 140 * chaos + 360) % 360;
    const s = 70 + (rand() - 0.5) * 40 * chaos;
    const l = 30 + (rand() - 0.5) * 28 * chaos + ((r + c) % 2) * 3;
    return hslToRgb(h, s, l);
  });
}

/** 32-bit avalanche hash: the cipher stream of the sandstorm. */
export function cipher(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 16; h = Math.imul(h, 0x7feb352d); h ^= h >>> 15; h = Math.imul(h, 0x846ca68b); h ^= h >>> 16;
  return h >>> 0;
}

export type SandstormParams = {
  /** Experiment time in seconds (already scaled by simulation speed / frozen). */
  time: number;
  /** Strobe interval in seconds; short = glitter, long = gentle drift. */
  strobe: number;
  /** 0..1 volatility / shell stress from the experiments store. */
  stress: number;
  /** Matrix energy from the latest experiment (0 when none). */
  energy: number;
  polarity: 'LONG' | 'SHORT' | null;
  /** 'core' = internal structure of the permanent Y axis, 'shell' = cylindrical outer shell. */
  mode: 'core' | 'shell';
  reducedMotion: boolean;
};

/** 0 at a slow strobe (≥ 1 s) … 1 at a fast strobe (≤ 0.11 s). */
export function glitterAmount(strobe: number) {
  return Math.min(1, Math.max(0, (1 / Math.max(0.01, strobe) - 1) / 8));
}

/**
 * Paint one block into a GRID × GRID ImageData.
 * Gentle mode: each cell's lightness drifts smoothly between successive cipher values.
 * Glitter mode: a sparse, de-synchronised set of cells (≤ 14 %) flashes and decays within a tick,
 * so the block's average luminance stays steady (no large-area flash).
 */
export function paintSandstorm(image: ImageData, blockId: number, colors: [number, number, number][], p: SandstormParams) {
  const glitter = p.reducedMotion ? 0 : glitterAmount(p.strobe);
  const strobe = Math.max(0.05, p.strobe);
  const tickF = p.time / strobe;
  const tick = Math.floor(tickF);
  const frac = p.reducedMotion ? 0 : tickF - tick;
  const smooth = frac * frac * (3 - 2 * frac);
  const density = Math.min(0.14, (0.03 + 0.08 * p.stress + 0.02 * Math.min(1, p.energy / 4)) * glitter);
  const tint = p.polarity === 'LONG' ? [170, 245, 255] : p.polarity === 'SHORT' ? [255, 190, 205] : [255, 250, 235];
  const spin = p.mode === 'shell' ? Math.floor(p.time * 2) : 0;
  const data = image.data;

  for (let r = 0; r < GRID; r += 1) {
    for (let c = 0; c < GRID; c += 1) {
      // Shell: the block is wrapped on a cylinder around the permanent Y axis and turns.
      const srcC = p.mode === 'shell' ? (c + spin) % GRID : c;
      const index = r * GRID + srcC;
      const [br, bg, bb] = colors[index];
      const h0 = cipher(blockId, index, tick);
      const h1 = cipher(blockId, index, tick + 1);
      const drift = ((h0 & 0xffff) / 0xffff) * (1 - smooth) + ((h1 & 0xffff) / 0xffff) * smooth;
      let gain = 1 + (drift - 0.5) * (0.35 + 0.25 * p.stress) * (1 - glitter * 0.5);
      let sparkle = 0;
      if (((h0 >>> 16) & 0xffff) / 0xffff < density) {
        const phase = ((h0 >>> 8) & 0xff) / 255; // de-synchronise sparkles inside the tick
        const local = (frac + phase) % 1;
        sparkle = (1 - local) ** 2;
      }
      if (p.mode === 'shell') {
        const angle = ((c + 0.5) / GRID - 0.5) * Math.PI;
        gain *= 0.4 + 0.6 * Math.cos(angle);
      }
      const o = (r * GRID + c) * 4;
      data[o] = Math.min(255, br * gain + (tint[0] - br * gain) * sparkle);
      data[o + 1] = Math.min(255, bg * gain + (tint[1] - bg * gain) * sparkle);
      data[o + 2] = Math.min(255, bb * gain + (tint[2] - bb * gain) * sparkle);
      data[o + 3] = 255;
    }
  }
}

/** Short hex digest of a block's cipher stream at a tick (shown as the block's "encryption" readout). */
export function blockDigest(blockId: number, tick: number) {
  return [0, 1].map((i) => cipher(blockId, 1000 + i, tick).toString(16).padStart(8, '0')).join('').slice(0, 12);
}
