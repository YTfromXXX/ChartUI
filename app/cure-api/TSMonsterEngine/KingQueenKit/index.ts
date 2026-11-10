// KingQueenKit — the entry layer of KING & QUEEN (tarot sevens + slot device).
//
// A. Central "7" hub = (arcana slot, {symbol} slot, SELECT slot). The arcana and symbol slots
//    turn with every lap of the infinite loop; the SELECT slot is the player's own card.
// B. Wildcards depend on Cure-API's sensory device (SensorySpiceKit texture).
// Lever-on: one simulated slot game. 3 reels × 20 stops; the witch's prophecy cut-in is
// 1/2048, or 1/343 (7³) with 5+ cards on the devil carpet. Simulation only: no medals,
// money or odds are involved.

import { cipher } from '@/lib/retroBlocks';
import type { Texture } from '../SensorySpiceKit';

export const HUB_ARCANA = [
  { id: 7, name: '戦車', role: '空間の絶対座標（全スートの交差点）' },
  { id: 10, name: '運命の輪', role: '次元の極性（反転・ループ）を管理するバッファ' },
  { id: 16, name: '塔', role: 'デッドロック時に手札を再配布する崩壊と再生（1+6=7）' },
] as const;

export const SUITS = ['ワンド', 'カップ', 'ソード', 'ペンタクル'] as const;
export type Suit = (typeof SUITS)[number];

export type Hub = { arcana: (typeof HUB_ARCANA)[number]; symbol: Suit; select: string };

/** Hub for a lap: arcana and symbol slots rotate (3 and 4 are coprime → 12-lap cycle). */
export function hubForLap(lap: number, select: string): Hub {
  return { arcana: HUB_ARCANA[lap % 3], symbol: SUITS[lap % 4], select };
}

export type Wildcard = { card: string; rule: string };

/** B. The sensory device decides which wildcards are live. */
export function wildcardsFor(texture: Texture): Wildcard[] {
  const fool = { card: '愚者（0 · ヌル）', rule: '1 か 14 の隣にスート無視で置ける。その列は奇数のみ／偶数のみに固定' };
  const world = { card: '世界（XXI · Ω）', rule: '全 4 スートで 14 と 1 がつながり、盤面がトーラスになる' };
  const wheel = { card: '運命の輪（φ）', rule: 'その列の ±1 がフィボナッチ・ジャンプに変わる（詳細はパチスロ版で）' };
  switch (texture) {
    case 'steady': return [world];
    case 'edged': return [fool];
    case 'breathing': return [wheel];
    default: return [fool, world];
  }
}

export const REEL_SYMBOLS = ['VII戦車', 'XVI塔', 'KING', 'QUEEN', 'ワンド', 'カップ', 'ソード', 'ペンタクル'] as const;
export type ReelSymbol = (typeof REEL_SYMBOLS)[number];

/** 20 stops per reel, built deterministically per reel. */
export const REELS: ReelSymbol[][] = [0, 1, 2].map((r) => Array.from({ length: 20 }, (_, i) => REEL_SYMBOLS[cipher(77, r, i) % REEL_SYMBOLS.length]));

export type KQEvent = { kind: 'prophecy' | 'devil-war' | 'coronation' | 'tower'; title: string; body: string };

export type LeverResult = { game: number; stops: [number, number, number]; symbols: [ReelSymbol, ReelSymbol, ReelSymbol]; events: KQEvent[] };

export function leverOn(game: number, carpet: number, seed = 0): LeverResult {
  const stops = [0, 1, 2].map((r) => cipher(seed, game, r) % 20) as [number, number, number];
  const symbols = stops.map((s, r) => REELS[r][s]) as [ReelSymbol, ReelSymbol, ReelSymbol];
  const events: KQEvent[] = [];
  const odds = carpet >= 5 ? 343 : 2048;
  if (cipher(seed, game, 99) % odds === 0) {
    events.push({ kind: 'prophecy', title: '魔女の予言カットイン', body: `確率 1/${odds}${carpet >= 5 ? '（デビル・カーペット 5 枚以上・7³）' : ''} · 左上段 戦車 → 中下段 塔 → 右中段へ KING／QUEEN が滑り込む` });
  }
  if (symbols[2] === 'KING') events.push({ kind: 'devil-war', title: 'デビル戦争', body: '第 3 リールに KING が停止。リール窓が暗転し、王位簒奪のループへ' });
  if (symbols[2] === 'QUEEN') events.push({ kind: 'coronation', title: 'クイーン即位', body: '第 3 リールに QUEEN が停止。失楽園ループの扉が開く' });
  if (symbols[0] === 'VII戦車' && symbols[1] === 'XVI塔') events.push({ kind: 'tower', title: '7 マスの結界', body: '戦車と塔が揃い、V 字の結界が形成された' });
  return { game, stops, symbols, events };
}
