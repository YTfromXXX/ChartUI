// Synthetic symbols for the chalk-room chess games: an endless, seeded stream of fictional tickers.
// Each has a small made-up price series, one plain technical signal (short average vs long average),
// a theme that matches one of the teams, and the filter it speaks to. Dropping one on a piece or a
// team nudges the game a little; it never sets a price and it is not advice. Everything is synthetic.
import type { Filter } from '@/lib/chessGame3';

export type Theme = 'ホテル' | '港' | '準備の金庫' | '温室' | '動画' | '鉄道' | '住まい' | 'ミーム';
export type Signal = '上向きの交差' | '下向きの交差' | '横ばい';
export type Sym = { i: number; ticker: string; name: string; theme: Theme; filter: Filter; series: number[]; signal: Signal; team: 'white' | 'black' | 'both' };

const THEMES: { theme: Theme; filter: Filter; team: Sym['team']; names: string[] }[] = [
  { theme: 'ホテル', filter: '事実', team: 'both', names: ['マリーナ・ホテルズ', 'ノーチェ・ステイ', 'カプリ・リゾーツ', 'ファロ・イン', 'ラス・オラス館', 'アルバ・スイーツ'] },
  { theme: '港', filter: '事実', team: 'white', names: ['港湾倉庫信託', 'ドック・ワークス', '旧桟橋開発', 'ブイ・ロジスティクス'] },
  { theme: '準備の金庫', filter: '感情', team: 'both', names: ['長期準備ホールディング', '静かな金庫', '二十年館'] },
  { theme: '温室', filter: '感情', team: 'black', names: ['六角温室', 'ハンモック住宅', '庭師組合', '島の畑'] },
  { theme: '動画', filter: '噂', team: 'both', names: ['朝食チャンネル', '短尺スタジオ', '再生回数研究所'] },
  { theme: '鉄道', filter: '噂', team: 'white', names: ['始発鉄道', '工場駅前', '三駅ぶんの空席'] },
  // Game 4: fictional meme coins (original names only; no real coin's name or mascot)
  { theme: 'ミーム', filter: '噂', team: 'both', names: ['くしゃみ猫コイン', 'まばたき金魚コイン', 'PE 群コイン', 'ドン・ぱコイン', '四つ打ちコイン', 'ブレイクコイン'] },
  // Sanctuary × SNS: composite signals of "are people still living there?" (aggregate, fictional, never one person)
  { theme: '住まい', filter: '感情', team: 'black', names: ['定住指数', '庭の手入れ指数', '窓の灯り指数', '近所の返信率', '朝と夜の投稿の幅', '同じ景色の写真の数'] },
];

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** The i-th synthetic symbol (stable for the same i). `prefer` biases the theme for a game (e.g. hotels in game 1). */
export function symbolAt(i: number, prefer?: Theme): Sym {
  // i ≥ 100000 is reserved for symbols born from posts (see symbolFromPost); they rebuild from the same seed.
  const r = rng(1000 + i * 7919);
  const pool = prefer && r() < 0.5 ? THEMES.filter((t) => t.theme === prefer) : THEMES;
  const th = pool[Math.floor(r() * pool.length)];
  const name = th.names[Math.floor(r() * th.names.length)];
  const letters = 'ABCDEFGHKLMNPRSTVWXZ';
  const ticker = Array.from({ length: 4 }, () => letters[Math.floor(r() * letters.length)]).join('');
  const series: number[] = []; let v = 100; const drift = (r() - 0.5) * 0.8;
  for (let k = 0; k < 30; k += 1) { v = Math.max(20, v + drift + (r() - 0.5) * 4); series.push(Number(v.toFixed(2))); }
  const short = avg(series.slice(-5)); const long = avg(series.slice(-20));
  const signal: Signal = short > long * 1.01 ? '上向きの交差' : short < long * 0.99 ? '下向きの交差' : '横ばい';
  return { i, ticker, name: `${name}（合成）`, theme: th.theme, filter: th.filter, series, signal, team: th.team };
}

/** Sparkline path for a series in a w × h box. */
export function sparkPath(series: number[], w = 80, h = 22) {
  const lo = Math.min(...series); const hi = Math.max(...series); const span = hi - lo || 1;
  return series.map((v, k) => `${k ? 'L' : 'M'}${((k / (series.length - 1)) * w).toFixed(1)} ${(h - ((v - lo) / span) * h).toFixed(1)}`).join('');
}

/** A symbol born from one SNS post (stable per handle): the post's kind becomes its filter. Fictional. */
export function symbolFromPost(handle: string, kind: Filter, theme: Theme): Sym {
  let h = 2166136261; for (const ch of handle) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  const base = symbolAt(100000 + (h % 50000), theme);
  return { ...base, i: 100000 + (h % 50000), name: `${handle} の声（合成）`, theme, filter: kind, team: 'both' };
}
