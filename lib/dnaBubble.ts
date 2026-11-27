// The "infinite DNA analyser" bubble in the header.
//
// An octahedral die (d8) turns through the 22 camera angles (slotStrip.slotAngle). Inside it sits
// a crystal baby — its gene is the 7-point cloud, and at the centre of the cloud, its heart, shows
// a symbol chosen from what the user says they are thinking about. Each face of the die carries one
// of 8 symbols; a roll lands on the face that turns most toward the viewer.
//
// Around it runs a portable (matrix) sonar for later RPG use: synthetic symbols appear as blips,
// their distance being the friction (1 − correlation)/2 of their returns against ₿. A roll points
// the sonar at the face's bearing, and the blip nearest that bearing becomes the game's pick, with
// a direction from the face. Everything is synthetic and it is a game, not a recommendation.

import { slotAngle, SLOTS } from './slotStrip';

export type V3 = [number, number, number];
export const OCTA_V: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** 8 faces: every choice of one ±x, one ±y, one ±z vertex. Face k has outward normal (sx, sy, sz)/√3. */
export const OCTA_F: { v: [number, number, number]; n: V3 }[] = [];
for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) OCTA_F.push({ v: [sx > 0 ? 0 : 1, sy > 0 ? 2 : 3, sz > 0 ? 4 : 5], n: [sx / Math.sqrt(3), sy / Math.sqrt(3), sz / Math.sqrt(3)] });

export const SYMBOLS = [
  { icon: '☀︎', ja: '太陽', words: ['朝', '光', '明る', '夏', 'sun', '希望'] },
  { icon: '☾', ja: '月', words: ['夜', '眠', '夢', 'moon', '静'] },
  { icon: '⚓', ja: '錨', words: ['守', '安定', '待', '港', '係留'] },
  { icon: '🔑', ja: '鍵', words: ['鍵', '暗号', '秘密', '署名', 'key'] },
  { icon: '✶', ja: '星', words: ['星', '宇宙', '望遠鏡', '銀河', 'star'] },
  { icon: '♞', ja: '騎士', words: ['チェス', '桂馬', '戦', '勝', '攻'] },
  { icon: '🌱', ja: '芽', words: ['育', '植物', '新し', '始', '芽'] },
  { icon: '🐟', ja: '魚', words: ['魚', '海', '泳', '水', '金魚'] },
] as const;

/** Which symbol fits the user's words: a keyword match, otherwise a stable hash of the text. */
export function heartSymbol(text: string): number {
  const t = text.normalize('NFKC').toLowerCase();
  const hit = SYMBOLS.findIndex((s) => s.words.some((w) => t.includes(w.toLowerCase())));
  if (hit >= 0) return hit;
  let h = 2166136261; for (const ch of t) { h ^= ch.codePointAt(0) ?? 0; h = Math.imul(h, 16777619); }
  return (h >>> 0) % SYMBOLS.length;
}

const ELEV = { front: 10, above: 35, low: -15, overhead: 65 } as const;
/** Yaw and pitch (radians) of camera angle i of 22, plus a slow spin so it never sits still. */
export function pose(i: number) { const a = slotAngle(((i % SLOTS) + SLOTS) % SLOTS); return { yaw: (a.azimuthDeg * Math.PI) / 180, pitch: (ELEV[a.elevation] * Math.PI) / 180 }; }
export function rotate([x, y, z]: V3, yaw: number, pitch: number): V3 {
  const x1 = x * Math.cos(yaw) + z * Math.sin(yaw); const z1 = -x * Math.sin(yaw) + z * Math.cos(yaw);
  const y2 = y * Math.cos(pitch) - z1 * Math.sin(pitch); const z2 = y * Math.sin(pitch) + z1 * Math.cos(pitch);
  return [x1, y2, z2];
}
/** The face turned most toward the viewer (+z after rotation): that is the roll. */
export function topFace(yaw: number, pitch: number) {
  let best = 0; let bz = -Infinity; OCTA_F.forEach((f, k) => { const z = rotate(f.n, yaw, pitch)[2]; if (z > bz) { bz = z; best = k; } }); return best;
}

export function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const SONAR_SYMBOLS = ['EURUSD', 'USDJPY', 'JPYUSD', 'XAUUSD', 'ETHUSD', 'SOLUSD', 'NIKKEI', 'SPX', 'CPU', 'OIL'];
/** Synthetic returns that share a part of ₿'s moves (beta) — so the sonar has something to find. */
export function sonarField(seed: number, n = 60) {
  const r = rng(seed); const btc = Array.from({ length: n }, () => r() - 0.5);
  return SONAR_SYMBOLS.map((sym, i) => {
    const beta = (r() * 2 - 1) * 0.9; const rets = btc.map((b) => beta * b + (1 - Math.abs(beta)) * (r() - 0.5));
    const ma = btc.reduce((a, b) => a + b, 0) / n; const mb = rets.reduce((a, b) => a + b, 0) / n;
    let sab = 0; let saa = 0; let sbb = 0; for (let k = 0; k < n; k += 1) { sab += (btc[k] - ma) * (rets[k] - mb); saa += (btc[k] - ma) ** 2; sbb += (rets[k] - mb) ** 2; }
    const friction = (1 - sab / Math.sqrt(saa * sbb)) / 2;
    return { sym, bearing: (i / SONAR_SYMBOLS.length) * 360, friction, rets };
  });
}

/** Bearing of a face (0–360°): the face's normal seen from above. */
export const faceBearing = (k: number) => { const n = OCTA_F[k].n; return ((Math.atan2(n[2], n[0]) * 180) / Math.PI + 360) % 360; };

export type Pick = { face: number; symbol: (typeof SYMBOLS)[number]; target: string; direction: 'up' | 'down'; bearing: number };
/** The game's pick for a roll: nearest blip to the face's bearing; up for faces with +y, down for −y. */
export function pick(face: number, field: ReturnType<typeof sonarField>): Pick {
  const b = faceBearing(face); const gap = (x: number) => { const d = Math.abs(x - b) % 360; return Math.min(d, 360 - d); };
  const t = field.reduce((a, f) => (gap(f.bearing) < gap(a.bearing) ? f : a));
  return { face, symbol: SYMBOLS[face], target: t.sym, direction: OCTA_F[face].n[1] > 0 ? 'up' : 'down', bearing: b };
}
/** Score the game on the next synthetic bars: did the pick move the way the face said? */
export function settle(p: Pick, next: number[]) { const s = next.reduce((a, b) => a + b, 0); return { move: s, win: p.direction === 'up' ? s > 0 : s < 0 }; }

/** A point on the ₿ loop (a lemniscate), phase 0–1. */
export const loopPoint = (ph: number, w = 1, h = 0.5) => { const t = ph * Math.PI * 2; const d = 1 + Math.sin(t) ** 2; return { x: (w * Math.cos(t)) / d, y: (h * 2 * Math.sin(t) * Math.cos(t)) / d }; };
