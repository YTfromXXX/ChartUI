'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Die3D from '@/components/relay/Die3D';
import CubeClock from '@/components/tetra/CubeClock';
import SevenSpheres from '@/components/tetra/SevenSpheres';
import {
  COMPARISON, MELD_NAME, PRESETS, SEATS, SUIT_INFO, buildDeck, cardLabel, chooseDiscard, goldenSplit, isFava, isWild, rng, score, shuffle, waits,
  type Card, type Preset, type Score,
} from '@/lib/tetraArcana';

type SeatState = { hand: Card[]; river: { card: Card; down: boolean }[]; silent: boolean; favaDiscards: number; spoke: boolean };
type Game = {
  phase: 'idle' | 'play' | 'won' | 'draw'; preset: Preset; seats: SeatState[]; wall: Card[]; axioms: Card[]; turn: number; dealer: number;
  dice: [number, number]; winner: { seat: number; score: Score } | null; log: string[]; burned: number;
  /** Bumped on every new hand and every discard: each value means one draw is due. */
  seq: number;
};
const HUMAN = 0; const ICONS = ['₿', '$', 'Au', '⚙', '✶'];
const emptySeat = (): SeatState => ({ hand: [], river: [], silent: false, favaDiscards: 0, spoke: false });
const sortHand = (h: Card[]) => [...h].sort((a, b) => (a.suit === b.suit ? a.n - b.n : 'WCSPM'.indexOf(a.suit) - 'WCSPM'.indexOf(b.suit)));
const same = (a: Card, b: Card) => a.suit === b.suit && a.n === b.n;
const nums = (suit: Card['suit'], ns: number[]) => ns.map((n) => cardLabel({ id: -1, suit, n })).join('・');

function CardFace({ c, small = false, down = false, onClick, selected, title }: { c?: Card; small?: boolean; down?: boolean; onClick?: () => void; selected?: boolean; title?: string }) {
  const w = small ? 'w-7 h-10 text-[10px]' : 'w-11 h-16 text-sm';
  if (!c || down) return <span className={`${w} inline-flex items-center justify-center rounded border border-[#3a2a1a] bg-[repeating-linear-gradient(45deg,#5a3a22_0_4px,#6a4a2a_4px_8px)] text-[#d9b44a]`} title={title}>{down ? '伏' : ''}</span>;
  const info = SUIT_INFO[c.suit];
  return (
    <button type="button" onClick={onClick} disabled={!onClick} title={title ?? `${info.name} ${cardLabel(c)}`} data-card={`${c.suit}${c.n}`}
      className={`${w} relative inline-flex flex-col items-center justify-center rounded border-2 bg-[#fbf8ef] font-serif font-bold shadow-sm transition ${selected ? '-translate-y-2 border-[#d6001c]' : 'border-[#3a2a1a]'} ${onClick ? 'hover:-translate-y-1' : ''}`}
      style={{ color: c.suit === 'M' ? '#7a1f8a' : '#2a2015' }}>
      <span style={{ color: info.color, textShadow: '0 0 1px #000' }} className={small ? 'text-[9px]' : 'text-xs'}>{info.mark}</span>
      <span>{cardLabel(c)}</span>
      {isFava(c) && <span className="absolute -right-1 -top-1 rounded-full bg-[#5a8a2a] px-1 text-[8px] text-white">豆</span>}
    </button>
  );
}

/**
 * The interior of Order A (the Pythagorean school): the trapeza becomes a Tetra Arcana table.
 * On the walls: a clock of six cubes on an infinite loop, and the dice point cloud as seven spheres.
 */
export default function TetraArcanaRoom() {
  const [preset, setPreset] = useState<Preset>('pythagoras');
  const [g, setG] = useState<Game>({ phase: 'idle', preset: 'pythagoras', seats: [0, 1, 2, 3].map(emptySeat), wall: [], axioms: [], turn: 0, dealer: 0, dice: [1, 1], winner: null, log: [], burned: 0, seq: 0 });
  const [throws, setThrows] = useState<number[]>([]);
  const [icon, setIcon] = useState('₿');
  const [spin, setSpin] = useState(0);
  const [silentMode, setSilentMode] = useState(false);
  const [chat, setChat] = useState('');
  const [fast, setFast] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const rules = PRESETS[g.preset].rules;

  const roll = (r: () => number = Math.random): [number, number] => [1 + Math.floor(r() * 6), 1 + Math.floor(r() * 6)];
  const throwOnly = (n = 1) => { const add: number[] = []; for (let i = 0; i < n; i += 1) { const d = roll(); add.push(d[0] + d[1]); } setThrows((t) => [...t, ...add]); setSpin((s) => s + 1); };

  const newGame = () => {
    const seed = (Date.now() % 1e9) | 0; const r = rng(seed);
    const dice = roll(r); const sum = dice[0] + dice[1]; const dealer = (sum - 1) % 4;
    const { euclid, pythagoras } = goldenSplit(shuffle(buildDeck(preset), r));
    const seats = [0, 1, 2, 3].map(emptySeat);
    for (let i = 0; i < 52; i += 1) seats[(dealer + i) % 4].hand.push(euclid[i]);
    seats.forEach((s) => { s.hand = sortHand(s.hand); });
    setThrows((t) => [...t, sum]); setSpin((s) => s + 1); setSilentMode(false);
    setG((prev) => ({ phase: 'play', preset, seats, wall: pythagoras, axioms: euclid.slice(52), turn: dealer, dealer, dice, winner: null, burned: 0, seq: prev.seq + 1,
      log: [`サイコロ ${dice[0]}+${dice[1]}=${sum} → 親は ${SEATS[dealer].wind}（${SEATS[dealer].element}）。ユークリッドの 55 枚から配牌、ピタゴラスの 89 枚が山（89÷55≈1.618）。`] }));
  };

  // Draw for the seat whose turn it is (once per turn).
  const drawnSeq = useRef(0);
  useEffect(() => {
    if (g.phase !== 'play' || drawnSeq.current === g.seq) return;
    drawnSeq.current = g.seq;
    setG((s) => {
      if (!s.wall.length) return { ...s, phase: 'draw', log: [...s.log, '山が尽きた：流局'] };
      const seats = s.seats.map((x) => ({ ...x })); const card = s.wall[0];
      seats[s.turn].hand = s.turn === HUMAN ? [...sortHand(seats[s.turn].hand), card] : [...seats[s.turn].hand, card];
      return { ...s, seats, wall: s.wall.slice(1) };
    });
  }, [g.phase, g.seq]);

  const finalScore = useCallback((s: Game, seat: number) => {
    const st = s.seats[seat]; const sc = score(st.hand, s.preset, { silent: st.silent, favaDiscards: st.favaDiscards, spoke: st.spoke });
    const ax = st.hand.filter((c) => s.axioms.some((a) => same(a, c))).length;
    if (sc.win && ax) { sc.yaku.push({ name: '公理（ドラ）', han: ax }); sc.han += ax; }
    return sc;
  }, []);

  const playChord = (ratios: number[]) => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!Ctx) return;
    const ctx = (audio.current ??= new Ctx()); const t = ctx.currentTime;
    ratios.forEach((r, i) => { const o = ctx.createOscillator(); const gn = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 196 * r;
      gn.gain.setValueAtTime(0, t + i * 0.12); gn.gain.linearRampToValueAtTime(0.12, t + i * 0.12 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 2.6);
      o.connect(gn).connect(ctx.destination); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 2.7); });
  };

  const declareWin = useCallback((seat: number) => {
    setG((s) => {
      const sc = finalScore(s, seat); if (!sc.win) return s;
      return { ...s, phase: 'won', winner: { seat, score: sc }, log: [...s.log, `${SEATS[seat].wind}：${rules === 'pythagoras' ? 'ハルモニア（調和の完成）' : 'Q.E.D.'} ${sc.han} 翻`] };
    });
  }, [finalScore, rules]);
  useEffect(() => { if (g.phase === 'won' && g.winner && PRESETS[g.preset].rules === 'pythagoras') playChord(g.winner.score.ratios); }, [g.phase, g.winner, g.preset]);

  const discard = useCallback((seat: number, card: Card, down = false) => {
    setG((s) => {
      if (s.phase !== 'play' || s.turn !== seat) return s;
      const seats = s.seats.map((x) => ({ ...x }));
      const st = seats[seat]; st.hand = sortHand(st.hand.filter((c) => c.id !== card.id)); st.river = [...st.river, { card, down }];
      if (down) st.silent = true;
      if (isFava(card) && PRESETS[s.preset].rules === 'pythagoras') st.favaDiscards += 1;
      let wall = s.wall; const log = [...s.log]; let burned = s.burned;
      if (down) log.push(`${SEATS[seat].wind}：${PRESETS[s.preset].rules === 'pythagoras' ? `${cardLabel(card)} を伏せて沈黙の行` : '聴牌を宣言'}`);
      if (s.preset === 'nobunaga' && isWild(card) && !down) { const before = wall.length; wall = wall.filter((c) => !same(c, card)); if (before !== wall.length) { burned += before - wall.length; log.push(`焼き討ち：山の ${cardLabel(card)} を ${before - wall.length} 枚焼いた`); } }
      return { ...s, seats, wall, log: log.slice(-12), burned, turn: (seat + 1) % 4, seq: s.seq + 1 };
    });
  }, []);

  // CPU seats (and the silent human, who only draws and discards).
  useEffect(() => {
    if (g.phase !== 'play') return undefined;
    const st = g.seats[g.turn]; if (st.hand.length !== 14) return undefined;
    const isHuman = g.turn === HUMAN;
    if (isHuman && !st.silent) return undefined;
    const timer = window.setTimeout(() => {
      if (finalScore(g, g.turn).win) { if (!isHuman) declareWin(g.turn); return; }
      const drawn = st.hand[st.hand.length - 1];
      if (st.silent) { discard(g.turn, drawn); return; }
      const unseen = g.wall;
      const riichi = st.hand.find((c) => c.suit === 'M' && (c.n === 2 || c.n === 12) && waits(st.hand.filter((x) => x.id !== c.id), g.preset).length > 0);
      if (riichi) discard(g.turn, riichi, true); else discard(g.turn, chooseDiscard(st.hand, g.preset, unseen));
    }, fast ? 120 : 480);
    return () => window.clearTimeout(timer);
  }, [g, fast, discard, declareWin, finalScore]);

  const me = g.seats[HUMAN];
  const myTurn = g.phase === 'play' && g.turn === HUMAN && me.hand.length === 14;
  const canWin = myTurn && finalScore(g, HUMAN).win;
  const riichiable = (c: Card) => c.suit === 'M' && (c.n === 2 || c.n === 12) && !me.silent && waits(me.hand.filter((x) => x.id !== c.id), g.preset).length > 0;
  const onCard = (c: Card) => { if (!myTurn || me.silent) return; if (silentMode && riichiable(c)) { discard(HUMAN, c, true); setSilentMode(false); } else discard(HUMAN, c); };
  const say = () => {
    if (!chat.trim()) return;
    setG((s) => { const seats = s.seats.map((x) => ({ ...x })); const broke = seats[HUMAN].silent && PRESETS[s.preset].rules === 'pythagoras'; if (broke) seats[HUMAN].spoke = true;
      return { ...s, seats, log: [...s.log, `東：「${chat.trim()}」${broke ? '（沈黙の行を破った：和了するとチョンボ）' : ''}`].slice(-12) }; });
    setChat('');
  };

  const seatBox = (seat: number, pos: string) => {
    const st = g.seats[seat]; const info = SEATS[seat];
    return (
      <div className={`${pos} space-y-1`} data-testid={`seat-${seat}`}>
        <p className="text-xs font-bold" style={{ color: '#1f1f1f' }}><span className="rounded px-1 text-white" style={{ background: info.color === '#c8d0ff' ? '#7c86c8' : info.color }}>{info.wind}・{info.element}</span>{seat === g.dealer && ' 親'}{g.turn === seat && g.phase === 'play' && ' ◀'}{st.silent && ' 🤫'} {seat === HUMAN ? 'あなた' : 'CPU'}</p>
        {seat !== HUMAN && <div className="flex flex-wrap gap-0.5">{st.hand.map((c) => <CardFace key={c.id} small down={g.phase === 'play'} c={g.phase === 'play' ? undefined : c} />)}</div>}
        <div className="flex flex-wrap gap-0.5">{st.river.map(({ card, down }) => <CardFace key={card.id} c={card} small down={down} />)}</div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f4f1ea,#e4dfd3)] px-4 py-5 text-[#1f1f1f] sm:px-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] tracking-[0.4em] text-[#7a0f22]">ORDER A · PYTHAGOREAN SCHOOL · INTERIOR</p>
            <h1 className="font-serif text-2xl font-bold">ピタゴラス教団の内装 · トラペザ「テトラ・アルカナ」</h1>
            <p className="text-xs text-[#5a5245]">白い漆喰の壁、天窓、四角いトラペザ。卓は 144 枚（12²）。東西南北に火・風・水・地。</p>
          </div>
          <nav className="flex gap-2 text-xs"><Link href="/architect" className="border border-[#1f1f1f] bg-white px-3 py-1">建築オーダー</Link><Link href="/famidance" className="border border-[#1f1f1f] bg-white px-3 py-1">ファミダンス</Link></nav>
        </header>

        <section aria-label="Walls" className="grid gap-4 rounded border border-[#cfc6b0] bg-white/70 p-3 shadow-[inset_0_-30px_60px_rgba(0,0,0,.04)] md:grid-cols-[260px_1fr]">
          <figure className="flex flex-col items-center"><CubeClock /><figcaption className="text-center text-[10px] text-[#5a5245]">壁の時計：立方体 6 個と枠だけ。∞ の上を、時（金）・分（青）・秒（赤と残像 3 つ）が実時刻どおりに回り続ける</figcaption></figure>
          <figure className="space-y-1">
            <SevenSpheres throws={throws} icon={icon} />
            <figcaption className="flex flex-wrap items-center gap-2 text-[10px] text-[#5a5245]">
              <span>床の点群：サイコロの和を 7 マスに（和 mod 7 + 1）。投げた数 {throws.length}</span>
              {ICONS.map((i) => <button key={i} type="button" aria-pressed={icon === i} onClick={() => setIcon(i)} className={`border px-1.5 ${icon === i ? 'border-[#7a0f22] bg-[#7a0f22] text-white' : 'border-[#1f1f1f]'}`}>{i}</button>)}
              <button type="button" onClick={() => throwOnly(1)} className="border border-[#1f1f1f] px-2">サイコロを振る</button>
              <button type="button" onClick={() => throwOnly(21)} className="border border-[#1f1f1f] px-2">21 回振る</button>
            </figcaption>
          </figure>
        </section>

        <section aria-label="Table" className="space-y-3 rounded border-4 border-[#3a2a1a] bg-[radial-gradient(ellipse_at_center,#6b4a2c,#3a2a1a)] p-3 text-[#f4f1ea]">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1">卓の作者
              <select aria-label="Preset" value={preset} disabled={g.phase === 'play'} onChange={(e) => setPreset(e.target.value as Preset)} className="rounded bg-[#f4f1ea] px-1 text-[#1f1f1f]">
                {(Object.keys(PRESETS) as Preset[]).map((p) => <option key={p} value={p}>{PRESETS[p].name}</option>)}
              </select>
            </label>
            <span className="text-[#d9c9a8]">{PRESETS[preset].note}</span>
            <button type="button" onClick={newGame} className="ml-auto rounded bg-[#d6001c] px-3 py-1 font-bold">{g.phase === 'idle' ? 'サイコロを振って始める' : '新しい局'}</button>
            <label className="flex items-center gap-1"><input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> はやく</label>
          </div>
          <div className="grid grid-cols-[1fr_2fr_1fr] gap-2 rounded bg-[#2d5a3a]/80 p-2">
            <div />{seatBox(2, '')}<div />
            {seatBox(3, '')}
            <div className="flex flex-col items-center justify-center gap-1 rounded border border-[#d9b44a]/40 p-2 text-center text-xs" data-testid="center">
              <div className="flex gap-2"><Die3D value={g.dice[0]} spin={spin} size={40} /><Die3D value={g.dice[1]} spin={spin} size={40} /></div>
              <p>ピタゴラスの山 <span className="font-mono" data-testid="wall">{g.wall.length}</span> / 89 · ユークリッドの公理 3{g.burned ? ` · 焼いた札 ${g.burned}` : ''}</p>
              <div className="flex gap-1">{g.axioms.map((c) => <CardFace key={c.id} c={c} small title="公理（ドラ）" />)}</div>
              <p className="text-[10px] text-[#d9c9a8]">{PRESETS[g.preset].name}の卓 · {g.phase === 'play' ? `${SEATS[g.turn].wind}の番` : g.phase === 'won' ? '和了' : g.phase === 'draw' ? '流局' : '開始前'}</p>
            </div>
            {seatBox(1, '')}
            <div />{seatBox(0, '')}<div />
          </div>
          <div className="space-y-2 rounded bg-black/20 p-2">
            <div className="flex flex-wrap gap-1" data-testid="my-hand">{me.hand.map((c) => <CardFace key={c.id} c={c} onClick={myTurn && !me.silent ? () => onCard(c) : undefined} selected={silentMode && riichiable(c)} />)}</div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {myTurn && !me.silent && <span>捨てる札をクリック</span>}
              {canWin && <button type="button" onClick={() => declareWin(HUMAN)} className="rounded bg-[#f5c542] px-3 py-1 font-bold text-black">{rules === 'pythagoras' ? 'ハルモニア（和了）' : 'Q.E.D.（和了）'}</button>}
              {myTurn && !me.silent && me.hand.some(riichiable) && <label className="flex items-center gap-1"><input type="checkbox" checked={silentMode} onChange={(e) => setSilentMode(e.target.checked)} /> {rules === 'pythagoras' ? '沈黙の行（II か XII を伏せて捨てる）' : '聴牌を宣言（II か XII を伏せる）'}</label>}
              {me.silent && <span className="rounded bg-black/40 px-2">{rules === 'pythagoras' ? '🤫 沈黙の行の最中：話すとチョンボ' : '聴牌中'}</span>}
              {me.hand.some(isFava) && rules === 'pythagoras' && <span className="text-[#c8e6a0]">豆＝ペンタクルの 5：捨てると −1、和了まで残すと −2</span>}
              <form className="ml-auto flex gap-1" onSubmit={(e) => { e.preventDefault(); say(); }}><input aria-label="Speak" value={chat} onChange={(e) => setChat(e.target.value)} placeholder="卓で発声する" className="w-40 rounded bg-[#f4f1ea] px-1 text-[#1f1f1f]" /><button type="submit" className="rounded border border-[#f4f1ea] px-2">言う</button></form>
            </div>
          </div>
          {g.winner && (
            <div className="rounded bg-[#f4f1ea] p-3 text-[#1f1f1f]" data-testid="result">
              <p className="font-serif text-lg font-bold">{SEATS[g.winner.seat].wind}（{g.winner.seat === HUMAN ? 'あなた' : 'CPU'}）の和了 · {g.winner.score.han} 翻</p>
              <ul className="text-sm">{g.winner.score.yaku.map((y) => <li key={y.name}>{y.name}{y.note ? `（${y.note}）` : ''}：{y.han > 0 ? '+' : ''}{y.han}</li>)}</ul>
              {g.winner.score.decomp && <p className="text-xs text-[#5a5245]">面子：{g.winner.score.decomp.melds.map((m) => `${m.kind === 'wild' ? '宇宙の理' : `${SUIT_INFO[m.suit].name}${nums(m.suit, m.ns)}（${MELD_NAME[m.kind]}${m.wilds ? `・✶${m.wilds}` : ''}）`}`).join(' ／ ')} ／ 雀頭 {g.winner.score.decomp.pair.ns.length ? nums(g.winner.score.decomp.pair.suit, g.winner.score.decomp.pair.ns) : '宇宙の理'}</p>}
              {rules === 'pythagoras' && <button type="button" onClick={() => playChord(g.winner!.score.ratios)} className="mt-1 rounded border border-[#1f1f1f] px-2 text-xs">モノコードで精算をもう一度（比 {g.winner.score.ratios.map((r) => r.toFixed(2)).join(' : ')}）</button>}
            </div>
          )}
          <ol className="max-h-28 overflow-y-auto text-[11px] text-[#e8dcc4]" data-testid="log">{g.log.map((l, i) => <li key={i}>{l}</li>)}</ol>
        </section>

        <section aria-label="Comparison" className="rounded border border-[#cfc6b0] bg-white/80 p-3 text-xs">
          <p className="mb-1 font-serif text-base font-bold">ピタゴラス版とユークリッド版の違い</p>
          <table className="w-full"><thead><tr className="text-left text-[#7a0f22]"><th className="w-20" /><th>ピタゴラス</th><th>ユークリッド</th></tr></thead>
            <tbody>{COMPARISON.map(([k, a, b]) => <tr key={k} className="border-t border-[#e4dfd3] align-top"><td className="py-1 font-bold">{k}</td><td className="py-1 pr-2">{a}</td><td className="py-1">{b}</td></tr>)}</tbody></table>
          <p className="mt-2 text-[#5a5245]">同じ手でも、ピタゴラス版で和了（比 2:4 の雀頭、2・3・4 の和音）になる形は、ユークリッド版では和了にならない。逆に、互除法と外中比の面子はユークリッド版にしかない。</p>
        </section>

        <section aria-label="Shelf" className="grid gap-3 rounded border border-[#cfc6b0] bg-white/70 p-3 text-xs md:grid-cols-2">
          <div>
            <p className="font-serif text-sm font-bold">資料から卓に反映したこと</p>
            <ul className="list-disc pl-4">
              <li>144 枚＝12²＝第 12 フィボナッチ数。「1.618 で二人の魔法使いに分業」→ 55（ユークリッド：配牌 52 ＋ 公理 3）と 89（ピタゴラス：山）。</li>
              <li>テトラクテュスは同じスートの 4 が 4 枚必要だが、各札は 3 枚しかない → 4 だけは四元素（スート）をまたいでよい。</li>
              <li>大アルカナは本文の 7 種（0 I II III IV X XXI）に、沈黙の行で使う XII を足して 8 種 × 3 枚＝24 枚。</li>
              <li>ソラマメの禁忌は「捨てても、残しても」減点 → 引いた時点で選ぶしかないジレンマ（CPU は早めに捨てる）。</li>
              <li>ダ・ヴィンチは I と VII だけ、アインシュタインは 8 に穴と 0 の前の肖像、ノイマンは先読み、信長は焼き討ち。</li>
            </ul>
          </div>
          <div>
            <p className="font-serif text-sm font-bold">書架の札（タロットと結びつく人物・史実）</p>
            <ul className="list-disc pl-4">
              <li>マリー・アンヌ・ルノルマン（18〜19 世紀フランスのカード占い師）</li>
              <li>パメラ・コールマン・スミス（ウェイト＝スミス版タロットの絵を描いた画家）</li>
              <li>ローリー・キャボット（セイラムの魔女として知られる現代の実践者）</li>
              <li>注：タロットが占いに使われ始めたのは 16〜18 世紀頃で、中世の魔女裁判の時代とは重ならない。使用回数の公式記録はない。</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

