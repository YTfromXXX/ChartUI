'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import Die3D from '@/components/relay/Die3D';
import CubeClock from '@/components/tetra/CubeClock';
import SevenSpheres from '@/components/tetra/SevenSpheres';
import WaveDie from '@/components/tetra/WaveDie';
import { DEFAULT_RULES, ROLES, RULE_LABEL, canEdit, describe, type Role, type RonRules } from '@/lib/tableAuthority';
import {
  COMPARISON, MELD_NAME, PRESETS, SEATS, SUIT_INFO, buildDeck, cardLabel, chooseDiscard, goldenSplit, isFava, isWild, rng, score, shuffle, waits,
  type Card, type Preset, type Score,
} from '@/lib/tetraArcana';
import { DEFAULT_LAYOUT, rollWave } from '@/lib/waveDie';

type SeatState = { hand: Card[]; river: { card: Card; down: boolean }[]; silent: boolean; favaDiscards: number; spoke: boolean; passed: Card[] };
type Winner = { seat: number; score: Score; by: 'tsumo' | 'ron'; from?: number };
type Game = {
  phase: 'idle' | 'play' | 'won' | 'draw'; preset: Preset; seats: SeatState[]; wall: Card[]; axioms: Card[]; turn: number; dealer: number;
  dice: [number, number]; winners: Winner[]; log: string[]; burned: number;
  /** Bumped on every new hand and every settled discard: each value means one draw is due. */
  seq: number;
  /** The ron rules frozen for this hand (the authority panel edits the next hand's rules). */
  rules: RonRules;
  /** A discard that someone may ron, waiting to be settled. */
  pendingRon: { card: Card; from: number; cands: number[] } | null;
};
const HUMAN = 0; const ICONS = ['₿', '$', 'Au', '⚙', '✶'];
const emptySeat = (): SeatState => ({ hand: [], river: [], silent: false, favaDiscards: 0, spoke: false, passed: [] });
const sortHand = (h: Card[]) => [...h].sort((a, b) => (a.suit === b.suit ? a.n - b.n : 'WCSPM'.indexOf(a.suit) - 'WCSPM'.indexOf(b.suit)));
const same = (a: Card, b: Card) => a.suit === b.suit && a.n === b.n;
const nums = (suit: Card['suit'], ns: number[]) => ns.map((n) => cardLabel({ id: -1, suit, n })).join('・');
const NEON = { pink: '#ff2bd6', cyan: '#00f0ff', lime: '#b6ff00', amber: '#ffb000' };

function CardFace({ c, small = false, down = false, onClick, selected, title, hot }: { c?: Card; small?: boolean; down?: boolean; onClick?: () => void; selected?: boolean; title?: string; hot?: boolean }) {
  const w = small ? 'w-7 h-10 text-[10px]' : 'w-11 h-16 text-sm';
  if (!c || down) return <span className={`${w} inline-flex items-center justify-center rounded border border-cyan-400/40 bg-[repeating-linear-gradient(60deg,#0a0f1f_0_5px,#101a33_5px_10px)] font-mono text-cyan-300/80 shadow-[0_0_6px_#00f0ff33]`} title={title}>{down ? '伏' : ''}</span>;
  const info = SUIT_INFO[c.suit]; const glow = c.suit === 'M' ? NEON.pink : info.color;
  return (
    <button type="button" onClick={onClick} disabled={!onClick} title={title ?? `${info.name} ${cardLabel(c)}`} data-card={`${c.suit}${c.n}`}
      className={`${w} relative inline-flex flex-col items-center justify-center rounded border bg-[linear-gradient(160deg,#0d1230,#060814)] font-mono font-bold transition ${selected ? '-translate-y-2' : ''} ${onClick ? 'hover:-translate-y-1' : ''}`}
      style={{ color: glow, borderColor: hot ? NEON.lime : `${glow}aa`, boxShadow: `0 0 ${hot || selected ? 12 : 6}px ${hot ? NEON.lime : glow}66, inset 0 0 8px ${glow}22` }}>
      <span className={small ? 'text-[9px]' : 'text-xs'} style={{ textShadow: `0 0 4px ${glow}` }}>{info.mark}</span>
      <span style={{ textShadow: `0 0 6px ${glow}` }}>{cardLabel(c)}</span>
      {isFava(c) && <span className="absolute -right-1 -top-1 rounded-full bg-lime-400 px-1 text-[8px] text-black">豆</span>}
    </button>
  );
}

const Panel = ({ title, children, className = '', accent = NEON.cyan, ...rest }: { title: string; children: ReactNode; className?: string; accent?: string } & HTMLAttributes<HTMLElement>) => (
  <section {...rest} className={`hud relative rounded-sm border bg-[#070b18]/85 p-3 ${className}`} style={{ borderColor: `${accent}66`, boxShadow: `0 0 18px ${accent}22, inset 0 0 30px #000` }}>
    <p className="mb-2 font-mono text-[10px] tracking-[0.35em]" style={{ color: accent }}>▍{title}</p>
    {children}
  </section>
);

/**
 * The interior of Order A, rebuilt as a cyberpunk game room: neon HUD walls, a wave die that is
 * always moving, a Tetra Arcana table with optional ron, and an authority panel (roles are major
 * arcana) that sets the ron rules for the next hand.
 */
export default function TetraArcanaRoom() {
  const [preset, setPreset] = useState<Preset>('pythagoras');
  const [g, setG] = useState<Game>({ phase: 'idle', preset: 'pythagoras', seats: [0, 1, 2, 3].map(emptySeat), wall: [], axioms: [], turn: 0, dealer: 0, dice: [1, 1], winners: [], log: [], burned: 0, seq: 0, rules: DEFAULT_RULES, pendingRon: null });
  const [throws, setThrows] = useState<number[]>([]);
  const [icon, setIcon] = useState('₿');
  const [spin, setSpin] = useState(0);
  const [silentMode, setSilentMode] = useState(false);
  const [chat, setChat] = useState('');
  const [fast, setFast] = useState(false);
  const [layout, setLayout] = useState<number[]>(DEFAULT_LAYOUT);
  const [faceCounts, setFaceCounts] = useState<Record<number, number>>({});
  const [flash, setFlash] = useState<number[]>([]);
  const [role, setRole] = useState<Role>('emperor');
  const [rules, setRules] = useState<RonRules>(DEFAULT_RULES);
  const [ruleLog, setRuleLog] = useState<string[]>([]);
  const audio = useRef<AudioContext | null>(null);
  const kind = PRESETS[g.preset].rules;

  // ---------------- the wave die
  const rollAt = useCallback((t: number) => {
    const r = rollWave(layout, t);
    setFaceCounts((c) => ({ ...c, [r.faces[0]]: (c[r.faces[0]] ?? 0) + 1, [r.faces[1]]: (c[r.faces[1]] ?? 0) + 1 }));
    return r;
  }, [layout]);
  const throwOnly = (n = 1) => {
    const t0 = Date.now(); const sums: number[] = []; let last = rollWave(layout, t0);
    for (let k = 0; k < n; k += 1) { last = rollAt(t0 + k * 137); sums.push(last.faces[0] + last.faces[1]); }
    setThrows((t) => [...t, ...sums]); setSpin((s) => s + 1); setG((s) => ({ ...s, dice: last.faces })); setFlash(last.cells);
  };
  useEffect(() => { if (!flash.length) return undefined; const id = window.setTimeout(() => setFlash([]), 900); return () => window.clearTimeout(id); }, [flash]);
  const totalFaces = Object.values(faceCounts).reduce((a, b) => a + b, 0);

  // ---------------- authority panel
  const setRule = <K extends keyof RonRules>(key: K, value: RonRules[K]) => {
    if (!canEdit(role, key)) return;
    setRules((r) => ({ ...r, [key]: value }));
    const shown = typeof value === 'boolean' ? (value ? 'オン' : 'オフ') : ({ any: '誰の捨て札でも', kamicha: '上家だけ', atamahane: '頭ハネ', double: 'ダブロン' } as Record<string, string>)[String(value)] ?? (typeof value === 'number' && value > 0 ? `+${value}` : String(value));
    setRuleLog((l) => [`${ROLES[role].card} ${ROLES[role].name}：${RULE_LABEL[key]} → ${shown}（次の局から）`, ...l].slice(0, 8));
  };

  // ---------------- game
  const newGame = () => {
    const r = rng((Date.now() % 1e9) | 0);
    const roll = rollAt(Date.now()); const dice = roll.faces; const sum = dice[0] + dice[1]; const dealer = (sum - 1) % 4;
    const { euclid, pythagoras } = goldenSplit(shuffle(buildDeck(preset), r));
    const seats = [0, 1, 2, 3].map(emptySeat);
    for (let i = 0; i < 52; i += 1) seats[(dealer + i) % 4].hand.push(euclid[i]);
    seats.forEach((s) => { s.hand = sortHand(s.hand); });
    setThrows((t) => [...t, sum]); setSpin((s) => s + 1); setSilentMode(false); setFlash(roll.cells);
    setG((prev) => ({ phase: 'play', preset, seats, wall: pythagoras, axioms: euclid.slice(52), turn: dealer, dealer, dice, winners: [], burned: 0, seq: prev.seq + 1, rules, pendingRon: null,
      log: [`波のサイコロ ${dice[0]}+${dice[1]}=${sum} → 親は ${SEATS[dealer].wind}（${SEATS[dealer].element}）。規則：${describe(rules)}`] }));
  };

  const drawnSeq = useRef(0);
  useEffect(() => {
    if (g.phase !== 'play' || g.pendingRon || drawnSeq.current === g.seq) return;
    drawnSeq.current = g.seq;
    setG((s) => {
      if (!s.wall.length) return { ...s, phase: 'draw', log: [...s.log, '山が尽きた：流局'] };
      const seats = s.seats.map((x) => ({ ...x })); const card = s.wall[0];
      seats[s.turn].hand = s.turn === HUMAN ? [...sortHand(seats[s.turn].hand), card] : [...seats[s.turn].hand, card];
      return { ...s, seats, wall: s.wall.slice(1) };
    });
  }, [g.phase, g.seq, g.pendingRon]);

  const scoreFor = useCallback((s: Game, seat: number, ron?: Card) => {
    const st = s.seats[seat]; const hand = ron ? [...st.hand, ron] : st.hand;
    const sc = score(hand, s.preset, { silent: st.silent, favaDiscards: st.favaDiscards, spoke: st.spoke });
    if (!sc.win) return sc;
    const ax = hand.filter((c) => s.axioms.some((a) => same(a, c))).length;
    if (ax) sc.yaku.push({ name: '公理（ドラ）', han: ax });
    if (ron) sc.yaku.push({ name: `ロン（${SEATS[s.pendingRon?.from ?? 0].wind}の ${cardLabel(ron)}）`, han: s.rules.hanAdjust });
    else if (s.rules.tsumoBonus) sc.yaku.push({ name: 'ツモ', han: 1 });
    sc.han = sc.yaku.reduce((a, y) => a + y.han, 0);
    return sc;
  }, []);

  const playChord = (ratios: number[]) => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (!Ctx) return;
    const ctx = (audio.current ??= new Ctx()); const t = ctx.currentTime;
    ratios.forEach((r, i) => { const o = ctx.createOscillator(); const gn = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 196 * r;
      gn.gain.setValueAtTime(0, t + i * 0.12); gn.gain.linearRampToValueAtTime(0.12, t + i * 0.12 + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 2.6);
      o.connect(gn).connect(ctx.destination); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 2.7); });
  };

  const declareTsumo = useCallback((seat: number) => {
    setG((s) => {
      const sc = scoreFor(s, seat); if (!sc.win) return s;
      return { ...s, phase: 'won', winners: [{ seat, score: sc, by: 'tsumo' }], log: [...s.log, `${SEATS[seat].wind}：ツモ ${sc.han} 翻`] };
    });
  }, [scoreFor]);
  useEffect(() => { if (g.phase === 'won' && g.winners.length && PRESETS[g.preset].rules === 'pythagoras') playChord(g.winners[0].score.ratios); }, [g.phase, g.winners, g.preset]);

  /** Who may ron this discard under the hand's rules (in turn order from the discarder's right). */
  const ronCandidates = (s: Game, from: number, card: Card) => {
    const r = s.rules; if (!r.ron) return [];
    const out: number[] = [];
    for (let k = 1; k < 4; k += 1) {
      const seat = (from + k) % 4; const st = s.seats[seat];
      if (r.from === 'kamicha' && seat !== (from + 1) % 4) continue;
      if (r.silentOnly && !st.silent) continue;
      if (r.furiten && (st.river.some((x) => same(x.card, card)) || st.passed.some((x) => same(x, card)))) continue;
      if (score([...st.hand, card], s.preset).win) out.push(seat);
    }
    return out;
  };

  const discard = useCallback((seat: number, card: Card, down = false) => {
    setG((s) => {
      if (s.phase !== 'play' || s.turn !== seat || s.pendingRon) return s;
      const seats = s.seats.map((x) => ({ ...x }));
      const st = seats[seat]; st.hand = sortHand(st.hand.filter((c) => c.id !== card.id)); st.river = [...st.river, { card, down }];
      if (down) st.silent = true;
      if (isFava(card) && PRESETS[s.preset].rules === 'pythagoras') st.favaDiscards += 1;
      let wall = s.wall; const log = [...s.log]; let burned = s.burned;
      if (down) log.push(`${SEATS[seat].wind}：${PRESETS[s.preset].rules === 'pythagoras' ? `${cardLabel(card)} を伏せて沈黙の行` : '聴牌を宣言'}`);
      if (s.preset === 'nobunaga' && isWild(card) && !down) { const before = wall.length; wall = wall.filter((c) => !same(c, card)); if (before !== wall.length) { burned += before - wall.length; log.push(`焼き討ち：山の ${cardLabel(card)} を ${before - wall.length} 枚焼いた`); } }
      const next = { ...s, seats, wall, log: log.slice(-14), burned, turn: (seat + 1) % 4 };
      const cands = down ? [] : ronCandidates(next, seat, card); // a face-down card cannot be ronned
      if (cands.length) return { ...next, pendingRon: { card, from: seat, cands } };
      return { ...next, seq: s.seq + 1 };
    });
  }, []);

  /** Settle a pending ron: CPUs always take it, the human decides. */
  const settleRon = useCallback((humanTakes: boolean) => {
    setG((s) => {
      const p = s.pendingRon; if (!p) return s;
      const takers = p.cands.filter((seat) => seat !== HUMAN || humanTakes);
      if (!takers.length) {
        const seats = s.seats.map((x, i) => (i === HUMAN ? { ...x, passed: [...x.passed, p.card] } : x));
        return { ...s, seats, pendingRon: null, seq: s.seq + 1, log: [...s.log, `東：${cardLabel(p.card)} を見逃した${s.rules.furiten ? '（以後この札ではロンできない：フリテン）' : ''}`].slice(-14) };
      }
      const chosen = s.rules.multi === 'atamahane' ? [takers[0]] : takers;
      const winners: Winner[] = chosen.map((seat) => ({ seat, score: scoreFor(s, seat, p.card), by: 'ron', from: p.from }));
      return { ...s, phase: 'won', winners, pendingRon: null, log: [...s.log, ...winners.map((w) => `${SEATS[w.seat].wind}：ロン（${SEATS[p.from].wind}から ${cardLabel(p.card)}）${w.score.han} 翻${s.seats[w.seat].silent && kindOf(s) === 'pythagoras' ? '・無言のロン（II を表に返す）' : ''}`)].slice(-14) };
    });
  }, [scoreFor]);
  const kindOf = (s: Game) => PRESETS[s.preset].rules;

  useEffect(() => { // resolve at once when the human is not among the candidates
    if (!g.pendingRon || g.pendingRon.cands.includes(HUMAN)) return undefined;
    const id = window.setTimeout(() => settleRon(false), fast ? 150 : 600); return () => window.clearTimeout(id);
  }, [g.pendingRon, settleRon, fast]);

  // CPU seats (and the silent human, who only draws and discards).
  useEffect(() => {
    if (g.phase !== 'play' || g.pendingRon) return undefined;
    const st = g.seats[g.turn]; if (st.hand.length !== 14) return undefined;
    const isHuman = g.turn === HUMAN;
    if (isHuman && !st.silent) return undefined;
    const timer = window.setTimeout(() => {
      if (scoreFor(g, g.turn).win) { if (!isHuman) declareTsumo(g.turn); return; }
      const drawn = st.hand[st.hand.length - 1];
      if (st.silent) { discard(g.turn, drawn); return; }
      const riichi = st.hand.find((c) => c.suit === 'M' && (c.n === 2 || c.n === 12) && waits(st.hand.filter((x) => x.id !== c.id), g.preset).length > 0);
      if (riichi) discard(g.turn, riichi, true); else discard(g.turn, chooseDiscard(st.hand, g.preset, g.wall));
    }, fast ? 120 : 480);
    return () => window.clearTimeout(timer);
  }, [g, fast, discard, declareTsumo, scoreFor]);

  const me = g.seats[HUMAN];
  const myTurn = g.phase === 'play' && !g.pendingRon && g.turn === HUMAN && me.hand.length === 14;
  const canTsumo = myTurn && scoreFor(g, HUMAN).win;
  const myRon = g.pendingRon?.cands.includes(HUMAN) ? g.pendingRon : null;
  const riichiable = (c: Card) => c.suit === 'M' && (c.n === 2 || c.n === 12) && !me.silent && waits(me.hand.filter((x) => x.id !== c.id), g.preset).length > 0;
  const onCard = (c: Card) => { if (!myTurn || me.silent) return; if (silentMode && riichiable(c)) { discard(HUMAN, c, true); setSilentMode(false); } else discard(HUMAN, c); };
  const say = () => {
    if (!chat.trim()) return;
    setG((s) => { const seats = s.seats.map((x) => ({ ...x })); const broke = seats[HUMAN].silent && PRESETS[s.preset].rules === 'pythagoras'; if (broke) seats[HUMAN].spoke = true;
      return { ...s, seats, log: [...s.log, `東：「${chat.trim()}」${broke ? '（沈黙の行を破った：和了するとチョンボ）' : ''}`].slice(-14) }; });
    setChat('');
  };

  const seatBox = (seat: number) => {
    const st = g.seats[seat]; const info = SEATS[seat];
    return (
      <div className="space-y-1" data-testid={`seat-${seat}`}>
        <p className="font-mono text-[11px]"><span className="rounded-sm px-1 text-black" style={{ background: info.color }}>{info.wind}・{info.element}</span>{seat === g.dealer && <span className="text-amber-300"> 親</span>}{g.turn === seat && g.phase === 'play' && <span className="text-lime-300"> ◀</span>}{st.silent && ' 🤫'} <span className="text-slate-400">{seat === HUMAN ? 'YOU' : 'CPU'}</span></p>
        {seat !== HUMAN && <div className="flex flex-wrap gap-0.5">{st.hand.map((c) => <CardFace key={c.id} small down={g.phase === 'play'} c={g.phase === 'play' ? undefined : c} />)}</div>}
        <div className="flex flex-wrap gap-0.5">{st.river.map(({ card, down }) => <CardFace key={card.id} c={card} small down={down} hot={g.pendingRon?.card.id === card.id} />)}</div>
      </div>
    );
  };

  const toggle = (key: keyof RonRules, label?: string) => {
    const on = rules[key] as boolean; const ok = canEdit(role, key);
    return <label key={key} className={`flex items-center gap-1 ${ok ? '' : 'opacity-40'}`} title={ok ? '' : `${ROLES[role].name}には変更の権限がない`}><input type="checkbox" checked={on} disabled={!ok} onChange={(e) => setRule(key, e.target.checked as never)} />{label ?? RULE_LABEL[key]}</label>;
  };

  return (
    <main className="cyber relative min-h-screen overflow-hidden bg-[#03040b] px-4 py-5 text-slate-100 sm:px-8">
      <style>{`
        .cyber::before { content: ''; position: fixed; inset: 45% -50% -40% -50%; background:
          linear-gradient(#ff2bd622 1px, transparent 1px) 0 0 / 60px 60px, linear-gradient(90deg, #00f0ff22 1px, transparent 1px) 0 0 / 60px 60px;
          transform: perspective(500px) rotateX(62deg); pointer-events: none; z-index: 0; }
        .cyber::after { content: ''; position: fixed; inset: 0; pointer-events: none; z-index: 50;
          background: repeating-linear-gradient(180deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px); }
        .cyber > * { position: relative; z-index: 1; }
        .hud::before, .hud::after { content: ''; position: absolute; width: 12px; height: 12px; border-color: inherit; }
        .hud::before { top: -1px; left: -1px; border-top: 2px solid; border-left: 2px solid; }
        .hud::after { bottom: -1px; right: -1px; border-bottom: 2px solid; border-right: 2px solid; }
        .glitch { text-shadow: 2px 0 #ff2bd6, -2px 0 #00f0ff; animation: glitch 4s steps(1) infinite; }
        @keyframes glitch { 0%, 92%, 100% { transform: none; text-shadow: 2px 0 #ff2bd6, -2px 0 #00f0ff; } 94% { transform: translateX(2px) skewX(-6deg); text-shadow: -3px 0 #ff2bd6, 3px 0 #00f0ff; } 97% { transform: translateX(-1px); } }
        @media (prefers-reduced-motion: reduce) { .glitch { animation: none; } }
      `}</style>
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] tracking-[0.4em] text-cyan-300">ORDER_A://PYTHAGOREAN.SCHOOL/INTERIOR v2.077</p>
            <h1 className="glitch font-mono text-2xl font-bold tracking-wide">TETRA ARCANA · トラペザ</h1>
            <p className="text-xs text-slate-400">教団の内装をネオンの遊戯室に改装。卓は 144 枚（12²）、東西南北に火・風・水・地。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/architect" className="border border-cyan-400/50 px-3 py-1 text-cyan-200">ARCHITECT</Link><Link href="/famidance" className="border border-pink-400/50 px-3 py-1 text-pink-200">FAMIDANCE</Link></nav>
        </header>

        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <Panel title="WALL_CLOCK · 6 CUBES" accent={NEON.amber} aria-label="Clock">
            <div className="flex flex-col items-center text-amber-200"><CubeClock /></div>
            <p className="mt-1 text-[10px] text-slate-400">立方体 6 個と枠だけ。∞ の上を時（金）・分（青）・秒（赤と残像 3 つ）が実時刻どおりに回る。</p>
          </Panel>
          <Panel title="WAVE_DIE · 2×3" accent={NEON.pink} aria-label="Wave die">
            <WaveDie layout={layout} onLayout={setLayout} counts={faceCounts} total={totalFaces} flash={flash} />
            <div className="mt-2 flex flex-wrap items-center gap-2 font-mono text-[10px] text-slate-400">
              <span>サイコロの定義：6 つのマスがいつも波を刻む。振った瞬間にいちばん高いマスの面が出る（2 個目は 1/φ 秒後）。ドラッグで面を入れ替え、ホバー／長押しで進行具合。</span>
              <button type="button" onClick={() => setLayout(DEFAULT_LAYOUT)} className="border border-pink-400/50 px-2 text-pink-200">配置を戻す</button>
            </div>
          </Panel>
        </div>

        <Panel title="FLOOR_POINTCLOUD · 7 SPHERES" accent={NEON.lime} aria-label="Floor">
          <div className="text-lime-100"><SevenSpheres throws={throws} icon={icon} /></div>
          <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-slate-400">
            <span>波のサイコロの和を 7 マスに（和 mod 7 + 1）。投げた数 {throws.length}</span>
            {ICONS.map((i) => <button key={i} type="button" aria-pressed={icon === i} onClick={() => setIcon(i)} className={`border px-1.5 ${icon === i ? 'border-lime-300 bg-lime-300 text-black' : 'border-lime-300/40 text-lime-200'}`}>{i}</button>)}
            <button type="button" onClick={() => throwOnly(1)} className="border border-lime-300/60 px-2 text-lime-200">サイコロを振る</button>
            <button type="button" onClick={() => throwOnly(21)} className="border border-lime-300/60 px-2 text-lime-200">21 回振る</button>
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <Panel title="TABLE · TETRA ARCANA" accent={NEON.cyan} aria-label="Table" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <label className="flex items-center gap-1">卓の作者
                <select aria-label="Preset" value={preset} disabled={g.phase === 'play'} onChange={(e) => setPreset(e.target.value as Preset)} className="border border-cyan-400/50 bg-black px-1 text-cyan-200">
                  {(Object.keys(PRESETS) as Preset[]).map((p) => <option key={p} value={p}>{PRESETS[p].name}</option>)}
                </select>
              </label>
              <span className="text-slate-400">{PRESETS[preset].note}</span>
              <button type="button" onClick={newGame} className="ml-auto bg-[#ff2bd6] px-3 py-1 font-bold text-black shadow-[0_0_14px_#ff2bd6]">{g.phase === 'idle' ? 'サイコロを振って始める' : '新しい局'}</button>
              <label className="flex items-center gap-1"><input type="checkbox" checked={fast} onChange={(e) => setFast(e.target.checked)} /> はやく</label>
            </div>
            <div className="grid grid-cols-[1fr_2fr_1fr] gap-2 rounded-sm border border-cyan-400/20 bg-[radial-gradient(ellipse_at_center,#0b2a3a,#050812)] p-2">
              <div />{seatBox(2)}<div />
              {seatBox(3)}
              <div className="flex flex-col items-center justify-center gap-1 border border-cyan-400/30 p-2 text-center font-mono text-xs" data-testid="center">
                <div className="flex gap-2"><Die3D value={g.dice[0]} spin={spin} size={36} /><Die3D value={g.dice[1]} spin={spin} size={36} /></div>
                <p>ピタゴラスの山 <span className="text-cyan-300" data-testid="wall">{g.wall.length}</span>/89 · 公理 3{g.burned ? ` · 焼 ${g.burned}` : ''}</p>
                <div className="flex gap-1">{g.axioms.map((c) => <CardFace key={c.id} c={c} small title="公理（ドラ）" />)}</div>
                <p className="text-[10px] text-slate-400" data-testid="hand-rules">{PRESETS[g.preset].name} · {describe(g.rules)}</p>
              </div>
              {seatBox(1)}
              <div />{seatBox(0)}<div />
            </div>
            <div className="space-y-2 border border-pink-400/30 bg-black/40 p-2">
              <div className="flex flex-wrap gap-1" data-testid="my-hand">{me.hand.map((c) => <CardFace key={c.id} c={c} onClick={myTurn && !me.silent ? () => onCard(c) : undefined} selected={silentMode && riichiable(c)} />)}</div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
                {myTurn && !me.silent && <span className="text-slate-400">捨てる札をクリック</span>}
                {canTsumo && <button type="button" onClick={() => declareTsumo(HUMAN)} className="bg-[#ffb000] px-3 py-1 font-bold text-black shadow-[0_0_12px_#ffb000]">{kind === 'pythagoras' ? 'ハルモニア（ツモ）' : 'Q.E.D.（ツモ）'}</button>}
                {myRon && (<>
                  <button type="button" onClick={() => settleRon(true)} className="bg-[#b6ff00] px-3 py-1 font-bold text-black shadow-[0_0_12px_#b6ff00]">ロン（{SEATS[myRon.from].wind}の {cardLabel(myRon.card)}）{me.silent && kind === 'pythagoras' ? '・無言で II を返す' : ''}</button>
                  <button type="button" onClick={() => settleRon(false)} className="border border-slate-400 px-3 py-1">見逃す</button>
                </>)}
                {myTurn && !me.silent && me.hand.some(riichiable) && <label className="flex items-center gap-1"><input type="checkbox" checked={silentMode} onChange={(e) => setSilentMode(e.target.checked)} /> {kind === 'pythagoras' ? '沈黙の行（II か XII を伏せて捨てる）' : '聴牌を宣言（II か XII を伏せる）'}</label>}
                {me.silent && <span className="border border-pink-400/50 px-2 text-pink-200">{kind === 'pythagoras' ? '🤫 沈黙の行の最中：話すとチョンボ' : '聴牌中'}</span>}
                {me.hand.some(isFava) && kind === 'pythagoras' && <span className="text-lime-300">豆＝ペンタクルの 5：捨てると −1、和了まで残すと −2</span>}
                <form className="ml-auto flex gap-1" onSubmit={(e) => { e.preventDefault(); say(); }}><input aria-label="Speak" value={chat} onChange={(e) => setChat(e.target.value)} placeholder="> 卓で発声する" className="w-40 border border-cyan-400/40 bg-black px-1 text-cyan-100" /><button type="submit" className="border border-cyan-400/60 px-2 text-cyan-200">言う</button></form>
              </div>
            </div>
            {g.winners.length > 0 && (
              <div className="space-y-2" data-testid="result">
                {g.winners.map((w) => (
                  <div key={w.seat} className="border border-amber-300/60 bg-black/60 p-3 shadow-[0_0_16px_#ffb00033]">
                    <p className="font-mono text-lg font-bold text-amber-200">{SEATS[w.seat].wind}（{w.seat === HUMAN ? 'YOU' : 'CPU'}）の{w.by === 'ron' ? `ロン ← ${SEATS[w.from!].wind}` : 'ツモ'} · {w.score.han} 翻</p>
                    <ul className="font-mono text-sm">{w.score.yaku.map((y) => <li key={y.name}>{y.name}{y.note ? `（${y.note}）` : ''}：{y.han > 0 ? '+' : ''}{y.han}</li>)}</ul>
                    {w.score.decomp && <p className="text-xs text-slate-400">面子：{w.score.decomp.melds.map((m) => `${m.kind === 'wild' ? '宇宙の理' : `${SUIT_INFO[m.suit].name}${nums(m.suit, m.ns)}（${MELD_NAME[m.kind]}${m.wilds ? `・✶${m.wilds}` : ''}）`}`).join(' ／ ')} ／ 雀頭 {w.score.decomp.pair.ns.length ? nums(w.score.decomp.pair.suit, w.score.decomp.pair.ns) : '宇宙の理'}</p>}
                    {kind === 'pythagoras' && <button type="button" onClick={() => playChord(w.score.ratios)} className="mt-1 border border-amber-300/60 px-2 font-mono text-xs text-amber-200">モノコード（比 {w.score.ratios.map((r) => r.toFixed(2)).join(' : ')}）</button>}
                  </div>
                ))}
              </div>
            )}
            <ol className="max-h-28 overflow-y-auto font-mono text-[11px] text-cyan-100/80" data-testid="log">{g.log.map((l, i) => <li key={i}>&gt; {l}</li>)}</ol>
          </Panel>

          <Panel title="AUTHORITY · 権限" accent={NEON.amber} aria-label="Authority" className="space-y-2 font-mono text-xs">
            <p className="text-slate-400">役割は大アルカナ。規則の変更は記録され、次の局から効く（進行中の局は変わらない）。</p>
            <div className="grid grid-cols-2 gap-1">
              {(Object.keys(ROLES) as Role[]).map((r) => (
                <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)} className={`border px-1 py-1 text-left ${role === r ? 'border-amber-300 bg-amber-300/15 text-amber-200' : 'border-white/15 text-slate-300'}`}>
                  <span className="text-pink-300">{ROLES[r].card}</span> {ROLES[r].name}
                </button>
              ))}
            </div>
            <p className="text-amber-200" data-testid="role-can">{ROLES[role].card} {ROLES[role].name}：{ROLES[role].can}</p>
            <div className="space-y-1 border border-amber-300/20 p-2" data-testid="rules-editor">
              {toggle('ron')}
              <label className={`flex items-center gap-1 ${canEdit(role, 'from') ? '' : 'opacity-40'}`}>{RULE_LABEL.from}
                <select aria-label="Ron from" value={rules.from} disabled={!canEdit(role, 'from')} onChange={(e) => setRule('from', e.target.value as RonRules['from'])} className="border border-amber-300/40 bg-black px-1">
                  <option value="any">誰の捨て札でも</option><option value="kamicha">上家だけ</option>
                </select>
              </label>
              {toggle('furiten', 'フリテン（自分が捨てた札・見逃した札ではロンできない）')}
              {toggle('silentOnly')}
              <label className={`flex items-center gap-1 ${canEdit(role, 'hanAdjust') ? '' : 'opacity-40'}`}>{RULE_LABEL.hanAdjust}
                <input aria-label="Ron han adjust" type="range" min={-2} max={2} value={rules.hanAdjust} disabled={!canEdit(role, 'hanAdjust')} onChange={(e) => setRule('hanAdjust', Number(e.target.value))} /> {rules.hanAdjust > 0 ? '+' : ''}{rules.hanAdjust}
              </label>
              <label className={`flex items-center gap-1 ${canEdit(role, 'multi') ? '' : 'opacity-40'}`}>{RULE_LABEL.multi}
                <select aria-label="Multiple ron" value={rules.multi} disabled={!canEdit(role, 'multi')} onChange={(e) => setRule('multi', e.target.value as RonRules['multi'])} className="border border-amber-300/40 bg-black px-1">
                  <option value="atamahane">頭ハネ（下家に近い 1 人）</option><option value="double">ダブロン（全員）</option>
                </select>
              </label>
              {toggle('tsumoBonus')}
            </div>
            <p data-testid="next-rules">次の局：{describe(rules)}</p>
            <ol className="space-y-0.5 text-[10px] text-slate-400" data-testid="rule-log">{ruleLog.map((l, i) => <li key={i}>{l}</li>)}</ol>
          </Panel>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Panel title="DIFF · PYTHAGORAS / EUCLID" accent={NEON.cyan} aria-label="Comparison" className="text-xs">
            <table className="w-full"><thead><tr className="text-left text-cyan-300"><th className="w-16" /><th>ピタゴラス</th><th>ユークリッド</th></tr></thead>
              <tbody>{COMPARISON.map(([k, a, b]) => <tr key={k} className="border-t border-white/10 align-top"><td className="py-1 font-bold text-pink-300">{k}</td><td className="py-1 pr-2">{a}</td><td className="py-1">{b}</td></tr>)}</tbody></table>
          </Panel>
          <Panel title="ARCHIVE · 資料と書架" accent={NEON.pink} aria-label="Shelf" className="space-y-2 text-xs">
            <ul className="list-disc pl-4 text-slate-300">
              <li>144 枚＝12²＝第 12 フィボナッチ数。1.618 の分業 → ユークリッド 55（配牌 52 ＋ 公理 3）とピタゴラス 89（山）。</li>
              <li>テトラクテュスの 4 は四元素をまたいでよい。大アルカナは 7 種＋XII の 8 種 × 3 枚。</li>
              <li>ソラマメの禁忌、沈黙の行（話すとチョンボ）、モノコードの精算。ロンは権限パネルで。</li>
              <li>波のサイコロ：ピタゴラス音律の 6 つの周波数（1・9/8・81/64・4/3・3/2・27/16）。</li>
            </ul>
            <ul className="list-disc pl-4 text-slate-400">
              <li>ルノルマン（18〜19 世紀のカード占い師）／パメラ・コールマン・スミス（ウェイト＝スミス版の画家）／ローリー・キャボット（セイラムの現代魔女）</li>
              <li>タロットが占いに使われ始めたのは 16〜18 世紀頃で、中世の魔女裁判の時代とは重ならない。</li>
            </ul>
          </Panel>
        </div>
      </div>
    </main>
  );
}
