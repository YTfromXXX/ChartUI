'use client';

import { ArrowLeft, Orbit } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const AxisParticleScene = dynamic(() => import('@/components/3d/AxisParticleScene'), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse rounded-xl bg-white/5" />,
});

type Candy = {
  index: number;
  cell: number;
  waveform: string;
  polarity: 'UP' | 'DOWN';
  x: number;
  y: number;
  z: number;
  tarot: string;
  element: string;
  redshift: number;
  lensing_distortion: number;
  axis_height: number;
  axis_radial: number;
  direction: 'LONG' | 'SHORT';
  expected_return: number;
  max_drawdown: number;
  gravity: { nearest_suit: string; nearest_market: string; time_factor: number };
  time_to_target_hrs: number;
  risk_reward_ratio: number;
  tarot_archetype: { name: string; aspect: string } | null;
  element_singularity: { market: string; suit: string } | null;
};

type GridResponse = { scale_dial: number; count: number; candies: Candy[] };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const SUIT_COLORS: Record<string, string> = {
  WANDS: '#f97316',
  CUPS: '#38bdf8',
  SWORDS: '#a78bfa',
  PENTACLES: '#4ade80',
};

function formatHours(hours: number): string {
  if (hours < 1) return `${(hours * 60).toFixed(0)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

export default function OracleApiPage() {
  const [dial, setDial] = useState(0.3);
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`${API_URL}/api/v1/oracle/spiral-grid?scale_dial=${dial}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`Oracle API returned ${response.status}`);
        setGrid(await response.json() as GridResponse);
        setError('');
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Oracle API is unavailable.');
      }
    }, 120);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [dial]);

  const candies = grid?.candies ?? [];
  const top = useMemo(() => [...candies].sort((a, b) => b.risk_reward_ratio - a.risk_reward_ratio).slice(0, 12), [candies]);
  const chart = useMemo(() => {
    if (!candies.length) return null;
    // Log radial axis (time) and signed-log height axis (price) keep micro and macro visible together.
    const sl = (v: number) => Math.sign(v) * Math.log10(1 + Math.abs(v));
    const maxR = Math.max(...candies.map((c) => Math.log10(1 + c.axis_radial))) || 1;
    const maxH = Math.max(...candies.map((c) => Math.abs(sl(c.axis_height)))) || 1;
    return candies.map((c) => ({
      c,
      px: 20 + (Math.log10(1 + c.axis_radial) / maxR) * 560,
      py: 200 - (sl(c.axis_height) / maxH) * 180,
    }));
  }, [candies]);
  const active = candies.find((c) => c.index === selected) ?? top[0];

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300"><Orbit size={14} /> METADOGG ORACLE API</p>
            <h1 className="text-2xl font-semibold">384 Spiral Candy · Singularity Axis</h1>
          </div>
          <Link href="/" className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={14} /> Back</Link>
        </header>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <label className="flex items-center gap-4 text-sm">
            <span className="w-28 text-slate-300">scale_dial</span>
            <input type="range" min={0} max={1} step={0.01} value={dial} onChange={(event) => setDial(Number(event.target.value))} className="flex-1" />
            <span className="w-12 text-right font-mono">{dial.toFixed(2)}</span>
          </label>
          {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
        </section>

        <section className="h-96 overflow-hidden rounded-xl border border-white/10 bg-black">
          <AxisParticleScene />
        </section>

        <section className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-sm text-slate-300">Time-to-Target (→ radial, log) × Price offset (↑ Y axis, signed log)</h2>
          <svg viewBox="0 0 600 400" className="h-80 w-full">
            <line x1={20} y1={200} x2={580} y2={200} stroke="#334155" />
            <line x1={20} y1={10} x2={20} y2={390} stroke="#64748b" strokeWidth={2} />
            {chart?.map(({ c, px, py }) => (
              <circle key={c.index} cx={px} cy={py} r={selected === c.index ? 5 : 2.5} fill={SUIT_COLORS[c.gravity.nearest_suit] ?? '#fff'} opacity={c.polarity === 'UP' ? 0.9 : 0.5} onClick={() => setSelected(c.index)} className="cursor-pointer" />
            ))}
          </svg>
          <div className="flex gap-4 text-xs text-slate-400">
            {Object.entries(SUIT_COLORS).map(([suit, color]) => (
              <span key={suit} className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />{suit} (nearest pole)</span>
            ))}
          </div>
        </section>

        {active && (
          <section className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm md:grid-cols-4">
            <div><p className="text-slate-400">Candy</p><p className="font-mono">#{active.index} {active.waveform} {active.polarity}</p></div>
            <div><p className="text-slate-400">Time-to-Target</p><p className="font-mono">{formatHours(active.time_to_target_hrs)}</p></div>
            <div><p className="text-slate-400">Risk/Reward</p><p className="font-mono">{active.risk_reward_ratio.toFixed(2)} ({active.direction})</p></div>
            <div><p className="text-slate-400">Gravity</p><p className="font-mono">{active.gravity.nearest_suit} ×{active.gravity.time_factor.toFixed(2)}</p></div>
          </section>
        )}

        <section className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="mb-2 text-sm text-slate-300">Top 12 by RR</h2>
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400"><tr>
              <th className="p-1">#</th><th>Archetype</th><th>Wave</th><th>Dir</th><th>T→Target</th><th>RR</th><th>Return</th><th>MaxDD</th><th>Gravity</th>
            </tr></thead>
            <tbody>
              {top.map((c) => (
                <tr key={c.index} onClick={() => setSelected(c.index)} className="cursor-pointer border-t border-white/5 hover:bg-white/5">
                  <td className="p-1 font-mono">{c.index}</td>
                  <td>{c.tarot_archetype ? `${c.tarot_archetype.name} ${c.tarot_archetype.aspect}` : `${c.element_singularity?.market} singularity`}</td>
                  <td>{c.waveform} {c.polarity}</td><td>{c.direction}</td>
                  <td className="font-mono">{formatHours(c.time_to_target_hrs)}</td>
                  <td className="font-mono">{c.risk_reward_ratio.toFixed(2)}</td>
                  <td className="font-mono">{c.expected_return.toFixed(1)}</td>
                  <td className="font-mono">{c.max_drawdown.toFixed(1)}</td>
                  <td>{c.gravity.nearest_suit} ×{c.gravity.time_factor.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}
