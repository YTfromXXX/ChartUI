'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import DancerStage, { type DancerLook } from '@/components/famidance/DancerStage';
import { JP_LABEL, MAX_TABLE_APIS, SURVEY_APIS, tableProfile } from '@/lib/apiSurvey';
import WaveDie from '@/components/tetra/WaveDie';
import { BONE_LABEL, CELL_JOINT, CELL_JOINT_LABEL, PORT_BONE, boneAngle, friction, guide, pairKey, waveOffsets } from '@/lib/famiLink';
import { DEFAULT_POSE, PARAM_INFO, SynthApi, breathe, constrain, dancePose, fan, paramsOf, type Note, type Pose, type Step } from '@/lib/famiDance';
import { FAMI_PORTS } from '@/lib/idlecrash';
import { rollWave, wave } from '@/lib/waveDie';
import { useWaveLayout } from '@/lib/waveLayoutStore';

type Sym = 'BTC' | 'USD' | 'XAU' | 'CPU';
const ALL: Sym[] = ['BTC', 'USD', 'XAU', 'CPU'];
type Score = { perfect: number; good: number; miss: number; combo: number; best: number };
const LOOKS: Record<Sym, DancerLook> = {
  BTC: { sym: 'BTC', tag: '₿ BTC', body: '#ff8c1a', accent: '#ffd400', skin: '#f2b48a' },
  USD: { sym: 'USD', tag: '$ USD', body: '#2fbf4a', accent: '#7fc4ff', skin: '#e3a179' },
  XAU: { sym: 'XAU', tag: 'Au XAU', body: '#c9a23a', accent: '#fff1a8', skin: '#f7caa8' },
  CPU: { sym: 'CPU', tag: '⚙ CPU（自動投入）', body: '#3dd6ff', accent: '#e040fb', skin: '#cfcfcf' },
};
const START: Record<Sym, number> = { BTC: 100000, USD: 100, XAU: 2650, CPU: 50 };
const KEYS: Record<string, [0 | 1, Step]> = {
  a: [0, '←'], s: [0, '↓'], w: [0, '↑'], d: [0, '→'], ' ': [0, '★'],
  ArrowLeft: [1, '←'], ArrowDown: [1, '↓'], ArrowUp: [1, '↑'], ArrowRight: [1, '→'], Enter: [1, '★'],
};
const AUTO_SKILL: Record<Sym, number> = { BTC: 0.9, USD: 0.9, XAU: 0.85, CPU: 0.97 };
const PERFECT_S = 0.06;
const newScore = (): Score => ({ perfect: 0, good: 0, miss: 0, combo: 0, best: 0 });
const STORE = 'famidance-poses-v1';

/**
 * FamiDance dual battle. Each Famicom dancer is a symbol and its body is the parameter set of that
 * symbol's synthetic API: drag the joints to change the steps the API produces. YogaTime is the
 * resting state; Dancing ("auto-trading active", paper and synthetic only) starts only when both
 * players agree, and Esc returns everyone to YogaTime.
 */
export default function FamiDancePage() {
  const [layout, setLayout] = useState<'duel' | 'quad'>('duel');
  const [mode, setMode] = useState<'yoga' | 'dance'>('yoga');
  const [poses, setPoses] = useState<Record<Sym, Pose>>(() => ({ BTC: DEFAULT_POSE, USD: constrain({ ...DEFAULT_POSE, hip: { x: 60, y: 104 } }), XAU: constrain({ ...DEFAULT_POSE, lHand: { x: 30, y: 60 }, rHand: { x: 90, y: 60 } }), CPU: constrain({ ...DEFAULT_POSE, head: { x: 68, y: 50 } }) }));
  const [auto, setAuto] = useState<Record<Sym, boolean>>({ BTC: false, USD: false, XAU: true, CPU: true });
  const [consent, setConsent] = useState({ p1: false, p2: false, paper: false });
  const [bpm, setBpm] = useState(100);
  const [table, setTable] = useState<string[]>([]);
  const [tableMsg, setTableMsg] = useState('');
  const [muted, setMuted] = useState(false);
  const [results, setResults] = useState<null | { sym: Sym; score: Score; price: number; fan: ReturnType<typeof fan> }[]>(null);
  const [, setFrame] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [announce, setAnnounce] = useState('');
  const [duelPair, setDuelPair] = useState<[Sym, Sym]>(['BTC', 'USD']);
  const [waveLayout, setWaveLayout] = useWaveLayout();
  const [faceCounts, setFaceCounts] = useState<Record<number, number>>({});
  const [port, setPort] = useState(2);
  const [holding, setHolding] = useState<Sym>('USD');
  const [traded, setTraded] = useState<string[]>([pairKey('USD', 'BTC')]);
  const syms: Sym[] = layout === 'duel' ? duelPair : ALL;
  const players: [Sym, Sym] = layout === 'duel' ? duelPair : ['BTC', 'USD'];
  const profile = tableProfile(table);

  const game = useRef({
    t0: 0, apis: {} as Record<Sym, SynthApi>, notes: {} as Record<Sym, Note[]>, last: {} as Record<Sym, { step: Step; at: number }>,
    score: {} as Record<Sym, Score>, judge: {} as Record<Sym, { text: string; at: number }>, lastBeat: -1, audio: null as AudioContext | null,
    lead: null as null | { cell: number; face: number; beat: number }, series: { BTC: [], USD: [], XAU: [], CPU: [] } as Record<Sym, number[]>, lastSample: 0,
  });
  const live = useRef({ poses, auto, bpm, syms, profile, muted, mode, waveLayout, port, players }); live.current = { poses, auto, bpm, syms, profile, muted, mode, waveLayout, port, players };

  // Poses persist on this device only.
  // Save only after the stored poses were read, so the defaults never overwrite them.
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try { const s = localStorage.getItem(STORE); if (s) { const saved = JSON.parse(s) as Record<Sym, Pose>; setPoses((p) => ({ ...p, ...Object.fromEntries(Object.entries(saved).map(([k, v]) => [k, constrain(v)])) })); } } catch { /* storage unavailable */ }
    setLoaded(true);
  }, []);
  useEffect(() => { if (!loaded) return; try { localStorage.setItem(STORE, JSON.stringify(poses)); } catch { /* storage unavailable */ } }, [poses, loaded]);

  /** What a dancer looks like right now: its pose, swayed by the wave die, then the step it dances. */
  const poseFor = (s: Sym, nowMs: number): Pose => {
    const L = live.current; const g = game.current; const lead = L.mode === 'dance' && g.lead ? g.lead.cell : null;
    const swayed = waveOffsets(L.poses[s], L.waveLayout, (cell) => wave(cell, nowMs), L.mode === 'dance' ? 1 : 0.6, lead);
    if (L.mode === 'yoga') return breathe(swayed, nowMs / 1000 + s.charCodeAt(0));
    const t = (performance.now() - g.t0) / 1000; const beat = t / (60 / L.bpm); const l = g.last[s];
    return dancePose(swayed, l ? l.step : null, l ? beat - l.at : 1);
  };
  const spb = () => 60 / live.current.bpm;
  useEffect(() => { game.current.series = { BTC: [], USD: [], XAU: [], CPU: [] }; }, [port]); // a new bone starts a new series
  const nowS = () => (performance.now() - game.current.t0) / 1000;
  const goodWindow = () => Math.max(0.08, 0.16 - live.current.profile.feeBps * 0.002);

  const startDance = () => {
    const g = game.current; g.t0 = performance.now() + 1500; g.lastBeat = -1; // a short count-in
    for (const s of ['BTC', 'USD', 'XAU', 'CPU'] as Sym[]) { g.apis[s] = new SynthApi((Date.now() + s.charCodeAt(0) * 977) % 1e9, START[s]); g.notes[s] = []; g.score[s] = newScore(); delete g.last[s]; delete g.judge[s]; }
    if (!g.audio) { const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext; if (Ctx) g.audio = new Ctx(); }
    setResults(null); setMode('dance'); setAnnounce('Dancing 開始。合成 API・ペーパーのみ。Esc で YogaTime に戻る。');
  };
  const stopDance = useCallback(() => {
    if (live.current.mode !== 'dance') return;
    const g = game.current;
    setResults(live.current.syms.map((s) => ({ sym: s, score: { ...g.score[s] }, price: g.apis[s].price, fan: fan(paramsOf(live.current.poses[s]), g.apis[s].price, 32, 200, 7) })));
    setMode('yoga'); setConsent((c) => ({ ...c, p1: false, p2: false })); setAnnounce('YogaTime に戻りました。');
  }, []);

  const judgeNote = (s: Sym, n: Note, text: Note['judged']) => {
    const g = game.current; const sc = g.score[s]; n.judged = text; n.hit = text !== 'MISS';
    if (text === 'PERFECT') sc.perfect += 1; else if (text === 'GOOD') sc.good += 1; else sc.miss += 1;
    sc.combo = text === 'MISS' ? 0 : sc.combo + 1; sc.best = Math.max(sc.best, sc.combo);
    g.judge[s] = { text, at: nowS() }; if (text !== 'MISS') g.last[s] = { step: n.step, at: nowS() / spb() };
  };

  // Game loop: generate steps from each dancer's pose, auto-play, mark misses, tick the beat.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      const L = live.current; const g = game.current;
      if (L.mode === 'dance') {
        const t = nowS(); const beat = t / spb(); const lag = L.profile.latencyMs / 1000 / spb();
        for (const s of ALL) { // hidden dancers keep dancing virtually (auto), for the matrix grid
          const api = g.apis[s]; const notes = g.notes[s];
          while (api.beat < beat + 7) notes.push(...api.nextBeat(paramsOf(L.poses[s])).map((n) => ({ ...n, at: n.at + lag })));
          for (const n of notes) {
            if (n.judged) continue;
            const dt = (n.at - beat) * spb();
            if ((L.auto[s] || !L.players.includes(s) || !L.syms.includes(s)) && dt <= 0) { const r = Math.random(); judgeNote(s, n, r < AUTO_SKILL[s] * 0.8 ? 'PERFECT' : r < AUTO_SKILL[s] ? 'GOOD' : 'MISS'); }
            else if (dt < -goodWindow()) judgeNote(s, n, 'MISS');
          }
          g.notes[s] = notes.filter((n) => n.at > beat - 2);
        }
        const whole = Math.floor(beat);
        if (whole !== g.lastBeat && whole >= 0) {
          g.lastBeat = whole;
          // Read the wave die at the beat: the top cell's joint leads this beat.
          const r = rollWave(L.waveLayout, Date.now());
          g.lead = { cell: r.cells[0], face: r.faces[0], beat: whole };
          setFaceCounts((c) => ({ ...c, [r.faces[0]]: (c[r.faces[0]] ?? 0) + 1, [r.faces[1]]: (c[r.faces[1]] ?? 0) + 1 }));
          if (g.audio && !L.muted) { const o = g.audio.createOscillator(); const gn = g.audio.createGain(); o.frequency.value = whole % 4 === 0 ? 1320 : 880; gn.gain.setValueAtTime(0.06, g.audio.currentTime); gn.gain.exponentialRampToValueAtTime(0.0001, g.audio.currentTime + 0.05); o.connect(gn).connect(g.audio.destination); o.start(); o.stop(g.audio.currentTime + 0.06); }
        }
      }
      // Sample the selected port's bone for every dancer (about 20 times a second).
      const nowMs = Date.now();
      if (nowMs - g.lastSample > 50) {
        g.lastSample = nowMs; const bone = PORT_BONE[L.port].bone;
        for (const s of ALL) { const arr = g.series[s]; arr.push(boneAngle(poseFor(s, nowMs), bone)); if (arr.length > 400) arr.shift(); }
      }
      setFrame((f) => (f + 1) % 1e6);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { stopDance(); return; }
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.getAttribute('role') === 'slider')) return;
      const L = live.current; if (L.mode !== 'dance') return;
      const k = KEYS[e.key.length === 1 ? e.key.toLowerCase() : e.key]; if (!k) return;
      const [slot, step] = k; const s = L.players[slot]; if (!L.syms.includes(s) || L.auto[s]) return;
      e.preventDefault();
      const beat = nowS() / spb();
      const n = game.current.notes[s].filter((x) => !x.judged && x.step === step).sort((a, b) => Math.abs(a.at - beat) - Math.abs(b.at - beat))[0];
      if (!n) return; const dt = Math.abs(n.at - beat) * spb();
      if (dt <= PERFECT_S) judgeNote(s, n, 'PERFECT'); else if (dt <= goodWindow()) judgeNote(s, n, 'GOOD');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stopDance]);

  // Table: the synthetic API plus at most two real API profiles, by drag and drop or click.
  const addApi = (id: string) => {
    setTable((t) => { if (t.includes(id)) return t; if (t.length >= MAX_TABLE_APIS) { setTableMsg(`テーブルに置ける API は ${MAX_TABLE_APIS} つまで（本当に必要な組み合わせだけ）`); return t; } setTableMsg(''); return [...t, id]; });
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); const id = e.dataTransfer.getData('text/api'); if (id) addApi(id); };

  const g = game.current; const t = mode === 'dance' ? nowS() : performance.now() / 1000; const beat = mode === 'dance' ? t / spb() : 0;
  const shownPose = (s: Sym): Pose => (mounted ? poseFor(s, Date.now()) : poses[s]);
  const glass = 'rounded border-2 border-white/20 bg-black/60';
  const canDance = consent.p1 && consent.p2 && consent.paper;

  return (
    <main className="min-h-screen bg-[#0a0a12] px-3 py-4 font-mono text-slate-100 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] tracking-[0.4em] text-pink-300">FAMIDANCE · DUAL BATTLE</p>
            <h1 className="text-xl font-bold">ファミダンス · {mode === 'dance' ? <span className="text-[#ffd400]">Dancing（自動取引アクティブ・合成 API／ペーパー）</span> : <span className="text-[#7fc4ff]">YogaTime（自動取引は休止中）</span>}</h1>
            <p className="text-xs text-slate-400">ダンサーの体がそのまま合成 API のパラメーター。関節の ○ をドラッグして形を変えると、出てくるステップが変わる。</p>
          </div>
          <nav className="flex gap-2 text-xs"><Link href="/cure-api" className={`${glass} px-2 py-1`}>Cure-API</Link><Link href="/lab/silicon" className={`${glass} px-2 py-1`}>シリコン LAB</Link></nav>
        </header>
        <p aria-live="polite" className="sr-only">{announce}</p>

        <section aria-label="Controls" className={`${glass} flex flex-wrap items-center gap-3 p-2 text-xs`}>
          {(['duel', 'quad'] as const).map((l) => <button key={l} type="button" aria-pressed={layout === l} disabled={mode === 'dance'} onClick={() => setLayout(l)} className={`border px-2 py-1 ${layout === l ? 'border-pink-300 bg-pink-300/20' : 'border-white/20'} disabled:opacity-40`}>{l === 'duel' ? `1 対 1（${duelPair[0]} ⇄ ${duelPair[1]}）` : '4 人の分割画面'}</button>)}
          <label className="flex items-center gap-1">テンポ <input aria-label="Tempo" type="range" min={60} max={180} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} /> {bpm} BPM</label>
          {players.map((s) => <label key={s} className="flex items-center gap-1"><input type="checkbox" checked={auto[s]} onChange={(e) => setAuto((a) => ({ ...a, [s]: e.target.checked }))} /> {s} を自動に</label>)}
          <label className="flex items-center gap-1"><input type="checkbox" checked={!muted} onChange={(e) => setMuted(!e.target.checked)} /> 拍の音</label>
          <span className="ml-auto text-slate-400">P1（{players[0]}）：W A S D ＋ Space ／ P2（{players[1]}）：矢印 ＋ Enter ／ Esc：YogaTime</span>
        </section>

        <div className={`grid gap-2 ${layout === 'duel' ? 'md:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
          {syms.map((s) => {
            const pr = paramsOf(poses[s]); const sc = g.score[s] ?? newScore(); const jd = g.judge[s];
            return (
              <div key={s} className={`${glass} p-1`} data-testid={`pane-${s}`}>
                <DancerStage look={LOOKS[s]} base={poses[s]} shown={shownPose(s)} onPose={(p) => setPoses((ps) => ({ ...ps, [s]: p }))}
                  notes={mode === 'dance' ? g.notes[s] ?? [] : []} nowBeat={beat} judge={mode === 'dance' && jd ? { text: jd.text, age: t - jd.at } : null} dancing={mode === 'dance'}
                  laneLabel={!players.includes(s) || auto[s] ? 'AUTO' : s === players[0] ? 'P1' : 'P2'} lead={mode === 'dance' && g.lead ? CELL_JOINT[g.lead.cell] : undefined} />
                <div className="grid grid-cols-5 gap-1 px-1 text-[9px]" data-testid={`params-${s}`}>
                  {PARAM_INFO.map((p) => { const v = pr[p.key]; const w = p.key === 'drift' ? Math.abs(v) * 50 : v * 100; return (
                    <div key={p.key} title={`${p.name} ← ${p.from}`}>
                      <div className="truncate" style={{ color: p.color }}>{p.name}</div>
                      <div className="relative h-1.5 bg-white/10"><div className="absolute h-1.5" style={{ background: p.color, width: `${w}%`, left: p.key === 'drift' ? (v < 0 ? `${50 - w}%` : '50%') : 0 }} /></div>
                      <div className="text-slate-400">{p.key === 'drift' ? (v >= 0 ? '+' : '') : ''}{v.toFixed(2)}</div>
                    </div>
                  ); })}
                </div>
                <div className="flex justify-between px-1 pt-0.5 text-[10px] text-slate-300">
                  <span>{mode === 'dance' && g.apis[s] ? `${s} ${g.apis[s].price.toFixed(s === 'BTC' ? 0 : 2)}` : `${s} 待機`}</span>
                  <span data-testid={`score-${s}`}>P {sc.perfect} · G {sc.good} · M {sc.miss} · combo {sc.combo}</span>
                  <button type="button" className="text-slate-500 underline" onClick={() => setPoses((ps) => ({ ...ps, [s]: DEFAULT_POSE }))}>形を戻す</button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <section aria-label="Wave die link" className={`${glass} space-y-1 p-2 text-xs`}>
            <p className="font-bold text-pink-300">波のサイコロ ⇄ 骨格（Tetra Arcana の部屋と共有）</p>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] text-slate-400">{CELL_JOINT_LABEL.map((l, i) => <span key={l}>{l}{mode === 'dance' && g.lead?.cell === i ? ' ◀ リード' : ''}</span>)}</div>
            <WaveDie layout={waveLayout} onLayout={setWaveLayout} counts={faceCounts} total={Object.values(faceCounts).reduce((a, b) => a + b, 0)} flash={mode === 'dance' && g.lead ? [g.lead.cell] : []} />
            <p className="text-[10px] text-slate-400">2×3 のマスは体の地図：上段が左手・頭・右手、下段が左足・腰・右足。マスの波がその関節を揺らし、置いた面（1〜6）が揺れの大きさになる。Dancing 中は拍ごとにサイコロを読み、いちばん高いマスの関節がリード（揺れ 2 倍）。</p>
            <p data-testid="lead">{mode === 'dance' && g.lead ? `拍 ${g.lead.beat}：リードは ${CELL_JOINT_LABEL[g.lead.cell]}（面 ${g.lead.face}）` : 'Dancing を始めると拍ごとにリードが決まる'}</p>
          </section>
          {(() => {
            const fr = (a: string, b: string) => friction(g.series[a as Sym], g.series[b as Sym]);
            const tradedSet = new Set(traded); const gd = guide(ALL, tradedSet, fr); const pb = PORT_BONE[port];
            const color = (v: number | null) => (v === null ? '#333' : `hsl(${190 + v * 130} 90% ${45 + v * 10}%)`);
            return (
              <section aria-label="Matrix grid" className={`${glass} space-y-2 p-2 text-xs`}>
                <p className="font-bold text-[#7fc4ff]">マトリックスグリッド：骨 1 本で測る摩擦</p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1">装置
                    <select aria-label="Port" value={port} onChange={(e) => setPort(Number(e.target.value))} className="max-w-[220px] border border-white/30 bg-black px-1">
                      {FAMI_PORTS.map((fp) => <option key={fp.no} value={fp.no}>ポート {fp.no}：{fp.title}</option>)}
                    </select>
                  </label>
                  <span data-testid="port-bone">→ {BONE_LABEL[pb.bone]} だけを読む（{pb.why}）</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1">カスタマーの保有
                    <select aria-label="Holding" value={holding} onChange={(e) => setHolding(e.target.value as Sym)} className="border border-white/30 bg-black px-1">{ALL.map((x) => <option key={x}>{x}</option>)}</select>
                  </label>
                  <span className="text-slate-400">マスを押すと「実際に取引している組」を切り替える</span>
                </div>
                <table className="w-full border-collapse text-center" data-testid="matrix">
                  <thead><tr><th />{ALL.map((c) => <th key={c} style={{ color: LOOKS[c].accent }}>{c}{c === holding ? ' 💼' : ''}</th>)}</tr></thead>
                  <tbody>{ALL.map((r) => (
                    <tr key={r}><th className="pr-1 text-right" style={{ color: LOOKS[r].accent }}>{r}{r === holding ? ' 💼' : ''}</th>
                      {ALL.map((c) => {
                        if (r === c) return <td key={c} className="text-slate-600">—</td>;
                        const k = pairKey(r, c); const real = tradedSet.has(k); const v = fr(r, c);
                        return (
                          <td key={c} className="p-0.5">
                            <button type="button" data-pair={k} aria-pressed={real} onClick={() => setTraded((tt) => (tt.includes(k) ? tt.filter((x) => x !== k) : [...tt, k]))}
                              className="w-full px-1 py-1" style={{ border: `1px ${real ? 'solid' : 'dashed'} ${real ? '#b6ff00' : '#ffffff40'}`, background: `${color(v)}${real ? '55' : '22'}`, color: real ? '#b6ff00' : '#cbd5e1' }}>
                              {v === null ? '…' : v.toFixed(2)}<br /><span className="text-[9px]">{real ? '実取引' : '仮想'}</span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}</tbody>
                </table>
                <p className="text-[10px] text-slate-400">摩擦 ＝（1 − 2 人の {BONE_LABEL[pb.bone]} の角度変化の相関）÷ 2。0 は一緒に動く、1 は逆に動く。画面にいないダンサーも裏で踊り（仮想構築）、表のすべてのマスを埋める。</p>
                <div className="space-y-1 border-t border-white/10 pt-1" data-testid="guide">
                  <p>実取引の摩擦の平均 {gd.base.toFixed(2)} ／ 次に仮想で踊らせてみる組（実取引と記号を 1 つ共有し、摩擦の違いが大きい順）：</p>
                  {gd.suggestions.slice(0, 2).map((x) => (
                    <div key={`${x.a}${x.b}`} className="flex items-center gap-2">
                      <span>{x.a} × {x.b}：摩擦 {x.friction.toFixed(2)}（差 {x.contrast.toFixed(2)}）</span>
                      <button type="button" disabled={mode === 'dance'} onClick={() => { setDuelPair([x.a as Sym, x.b as Sym]); setLayout('duel'); }} className="border border-[#7fc4ff] px-2 text-[#7fc4ff] disabled:opacity-40">1 対 1 で踊らせる</button>
                    </div>
                  ))}
                  {!gd.suggestions.length && <p className="text-slate-500">計測がまだ溜まっていない（数秒待つか、Dancing を始める）。</p>}
                  <p className="text-[10px] text-slate-500">合成 API の上での練習用の地図。投資の助言ではない。</p>
                </div>
              </section>
            );
          })()}
        </div>

        <div className="grid gap-2 lg:grid-cols-[1fr_1fr]">
          <section aria-label="Consent" className={`${glass} space-y-1 p-2 text-xs`}>
            {mode === 'yoga' ? (<>
              <p className="font-bold text-[#7fc4ff]">YogaTime → Dancing には 2 人の合意が必要</p>
              <label className="flex items-center gap-1"><input type="checkbox" checked={consent.p1} onChange={(e) => setConsent((c) => ({ ...c, p1: e.target.checked }))} /> P1（{players[0]}）：Dancing に同意する。いつでも Esc で止められる</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={consent.p2} onChange={(e) => setConsent((c) => ({ ...c, p2: e.target.checked }))} /> P2（{players[1]}）：Dancing に同意する。いつでも Esc で止められる</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={consent.paper} onChange={(e) => setConsent((c) => ({ ...c, paper: e.target.checked }))} /> 値動きは合成 API。実際の注文は出さない（ペーパー）</label>
              <button type="button" disabled={!canDance} onClick={startDance} className="mt-1 bg-[#d6001c] px-4 py-1 font-bold text-white disabled:opacity-40">Dancing を始める</button>
            </>) : (<>
              <p className="font-bold text-[#ffd400]">Dancing 中 · 拍 {Math.max(0, Math.floor(beat))}{beat < 0 ? `（カウントイン ${Math.ceil(-beat)}）` : ''}</p>
              <p className="text-slate-400">踊りながら関節をドラッグしても、次の拍からパラメーターが変わる。点線は自分で決めた形、塗りは踊っている形。</p>
              <button type="button" onClick={stopDance} className="bg-[#7fc4ff] px-4 py-1 font-bold text-black">YogaTime に戻る（Esc）</button>
            </>)}
          </section>
          <section aria-label="API table" className={`${glass} space-y-1 p-2 text-xs`}>
            <p className="font-bold">テーブル：合成 API ＋ 実 API の組み合わせ（{MAX_TABLE_APIS} つまで）</p>
            <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} className="flex min-h-[38px] flex-wrap items-center gap-1 border-2 border-dashed border-white/30 p-1" data-testid="api-table">
              <span className="bg-[#e040fb] px-2 py-0.5 font-bold text-black">合成 API</span>
              {table.map((id) => { const a = SURVEY_APIS.find((x) => x.id === id)!; return <span key={id} className="flex items-center gap-1 bg-white px-2 py-0.5 text-black">{a.name}<button type="button" aria-label={`Remove ${a.name}`} onClick={() => setTable((tt) => tt.filter((x) => x !== id))}>×</button></span>; })}
              {table.length < MAX_TABLE_APIS && <span className="text-slate-500">← 下からドラッグ</span>}
            </div>
            <p data-testid="profile">{profile.label} · 遅延 {profile.latencyMs} ms（ステップが遅れて届く） · 手数料 {profile.feeBps} bp（判定が {Math.round(goodWindow() * 1000)} ms に狭まる）</p>
            {tableMsg && <p role="alert" className="text-amber-300">{tableMsg}</p>}
            <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
              {SURVEY_APIS.map((a) => (
                <button key={a.id} type="button" draggable onDragStart={(e) => e.dataTransfer.setData('text/api', a.id)} onClick={() => addApi(a.id)} title={`${a.square}・${a.kind}・${JP_LABEL[a.jp]}（仮の値：${a.latencyMs} ms / ${a.feeBps} bp）`}
                  className={`border px-1.5 py-0.5 text-[10px] ${table.includes(a.id) ? 'border-pink-300 text-pink-300' : 'border-white/20'} ${a.jp === 'no' ? 'opacity-50' : ''}`}>{a.rank}. {a.name}</button>
              ))}
            </div>
            <p className="text-[10px] text-slate-500">遅延と手数料は調査カードで置き換える前の仮の値。どの API にも接続しない。</p>
          </section>
        </div>

        {results && (
          <section aria-label="Results" className={`${glass} space-y-2 p-2 text-xs`}>
            <p className="font-bold">結果と「その後」の見通し（合成 API・32 拍 × 200 本の幅。予測ではない）</p>
            <div className={`grid gap-2 ${results.length > 2 ? 'sm:grid-cols-4' : 'sm:grid-cols-2'}`}>
              {results.map((r) => {
                const lo = Math.min(...r.fan.map((f) => f.p5)); const hi = Math.max(...r.fan.map((f) => f.p95)); const y = (v: number) => 56 - ((v - lo) / (hi - lo || 1)) * 52; const x = (i: number) => (i / 32) * 160;
                const acc = r.score.perfect + r.score.good + r.score.miss ? Math.round(((r.score.perfect + r.score.good * 0.5) / (r.score.perfect + r.score.good + r.score.miss)) * 100) : 0;
                return (
                  <div key={r.sym} className="border border-white/10 p-1" data-testid={`result-${r.sym}`}>
                    <p style={{ color: LOOKS[r.sym].accent }}>{LOOKS[r.sym].tag} · 正確さ {acc}% · 最大 combo {r.score.best}</p>
                    <svg viewBox="0 0 160 60" className="w-full" role="img" aria-label={`${r.sym} fan`}>
                      <polygon points={`${r.fan.map((f, i) => `${x(i)},${y(f.p95)}`).join(' ')} ${r.fan.map((f, i) => `${x(i)},${y(f.p5)}`).reverse().join(' ')}`} fill={LOOKS[r.sym].body} opacity={0.3} />
                      <polyline points={r.fan.map((f, i) => `${x(i)},${y(f.p50)}`).join(' ')} fill="none" stroke={LOOKS[r.sym].accent} strokeWidth={1.2} />
                    </svg>
                    <p className="text-slate-400">いま {r.price.toFixed(r.sym === 'BTC' ? 0 : 2)} → 32 拍後 中央 {r.fan[32].p50.toFixed(r.sym === 'BTC' ? 0 : 2)}（90% の幅 {r.fan[32].p5.toFixed(r.sym === 'BTC' ? 0 : 2)}〜{r.fan[32].p95.toFixed(r.sym === 'BTC' ? 0 : 2)}）</p>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
