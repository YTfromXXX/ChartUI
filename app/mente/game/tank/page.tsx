'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import EventDisplay, { type View } from '@/components/tank/EventDisplay';
import { hits, makeEvent, pmts, type Ev } from '@/lib/tank';

const INK = '#0b0f17'; const PANEL = '#121826'; const LINE = '#243049';
const GIRL = '#f29b30'; const BOY = '#22b8c8';

/** A small CSS operator (original figures in the アリミノ colours): idle bob, a reaction on each event. */
function Operator({ who, color, says, busy }: { who: string; color: string; says: string; busy: boolean }) {
  return (
    <div className="flex items-end gap-2" data-testid={`op-${who}`}>
      <div className={`relative h-14 w-10 ${busy ? 'motion-safe:animate-[nod_0.6s_ease-in-out_2]' : 'motion-safe:animate-[bob_3s_ease-in-out_infinite]'}`} aria-hidden>
        <div className="absolute left-1 top-0 h-8 w-8 rounded-full" style={{ background: color }} />
        <div className="absolute left-2 top-2 h-6 w-6 rounded-full bg-[#ffe3c7]" />
        <div className="absolute left-[11px] top-[14px] h-1 w-1 rounded-full bg-black" /><div className="absolute left-[21px] top-[14px] h-1 w-1 rounded-full bg-black" />
        <div className="absolute left-1 top-8 h-6 w-8 rounded-t-md bg-[#e9eef5]" />
        <div className="absolute left-0 top-9 h-1 w-10" style={{ background: color }} />
      </div>
      <p className="relative mb-6 max-w-[14rem] rounded-xl border px-2 py-1 text-[11px]" style={{ borderColor: color, color: '#e6ebf2', background: '#0b0f17' }}>{says}</p>
    </div>
  );
}

const spark = (xs: number[], w = 220, h = 40) => { const m = Math.max(1, ...xs); return xs.map((v, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, xs.length - 1)) * w} ${h - (v / m) * h}`).join(''); };

export default function Tank() {
  const P = useMemo(() => pmts(), []);
  const [tab, setTab] = useState<'front' | 'admin'>('front');
  const [view, setView] = useState<View>('angle');
  const [measured, setMeasured] = useState(false);
  const [running, setRunning] = useState(true);
  const [oscillate, setOscillate] = useState(true);
  const [deadN, setDeadN] = useState(12);
  const [ev, setEv] = useState<Ev | null>(null);
  const [hit, setHit] = useState<{ k: number; q: number; t: number }[]>([]);
  const [hist, setHist] = useState({ muUp: 0, muDown: 0, eUp: 0, eDown: 0, cosmic: 0 });
  const [zen, setZen] = useState<{ mu: number[]; e: number[] }>({ mu: Array(10).fill(0), e: Array(10).fill(0) });
  const [rate, setRate] = useState<number[]>([]);
  const [log, setLog] = useState<string[]>(['RUN 0001 開始。水の透明度、よし。']);
  const [busy, setBusy] = useState(0);
  const [run] = useState(() => 1000 + Math.floor(Math.random() * 9000));
  const seed = useRef(12345); const rnd = () => { seed.current = (seed.current + 0x6d2b79f5) >>> 0; let t = seed.current; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; // mulberry32
  const dead = useMemo(() => { const s = new Set<number>(); let a = 7; while (s.size < deadN) { a = (a * 9301 + 49297) % 233280; s.add(a % P.length); } return s; }, [deadN, P.length]);
  useEffect(() => {
    if (!running) return undefined;
    const t = window.setInterval(() => {
      const e = makeEvent(rnd, oscillate); const h = hits(e, P, dead, rnd); setRate((x) => [...x.slice(-39), h.length]);
      setEv(e); setHit(h); setMeasured(false); setBusy((b) => b + 1);
      if (e.kind === 'cosmic') setHist((x) => ({ ...x, cosmic: x.cosmic + 1 }));
      else {
        const up = e.cosZ < 0; setHist((x) => ({ ...x, [`${e.flavor}${up ? 'Up' : 'Down'}`]: (x as Record<string, number>)[`${e.flavor}${up ? 'Up' : 'Down'}`] + 1 }));
        const bin = Math.min(9, Math.floor((e.cosZ + 1) * 5)); setZen((z) => ({ ...z, [e.flavor]: z[e.flavor].map((v, i) => (i === bin ? v + 1 : v)) }));
        setLog((l) => [`#${e.id} ${e.flavor === 'mu' ? 'μ 型（くっきりした輪）' : 'e 型（ぼやけた輪）'}・${e.cosZ < 0 ? '下から（地球を通ってきた）' : '上から'}・${Math.round(e.L).toLocaleString()} km`, ...l].slice(0, 8));
      }
    }, 1600);
    return () => window.clearInterval(t);
  }, [running, oscillate, dead, P]); // eslint-disable-line react-hooks/exhaustive-deps
  const atm = hist.muUp + hist.muDown + hist.eUp + hist.eDown;
  const girlSays = !ev ? '待機中。' : ev.kind === 'cosmic' ? '上から宇宙線のミューオン。岩を 1,000 m 通っても、少し届く。' : view === 'info' && !measured ? 'この輪、まだ測っていない。白いまま。' : ev.flavor === 'mu' ? '輪の縁がくっきり。μ 型、29 種の水色。' : '輪がぼやけてる。e 型、92 種の橙。';
  const boySays = hist.muUp + hist.muDown < 6 ? 'まだ数が少ない。数え直しは、もう少し集まってから。' : `μ 型：上から ${hist.muDown}・下から ${hist.muUp}。${hist.muUp < hist.muDown * 0.8 ? '下からが少ない。地球を通るあいだに、種類が変わった？' : '上下でだいたい同じ。'}`;

  return (
    <main className="mx-auto max-w-5xl space-y-3 p-4 text-[#e6ebf2]" style={{ background: INK }}>
      <style>{'@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}@keyframes nod{0%,100%{transform:rotate(0)}50%{transform:rotate(-6deg)}}'}</style>
      <header className="space-y-1">
        <p className="text-xs text-[#9aa7b8]">ChartUI · 大きな水のタンク（スーパーカミオカンデのような水チェレンコフ検出器）· 地下 1,000 m</p>
        <h1 className="text-xl font-bold">ニュートリノの輪を見る装置 — アリミノ達の当番</h1>
        <p className="text-[11px] text-[#9aa7b8]">直径約 39 m・高さ約 41 m の円筒に 5 万トンの水、壁に約 11,000 本の光電子増倍管（ここでは約 3,000 本を描く）。粒子が水の中の光より速く進むと、約 42° の光の円錐ができ、壁に輪が映る。事象は早送り（本物の大気ニュートリノは一日に十個ほど）。</p>
      </header>
      <nav className="flex gap-1 text-sm">{([['front', '🖥 フロントエンド（事象の画面）'], ['admin', '🛠 管理画面']] as const).map(([k, l]) => <button key={k} type="button" data-testid={`tab-${k}`} onClick={() => setTab(k)} className="rounded-t-md border border-b-0 px-3 py-1" style={{ borderColor: LINE, background: tab === k ? PANEL : 'transparent' }}>{l}</button>)}</nav>

      {tab === 'front' && (
        <section className="grid gap-3 rounded-b-md rounded-tr-md border p-3 md:grid-cols-[1.6fr_1fr]" style={{ borderColor: LINE, background: PANEL }} data-testid="front">
          <EventDisplay P={P} ev={ev} hit={hit} dead={dead} view={view} measured={measured} />
          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <p className="font-semibold">視点 {'{'}角度 または 情報{'}'}</p>
              <div className="flex gap-1">{([['angle', '角度（どこへ向かったか）'], ['info', '情報（何だったか）']] as const).map(([k, l]) => <button key={k} type="button" data-testid={`view-${k}`} onClick={() => setView(k)} className="rounded-sm border px-2 py-1" style={{ borderColor: view === k ? '#fff27a' : LINE }}>{l}</button>)}</div>
              {view === 'info' && <button type="button" data-testid="measure" onClick={() => setMeasured(true)} disabled={!ev || measured} className="mt-1 min-h-[36px] rounded-sm border-2 px-3 font-semibold" style={{ borderColor: BOY }}>測る（ミュウの規則で色が決まる）</button>}
              <p className="text-[#9aa7b8]">論文の規則 3：一回の観測では、角度か情報のどちらかを主にとる。情報の視点では、ミュウの規則（29 種＝水色＝μ 型、92 種＝橙＝e 型）を使い、測るまで輪は白い。</p>
            </div>
            <Operator who="girl" color={GIRL} says={girlSays} busy={busy % 2 === 1} />
            <Operator who="boy" color={BOY} says={boySays} busy={busy % 2 === 0} />
            <button type="button" onClick={() => setRunning((r) => !r)} className="min-h-[36px] rounded-sm border px-3" style={{ borderColor: LINE }} data-testid="run-toggle">{running ? '❚❚ 一時停止' : '▶ 再開'}</button>
          </div>
        </section>)}

      {tab === 'admin' && (
        <section className="space-y-3 rounded-b-md rounded-tr-md border p-3 text-xs" style={{ borderColor: LINE, background: PANEL }} data-testid="admin">
          <div className="grid gap-2 sm:grid-cols-4">
            {([['RUN', `${run}`], ['状態', running ? '収集中' : '停止'], ['大気ニュートリノ', `${atm} 事象`], ['宇宙線ミューオン', `${hist.cosmic} 事象（本物は約 2 回/秒）`]] as const).map(([k, v]) => <div key={k} className="rounded-sm border p-2" style={{ borderColor: LINE }}><p className="text-[#9aa7b8]">{k}</p><p className="font-mono text-sm">{v}</p></div>)}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1 rounded-sm border p-2" style={{ borderColor: LINE }}>
              <p className="font-semibold">1 事象ごとの、光った光電子増倍管の数（最近 40 事象）</p>
              <svg viewBox="0 0 220 40" className="h-12 w-full" aria-label="光った本数"><path d={spark(rate)} fill="none" stroke={BOY} strokeWidth="1.5" /></svg>
            </div>
            <div className="space-y-1 rounded-sm border p-2" style={{ borderColor: LINE }} data-testid="zenith">
              <p className="font-semibold">来た向きごとの数（左：下から ← → 右：上から）</p>
              <svg viewBox="0 0 220 70" className="h-20 w-full" aria-label="天頂角の分布">
                {zen.mu.map((v, i) => { const m = Math.max(1, ...zen.mu, ...zen.e); return <rect key={`m${i}`} x={i * 22 + 2} y={70 - (v / m) * 64} width={9} height={(v / m) * 64} fill={BOY} />; })}
                {zen.e.map((v, i) => { const m = Math.max(1, ...zen.mu, ...zen.e); return <rect key={`e${i}`} x={i * 22 + 11} y={70 - (v / m) * 64} width={9} height={(v / m) * 64} fill={GIRL} />; })}
              </svg>
              <p className="text-[#9aa7b8]"><span style={{ color: BOY }}>■ μ 型</span>　<span style={{ color: GIRL }}>■ e 型</span>　振動ありなら、左（地球を通ってきた）の μ 型が減る。1998 年に見つかった形。</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 rounded-sm border p-2" style={{ borderColor: LINE }}>
              <p className="font-semibold">運転の設定</p>
              <label className="flex items-center gap-2"><input type="checkbox" checked={oscillate} onChange={(e) => setOscillate(e.target.checked)} data-testid="osc" />ニュートリノ振動を入れる（入れないと、上下が同じになる）</label>
              <label className="flex items-center gap-2">止まっている光電子増倍管<input type="range" min={0} max={300} value={deadN} onChange={(e) => setDeadN(Number(e.target.value))} />{deadN} 本（事象の画面で暗い赤）</label>
              <button type="button" onClick={() => { setHist({ muUp: 0, muDown: 0, eUp: 0, eDown: 0, cosmic: 0 }); setZen({ mu: Array(10).fill(0), e: Array(10).fill(0) }); setLog(['数え直し。アリミノボーイが最初から数える。']); }} className="rounded-sm border px-2 py-1" style={{ borderColor: LINE }}>数を 0 にもどす</button>
            </div>
            <div className="space-y-1 rounded-sm border p-2" style={{ borderColor: LINE }} data-testid="shift-log">
              <p className="font-semibold">当番の記録（アリミノガールが書く）</p>
              <ol className="space-y-0.5 font-mono text-[10px]">{log.map((l, i) => <li key={`${i}-${l}`} style={{ opacity: 1 - i * 0.1 }}>{l}</li>)}</ol>
            </div>
          </div>
          <div className="flex flex-wrap gap-4"><Operator who="girl" color={GIRL} says="記録は上から新しい順。輪の形で、μ 型か e 型かを書く。" busy={busy % 2 === 1} /><Operator who="boy" color={BOY} says={boySays} busy={busy % 2 === 0} /></div>
        </section>)}
    </main>
  );
}
