// 骸骨電鉄 — a monochrome skull-world super mini game (Fami port 12).
//
// A fable about philosophy against money, played on a 22-station loop (one station per
// Cure kit item). Properties are bought with 骨貨 (bone coins, fictional; no real money).
//   · XIII 死神 = human resource: a property turns over, and its staff come back as 人材.
//   · XV 悪魔 = the devil who rides with a player and is settled mathematically by dice:
//     two dice summing to 7 (the hub of the sevens) pass him on; otherwise he takes
//     (sum × Fibonacci(min(9, turns ridden + 3))) bone coins. A 6 calls a swarm of cats
//     (animal resource) that halves the demand.
//   · X 運命の輪 = the galaxy super effect: every price is multiplied by φ or 1/φ.
// Five years (laps of the player) and the game ends; money and philosophy are judged apart.

import { CURE_KIT } from '@/lib/cureKit';
import { mulberry32 } from '@/lib/retroGrid';

export const PHI = (1 + Math.sqrt(5)) / 2;
export const STATIONS_N = 22;
export const YEARS = 5;

export type StationKind = 'start' | 'property' | 'death' | 'devil' | 'wheel';
export type Station = { id: number; kitId: number; name: string; kind: StationKind; basePrice: number };

const fib = (n: number) => { let a = 0; let b = 1; for (let i = 0; i < n; i += 1) [a, b] = [b, a + b]; return a; };
const SUFFIX = ['工房', '書庫', '温室', '劇場', '観測所', '診療所'];

export const STATIONS: readonly Station[] = Array.from({ length: STATIONS_N }, (_, id) => {
  const kit = CURE_KIT[id];
  const kind: StationKind = id === 0 ? 'start' : id === 10 ? 'wheel' : id === 13 ? 'death' : id === 15 ? 'devil' : 'property';
  const name = kind === 'start' ? `${kit.name}駅（始発）` : kind === 'wheel' ? 'X 運命の輪' : kind === 'death' ? 'XIII 死神' : kind === 'devil' ? 'XV 悪魔' : `${kit.name}の${SUFFIX[id % SUFFIX.length]}`;
  return { id, kitId: kit.id, name, kind, basePrice: kind === 'property' ? 10 * fib((id % 7) + 4) : 0 };
});

export type PlayerId = 'you' | 'obaa';
export type Player = { id: PlayerId; name: string; pos: number; money: number; hr: number; philo: number; laps: number };

export type Panel = { title: string; text: string; sfx: string; who?: PlayerId };
export type Effect = { kind: 'dolly' | 'galaxy' | 'cats' | 'devil'; at: number; station: number; cats?: number } | null;

export type GameState = {
  seed: number;
  rngCalls: number;
  turn: number;
  current: PlayerId;
  players: Record<PlayerId, Player>;
  owner: (PlayerId | null)[];
  priceMul: number;
  devil: { rider: PlayerId | null; turns: number };
  phase: 'roll' | 'buy' | 'devil' | 'over';
  dice: number[];
  log: Panel[];
  effect: Effect;
};

export function newGame(seed = 1): GameState {
  return {
    seed, rngCalls: 0, turn: 0, current: 'you',
    players: {
      you: { id: 'you', name: 'あなた（哲学派）', pos: 0, money: 500, hr: 0, philo: 0, laps: 0 },
      obaa: { id: 'obaa', name: '老婆（貨幣派）', pos: 0, money: 500, hr: 0, philo: 0, laps: 0 },
    },
    owner: Array(STATIONS_N).fill(null),
    priceMul: 1,
    devil: { rider: null, turns: 0 },
    phase: 'roll', dice: [], log: [{ title: '発車', text: '骸骨電鉄、始発の背骨駅を出る。哲学と貨幣、どちらが 5 年を制するか', sfx: 'ガタン' }], effect: null,
  };
}

/** Deterministic dice: the n-th roll of a game depends only on its seed. */
function d6(s: GameState) {
  const rand = mulberry32(s.seed * 7919 + s.rngCalls);
  s.rngCalls += 1;
  return 1 + Math.floor(rand() * 6);
}

export const priceOf = (s: GameState, id: number) => Math.round(STATIONS[id].basePrice * s.priceMul);
export const yieldOf = (s: GameState, id: number, hr: number) => Math.round(priceOf(s, id) * 0.1 * (1 + 0.1 * hr));
export const other = (p: PlayerId): PlayerId => (p === 'you' ? 'obaa' : 'you');
export const assets = (s: GameState, p: PlayerId) => s.players[p].money + s.owner.reduce((sum, o, id) => sum + (o === p ? priceOf(s, id) : 0), 0);
export const philosophy = (s: GameState, p: PlayerId) => s.players[p].philo * 50 + s.players[p].hr * 30;

const clone = (s: GameState): GameState => ({ ...s, players: { you: { ...s.players.you }, obaa: { ...s.players.obaa } }, owner: [...s.owner], devil: { ...s.devil }, log: [...s.log], dice: [...s.dice] });
const say = (s: GameState, panel: Panel) => { s.log = [panel, ...s.log].slice(0, 30); };

/** Sell the cheapest properties back at half price until the player is solvent. */
function liquidate(s: GameState, p: PlayerId) {
  while (s.players[p].money < 0) {
    const mine = s.owner.map((o, id) => (o === p ? id : -1)).filter((id) => id >= 0).sort((a, b) => priceOf(s, a) - priceOf(s, b));
    if (!mine.length) break;
    const id = mine[0];
    s.owner[id] = null;
    s.players[p].money += Math.round(priceOf(s, id) / 2);
    say(s, { title: '手放す', text: `${s.players[p].name}は${STATIONS[id].name}を半値で手放した`, sfx: 'ガラッ', who: p });
  }
}

function endTurn(s: GameState) {
  s.turn += 1;
  if (s.players.you.laps >= YEARS) { s.phase = 'over'; say(s, { title: '終着', text: judge(s), sfx: 'キィィ' }); return; }
  s.current = other(s.current);
  s.phase = s.devil.rider === s.current ? 'devil' : 'roll';
}

function land(s: GameState, now: number) {
  const p = s.current; const player = s.players[p]; const st = STATIONS[player.pos];
  switch (st.kind) {
    case 'property': {
      const owner = s.owner[st.id];
      if (owner === null) { s.phase = 'buy'; return; }
      if (owner !== p) {
        const toll = yieldOf(s, st.id, s.players[owner].hr) * 2;
        player.money -= toll; s.players[owner].money += toll;
        say(s, { title: '通行料', text: `${player.name}は${st.name}で ${toll} 骨貨を払った`, sfx: 'チャリン', who: p });
        liquidate(s, p);
      }
      break;
    }
    case 'death': {
      // Human resource: a property turns over; its people return as 人材.
      const mine = s.owner.map((o, id) => (o === p ? id : -1)).filter((id) => id >= 0).sort((a, b) => priceOf(s, a) - priceOf(s, b));
      if (mine.length) {
        const id = mine[0]; s.owner[id] = null; player.money += Math.round(priceOf(s, id) / 2);
        say(s, { title: 'XIII 死神', text: `${st.name}：${STATIONS[id].name}は代替わりした。人材 +1、知 +2`, sfx: 'スッ', who: p });
      } else {
        say(s, { title: 'XIII 死神', text: '失うものはない。人材 +1、知 +2', sfx: 'スッ', who: p });
      }
      player.hr += 1; player.philo += 2;
      break;
    }
    case 'devil':
      s.devil = { rider: p, turns: 0 };
      s.effect = { kind: 'devil', at: now, station: st.id };
      say(s, { title: 'XV 悪魔', text: `悪魔が${player.name}の列車に乗り込んだ。次の手番からサイコロで清算する`, sfx: 'ゴゴゴ', who: p });
      break;
    case 'wheel': {
      const spin = d6(s);
      s.priceMul = Number((spin % 2 === 0 ? s.priceMul * PHI : s.priceMul / PHI).toFixed(4));
      s.effect = { kind: 'galaxy', at: now, station: st.id };
      say(s, { title: 'X 運命の輪', text: `銀河が回る（${spin}）。すべての物件が ×${spin % 2 === 0 ? 'φ' : '1/φ'}（現在 ×${s.priceMul.toFixed(2)}）`, sfx: 'キラキラ', who: p });
      break;
    }
    default:
      break;
  }
  endTurn(s);
}

/** Roll and move the current player. */
export function roll(prev: GameState, now = 0): GameState {
  if (prev.phase !== 'roll') return prev;
  const s = clone(prev);
  const die = d6(s); s.dice = [die];
  const p = s.players[s.current];
  const next = p.pos + die;
  if (next >= STATIONS_N) {
    p.laps += 1;
    const income = s.owner.reduce((sum, o, id) => sum + (o === p.id ? yieldOf(s, id, p.hr) : 0), 0);
    p.money += income + 100;
    say(s, { title: `${p.laps} 年目の決算`, text: `${p.name}：給料 100 ＋ 物件収益 ${income} 骨貨`, sfx: 'ドン', who: p.id });
  }
  p.pos = next % STATIONS_N;
  s.effect = { kind: 'dolly', at: now, station: p.pos };
  land(s, now);
  return s;
}

/** Buy (or decline) the property under the current player. Declining is worth 知 +1. */
export function decide(prev: GameState, buy: boolean): GameState {
  if (prev.phase !== 'buy') return prev;
  const s = clone(prev);
  const p = s.players[s.current]; const st = STATIONS[p.pos]; const price = priceOf(s, st.id);
  if (buy && p.money >= price) {
    p.money -= price; s.owner[st.id] = p.id;
    say(s, { title: '物件取得', text: `${p.name}は${st.name}を ${price} 骨貨で買った`, sfx: 'カチッ', who: p.id });
  } else {
    p.philo += 1;
    say(s, { title: '見送り', text: `${p.name}は${st.name}を買わなかった。知 +1`, sfx: '……', who: p.id });
  }
  endTurn(s);
  return s;
}

/** The devil's dice: 7 passes him on; otherwise pay sum × Fib(turns + 3); a 6 brings the cats. */
export function settleDevil(prev: GameState, now = 0): GameState {
  if (prev.phase !== 'devil') return prev;
  const s = clone(prev);
  const p = s.players[s.current];
  const a = d6(s); const b = d6(s); s.dice = [a, b];
  const sum = a + b;
  if (sum === 7) {
    s.devil = { rider: other(p.id), turns: 0 };
    p.philo += 1;
    say(s, { title: '7 の清算', text: `${a} + ${b} = 7。悪魔は${s.players[other(p.id)].name}の列車へ移った。知 +1`, sfx: 'バッ', who: p.id });
  } else {
    let demand = sum * fib(Math.min(9, s.devil.turns + 3)); // capped at Fib(9) = 34
    const cats = a === 6 || b === 6;
    if (cats) {
      demand = Math.round(demand / 2);
      s.effect = { kind: 'cats', at: now, station: p.pos, cats: sum * 3 };
    }
    p.money -= demand; s.devil.turns += 1;
    say(s, { title: cats ? '猫の大群' : '悪魔の取り立て', text: `${a} + ${b} = ${sum} → ${sum} × Fib(${Math.min(9, s.devil.turns + 2)}) ${cats ? '÷ 2（猫が追い払った）' : ''}＝ ${demand} 骨貨`, sfx: cats ? 'ニャーーー' : 'ギギギ', who: p.id });
    liquidate(s, p.id);
  }
  s.phase = 'roll';
  return s;
}

/** CPU (老婆, money faction): buys when it can keep 1.5 × the price. */
export function cpuStep(s: GameState, now = 0): GameState {
  if (s.phase === 'devil') return settleDevil(s, now);
  if (s.phase === 'roll') return roll(s, now);
  if (s.phase === 'buy') return decide(s, s.players[s.current].money >= priceOf(s, s.players[s.current].pos) * 1.5);
  return s;
}

export function judge(s: GameState) {
  const money = (['you', 'obaa'] as const).map((p) => [p, assets(s, p)] as const).sort((x, y) => y[1] - x[1]);
  const philo = (['you', 'obaa'] as const).map((p) => [p, philosophy(s, p)] as const).sort((x, y) => y[1] - x[1]);
  return `貨幣では${s.players[money[0][0]].name}（${money[0][1]} 骨貨）、哲学では${s.players[philo[0][0]].name}（${philo[0][1]}）が勝った`;
}
