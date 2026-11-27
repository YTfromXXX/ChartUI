// Die-shot scanner (educational). A die photo is cut into 32×32 tiles and each tile is classified
// from texture alone: SRAM is a fine regular grid, GPU shader units repeat every few tiles, I/O and
// PHY are stripes or pads at the rim, CPU logic is dense and irregular. The area shares feed a
// toy "simulation credit" estimate: how much the in-app activity monitor would spend to simulate
// one second of this die. It is not a cost of copying any real chip, and on real photos the
// classifier is a rough first pass.

import { mulberry32 } from '@/lib/retroGrid';

export type Unit = 'cpu' | 'gpu' | 'sram' | 'io' | 'blank';
export const UNIT_INFO: Record<Unit, { name: string; color: string }> = {
  cpu: { name: 'CPU ロジック', color: '#ff6b3d' },
  gpu: { name: 'GPU シェーダー', color: '#22d3a6' },
  sram: { name: 'SRAM キャッシュ', color: '#7c6cff' },
  io: { name: 'I/O・PHY・パッド', color: '#f5c542' },
  blank: { name: '空き・アナログ', color: '#8a8f98' },
};
export const UNITS: Unit[] = ['cpu', 'gpu', 'sram', 'io', 'blank'];
export const TILE = 32; export const DIE_W = 640; export const DIE_H = 448;
export const COLS = DIE_W / TILE; export const ROWS = DIE_H / TILE;

/** Paint a synthetic die and return the ground-truth unit of every tile. */
export function paintDie(ctx: CanvasRenderingContext2D, seed = 7): Unit[] {
  const r = mulberry32(seed);
  const truth: Unit[] = new Array(COLS * ROWS).fill('blank');
  const set = (x0: number, y0: number, x1: number, y1: number, u: Unit) => { for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) truth[y * COLS + x] = u; };
  ctx.fillStyle = '#17161d'; ctx.fillRect(0, 0, DIE_W, DIE_H);
  const iri = ['#5be37d', '#b46cff', '#ff9a3d', '#3dd6ff', '#ff4f8b', '#e6e04a', '#6e8bff'];
  // Pad ring.
  set(0, 0, COLS - 1, 0, 'io'); set(0, ROWS - 1, COLS - 1, ROWS - 1, 'io'); set(0, 0, 0, ROWS - 1, 'io'); set(COLS - 1, 0, COLS - 1, ROWS - 1, 'io');
  for (let i = 0; i < COLS; i += 1) for (const y of [4, DIE_H - 24]) { ctx.fillStyle = '#d9b44a'; ctx.fillRect(i * TILE + 6, y, 20, 20); ctx.fillStyle = '#7a5a1a'; ctx.fillRect(i * TILE + 12, y + 6, 8, 8); }
  for (let j = 1; j < ROWS - 1; j += 1) for (const x of [4, DIE_W - 24]) { ctx.fillStyle = '#d9b44a'; ctx.fillRect(x, j * TILE + 6, 20, 20); ctx.fillStyle = '#7a5a1a'; ctx.fillRect(x + 6, j * TILE + 12, 8, 8); }
  // CPU cores: dense irregular logic (four cores, 3×3 tiles each).
  for (const [cx, cy] of [[1, 1], [4, 1], [1, 4], [4, 4]]) {
    set(cx, cy, cx + 2, cy + 2, 'cpu');
    for (let k = 0; k < 900; k += 1) { ctx.fillStyle = iri[Math.floor(r() * iri.length)]; ctx.globalAlpha = 0.5 + r() * 0.5; ctx.fillRect(cx * TILE + r() * 92, cy * TILE + r() * 92, 2 + r() * 7, 2 + r() * 7); }
    ctx.globalAlpha = 1;
  }
  // L2 SRAM: fine regular grid.
  set(1, 7, 6, 10, 'sram');
  for (let y = 7 * TILE; y < 11 * TILE; y += 4) for (let x = TILE; x < 7 * TILE; x += 4) { ctx.fillStyle = ((x + y) / 4) % 2 ? '#6d5bd0' : '#2b2160'; ctx.fillRect(x, y, 3, 3); }
  // GPU: identical 64×64 shader units stamped in a 6×4 array.
  set(7, 1, 18, 8, 'gpu');
  const unit = document.createElement('canvas'); unit.width = 64; unit.height = 64; const u = unit.getContext('2d')!; const ur = mulberry32(99);
  u.fillStyle = '#10261f'; u.fillRect(0, 0, 64, 64);
  for (let k = 0; k < 160; k += 1) { u.fillStyle = ['#22d3a6', '#3dd6ff', '#5be37d', '#e6e04a'][Math.floor(ur() * 4)]; u.fillRect(ur() * 56, ur() * 40, 2 + ur() * 6, 2 + ur() * 6); }
  for (let y = 44; y < 62; y += 3) for (let x = 2; x < 62; x += 3) { u.fillStyle = (x + y) % 2 ? '#1a8f78' : '#0b3b31'; u.fillRect(x, y, 2, 2); }
  for (let gy = 0; gy < 4; gy += 1) for (let gx = 0; gx < 6; gx += 1) ctx.drawImage(unit, 7 * TILE + gx * 64, TILE + gy * 64);
  // Memory PHY: wide stripes.
  set(7, 9, 18, 12, 'io');
  for (let x = 7 * TILE; x < 19 * TILE; x += 8) { ctx.fillStyle = (x / 8) % 2 ? '#c9a23a' : '#4a3a18'; ctx.fillRect(x, 9 * TILE + 4, 6, 4 * TILE - 8); }
  // A PLL (analog, mostly blank) below the cache: tiles x 1–6, y 11–12 stay blank.
  ctx.strokeStyle = '#8fa3b8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(3.5 * TILE, 12 * TILE, 18, 0, Math.PI * 2); ctx.stroke();
  // Iridescent film, the look of a real die photo.
  const film = ctx.createLinearGradient(0, 0, DIE_W, DIE_H);
  ['#ff4f8b', '#e6e04a', '#3dd6ff', '#b46cff'].forEach((c, i) => film.addColorStop(i / 3, c));
  ctx.globalAlpha = 0.12; ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = film; ctx.fillRect(0, 0, DIE_W, DIE_H);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  return truth;
}

type Gray = { g: Float32Array; w: number; h: number };
const toGray = (rgba: Uint8ClampedArray, w: number, h: number): Gray => {
  const g = new Float32Array(w * h);
  for (let i = 0; i < w * h; i += 1) g[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2];
  return { g, w, h };
};

export type TileFeature = { edge: number; periodic: number; repeat: number; aniso: number; dev: number };

function features(G: Gray, tx: number, ty: number): TileFeature {
  const { g, w } = G; const x0 = tx * TILE; const y0 = ty * TILE;
  let mean = 0; for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) mean += g[(y0 + y) * w + x0 + x];
  mean /= TILE * TILE;
  let dev = 0; let edge = 0; let dx = 0; let dy = 0;
  for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) {
    const v = g[(y0 + y) * w + x0 + x]; dev += Math.abs(v - mean);
    if (x < TILE - 1) { const d = Math.abs(v - g[(y0 + y) * w + x0 + x + 1]); dx += d; if (d > 40) edge += 1; }
    if (y < TILE - 1) { const d = Math.abs(v - g[(y0 + y + 1) * w + x0 + x]); dy += d; if (d > 40) edge += 1; }
  }
  dev /= TILE * TILE;
  // Small-scale periodicity: best self-match under a 2–8 px shift (SRAM bit cells).
  let best = Infinity;
  for (let s = 2; s <= 8; s += 1) for (const [sx, sy] of [[s, 0], [0, s]]) {
    let d = 0; let n = 0;
    for (let y = 0; y < TILE - sy; y += 1) for (let x = 0; x < TILE - sx; x += 1) { d += Math.abs(g[(y0 + y) * w + x0 + x] - g[(y0 + y + sy) * w + x0 + x + sx]); n += 1; }
    best = Math.min(best, d / n);
  }
  // Block repetition: match with the tile two tiles away (64 px shader units).
  let rep = 0;
  for (const [ox, oy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) {
    const nx = tx + ox; const ny = ty + oy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
    let d = 0; for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) d += Math.abs(g[(y0 + y) * w + x0 + x] - g[(ny * TILE + y) * w + nx * TILE + x]);
    rep = Math.max(rep, 1 - d / (TILE * TILE) / Math.max(1, dev * 2));
  }
  return { edge: edge / (2 * TILE * TILE), periodic: 1 - best / Math.max(1, dev * 2), repeat: rep, aniso: Math.min(dx, dy) / Math.max(1, Math.max(dx, dy)), dev };
}

export function classifyTile(f: TileFeature, tx: number, ty: number): Unit {
  if (tx === 0 || ty === 0 || tx === COLS - 1 || ty === ROWS - 1) return 'io';
  if (f.dev < 6 || f.edge < 0.025) return 'blank';
  if (f.aniso < 0.25) return 'io';
  if (f.periodic > 0.9) return 'sram';
  if (f.repeat > 0.8) return 'gpu';
  return 'cpu';
}

export function scanDie(rgba: Uint8ClampedArray): { units: Unit[]; features: TileFeature[] } {
  const G = toGray(rgba, DIE_W, DIE_H);
  const feats: TileFeature[] = []; const units: Unit[] = [];
  for (let ty = 0; ty < ROWS; ty += 1) for (let tx = 0; tx < COLS; tx += 1) { const f = features(G, tx, ty); feats.push(f); units.push(classifyTile(f, tx, ty)); }
  return { units, features: feats };
}

export function areaShares(units: Unit[]) {
  const out = Object.fromEntries(UNITS.map((u) => [u, 0])) as Record<Unit, number>;
  for (const u of units) out[u] += 1 / units.length;
  return out;
}

/** In-app units per mm² to simulate one second at the activity monitor's resolution. */
const CREDIT_PER_MM2: Record<Unit, number> = { cpu: 3, gpu: 2, sram: 0.5, io: 0.2, blank: 0 };
export function simCredits(shares: Record<Unit, number>, dieMm2: number) {
  const parts = UNITS.map((u) => ({ u, mm2: shares[u] * dieMm2, credits: shares[u] * dieMm2 * CREDIT_PER_MM2[u] }));
  return { parts, total: parts.reduce((s, p) => s + p.credits, 0) };
}
