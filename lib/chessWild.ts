// "Bold mode" for the chalk-room chess games: a faster, modern game where devices misbehave.
// Everything here is a GAME METAPHOR. The words (spoofing, a hijacked session, crosstalk, a hijacked
// camera, a hash mismatch) name in-game events only; nothing teaches a real technique.
// Two temptations are built in, each with its real-world consequence shown on screen:
//   • tampering with the news → its fingerprint no longer matches; the audit catches it;
//   • moving on news that is not yet public (insider-like) → the chain's timestamp shows the move came
//     first; the audit flags it and the piece is held for questioning. In real markets, trading on
//     material non-public information is insider trading, which is illegal.
// Without a device, a move goes through the XR brain interface: free movement (any square), at the
// price of noise, which makes faults more likely.
import { keccak256 } from '@/lib/meshMetaV2';
import { FILES, FLOORS, SIZE, legalMoves, same, type Color, type Move, type Piece, type Sq } from '@/lib/promptChess';

export const BRAIN_RULE = '決まり：駒の動きは、XRデバイスかメタ視点からのブレインインターフェースによってあなたの好きな様に動かすことが可能になりました(サンクチュアリ構想に関する要求)';

/** How likely a device fault is this turn: rises with the turn number and the brain interface's noise. */
export const faultChance = (turn: number, noise: number) => Math.min(0.7, 0.08 + turn * 0.07 + noise * 0.05);

/** Free move for the brain interface: any of your pieces to any empty square (no capturing by thought). */
export function parseFree(prompt: string, color: Color, pieces: Piece[], blocked: (s: Sq) => boolean): { move: Move; why: string } {
  const t = prompt.normalize('NFKC').toLowerCase(); const prefix = color === 'white' ? 'w' : 'b';
  const idm = t.match(new RegExp(`\\b${prefix}([1-9])\\b`));
  const rest = idm ? t.replace(idm[0], ' ') : t;
  const sq = rest.match(/\b([a-e])\s*([1-5])(?:\s*(?:@|階|f|floor|\s)\s*([1-3]))?/);
  const piece = idm ? pieces.find((p) => p.alive && p.id === `${prefix.toUpperCase()}${idm[1]}`) : null;
  if (!piece || !sq) return { move: null, why: '🧠 どの駒をどこへ、が読めない — 駐車のまま' };
  const to: Sq = { x: FILES.indexOf(sq[1]), y: Number(sq[2]) - 1, f: sq[3] ? Number(sq[3]) - 1 : piece.at.f };
  if (blocked(to)) return { move: null, why: '🧠 蜃気楼の部屋には、考えだけでも入れない — 駐車のまま' };
  if (pieces.some((p) => p.alive && same(p.at, to))) return { move: null, why: '🧠 誰かのいる区画には、考えだけでは降りられない — 駐車のまま' };
  return { move: { id: piece.id, to }, why: `🧠 ${piece.id} → ${FILES[to.x]}${to.y + 1}@${to.f + 1}F（自由な移動）` };
}

/** Brain-interface noise: the landing drifts to a neighbouring empty square. */
export function drift(m: NonNullable<Move>, pieces: Piece[], blocked: (s: Sq) => boolean, rnd: () => number): NonNullable<Move> {
  const opts: Sq[] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const s = { x: m.to.x + dx, y: m.to.y + dy, f: m.to.f };
    if (s.x < 0 || s.y < 0 || s.x >= SIZE || s.y >= SIZE || s.f >= FLOORS || blocked(s) || pieces.some((p) => p.alive && same(p.at, s))) continue;
    opts.push(s);
  }
  return opts.length ? { id: m.id, to: opts[Math.floor(rnd() * opts.length)] } : m;
}

/** A random legal knight move of one of your pieces (what a hijacked session would send). */
export function randomMove(color: Color, pieces: Piece[], blocked: (s: Sq) => boolean, rnd: () => number): Move {
  const opts = pieces.filter((p) => p.alive && p.color === color).flatMap((p) => legalMoves(p, pieces).filter((s) => !blocked(s)).map((to) => ({ id: p.id, to })));
  return opts.length ? opts[Math.floor(rnd() * opts.length)] : null;
}

/** A foe piece that can legally reach the square (for crosstalk: the foe heard your prompt). */
export function interceptor(color: Color, target: Sq, pieces: Piece[]): Move {
  for (const p of pieces.filter((q) => q.alive && q.color === color)) if (legalMoves(p, pieces).some((s) => same(s, target))) return { id: p.id, to: target };
  return null;
}

const enc = new TextEncoder();
/** The news's fingerprint (4 hex of keccak-256): tampering changes it. */
export const newsPrint = (x: unknown) => Array.from(keccak256(enc.encode(JSON.stringify(x))).slice(0, 2), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();

/** Drone fault (GPS spoofing, a game metaphor): the landing slips to the same bay one floor up or down, if empty. */
export function floorSlip(m: NonNullable<Move>, pieces: Piece[], blocked: (s: Sq) => boolean, rnd: () => number): NonNullable<Move> {
  const opts = [m.to.f - 1, m.to.f + 1].filter((f) => f >= 0 && f < FLOORS).map((f) => ({ ...m.to, f })).filter((s) => !blocked(s) && !pieces.some((p) => p.alive && same(p.at, s)));
  return opts.length ? { id: m.id, to: opts[Math.floor(rnd() * opts.length)] } : m;
}
