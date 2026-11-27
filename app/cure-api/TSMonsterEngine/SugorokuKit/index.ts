// SugorokuKit — the two-dimensional board game of color emergence on retro-grid A / B.
//
// 22 squares (one per kit item). A six-sided die (the honeycomb 6) moves the token.
// Landing on an even square slips forward to the next odd square: the odd-return rule,
// with the skipped even square as the blank singularity. The 11 odd squares reveal the
// 11 emergence steps of LAB/colorcube in order; passing square 22 starts a new lap with
// a new seed (the polyhedral infinite loop).

export const BOARD_SIZE = 22;
export const DIE_FACES = 6;

export type BoardPage = 'A' | 'B';

/** Kit ids along the path. A starts from the skeleton spine, B from the internal three. */
export function boardOrder(page: BoardPage): number[] {
  const all = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);
  return page === 'A' ? all : [20, 21, 22, ...all.slice(0, 19)];
}

export type SugorokuState = { square: number; lap: number; seed: number; slipFrom: number | null; lastRoll: number | null };

export const START: SugorokuState = { square: 1, lap: 0, seed: 0, slipFrom: null, lastRoll: null };

export function rollDie(rand: () => number = Math.random): number {
  return 1 + Math.floor(rand() * DIE_FACES);
}

/** Squares are 1-based. */
export function advance(state: SugorokuState, roll: number): SugorokuState {
  let square = state.square + roll;
  let slipFrom: number | null = null;
  if (square % 2 === 0) {
    slipFrom = square;
    square += 1;
  }
  let { lap, seed } = state;
  if (square > BOARD_SIZE) {
    square -= BOARD_SIZE;
    lap += 1;
    seed += 1;
    if (square % 2 === 0) { slipFrom = square; square += 1; }
  }
  return { square, lap, seed, slipFrom, lastRoll: roll };
}

/** Emergence step revealed on an odd square: 1 -> 0, 3 -> 1, …, 21 -> 10. */
export function stepForSquare(square: number): number {
  return Math.floor((square - 1) / 2);
}
