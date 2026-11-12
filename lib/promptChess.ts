// Physical prompt chess in a multi-storey car park.
//
// The board is a car park: FLOORS levels of SIZE × SIZE bays. Every piece starts as a knight (桂馬).
// A knight moves like a 3D knight: two bays along one axis and one along another, where the floor
// is an axis too (so it can jump up or down a level via the ramp) — 24 moves at most.
//
// Each turn both players write a prompt within the time limit (5 minutes in a real game). The
// prompt is turned into a move by a resolver; the default resolver here is a plain parser (no AI),
// and an AI resolver can be plugged in later through the same interface. Then both moves run AT
// THE SAME TIME (同時走行):
//   • both land on the same bay  → they crash and both go back where they were;
//   • a knight lands on a bay the opponent has just left → no capture (the car drove away);
//   • a knight lands on an opponent that stayed put → captured;
//   • two knights swap bays → they pass each other; nobody is captured.
// A prompt that cannot be understood, or names an illegal move, leaves that knight parked.

export const SIZE = 5; export const FLOORS = 3;
export type Sq = { x: number; y: number; f: number };
export type Color = 'white' | 'black';
export type Piece = { id: string; color: Color; at: Sq; alive: boolean };
export type Move = { id: string; to: Sq } | null;
export type Resolved = { move: Move; why: string };
export type PromptResolver = (prompt: string, color: Color, pieces: Piece[]) => Resolved;

export const FILES = 'abcde';
export const sqName = (s: Sq) => `${FILES[s.x]}${s.y + 1}@${s.f + 1}F`;
export const same = (a: Sq, b: Sq) => a.x === b.x && a.y === b.y && a.f === b.f;
const inside = (s: Sq) => s.x >= 0 && s.y >= 0 && s.f >= 0 && s.x < SIZE && s.y < SIZE && s.f < FLOORS;

export const KNIGHT_STEPS: Sq[] = (() => {
  const out: Sq[] = []; const axes = ['x', 'y', 'f'] as const;
  for (const a of axes) for (const b of axes) if (a !== b) for (const sa of [-2, 2]) for (const sb of [-1, 1]) { const d = { x: 0, y: 0, f: 0 }; d[a] = sa; d[b] = sb; out.push(d); }
  return out;
})();

export function initialPieces(): Piece[] {
  const ps: Piece[] = [];
  [1, 3].forEach((x, i) => { ps.push({ id: `W${i + 1}`, color: 'white', at: { x, y: 0, f: 0 }, alive: true }); ps.push({ id: `B${i + 1}`, color: 'black', at: { x, y: SIZE - 1, f: FLOORS - 1 }, alive: true }); });
  [0, 4].forEach((x, i) => { ps.push({ id: `W${i + 3}`, color: 'white', at: { x, y: 0, f: 1 }, alive: true }); ps.push({ id: `B${i + 3}`, color: 'black', at: { x, y: SIZE - 1, f: 1 }, alive: true }); });
  return ps;
}

export function legalMoves(p: Piece, pieces: Piece[]): Sq[] {
  return KNIGHT_STEPS.map((d) => ({ x: p.at.x + d.x, y: p.at.y + d.y, f: p.at.f + d.f }))
    .filter((s) => inside(s) && !pieces.some((q) => q.alive && q.color === p.color && same(q.at, s)));
}

/**
 * Default resolver: reads a piece name (W1 / B2, or 桂1 for your first knight) and a bay
 * ("c3@2F", "c3 2階", or "c3" — the floor is then picked if only one legal move lands there).
 */
export const parsePrompt: PromptResolver = (prompt, color, pieces) => {
  const t = prompt.normalize('NFKC').toLowerCase();
  const prefix = color === 'white' ? 'w' : 'b';
  const mine = pieces.filter((p) => p.alive && p.color === color);
  const idm = t.match(new RegExp(`\\b${prefix}([1-9])\\b`)) ?? t.match(/桂\s*([1-9])/);
  // Drop the piece name first, so "b1" in "B1 を c3@2F へ" is not read as the bay b1.
  const rest = idm ? t.replace(idm[0], ' ') : t;
  const sq = rest.match(/\b([a-e])\s*([1-5])(?:\s*(?:@|階|f|floor|\s)\s*([1-3]))?/);
  if (!sq) return { move: null, why: '行き先の区画（例 c3@2F）が読めない — 駐車のまま' };
  const x = FILES.indexOf(sq[1]); const y = Number(sq[2]) - 1; const floor = sq[3] ? Number(sq[3]) - 1 : null;
  const named = idm ? mine.find((p) => p.id === `${prefix.toUpperCase()}${idm[1]}`) : null;
  const candidates = (named ? [named] : mine).flatMap((p) => legalMoves(p, pieces).filter((s) => s.x === x && s.y === y && (floor === null || s.f === floor)).map((to) => ({ id: p.id, to })));
  if (!candidates.length) return { move: null, why: `${named ? named.id : '桂馬'} は ${sq[0]} へ跳べない — 駐車のまま` };
  if (candidates.length > 1) return { move: null, why: `候補が ${candidates.length} 通りある（駒か階を書いて） — 駐車のまま` };
  return { move: candidates[0], why: `${candidates[0].id} → ${sqName(candidates[0].to)}` };
};

export type TurnEvent = { kind: 'move' | 'crash' | 'capture' | 'pass' | 'stay'; text: string };
/** Run both moves at the same time. Returns the new pieces and what happened. */
export function resolveTurn(pieces: Piece[], white: Move, black: Move): { pieces: Piece[]; events: TurnEvent[] } {
  const next = pieces.map((p) => ({ ...p, at: { ...p.at } })); const events: TurnEvent[] = [];
  const by = (id: string) => next.find((p) => p.id === id) as Piece;
  const moves = [white, black].filter((m): m is NonNullable<Move> => !!m && !!pieces.find((p) => p.id === m.id && p.alive));
  if (!white) events.push({ kind: 'stay', text: '白は駐車のまま' });
  if (!black) events.push({ kind: 'stay', text: '黒は駐車のまま' });
  if (moves.length === 2 && same(moves[0].to, moves[1].to)) {
    events.push({ kind: 'crash', text: `${moves[0].id} と ${moves[1].id} が ${sqName(moves[0].to)} で衝突 — 両方とも元の区画へ` });
    return { pieces: next, events };
  }
  const from = new Map(moves.map((m) => [m.id, { ...by(m.id).at }]));
  for (const m of moves) by(m.id).at = { ...m.to };
  if (moves.length === 2 && same(moves[0].to, from.get(moves[1].id) as Sq) && same(moves[1].to, from.get(moves[0].id) as Sq)) {
    events.push({ kind: 'pass', text: `${moves[0].id} と ${moves[1].id} がすれ違った` });
    return { pieces: next, events };
  }
  for (const m of moves) {
    const mover = by(m.id); events.push({ kind: 'move', text: `${m.id} → ${sqName(m.to)}` });
    const victim = next.find((p) => p.alive && p.color !== mover.color && same(p.at, m.to) && !moves.some((o) => o.id === p.id));
    if (victim) { victim.alive = false; events.push({ kind: 'capture', text: `${m.id} が ${victim.id} を取った` }); }
  }
  return { pieces: next, events };
}

/** A simple opponent: capture if it can (and the target is not about to leave), else head toward the enemy. */
export function cpuPrompt(color: Color, pieces: Piece[], rnd: () => number): string {
  const mine = pieces.filter((p) => p.alive && p.color === color); const foes = pieces.filter((p) => p.alive && p.color !== color);
  let best: { id: string; to: Sq; score: number } | null = null;
  for (const p of mine) for (const to of legalMoves(p, pieces)) {
    const cap = foes.some((f) => same(f.at, to)) ? 10 : 0;
    const dist = Math.min(...foes.map((f) => Math.abs(f.at.x - to.x) + Math.abs(f.at.y - to.y) + Math.abs(f.at.f - to.f)));
    const score = cap - dist * 0.3 + rnd();
    if (!best || score > best.score) best = { id: p.id, to, score };
  }
  return best ? `${best.id} を ${sqName(best.to)} へ` : 'そのまま';
}
