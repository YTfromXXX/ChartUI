'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { epicycles, harmonics, overshoot, partialSum, sigma } from '@/lib/fourierSquare';

const W = 900; const H = 320; const X0 = 330; // the wave is drawn to the right of the circles
const BASE_HZ = 0.1; // the fundamental turns once every 10 s; drawn circles are capped so nothing strobes
const MAX_DRAWN = 12;

/**
 * Square wave from its Fourier series: watch the circles add up, see the Gibbs overshoot stay at
 * about 9 % however many terms you add, and switch on Lanczos sigma factors to smooth it.
 */
export default function FourierLab() {
  const [N, setN] = useState(15);
  const [lanczos, setLanczos] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!playing) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0; let last = performance.now();
    const f = (now: number) => { const dt = Math.max(0, now - last) / 1000; last = Math.max(last, now); setT((x) => x + dt * 2 * Math.PI * BASE_HZ * (reduce ? 0.3 : 1)); raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, [playing]);

  const g = useMemo(() => overshoot(N), [N]); const l = useMemo(() => overshoot(N, true), [N]);
  const sy = (v: number) => H / 2 - v * 95;
  const curve = (lz: boolean) => Array.from({ length: 561 }, (_, i) => { const x = (i / 560) * 4 * Math.PI; return `${i ? 'L' : 'M'}${X0 + (i / 560) * (W - X0 - 10)} ${sy(partialSum(x, N, lz))}`; }).join(' ');
  const ep = epicycles(t, N, lanczos); const tip = ep[ep.length - 1]; const C = { x: 160, y: H / 2 };
  const wavePhase = ((t % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI);

  return (
    <main className="min-h-screen bg-[#0a0c12] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-slate-400">LAB · Cure-API · フーリエ級数の矩形波</p>
            <h1 className="text-2xl font-semibold">円を足していくと、四角い波になる</h1>
            <p className="max-w-3xl text-sm text-slate-300">矩形波 = (4/π) Σ sin(kx)/k（k は奇数）。項を増やしても、角の手前の行き過ぎ（ギブズ現象）は段差の約 9% のまま残ります。各項にランチョスのシグマ因子 σ<sub>k</sub> = sinc(k/(N+1)) を掛けると、揺れ（リンギング）が収まります。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/lab/backlog" className="border border-white/20 px-3 py-1">やることボード</Link><Link href="/mente" className="border border-white/20 px-3 py-1">Mente</Link></nav>
        </header>
        <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
          <label className="flex items-center gap-2">最高の倍音 N = {N}（{harmonics(N).length} 項）<input type="range" min={1} max={199} step={2} value={N} onChange={(e) => setN(Number(e.target.value))} aria-label="N" /></label>
          <label className="flex items-center gap-1"><input type="checkbox" data-testid="lanczos" checked={lanczos} onChange={(e) => setLanczos(e.target.checked)} />ランチョスのシグマ因子</label>
          <button type="button" onClick={() => setPlaying((p) => !p)} className="rounded border border-white/20 px-2 py-1">{playing ? '⏸️' : '▶️'}</button>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border border-white/10 bg-[#0d1018]" data-testid="plot">
          <line x1={X0} x2={W} y1={sy(1)} y2={sy(1)} stroke="#ffffff22" strokeDasharray="4 4" /><line x1={X0} x2={W} y1={sy(-1)} y2={sy(-1)} stroke="#ffffff22" strokeDasharray="4 4" />
          <line x1={X0} x2={W} y1={sy(g.peak)} y2={sy(g.peak)} stroke="#f8717155" strokeDasharray="2 3" /><text x={W - 6} y={sy(g.peak) - 4} textAnchor="end" fontSize="10" fill="#fca5a5">ギブズ {(g.share * 100).toFixed(2)}%</text>
          <path d={curve(false)} fill="none" stroke={lanczos ? '#f8717155' : '#f87171'} strokeWidth="1.6" />
          {lanczos && <path d={curve(true)} fill="none" stroke="#5eead4" strokeWidth="2" />}
          {ep.slice(0, MAX_DRAWN).map((c, i) => <circle key={i} cx={C.x + c.cx * 95} cy={C.y - c.cy * 95} r={c.r * 95} fill="none" stroke="#a5b4fc55" />)}
          <polyline points={[{ x: 0, y: 0 }, ...ep.slice(0, MAX_DRAWN).map((c) => ({ x: c.x, y: c.y }))].map((p) => `${C.x + p.x * 95},${C.y - p.y * 95}`).join(' ')} fill="none" stroke="#c7d2fe" />
          <line x1={C.x + tip.x * 95} y1={C.y - tip.y * 95} x2={X0 + (wavePhase / (4 * Math.PI)) * (W - X0 - 10)} y2={C.y - tip.y * 95} stroke="#fde68a88" strokeDasharray="3 3" />
          <circle cx={X0 + (wavePhase / (4 * Math.PI)) * (W - X0 - 10)} cy={C.y - tip.y * 95} r="4" fill="#fde68a" />
        </svg>
        <table className="font-mono text-xs" data-testid="numbers"><tbody>
          <tr><td className="pr-4">行き過ぎ（そのまま）</td><td>{(g.share * 100).toFixed(2)}%（頂点 {g.peak.toFixed(4)}）</td></tr>
          <tr><td className="pr-4">行き過ぎ（シグマ因子あり）</td><td>{(l.share * 100).toFixed(2)}%（頂点 {l.peak.toFixed(4)}）</td></tr>
          <tr><td className="pr-4">σ の例</td><td>{harmonics(N).slice(0, 4).map((k) => `σ${k}=${sigma(k, N + 1).toFixed(3)}`).join('  ')}</td></tr>
        </tbody></table>
        <p className="text-xs text-slate-500">回る円は最初の {MAX_DRAWN} 個だけ描き、基本の回転は 10 秒で 1 周です（速い回転や点滅に見えないように）。音として鳴らす場合も、聞く人が気付かない埋め込み（サブリミナル）は使いません。</p>
      </div>
    </main>
  );
}
