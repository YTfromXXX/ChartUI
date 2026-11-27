'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { heptad } from '@/lib/crystalBaby';
import { OCTA_F, OCTA_V, SYMBOLS, heartSymbol, loopPoint, pick, pose, rng, rotate, settle, sonarField, topFace, type Pick, type V3 } from '@/lib/dnaBubble';
import { SLOTS } from '@/lib/slotStrip';

const THOUGHT_KEY = 'chartui-dna-thought-v1';
const STEP_MS = 600; // one camera angle every 0.6 s while playing
const ease = (x: number) => x * x * (3 - 2 * x);

/**
 * Header bubble: the infinite DNA analyser. A d8 die turns through the 22 angles with a crystal
 * baby inside; its heart shows a symbol for what you are thinking about. ▶️ / ⏸️ run the ₿ loop and
 * the turning; 🎲 rolls; the portable sonar turns the roll into a game pick (synthetic, not advice).
 */
export default function DnaBubble() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [thought, setThought] = useState('');
  const [clock, setClock] = useState(0);
  const [, setTick] = useState(0); // redraw every frame while open (a roll animates even when paused)
  const [roll, setRoll] = useState<{ from: number; to: number; t0: number } | null>(null);
  const [result, setResult] = useState<{ pick: Pick; win: boolean; move: number } | null>(null);
  const [seed, setSeed] = useState(5);
  const field = useMemo(() => sonarField(seed), [seed]);
  const live = useRef({ playing }); live.current = { playing };

  useEffect(() => { try { setThought(window.localStorage.getItem(THOUGHT_KEY) ?? ''); } catch { /* ignore */ } }, []);
  useEffect(() => {
    if (!open) return undefined;
    let raf = 0; let last = performance.now();
    const f = (now: number) => { const dt = Math.max(0, now - last); last = Math.max(last, now); if (live.current.playing) setClock((c) => c + dt); setTick((n) => n + 1); raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, [open]);

  // Where the die is: during a roll it sweeps 22 angles in 2.2 s and lands; otherwise one angle per 0.6 s.
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  let pos: number;
  if (roll && now - roll.t0 < 2200) pos = roll.from + (roll.to - roll.from) * ease((now - roll.t0) / 2200);
  else if (roll) pos = roll.to;
  else pos = clock / STEP_MS;
  const i0 = Math.floor(pos); const k = ease(pos - i0); const a = pose(i0); const b = pose(i0 + 1);
  const dyaw = Math.atan2(Math.sin(b.yaw - a.yaw), Math.cos(b.yaw - a.yaw));
  const yaw = a.yaw + dyaw * k; const pitch = a.pitch + (b.pitch - a.pitch) * k;
  const face = topFace(yaw, pitch);
  const heart = SYMBOLS[heartSymbol(thought)];

  useEffect(() => {
    if (!roll) return undefined;
    const id = window.setTimeout(() => {
      const p = pose(roll.to); const fc = topFace(p.yaw, p.pitch); const pk = pick(fc, field);
      const r = rng(seed * 31 + roll.to); const next = Array.from({ length: 5 }, () => r() - 0.5 + (field.find((f) => f.sym === pk.target)?.rets.slice(-1)[0] ?? 0) * 0.2);
      const s = settle(pk, next); setResult({ pick: pk, ...s });
      setClock(roll.to * STEP_MS); setRoll(null);
    }, 2250);
    return () => window.clearTimeout(id);
  }, [roll, field, seed]);

  const doRoll = () => { const from = pos; const r = rng(Date.now() & 0xffff); setResult(null); setRoll({ from, to: Math.floor(from) + SLOTS + Math.floor(r() * SLOTS), t0: performance.now() }); };

  // Die drawing.
  const S = 74; const C = 110;
  const pv = OCTA_V.map((v) => rotate(v, yaw, pitch));
  const faces = OCTA_F.map((f, idx) => ({ idx, pts: f.v.map((j) => pv[j]), z: f.v.reduce((s, j) => s + pv[j][2], 0) / 3, front: rotate(f.n, yaw, pitch)[2] > 0 })).sort((p, q) => p.z - q.z);
  const P = (v: V3) => `${C + v[0] * S},${C - v[1] * S}`;
  const gene = heptad({ x: 0, y: 0 }, 0.28).map((g) => rotate([g.x, g.y, 0], yaw, pitch));
  const sweep = ((clock / 4000) * 360) % 360;

  return (
    <>
      <button type="button" data-testid="dna-bubble" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="無限 DNA 解析装置"
        className="relative grid h-9 w-9 place-items-center rounded-full border border-emerald-300/50 bg-emerald-300/10 text-base shadow-[0_0_14px_rgba(110,231,183,.25)]">
        <span aria-hidden>🧬</span><span className="sr-only">無限 DNA 解析装置</span>
      </button>
      {open && (
        <div data-testid="dna-panel" className="fixed right-4 top-[72px] z-[95] w-[min(560px,calc(100vw-2rem))] rounded-xl border border-emerald-300/30 bg-[#04110d]/95 p-3 text-slate-100 shadow-2xl backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs tracking-widest text-emerald-200">無限 DNA 解析装置 · DNAf4I</p>
            <div className="flex gap-1 font-mono text-xs">
              <button type="button" data-testid="dna-play" onClick={() => setPlaying((p) => !p)} className="rounded border border-white/20 px-2 py-0.5">{playing ? '⏸️' : '▶️'}</button>
              <button type="button" data-testid="dna-roll" onClick={doRoll} disabled={!!roll} className="rounded border border-white/20 px-2 py-0.5 disabled:opacity-40">🎲 振る</button>
              <button type="button" onClick={() => setOpen(false)} className="rounded border border-white/20 px-2 py-0.5">✕</button>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-[220px_1fr] gap-3">
            <svg viewBox="0 0 220 220" className="h-[220px] w-[220px]" aria-label="d8 のサイコロとクリスタルベイビー">
              <circle cx={C} cy={C} r="104" fill="#0a2a22" opacity="0.5" />
              {faces.filter((f) => !f.front).map((f) => <polygon key={`b${f.idx}`} points={f.pts.map(P).join(' ')} fill="#34d39914" stroke="#6ee7b744" />)}
              {/* The baby inside: gene (7 points) and its heart */}
              <polygon points={gene.slice(1).map(P).join(' ')} fill="#fbcfe833" stroke="#f9a8d4" />
              {gene.map((g, j) => <circle key={j} cx={C + g[0] * S} cy={C - g[1] * S} r={j ? 2.5 : 4} fill={j ? '#f9a8d4' : '#fff'} />)}
              <text x={C} y={C + 6} textAnchor="middle" fontSize="18" data-testid="dna-heart">{heart.icon}</text>
              {faces.filter((f) => f.front).map((f) => {
                const cx = f.pts.reduce((s, p) => s + p[0], 0) / 3; const cy = f.pts.reduce((s, p) => s + p[1], 0) / 3;
                return (<g key={`f${f.idx}`}><polygon points={f.pts.map(P).join(' ')} fill={f.idx === face ? '#34d39940' : '#a7f3d01a'} stroke="#a7f3d0" strokeWidth={f.idx === face ? 2 : 1} />
                  <text x={C + cx * S} y={C - cy * S + 5} textAnchor="middle" fontSize="13" opacity="0.85">{SYMBOLS[f.idx].icon}</text></g>);
              })}
              <text x="8" y="214" fontSize="9" fill="#6ee7b7" fontFamily="monospace">angle {((Math.floor(pos) % SLOTS) + SLOTS) % SLOTS + 1}/22 · face {face + 1}</text>
            </svg>
            <div className="space-y-2 text-xs">
              <label className="block">いま考えていること（心臓のシンボルになります）
                <input data-testid="dna-thought" value={thought} onChange={(e) => { setThought(e.target.value); try { window.localStorage.setItem(THOUGHT_KEY, e.target.value); } catch { /* ignore */ } }}
                  className="mt-1 w-full rounded border border-white/20 bg-black/40 px-2 py-1" placeholder="例：宇宙、魚、鍵…" /></label>
              <p>彼の心臓に見えるもの：<span className="text-base">{heart.icon}</span> {heart.ja}</p>
              <svg viewBox="-80 -80 160 160" className="h-[150px] w-[150px]" aria-label="ポータブルソナー">
                {[25, 50, 75].map((r) => <circle key={r} r={r} fill="none" stroke="#34d39933" />)}
                <line x1="0" y1="0" x2={75 * Math.cos((sweep * Math.PI) / 180)} y2={75 * Math.sin((sweep * Math.PI) / 180)} stroke="#6ee7b7" strokeWidth="1.5" />
                {field.map((f) => { const r = f.friction * 75; const a = (f.bearing * Math.PI) / 180; const hit = result?.pick.target === f.sym; return (
                  <g key={f.sym}><circle cx={r * Math.cos(a)} cy={r * Math.sin(a)} r={hit ? 5 : 3} fill={hit ? '#fbbf24' : '#6ee7b7'} /><text x={r * Math.cos(a) + 5} y={r * Math.sin(a) - 3} fontSize="6" fill="#a7f3d0">{f.sym}</text></g>
                ); })}
                {result && <line x1="0" y1="0" x2={75 * Math.cos((result.pick.bearing * Math.PI) / 180)} y2={75 * Math.sin((result.pick.bearing * Math.PI) / 180)} stroke="#fbbf24" strokeDasharray="3 2" />}
                <text x="0" y="3" textAnchor="middle" fontSize="9" fill="#fbbf24">₿</text>
              </svg>
            </div>
          </div>
          <svg viewBox="-1.2 -0.4 2.4 0.8" className="mt-1 h-10 w-full" aria-label="₿ のスーパーバブルループ">
            <path d={Array.from({ length: 61 }, (_, j) => { const p = loopPoint(j / 60); return `${j ? 'L' : 'M'}${p.x} ${p.y}`; }).join(' ')} fill="none" stroke="#fbbf2455" strokeWidth="0.01" />
            {Array.from({ length: 6 }, (_, j) => { const p = loopPoint((clock / 6000 + j / 6) % 1); return <g key={j}><circle cx={p.x} cy={p.y} r="0.07" fill="#fbbf2422" stroke="#fbbf24" strokeWidth="0.01" /><text x={p.x} y={p.y + 0.03} fontSize="0.08" textAnchor="middle" fill="#fbbf24">₿</text></g>; })}
          </svg>
          <p data-testid="dna-result" className="font-mono text-xs text-emerald-100">
            {roll ? '🎲 22 の角度を回っています…' : result ? `面 ${result.pick.face + 1}（${result.pick.symbol.icon} ${result.pick.symbol.ja}）→ ソナーの ${result.pick.target} を${result.pick.direction === 'up' ? '上' : '下'}向きに — 次の 5 本（合成）で ${result.win ? '的中' : '外れ'}（${result.move >= 0 ? '+' : ''}${result.move.toFixed(2)}）` : '🎲 を振ると、ゲームの銘柄と方向が決まります'}
          </p>
          <div className="flex items-center justify-between text-[10px] text-slate-500"><span>合成データのゲームです。投資の助言ではありません。</span><button type="button" className="underline" onClick={() => setSeed((s) => s + 1)}>ソナーを張り直す</button></div>
        </div>
      )}
    </>
  );
}
