// idlecrash — the infinite loop on the retro-grid pages.
//
// 22 Famiポート (virtual cartridges: skeleton 19 + skin) run two games at once on the
// 16 × 16 retro grid: SIDE MENU (candies thrown into the ABCD circle) and POP UP (an idle
// crash multiplier chart). An old woman behind the No.9 pillar asks an ABCD question.
// Until she is answered, both panes only mimic: geometric patterns or copies of
// [a,b,c,d]. Idling raises the crash multiplier and erodes both panes; when one pane
// shatters, page A moves to page B (and B back to A), forever.
// Everything here is a simulation: no money, odds or real trades are involved.

import { cipher } from '@/lib/retroBlocks';
import { kitItem } from '@/lib/cureKit';

export type FamiPort = { no: number; title: string; dual?: [string, string]; note?: string; /** Filled in by the implementation where the brief left "~". */ filled?: boolean };

export const FAMI_PORTS: readonly FamiPort[] = [
  { no: 1, title: 'スーパーベイベー物語 〜スクエアスロット〜' },
  { no: 2, title: 'ファミダンスレボリューション', note: '19 体構築：片腕でもいいからシンクロを得る、アクロバットな計測装置' },
  { no: 3, title: '“奇数” ＆ “偶数”', dual: ['奇数', '偶数'], note: '偶数マスは奇数へ滑る（奇数回帰）', filled: true },
  { no: 4, title: 'ファミトーク' },
  { no: 5, title: 'idlecrash', note: 'このループそのもの' },
  { no: 6, title: '愛知牧場', note: '動物行動予測' },
  { no: 7, title: '“I am a Tangent.”', note: '皆が一緒に飛行機に乗るマス', filled: true },
  { no: 8, title: 'aviator', dual: ['リトル', 'ネフェリム'], note: 'ポップアップで Dual パラメーターを初期化' },
  { no: 9, title: 'ファミスカルの柱', note: '柱の陰で老婆が本と虫眼鏡で作業する', filled: true },
  { no: 10, title: 'ストイック', note: '僕の夏休み研究の絵日記' },
  { no: 11, title: '新しい学生服のリーダーズ' },
  { no: 12, title: '髑髏電鉄' },
  { no: 13, title: 'St.', note: 'メッシュの接合点を順に記号へ変換。音楽的思考が Cure 内部パラメーターと連携' },
  { no: 14, title: '巨人無双' },
  { no: 15, title: 'ファミつく', dual: ['軍服パターン', 'セーラー服'], note: 'ほぼサッカー。コートの平面がサイコロで敷き詰められ、音に合わせて 7 マス' },
  { no: 16, title: '“アイロボ”', filled: true },
  { no: 17, title: 'Mente', note: 'リアルコンセプトチャット。Cure 内部のボディメンテナンスに介入' },
  { no: 18, title: '“学園の保健室”', note: 'Mente と保険医の接点', filled: true },
  { no: 19, title: 'クイズクオンタム' },
  { no: 20, title: 'King ＆ Queen', dual: ['King', 'Queen'] },
  { no: 21, title: 'MAP ex（パチスロ版）' },
  { no: 22, title: 'バイク魂 or 海賊戦線（パチスロ版）', dual: ['バイク魂', '海賊戦線'] },
];

export const portByNo = (no: number) => FAMI_PORTS[no - 1];

/** The <idlecrash> design table, with the "~~" blanks filled. */
export const IDLECRASH_TABLE: readonly { key: string; value: string; filled?: boolean }[] = [
  { key: '——', value: '{T-シャツ}（素体・初期コスチューム）' },
  { key: 'コスチューム', value: '[セーラー服, オリンピック体操, コスチューム(++++), 保険医]' },
  { key: 'アイコン（縦スワイプ）', value: '{TikTok or スマホ}', filled: true },
  { key: 'アイドル（センター）', value: 'ABCD の円の中心でキャンディを受ける', filled: true },
  { key: '◻︎', value: '{“I am a Tangent.”}（皆が一緒に飛行機に乗るマス）→ Port 7' },
  { key: '◻︎', value: '{アイロボ} → Port 16' },
  { key: '（学園の保健室）', value: 'Mente（17）と保険医をつなぐ回復マス → Port 18', filled: true },
  { key: 'クラッシュ（×∞）', value: '{idle or crash}：放置で倍率が上がり、ペインが削れる', filled: true },
  { key: 'ループ（ABCD）', value: '{老婆 or 虫眼鏡}：回答するまでペインは模倣だけを出力', filled: true },
];

export type Pane = 'side' | 'popup';
export type Letter = 'A' | 'B' | 'C' | 'D';
export const LETTERS: Letter[] = ['A', 'B', 'C', 'D'];

export type IdleCrashState = {
  tick: number;
  lap: number;
  multiplier: number;
  /** Multiplier history for the POP UP crash chart. */
  history: number[];
  integrity: Record<Pane, number>;
  phase: 'idle' | 'event' | 'shatter';
  /** Port numbers offered as A–D while the old woman waits. */
  options: [number, number, number, number] | null;
  candies: { letter: Letter; tick: number }[];
  /** Ticks since the last answer; the games run while this is small. */
  sinceAnswer: number;
  portA: number;
  portB: number;
  shattered: Pane | null;
  dual: Record<number, 0 | 1>;
};

export const EVENT_EVERY = 10;
const GAME_WINDOW = 12;

export function initIdleCrash(lap = 0): IdleCrashState {
  return {
    tick: 0, lap, multiplier: 1, history: [1], integrity: { side: 1, popup: 1 }, phase: 'idle', options: null,
    candies: [], sinceAnswer: 99, portA: 5, portB: 9, shattered: null, dual: {},
  };
}

function offerPorts(tick: number, lap: number): [number, number, number, number] {
  const picks: number[] = [];
  let i = 0;
  while (picks.length < 4) {
    const no = (cipher(lap, tick, i) % 22) + 1;
    if (!picks.includes(no)) picks.push(no);
    i += 1;
  }
  return picks as [number, number, number, number];
}

/** One strobe tick. */
export function stepIdleCrash(s: IdleCrashState): IdleCrashState {
  if (s.phase === 'shatter') return s;
  const tick = s.tick + 1;
  const waiting = s.phase === 'event';
  const growth = waiting ? 1.06 : 1.035;
  const multiplier = Math.min(99, s.multiplier * growth);
  const wobble = (cipher(s.lap, tick, 7) % 1000) / 1000;
  const erosion = 0.006 * multiplier * (waiting ? 1.5 : 1);
  const integrity = {
    side: Math.max(0, s.integrity.side - erosion * (0.7 + 0.6 * wobble)),
    popup: Math.max(0, s.integrity.popup - erosion * (1.3 - 0.6 * wobble)),
  };
  const broken = integrity.side <= 0 ? 'side' : integrity.popup <= 0 ? 'popup' : null;
  const startEvent = !waiting && tick % EVENT_EVERY === 0;
  return {
    ...s,
    tick,
    multiplier,
    history: [...s.history, multiplier].slice(-48),
    integrity,
    sinceAnswer: s.sinceAnswer + 1,
    phase: broken ? 'shatter' : startEvent ? 'event' : s.phase,
    options: startEvent ? offerPorts(tick, s.lap) : s.options,
    shattered: broken,
  };
}

/** Answer the old woman: throw a candy into the circle at the letter. A/B mend SIDE MENU, C/D mend POP UP. */
export function answerIdleCrash(s: IdleCrashState, letter: Letter): IdleCrashState {
  if (s.phase !== 'event' || !s.options) return s;
  const chosen = s.options[LETTERS.indexOf(letter)];
  const pane: Pane = letter === 'A' || letter === 'B' ? 'side' : 'popup';
  return {
    ...s,
    phase: 'idle',
    options: null,
    multiplier: 1,
    sinceAnswer: 0,
    candies: [...s.candies, { letter, tick: s.tick }].slice(-24),
    integrity: { ...s.integrity, [pane]: Math.min(1, s.integrity[pane] + 0.4) },
    portB: s.portA,
    portA: chosen,
  };
}

/** Re-initialise a dual port's parameters (e.g. aviator: リトル or ネフェリム). */
export function setDual(s: IdleCrashState, no: number, side: 0 | 1): IdleCrashState {
  return { ...s, dual: { ...s.dual, [no]: side }, multiplier: 1, history: [1], integrity: { side: 1, popup: 1 } };
}

export const gamesRunning = (s: IdleCrashState) => s.sinceAnswer < GAME_WINDOW;

/** What a pane cell shows while the old woman is unanswered: geometry or a copy of [a,b,c,d]. */
export function mimicCell(s: IdleCrashState, pane: Pane, cell: number): string {
  const h = cipher(s.lap * 31 + (pane === 'side' ? 1 : 2), cell, s.tick);
  const copyShare = Math.min(0.85, 0.25 + 0.08 * Math.log2(s.multiplier + 1));
  if ((h % 1000) / 1000 < copyShare) return 'abcd'[(cell + s.tick) % 4];
  return '△◇○□╱╲'[(h >>> 10) % 6];
}

const ENGINES = ['SensorySpiceKit', 'GreenCardKit', 'ChoiceForgeKit', 'SugorokuKit'];

/** “スーパーエフェクト”: the leverage-legend sentence, its blanks filled from the live loop. */
export function superEffect(s: IdleCrashState, strobe: number, speed: number) {
  const perSec = Math.max(1, Math.round((1 / Math.max(0.05, strobe)) * Math.max(0.1, speed) * s.multiplier));
  const h = cipher(s.lap, s.tick, 99);
  const origin = kitItem((h % 22) + 1).name;
  const galaxy = kitItem(((h >>> 5) % 22) + 1).name;
  const body = kitItem(((h >>> 10) % 22) + 1).name;
  const region = s.integrity.side < s.integrity.popup ? 'SIDE MENU' : 'POP UP';
  const engine = ENGINES[Math.min(3, Math.floor(Math.log2(s.multiplier + 1)))];
  return `レバレッジ列伝 ——『${portByNo(s.portA).title}』in『${portByNo(s.portB).title}』は、一秒間に ${perSec} 回、一分間に ${perSec * 60} 回の光速取引を行いました。`
    + `この初期衝動は、{${origin}} から {${Math.round(1000 * s.multiplier)}} 光年離れた {${galaxy}} 銀河 {第${(h % 4) + 1}腕} の天体 {${body}} を {${region}} の領域で突破していく {${engine}} なるエンジンを搭載しています。`;
}
