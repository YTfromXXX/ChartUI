'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { parseSymbols, readMorse, totalUnits, unitSec, type Seg } from '@/lib/morseRhythm';

type Side = 'A' | 'B';
const COLOR = { A: '#8b0000', B: '#2b3a67' } as const;
const TOL = 0.09; // seconds of slack around a tone

/** TEXTBOX: right brain (meaning) → left brain (symbols) → microcomputer 0/1 → tap along with the rhythm. */
export default function TextBox() {
  const [right, setRight] = useState<Record<Side, string>>({ A: '私の推敲なる右側のテキストA', B: '私の推敲なる右側のテキストB' });
  const [left, setLeft] = useState<Record<Side, string>>({ A: '-----./ ===', B: '../..{}{}./../../|| ‖‖ }./ * ////' });
  const [side, setSide] = useState<Side>('B');
  const [wpm, setWpm] = useState(10);
  const [sound, setSound] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [taps, setTaps] = useState<number[]>([]);
  const ctx = useRef<AudioContext | null>(null); const t0 = useRef(0); const raf = useRef(0);

  const segs = useMemo(() => parseSymbols(left[side]), [left, side]);
  const u = unitSec(wpm); const dur = totalUnits(segs) * u;
  const tones = useMemo(() => { let at = 0; return segs.map((g) => { const r = { ...g, start: at * u, end: (at + g.units) * u }; at += g.units; return r; }).filter((g) => g.on); }, [segs, u]);

  const now = () => (ctx.current ? ctx.current.currentTime : performance.now() / 1000) - t0.current;
  const start = () => {
    cancelAnimationFrame(raf.current);
    if (sound) {
      ctx.current ??= new AudioContext();
      const ac = ctx.current; const base = ac.currentTime + 0.3; t0.current = base;
      for (const g of tones) {
        const o = ac.createOscillator(); const v = ac.createGain();
        o.frequency.value = g.accent ? 330 : 660; o.type = 'sine';
        v.gain.setValueAtTime(0, base + g.start); v.gain.linearRampToValueAtTime(0.15, base + g.start + 0.008); v.gain.setValueAtTime(0.15, base + g.end - 0.008); v.gain.linearRampToValueAtTime(0, base + g.end);
        o.connect(v).connect(ac.destination); o.start(base + g.start); o.stop(base + g.end + 0.02);
      }
    } else { ctx.current = null; t0.current = performance.now() / 1000 + 0.3; }
    setTaps([]); setPlaying(true);
    const tick = () => { const x = now(); setT(x); if (x < dur + 0.5) raf.current = requestAnimationFrame(tick); else setPlaying(false); };
    raf.current = requestAnimationFrame(tick);
  };
  const tap = () => { if (playing) setTaps((xs) => [...xs, now()]); };
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Space' && (e.target as HTMLElement).tagName !== 'TEXTAREA' && (e.target as HTMLElement).tagName !== 'INPUT') { e.preventDefault(); tap(); } };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  });
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const hit = tones.map((g) => taps.some((x) => x >= g.start - TOL && x <= g.end + TOL));
  const stray = taps.filter((x) => !tones.some((g) => x >= g.start - TOL && x <= g.end + TOL)).length;
  const light = tones.length ? Math.max(0, Math.round(((hit.filter(Boolean).length - stray * 0.5) / tones.length) * 100)) : 0;
  const finished = !playing && taps.length > 0;

  const W = 640; const scale = dur ? W / dur : 1;
  let acc = 0;
  return (
    <main className="mx-auto max-w-3xl space-y-4 bg-[#faf7f2] p-4 text-[#1f1f1f]">
      <header className="space-y-1">
        <p className="text-xs text-stone-500">モールス［TEXTBOX］</p>
        <h1 className="text-xl font-bold">左脳のリズムに、手を合わせる</h1>
        <p className="text-sm">右脳（意味）の文章を、左脳（記号）にする。記号は、マイコンの 1（音）と 0（無音）の時間になる。音に合わせてスペースキーかボタンを押すと、手元の「軽さ」が出る。</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['A', 'B'] as Side[]).map((s) => (
          <div key={s} className="space-y-1 border p-2 text-xs" style={{ borderColor: COLOR[s] }} data-testid={`side-${s}`}>
            <button type="button" onClick={() => setSide(s)} className="font-semibold" style={{ color: COLOR[s] }}>{side === s ? '▶ ' : ''}{s}</button>
            <label className="block">右脳<input value={right[s]} onChange={(e) => setRight({ ...right, [s]: e.target.value })} className="w-full border border-stone-300 bg-white px-1 py-0.5" /></label>
            <label className="block">左脳<input data-testid={`left-${s}`} value={left[s]} onChange={(e) => setLeft({ ...left, [s]: e.target.value })} className="w-full border border-stone-300 bg-white px-1 py-0.5 font-mono" /></label>
            <p className="text-stone-600">読み：<span data-testid={`read-${s}`}>{readMorse(left[s]) || '—'}</span></p>
          </div>))}
      </div>

      <div className="space-y-1 text-xs" data-testid="micro">
        <p className="font-semibold">マイコン（{side}）— {wpm} WPM・1 単位 {u.toFixed(2)} 秒・全体 {dur.toFixed(2)} 秒</p>
        <svg viewBox={`0 0 ${W} 40`} className="w-full border border-stone-300 bg-white" role="img" aria-label="0 と 1 の時間の帯">
          {segs.map((g, k) => { const x = acc * u * scale; acc += g.units; const w = g.units * u * scale; const ti = g.on ? tones.findIndex((q) => Math.abs(q.start - x / scale) < 1e-6) : -1;
            return <g key={k}><rect x={x} y={g.on ? 6 : 30} width={Math.max(1, w - 0.5)} height={g.on ? 24 : 4} fill={g.on ? (finished ? (hit[ti] ? '#2f6b1a' : '#c8001a') : g.accent ? '#7a5c00' : COLOR[side]) : '#d6d3d1'} />{g.sym && g.on && <text x={x + 2} y={4} fontSize="6" fill="#57534e">{g.sym}</text>}</g>; })}
          {playing && <line x1={t * scale} x2={t * scale} y1={0} y2={40} stroke="#1f1f1f" strokeWidth={1} />}
          {taps.map((x, k) => <circle key={k} cx={x * scale} cy={36} r={2} fill="#1f1f1f" />)}
        </svg>
        <p className="font-mono text-[10px] text-stone-600" data-testid="bits">{segs.map((g) => `${g.on ? 1 : 0}(${(g.units * u).toFixed(2)}s)`).join(' ')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label>速さ <input type="range" min={5} max={20} value={wpm} onChange={(e) => setWpm(Number(e.target.value))} /> {wpm} WPM</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />音を鳴らす</label>
        <button type="button" data-testid="start" onClick={start} disabled={playing || !tones.length} className="border border-stone-500 bg-white px-3 py-1">▶ はじめる</button>
        <button type="button" data-testid="tap" onPointerDown={tap} className="border-2 border-black bg-white px-6 py-2 font-semibold">打つ（スペース）</button>
      </div>

      {finished && <p className="text-sm" data-testid="light">手元の軽さ：<b>{light}%</b>（当たり {hit.filter(Boolean).length} / {tones.length}・はみ出し {stray}）</p>}

      <details className="text-[11px] text-stone-600">
        <summary>記号の決まり</summary>
        <p><code>.</code> 1 単位の音、<code>-</code> 3 単位の音、<code>=</code> 2 単位の音（続けると、つながって伸びる）、<code>*</code> 外からの一打（低い音）。<code>/</code> 3 単位の無音、<code>{'{}'}</code> 空の枠（7 単位）、<code>||</code>・<code>‖</code> 音の枠の終わり（7 単位）。音と音のあいだは 1 単位あける。1 単位 = 1.2 ÷ WPM 秒。</p>
      </details>
    </main>
  );
}
