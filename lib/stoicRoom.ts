// Cybernetics-API (virtual METADOGG-ORACLE-API): THE STOIC ROOM.
//
// A shelf of 23 cartridges (#0 = the zero Fool, #1–#22 = the 22 arcana). One loop:
//   insert → sugoroku / tarot animation → TASKON (an undetermined bottle drops from the gene
//   vending machine; its position and symbol pool into a future slot) → TAB / synthesis
//   (feed the cat or press TAB; after the data lag the value settles to a natural number in
//   BIP) → TASKOFF (choose one of four theses; the world is patched and the cartridge returns
//   to the shelf as new).
// Every input returns a diary-format log with an 8 × 8 four-level asterisk grid.
// Positions and sequences are fictional symbols: no real registry or genome data.

import { ARCANA_ATTRACTORS } from '@/lib/arcanaMatrix';
import { cipher } from '@/lib/retroBlocks';

export const CARTRIDGES = [
  { no: 0, name: '0 の愚者（ゼロ）' },
  ...ARCANA_ATTRACTORS.map((a) => ({ no: a.id + 1, name: `${a.roman} ${a.name}` })),
];

/** Four asterisk levels, low to high. */
export const LEVELS = [' ', '·', '*', '✱'] as const;

export type Phase = 'shelf' | 'spin' | 'taskon' | 'lag' | 'taskoff';

export type Bottle = {
  /** Future slot the bottle pools into (the data lag, in slots). */
  slot: number;
  lag: number;
  // Revealed at TAB:
  estate?: string; gene?: string; space?: string; amino?: string;
};

export type RoomState = {
  phase: Phase;
  cartridge: number | null;
  frame: number;
  slotNow: number;
  bottle: Bottle | null;
  /** Synthetic price when the bottle dropped, and when it settled. */
  priceAtDrop?: number;
  bip?: number;
  kundalini: number;
  loops: number;
  diary: string[];
};

export const initRoom = (): RoomState => ({ phase: 'shelf', cartridge: null, frame: 0, slotNow: 0, bottle: null, kundalini: 0, loops: 0, diary: [] });

const AMINO = 'ACDEFGHIKLMNPQRSTVWY';
const CHAKRA = ['ムーラダーラ', 'スワディシュターナ', 'マニプーラ', 'アナーハタ', 'ヴィシュッダ', 'アージュニャー', 'サハスラーラ'];

export function thesesFor(cartridge: number) {
  const name = CARTRIDGES[cartridge].name;
  return [
    { key: 'A', text: `位置が意味を決める —— ${name}の登記座標が先にある` },
    { key: 'B', text: '記号が位置を決める —— 配列（部位）が座標を呼び寄せる' },
    { key: 'C', text: '遅れそのものが価値である —— データラグは利子である' },
    { key: 'D', text: '価値は新品に戻る —— 精算のたびに世界はリセットされる' },
  ] as const;
}

/** 8 × 8 four-level grid compositing a sugoroku piece, a tarot card and the vending machine. */
export function aaGrid(cartridge: number, frame: number, phase: Phase): string {
  const rows: string[] = [];
  for (let y = 0; y < 8; y += 1) {
    let row = '';
    for (let x = 0; x < 8; x += 1) {
      // Sugoroku piece: a diamond that hops one cell per frame.
      const cx = 1.5 + (frame % 5); const piece = Math.abs(x - cx) + Math.abs(y - 3.5) <= 1.6 ? 3 : 0;
      // Tarot card: a frame whose inner pattern shuffles with the cartridge and frame.
      const card = (x === 0 || x === 7 || y === 0 || y === 7) ? 1 : (cipher(cartridge, x * 8 + y, frame) % 4 === 0 ? 2 : 0);
      // Vending machine: a slot on row 5 and a bottle falling after TASKON.
      const slot = y === 5 && x >= 2 && x <= 5 ? 1 : 0;
      const bottle = (phase === 'taskon' || phase === 'lag') && x === 4 && y === Math.min(6, 1 + (frame % 6)) ? 3 : 0;
      const level = phase === 'spin' ? Math.max(piece, card) : Math.max(card, slot, bottle, phase === 'shelf' ? 0 : piece >> 1);
      row += LEVELS[level];
    }
    rows.push(row.split('').join(' '));
  }
  return rows.join('\n');
}

function log(s: RoomState, body: { tab1: string; tab2: string; select: string; note: string }) {
  const c = s.cartridge ?? 0;
  const entry = [
    '---',
    '【仮想METADOGG-ORACLE-API 応答ログ】',
    `[ACTIVE CARTRIDGE: #${c} ${CARTRIDGES[c].name}]`,
    aaGrid(c, s.frame, s.phase),
    `[TAB-1: ポジション(不動産/遺伝子)] ${body.tab1} / [TAB-2: シンボル(部位)] ${body.tab2}`,
    `[SELECT (A/B/C/D)] ── ${body.select}`,
    `(${body.note})`,
    '---',
  ].join('\n');
  return { ...s, diary: [entry, ...s.diary].slice(0, 20) };
}

const theseLine = (c: number) => thesesFor(c).map((t) => `${t.key}: ${t.text}`).join(' / ');

export function insert(s: RoomState, cartridge: number): RoomState {
  if (s.phase !== 'shelf') return s;
  const next: RoomState = { ...s, phase: 'spin', cartridge, frame: 0 };
  return log(next, { tab1: '未確定', tab2: '未確定', select: '（まだ選べない）', note: `カセット #${cartridge} を差し込んだ。新品の名前と初期状態。双六の駒とタロットが高速で回る` });
}

export function tick(s: RoomState): RoomState { return { ...s, frame: s.frame + 1, slotNow: s.slotNow + 1 }; }

/** TASKON: the undetermined bottle drops; it pools into a slot a few steps ahead. */
export function taskOn(s: RoomState, price: number): RoomState {
  if (s.phase !== 'spin' || s.cartridge === null) return s;
  const lag = 2 + (cipher(s.cartridge, s.loops, 1) % 4);
  const next: RoomState = { ...s, phase: 'taskon', bottle: { slot: s.slotNow + lag, lag }, priceAtDrop: price };
  return log(next, { tab1: `?? → スロット ${s.slotNow + lag} にプール`, tab2: '??', select: '（TAB または愛猫への給餌で合成）', note: `TASKON：未確定ボトルが排出された。データラグ ${lag} スロット。投入時の合成価格 ${price.toFixed(5)}` });
}

/** TAB / feed the cat: the synthetic data is issued; position and symbol are revealed. */
export function synthesize(s: RoomState): RoomState {
  if (s.phase !== 'taskon' || !s.bottle || s.cartridge === null) return s;
  const h = cipher(s.cartridge, s.loops, s.bottle.slot);
  const bottle: Bottle = {
    ...s.bottle,
    estate: `地番 ${(h % 900) + 100}-${(h >>> 10) % 50}`,
    gene: `chr${((h >>> 4) % 22) + 1}:${(h >>> 8) % 1_000_000}`,
    space: `占有 ${((h >>> 12) % 89) + 1} ㎡`,
    amino: Array.from({ length: 8 }, (_, i) => AMINO[cipher(h, i, 7) % AMINO.length]).join(''),
  };
  const next: RoomState = { ...s, phase: 'lag', bottle };
  return log(next, { tab1: `${bottle.estate} / ${bottle.gene}`, tab2: `${bottle.space} / ${bottle.amino}`, select: '（ラグの精算を待つ）', note: `合成データ発行。評価はスロット ${bottle.slot} で確定する（いま ${s.slotNow}）` });
}

/** When the lag has elapsed, the value settles to a natural number in BIP. */
export function settle(s: RoomState, price: number): RoomState {
  if (s.phase !== 'lag' || !s.bottle || s.slotNow < s.bottle.slot || s.priceAtDrop === undefined) return s;
  const change = price / s.priceAtDrop - 1;
  const bip = Math.max(1, Math.round(price * 10_000 * (1 + change * s.bottle.lag)));
  const next: RoomState = { ...s, phase: 'taskoff', bip };
  return log(next, { tab1: `${s.bottle.estate} / ${s.bottle.gene}`, tab2: `${s.bottle.space} / ${s.bottle.amino}`, select: theseLine(s.cartridge ?? 0), note: `精算：${bip} BIP（合成価格 ${s.priceAtDrop.toFixed(5)} → ${price.toFixed(5)}、変化 ${(change * 100).toFixed(3)}% × ラグ ${s.bottle.lag}）。四択の論文を選べ` });
}

/** TASKOFF: a thesis is chosen; the world is patched and the cartridge goes back to the shelf as new. */
export function taskOff(s: RoomState, key: 'A' | 'B' | 'C' | 'D'): RoomState {
  if (s.phase !== 'taskoff' || s.cartridge === null) return s;
  const shift = ({ A: 1, B: 1, C: s.bip && s.bip > 400 ? 2 : -1, D: 0 } as const)[key];
  const kundalini = Math.max(0, Math.min(6, s.kundalini + shift));
  const thesis = thesesFor(s.cartridge).find((t) => t.key === key)!;
  const patched = log({ ...s, phase: 'shelf', kundalini }, {
    tab1: '（リセット）', tab2: '（リセット）', select: `${key}: ${thesis.text}`,
    note: `TASKOFF：世界はパッチされた。カセット #${s.cartridge} は新品として棚へ戻る。クンダリーニ ${shift >= 0 ? '↑' : '↓'} 第 ${kundalini + 1} チャクラ（${CHAKRA[kundalini]}）`,
  });
  return { ...patched, cartridge: null, bottle: null, bip: undefined, priceAtDrop: undefined, loops: s.loops + 1 };
}

export const chakraName = (k: number) => CHAKRA[k];
