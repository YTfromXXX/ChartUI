// Seats, colours and gaze for a 4- or 8-player table, as points on the complex plane.
//
// Seat k sits at z_k = R·e^{iθ_k}, θ_k = π/2 − 2πk/N (seat 0 at the top, going clockwise).
// Its gaze is a unit complex number g_k: toward the table centre (−z_k/|z_k|), toward another
// seat, or — for a player at a computer split 5:5 — a little to the left (the folder half) or to
// the right (the terminal half) of the table direction.
// Each seat point carries a value (表面積 : 質量):
//   表面積 (surface) = what the others can see of you: the cards in your river, + 1
//   質量   (mass)    = what you hold: the cards in your hand
// Values are given slowly: every frame a value moves a fraction 1 − e^(−dt/τ) of the way to its
// target (τ = 3 s), so nothing jumps.
// 8 players use the von Neumann rule with two decks (2 × 144 = 288 cards).

import { SEATS } from './tetraArcana';

export type C = { re: number; im: number };
export const polar = (r: number, th: number): C => ({ re: r * Math.cos(th), im: r * Math.sin(th) });
export const arg = (z: C) => Math.atan2(z.im, z.re);
export const abs = (z: C) => Math.hypot(z.re, z.im);
export const TAU_S = 3;
export const DECK = 144;
export const HAND = 13;

export type Gaze = { kind: 'table' } | { kind: 'seat'; to: number } | { kind: 'screen'; half: 'left' | 'right' };
export type Seat = { k: number; z: C; colour: string; wind: string; gaze: Gaze; area: number; mass: number; target: { area: number; mass: number } };

const hsl = (h: number, s: number, l: number) => { const a = s * Math.min(l, 1 - l); const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; return `#${f(0)}${f(8)}${f(4)}`; };
/** 4 seats keep the tetra-arcana colours; 8 seats add four colours halfway round the wheel from them. */
export function seatColours(n: 4 | 8) {
  const base = SEATS.map((s) => ({ colour: s.color, wind: s.wind }));
  if (n === 4) return base;
  const extra = [{ wind: '東南', h: 160 }, { wind: '南西', h: 280 }, { wind: '西北', h: 20 }, { wind: '北東', h: 100 }].map((e) => ({ colour: hsl(e.h, 0.7, 0.62), wind: e.wind }));
  return base.flatMap((b, i) => [b, extra[i]]);
}

export function makeSeats(n: 4 | 8, R = 1): Seat[] {
  const cols = seatColours(n);
  return cols.map((c, k) => ({ k, z: polar(R, Math.PI / 2 - (2 * Math.PI * k) / n), colour: c.colour, wind: c.wind, gaze: { kind: 'table' }, area: 1, mass: 0, target: { area: 1, mass: HAND } }));
}

/** The gaze as an angle: table centre, another seat, or ±25° off the table direction for a 5:5 screen. */
export function gazeAngle(s: Seat, seats: Seat[]): number {
  const toCentre = arg({ re: -s.z.re, im: -s.z.im });
  if (s.gaze.kind === 'table') return toCentre;
  if (s.gaze.kind === 'seat') { const o = seats[s.gaze.to]; return arg({ re: o.z.re - s.z.re, im: o.z.im - s.z.im }); }
  const off = (25 * Math.PI) / 180; return toCentre + (s.gaze.half === 'left' ? off : -off);
}

/** Move each value a little toward its target (slow giving). */
export function ease(seats: Seat[], dt: number): Seat[] {
  const k = 1 - Math.exp(-dt / TAU_S);
  return seats.map((s) => ({ ...s, area: s.area + (s.target.area - s.area) * k, mass: s.mass + (s.target.mass - s.mass) * k }));
}

export const ratio = (s: Seat) => s.area / Math.max(0.5, s.mass);
/** Cards for N players with the von Neumann rule: 8 players play with two decks. */
export const deckFor = (n: 4 | 8) => ({ decks: n === 8 ? 2 : 1, cards: (n === 8 ? 2 : 1) * DECK, dealt: n * HAND });

// ---------- ASCII art of the table (for the terminal half) ----------
const ARROWS = ['>', '/', '^', '\\', '<', '/', 'v', '\\']; // 8 directions from 0 rad, counter-clockwise
export const arrowOf = (angle: number) => ARROWS[(((Math.round(angle / (Math.PI / 4)) % 8) + 8) % 8)];

/** Draw the table in plain ASCII: seats on an ellipse, each with its gaze arrow, the deck count in the middle. */
export function asciiTable(seats: Seat[], names: string[], cols = 45, rows = 19): string {
  const g = Array.from({ length: rows }, () => Array(cols).fill(' '));
  const cx = (cols - 1) / 2; const cy = (rows - 1) / 2; const rx = cols / 2 - 6; const ry = rows / 2 - 3;
  for (let t = 0; t < 360; t += 3) { const x = Math.round(cx + rx * 0.62 * Math.cos((t * Math.PI) / 180)); const y = Math.round(cy - ry * 0.62 * Math.sin((t * Math.PI) / 180)); g[y][x] = '.'; }
  const put = (x: number, y: number, s: string) => { for (let i = 0; i < s.length; i += 1) if (g[y] && x + i >= 0 && x + i < cols) g[y][x + i] = s[i]; };
  const mid = `${deckFor(seats.length === 8 ? 8 : 4).cards} cards`; put(Math.round(cx - mid.length / 2), Math.round(cy), mid);
  const at = (s: Seat) => ({ x: Math.round(cx + rx * s.z.re), y: Math.round(cy - ry * s.z.im) });
  // Labels first, then letters, then gaze arrows on top, so no seat's arrow is hidden under a label.
  seats.forEach((s) => { const { x, y } = at(s); const v = `${Math.round(s.area)}:${Math.round(s.mass)}`; put(x - Math.floor(v.length / 2), y + (s.z.im >= 0 ? -2 : 2), v); });
  seats.forEach((s, i) => { const { x, y } = at(s); put(x, y, names[i].slice(0, 1)); });
  seats.forEach((s) => { const { x, y } = at(s); const a = gazeAngle(s, seats); put(x + Math.round(Math.cos(a) * 2), y - Math.round(Math.sin(a) * 1), arrowOf(a)); });
  return g.map((r) => r.join('').replace(/\s+$/, '')).join('\n');
}
