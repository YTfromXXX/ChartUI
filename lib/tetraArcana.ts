// Tetra Arcana — Pythagoras' tarot mahjong (and its Euclid, da Vinci, Einstein, von Neumann and
// Nobunaga variants), as a rules engine with no dependencies.
//
// Deck: 144 cards = 12² = the 12th Fibonacci number. Minor arcana 1–10 × 4 suits × 3 copies (120)
// plus 24 major cards. The text names seven majors (0 I II III IV X XXI); XII is added because the
// "silence" riichi uses II or XII — 8 majors × 3 copies = 24. The deck is split in the golden ratio
// between two wizards: Euclid's 55 deal the hands (4 × 13 = 52, the last 3 are the axiom
// indicators) and Pythagoras' 89 are the draw wall (89 / 55 ≈ 1.618).
//
// Melds replace runs and sets with number laws. Majors (and Einstein's portrait) are rare "laws of
// the cosmos": identical majors make sets, X with 0 is the rebirth pair, and at most two loose majors
// per hand may stand in for missing cards. The Tetractys asks for four 4s of one suit, which three copies cannot give, so here
// the 4s may come from any suit (the four elements meet).

export type Suit = 'W' | 'C' | 'S' | 'P';
export type Card = { id: number; suit: Suit | 'M'; n: number }; // suit 'M' = major, n −1 (portrait) … 21
export const SUITS: Suit[] = ['W', 'C', 'S', 'P'];
export const SUIT_INFO: Record<Suit | 'M', { name: string; mark: string; color: string; element?: string }> = {
  W: { name: 'ワンド', mark: '🜂', color: '#ff6b3d', element: '火' }, C: { name: 'カップ', mark: '🜄', color: '#3dd6ff', element: '水' },
  S: { name: 'ソード', mark: '🜁', color: '#c8d0ff', element: '風' }, P: { name: 'ペンタクル', mark: '🜃', color: '#f5c542', element: '地' },
  M: { name: '大アルカナ', mark: '✶', color: '#e879f9' },
};
const ROMAN = ['0', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI'];
export const cardLabel = (c: Card) => (c.suit === 'M' ? (c.n < 0 ? '肖像' : ROMAN[c.n]) : `${c.n}`);
export const isWild = (c: Card) => c.suit === 'M';
export const isFava = (c: Card) => c.suit === 'P' && c.n === 5;

export type Preset = 'pythagoras' | 'euclid' | 'davinci' | 'einstein' | 'neumann' | 'nobunaga';
export const PRESETS: Record<Preset, { name: string; rules: 'pythagoras' | 'euclid'; note: string }> = {
  pythagoras: { name: 'ピタゴラス', rules: 'pythagoras', note: '数は実体。音の比・偶奇・沈黙・ソラマメの禁忌' },
  euclid: { name: 'ユークリッド', rules: 'euclid', note: '定義と作図。互除法・外中比（1.618）・平行線公準。禁忌も沈黙もない' },
  davinci: { name: 'ダ・ヴィンチ', rules: 'pythagoras', note: '大アルカナは I と VII だけ（各 12 枚）。外中比の面子も使える' },
  einstein: { name: 'アインシュタイン', rules: 'pythagoras', note: '8 に穴（数札の 8 を抜く）。0 の前に肖像（観測者）を 12 枚置く' },
  neumann: { name: 'フォン・ノイマン', rules: 'pythagoras', note: 'CPU が一手先の期待値で捨てる（ゲーム理論）' },
  nobunaga: { name: '織田信長', rules: 'pythagoras', note: '焼き討ち：大アルカナを捨てると、山に残る同じ札がすべて燃える' },
};

/** Small seeded RNG (mulberry32) so the engine has no imports. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function buildDeck(preset: Preset): Card[] {
  const out: Card[] = []; let id = 0;
  const add = (suit: Card['suit'], n: number, copies: number) => { for (let k = 0; k < copies; k += 1) out.push({ id: id++, suit, n }); };
  for (const s of SUITS) for (let n = 1; n <= 10; n += 1) if (!(preset === 'einstein' && n === 8)) add(s, n, 3);
  if (preset === 'davinci') { add('M', 1, 12); add('M', 7, 12); }
  else for (const n of [0, 1, 2, 3, 4, 10, 12, 21]) add('M', n, 3);
  if (preset === 'einstein') add('M', -1, 12); // the portrait placed before 0
  return out; // always 144 cards
}

export function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = [...arr]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a;
}

/** Golden division of labour: Euclid's 55 (hands + 3 axioms) and Pythagoras' 89 (draw wall). */
export function goldenSplit(deck: Card[]) { return { euclid: deck.slice(0, 55), pythagoras: deck.slice(55) }; }

// ---------------------------------------------------------------- melds
export type MeldKind = 'same' | 'triple' | 'harmony' | 'gcd' | 'golden' | 'wild';
export const MELD_NAME: Record<MeldKind, string> = { same: '同数', triple: 'ピュタゴラスの三つ組', harmony: '和音', gcd: '互除法', golden: '外中比', wild: '宇宙の理' };
const RATIOS = [2, 1.5, 4 / 3];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const near = (x: number, y: number) => Math.abs(x - y) < 1e-9;

function templates(rules: 'pythagoras' | 'euclid', golden: boolean): { kind: MeldKind; ns: number[] }[] {
  const t: { kind: MeldKind; ns: number[] }[] = [];
  for (let n = 1; n <= 10; n += 1) t.push({ kind: 'same', ns: [n, n, n] });
  t.push({ kind: 'triple', ns: [3, 4, 5] }, { kind: 'triple', ns: [6, 8, 10] });
  for (let a = 1; a <= 10; a += 1) for (let b = a + 1; b <= 10; b += 1) for (let c = b + 1; c <= 10; c += 1) {
    if (rules === 'pythagoras' && RATIOS.some((r) => near(b / a, r)) && RATIOS.some((r) => near(c / b, r))) t.push({ kind: 'harmony', ns: [a, b, c] });
    // Elements VII.2: the greatest common measure of b and c, when they share one (> 1).
    if (rules === 'euclid' && a > 1 && gcd(c, b) === a) t.push({ kind: 'gcd', ns: [a, b, c] });
  }
  if (rules === 'euclid' || golden) for (const ns of [[1, 2, 3], [2, 3, 5], [3, 5, 8]]) t.push({ kind: 'golden', ns });
  return t;
}
const pairOk = (rules: 'pythagoras' | 'euclid', a: number, b: number) => a === b || (rules === 'pythagoras' && RATIOS.some((r) => near(Math.max(a, b) / Math.min(a, b), r)));

export type Meld = { kind: MeldKind; suit: Suit | 'M'; ns: number[]; wilds: number };
export type Decomp = { melds: Meld[]; pair: { suit: Suit | 'M'; ns: number[]; wilds: number } };

/**
 * All ways to read 14 cards as four melds and one pair. Majors are rare laws of the cosmos: three
 * (or two) identical majors make a meld (or the pair), X with 0 makes the rebirth pair, and at most
 * two loose majors may stand in for missing cards.
 */
/**
 * How many loose majors one hand may use as stand-ins. Simulated 60 CPU games each: all majors wild →
 * every hand won within ~4 draws a player; 1 → 22 % won; 2 → 68 % won and silence was possible in
 * over half the games.
 */
export const MAX_LOOSE_WILDS = 2;

export function decompose(cards: Card[], preset: Preset, limit = 64): Decomp[] {
  const rules = PRESETS[preset].rules; const T = templates(rules, preset === 'davinci');
  const majors = new Map<number, number>(); for (const c of cards) if (isWild(c)) majors.set(c.n, (majors.get(c.n) ?? 0) + 1);
  const cnt = new Map<string, number>(); for (const c of cards) if (!isWild(c)) cnt.set(`${c.suit}${c.n}`, (cnt.get(`${c.suit}${c.n}`) ?? 0) + 1);
  const out: Decomp[] = [];
  const firstKey = () => { for (const s of SUITS) for (let n = 1; n <= 10; n += 1) if ((cnt.get(`${s}${n}`) ?? 0) > 0) return { s, n }; return null; };
  const take = (s: Suit, ns: number[]) => { // use real cards where present, the wild for the rest
    const used: string[] = []; let w = 0;
    for (const n of ns) { const k = `${s}${n}`; if ((cnt.get(k) ?? 0) > 0) { cnt.set(k, cnt.get(k)! - 1); used.push(k); } else w += 1; }
    return { used, w };
  };
  const put = (used: string[]) => { for (const k of used) cnt.set(k, (cnt.get(k) ?? 0) + 1); };
  const rec = (wild: number, melds: Meld[], pair: Decomp['pair'] | null) => {
    if (out.length >= limit) return;
    const f = firstKey();
    if (!f) {
      const need = (4 - melds.length) * 3 + (pair ? 0 : 2);
      if (need === wild) out.push({ melds: [...melds, ...Array.from({ length: 4 - melds.length }, () => ({ kind: 'wild' as MeldKind, suit: 'M' as const, ns: [], wilds: 3 }))], pair: pair ?? { suit: 'M', ns: [], wilds: 2 } });
      return;
    }
    if (melds.length < 4) for (const t of T) {
      if (!t.ns.includes(f.n)) continue;
      const ns = [f.n, ...t.ns.filter((x, i) => i !== t.ns.indexOf(f.n))];
      const { used, w } = take(f.s, ns);
      if (used[0] === `${f.s}${f.n}` && w <= wild) rec(wild - w, [...melds, { kind: t.kind, suit: f.s, ns: t.ns, wilds: w }], pair);
      put(used);
    }
    if (!pair) {
      for (let m = 1; m <= 10; m += 1) if (pairOk(rules, f.n, m)) {
        const { used, w } = take(f.s, [f.n, m]);
        if (used[0] === `${f.s}${f.n}` && w <= wild) rec(wild - w, melds, { suit: f.s, ns: [f.n, m], wilds: w });
        put(used);
      }
    }
  };
  // Place the majors first: sets of three, a pair (identical, or X with 0), and at most two loose wilds.
  const types = [...majors.keys()];
  const place = (i: number, left: Map<number, number>, melds: Meld[], pair: Decomp['pair'] | null) => {
    if (i === types.length) {
      const loose = [...left.values()].reduce((a, b) => a + b, 0);
      // X and 0 as the rebirth pair (tried first, so the reading limit never cuts it off).
      if (!pair && (left.get(10) ?? 0) >= 1 && (left.get(0) ?? 0) >= 1 && loose - 2 <= MAX_LOOSE_WILDS) rec(loose - 2, melds, { suit: 'M', ns: [10, 0], wilds: 0 });
      if (loose <= MAX_LOOSE_WILDS) rec(loose, melds, pair);
      return;
    }
    const n = types[i]; const k = left.get(n) ?? 0;
    const next = (m: Map<number, number>, ms: Meld[], pr: Decomp['pair'] | null) => place(i + 1, m, ms, pr);
    next(left, melds, pair);
    if (k >= 3 && melds.length < 4) { const m = new Map(left); m.set(n, k - 3); next(m, [...melds, { kind: 'same', suit: 'M', ns: [n, n, n], wilds: 0 }], pair); }
    if (k >= 2 && !pair) { const m = new Map(left); m.set(n, k - 2); next(m, melds, { suit: 'M', ns: [n, n], wilds: 0 }); }
  };
  place(0, new Map(majors), [], null);
  return out;
}

/** Tetractys: one 1, two 2s, three 3s of one suit and four 4s from any suit (no wilds). */
export function isTetractys(cards: Card[]) {
  const fours = cards.filter((c) => c.suit !== 'M' && c.n === 4).length;
  return fours >= 4 && SUITS.some((s) => [1, 2, 3].every((n) => cards.filter((c) => c.suit === s && c.n === n).length >= n));
}

export type Yaku = { name: string; han: number; note?: string };
export type Score = { win: boolean; yaku: Yaku[]; han: number; decomp: Decomp | null; ratios: number[] };

export function score(cards: Card[], preset: Preset, opts: { silent?: boolean; favaDiscards?: number; spoke?: boolean } = {}): Score {
  const rules = PRESETS[preset].rules;
  const extra: Yaku[] = [];
  const fava = cards.filter(isFava).length;
  if (rules === 'pythagoras') {
    if (fava) extra.push({ name: 'ソラマメの禁忌（手に残す）', han: -2 * fava });
    if (opts.favaDiscards) extra.push({ name: 'ソラマメの禁忌（捨てた）', han: -1 * opts.favaDiscards });
  }
  if (isTetractys(cards)) {
    const y = [{ name: 'テトラクテュス（役満）', han: 13, note: '1+2+3+4 = 10' }, ...extra];
    return { win: true, yaku: y, han: y.reduce((s, x) => s + x.han, 0), decomp: null, ratios: [1, 2, 3, 4] };
  }
  let best: Score = { win: false, yaku: [], han: 0, decomp: null, ratios: [] };
  for (const d of decompose(cards, preset)) {
    const y: Yaku[] = [{ name: rules === 'pythagoras' ? '調和の完成' : '証明終わり（Q.E.D.）', han: 1 }];
    const kinds = d.melds.map((m) => m.kind);
    const triples = d.melds.filter((m) => m.kind === 'triple');
    if (triples.length) y.push({ name: rules === 'pythagoras' ? 'ピュタゴラスの三つ組' : '原論 I.47（三平方）', han: 2 * triples.length });
    if (triples.some((m) => m.ns[0] === 3) && triples.some((m) => m.ns[0] === 6)) y.push({ name: '3・4・5 と 6・8・10', han: 2 });
    if (rules === 'pythagoras') {
      if (d.pair.suit !== 'M' && d.pair.ns.length === 2 && d.pair.ns[0] !== d.pair.ns[1]) y.push({ name: '協和音程', han: 2, note: `${Math.min(...d.pair.ns)}:${Math.max(...d.pair.ns)}` });
      const nums = cards.map((c) => (c.suit === 'M' ? c.n : c.n));
      if (nums.every((n) => Math.abs(n) % 2 === 1)) y.push({ name: '奇数の二元論（光）', han: 3 });
      else if (nums.every((n) => n % 2 === 0)) y.push({ name: '偶数の二元論（闇）', han: 3 });
      if (cards.some((c) => c.suit === 'M' && c.n === 10) && cards.some((c) => c.suit === 'M' && c.n === 0)) y.push({ name: '輪廻転生（X と 0）', han: 5 });
      if (opts.silent) y.push({ name: '沈黙の行', han: 1 });
      if (kinds.includes('golden')) y.push({ name: '外中比（ダ・ヴィンチ）', han: 2 * kinds.filter((k) => k === 'golden').length });
    } else {
      const g = kinds.filter((k) => k === 'gcd').length; if (g) y.push({ name: '互除法', han: g });
      const gold = kinds.filter((k) => k === 'golden').length; if (gold) y.push({ name: '外中比（1.618）', han: 2 * gold });
      if (new Set(kinds.filter((k) => k !== 'wild')).size >= 3) y.push({ name: '公理系（3 種の作図）', han: 3 });
      if (opts.silent) y.push({ name: '聴牌の宣言', han: 1 });
    }
    if (opts.spoke && opts.silent && rules === 'pythagoras') y.push({ name: 'チョンボ（沈黙を破った）', han: -8 });
    const all = [...y, ...extra]; const han = all.reduce((s, x) => s + x.han, 0);
    if (!best.win || han > best.han) best = { win: true, yaku: all, han, decomp: d, ratios: chordOf(d) };
  }
  return best;
}

/** The monochord: frequency ratios taken from the winning shape. */
function chordOf(d: Decomp) {
  const r = new Set<number>([1]);
  for (const m of d.melds) if (m.ns.length) { const base = m.ns[0]; for (const n of m.ns) r.add(n / base); }
  if (d.pair.ns.length === 2) r.add(Math.max(...d.pair.ns) / Math.min(...d.pair.ns));
  return [...r].filter((x) => x <= 4).sort((a, b) => a - b).slice(0, 5);
}

// ---------------------------------------------------------------- simple play helpers
/** Cards that would complete a 13-card hand (one example of each kind). */
export function waits(hand13: Card[], preset: Preset): Card[] {
  const out: Card[] = [];
  const kinds: Card[] = [...SUITS.flatMap((s) => Array.from({ length: 10 }, (_, i) => ({ id: -1, suit: s, n: i + 1 }))), { id: -1, suit: 'M', n: 1 }];
  for (const k of kinds) if (score([...hand13, k], preset).win) out.push(k);
  return out;
}

/** How well a card sits in the hand: identical cards and template partners nearby. */
export function connectivity(c: Card, hand: Card[], preset: Preset) {
  if (isWild(c)) return 99;
  const rules = PRESETS[preset].rules; const T = templates(rules, preset === 'davinci');
  let s = 0;
  for (const o of hand) {
    if (o.id === c.id || o.suit !== c.suit) continue;
    if (o.n === c.n) s += 3; else if (T.some((t) => t.ns.includes(c.n) && t.ns.includes(o.n))) s += 1; else if (pairOk(rules, c.n, o.n)) s += 0.5;
  }
  return s;
}

/** CPU discard: the least connected card (von Neumann also weighs how many draws would help). */
export function chooseDiscard(hand: Card[], preset: Preset, unseen: Card[]): Card {
  const rules = PRESETS[preset].rules;
  const fava = hand.find(isFava);
  if (fava && rules === 'pythagoras') return fava; // −1 now beats −2 at the end
  let best = hand[0]; let bestV = Infinity;
  for (const c of hand) {
    if (isWild(c)) continue;
    let v = connectivity(c, hand, preset);
    if (preset === 'neumann') {
      const rest = hand.filter((x) => x.id !== c.id);
      const sample = unseen.filter((_, i) => i % 3 === 0).slice(0, 24);
      v -= sample.filter((u) => connectivity(u, rest, preset) >= 3).length * 0.05; // keep cards whose replacements help less
    }
    if (v < bestV) { bestV = v; best = c; }
  }
  return best;
}

export const SEATS = [
  { wind: '東', element: '火', color: '#ff6b3d' }, { wind: '南', element: '風', color: '#c8d0ff' },
  { wind: '西', element: '水', color: '#3dd6ff' }, { wind: '北', element: '地', color: '#f5c542' },
];

/** Euclid vs Pythagoras, for the comparison table. */
export const COMPARISON: [string, string, string][] = [
  ['数とは', '宇宙の実体。数そのものに魂がある', '量と比の定義。証明の対象'],
  ['面子', '同数・三つ組（3・4・5／6・8・10）・和音（隣り合う比が 1:2・2:3・3:4）', '同数・三つ組（原論 I.47）・互除法（b, c と最大公約数 > 1。例 2・4・6、3・6・9）・外中比（1・2・3／2・3・5／3・5・8）'],
  ['雀頭', '同じ数か、協和音程の比（2 と 4、4 と 6 …）', '同じ数だけ（平行線公準：等しいもの同士）'],
  ['リーチ', '沈黙の行：II か XII を伏せて捨て、和了まで話さない', '聴牌の宣言：ふつうに宣言してよい'],
  ['禁忌', 'ペンタクルの 5（ソラマメ）は捨てても残しても減点', 'なし'],
  ['精算', 'モノコードで和了形の比の和音を鳴らす', '点数の表（作図の手順を残す）'],
  ['最高役', 'テトラクテュス（1+2+3+4=10）', '公理系（3 種類以上の作図をそろえる）'],
];
