'use client';

import { ArrowLeft, FlaskConical, Play } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useRef, useState } from 'react';
import { SUIT_COLORS, SUITS, SWEEP, WAVE_COLORS, WAVEFORMS, type Suit, type Waveform } from '../params';

type Candy = {
  index: number;
  waveform: Waveform;
  polarity: 'UP' | 'DOWN';
  r: number;
  direction: 'LONG' | 'SHORT';
  lensing_distortion: number;
  time_to_target_hrs: number;
  risk_reward_ratio: number;
  gravity: { nearest_suit: Suit; time_factor: number };
};

type GridResponse = {
  scale_dial: number;
  count: number;
  log10_radius_min: number;
  log10_radius_max: number;
  candies: Candy[];
};

type Snapshot = {
  dial: number;
  count: number;
  log10Min: number;
  log10Max: number;
  meanLog10R: number;
  meanRR: number;
  actionable: number;
  long: number;
  short: number;
  medianHours: number;
  meanLensing: number;
  rrByWave: Record<Waveform, number>;
  rrBySuit: Record<Suit, number>;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const mean = (values: number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatHours(hours: number): string {
  if (hours < 1) return `${(hours * 60).toFixed(0)} min`;
  if (hours < 48) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

function dialSteps(from: number, to: number, steps: number): number[] {
  const n = Math.max(2, Math.round(steps));
  const lo = Math.min(1, Math.max(0, Math.min(from, to)));
  const hi = Math.min(1, Math.max(0, Math.max(from, to)));
  const values = Array.from({ length: n }, (_, i) => Number((lo + ((hi - lo) * i) / (n - 1)).toFixed(4)));
  return [...new Set(values)];
}

function summarize(grid: GridResponse, rrThreshold: number): Snapshot {
  const { candies } = grid;
  const rrBy = <K extends string>(keys: readonly K[], pick: (c: Candy) => K) =>
    Object.fromEntries(keys.map((k) => [k, mean(candies.filter((c) => pick(c) === k).map((c) => c.risk_reward_ratio))])) as Record<K, number>;
  return {
    dial: grid.scale_dial,
    count: grid.count,
    log10Min: grid.log10_radius_min,
    log10Max: grid.log10_radius_max,
    meanLog10R: mean(candies.map((c) => Math.log10(c.r))),
    meanRR: mean(candies.map((c) => c.risk_reward_ratio)),
    actionable: candies.filter((c) => c.risk_reward_ratio >= rrThreshold).length,
    long: candies.filter((c) => c.direction === 'LONG').length,
    short: candies.filter((c) => c.direction === 'SHORT').length,
    medianHours: median(candies.map((c) => c.time_to_target_hrs)),
    meanLensing: mean(candies.map((c) => c.lensing_distortion)),
    rrByWave: rrBy(WAVEFORMS, (c) => c.waveform),
    rrBySuit: rrBy(SUITS, (c) => c.gravity.nearest_suit),
  };
}

async function fetchGrid(dial: number, signal: AbortSignal): Promise<GridResponse> {
  const response = await fetch(`${API_URL}/api/v1/oracle/spiral-grid?scale_dial=${dial}`, { signal, cache: 'no-store' });
  if (!response.ok) throw new Error(`Oracle API returned ${response.status} for scale_dial=${dial}`);
  return (await response.json()) as GridResponse;
}

export default function OracleExperimentsPage() {
  const [from, setFrom] = useState(SWEEP.from);
  const [to, setTo] = useState(SWEEP.to);
  const [steps, setSteps] = useState(SWEEP.steps);
  const [rrThreshold, setRrThreshold] = useState(SWEEP.rrThreshold);
  const [grids, setGrids] = useState<GridResponse[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const dials = useMemo(() => dialSteps(from, to, steps), [from, to, steps]);
  const snapshots = useMemo(() => grids.map((grid) => summarize(grid, rrThreshold)), [grids, rrThreshold]);

  const runSweep = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setError('');
    setProgress(0);
    const results: GridResponse[] = new Array(dials.length);
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < dials.length) {
        const slot = next++;
        results[slot] = await fetchGrid(dials[slot], controller.signal);
        done += 1;
        setProgress(done);
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(SWEEP.concurrency, dials.length) }, worker));
      setGrids(results);
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : 'Oracle API is unavailable.');
    } finally {
      if (abortRef.current === controller) setRunning(false);
    }
  }, [dials]);

  // Log-linear zoom check: each step should move mean log10(r) by expectedDecadesPerDial * Δdial.
  const linearity = useMemo(() => snapshots.slice(1).map((snap, i) => {
    const prev = snapshots[i];
    const expected = SWEEP.expectedDecadesPerDial * (snap.dial - prev.dial);
    const observed = snap.meanLog10R - prev.meanLog10R;
    return { dial: snap.dial, expected, observed, error: Math.abs(observed - expected) };
  }), [snapshots]);
  const maxLinearityError = linearity.length ? Math.max(...linearity.map((l) => l.error)) : 0;

  const chart = useMemo(() => {
    if (snapshots.length < 2) return null;
    const lo = snapshots[0].dial;
    const span = snapshots[snapshots.length - 1].dial - lo || 1;
    const maxRR = Math.max(...snapshots.flatMap((s) => WAVEFORMS.map((w) => s.rrByWave[w]))) || 1;
    const px = (dial: number) => 40 + ((dial - lo) / span) * 540;
    const py = (rr: number) => 220 - (rr / maxRR) * 200;
    return {
      maxRR,
      lines: WAVEFORMS.map((wave) => ({
        wave,
        points: snapshots.map((s) => `${px(s.dial).toFixed(1)},${py(s.rrByWave[wave]).toFixed(1)}`).join(' '),
        dots: snapshots.map((s) => ({ x: px(s.dial), y: py(s.rrByWave[wave]), rr: s.rrByWave[wave], dial: s.dial })),
      })),
    };
  }, [snapshots]);

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300"><FlaskConical size={14} /> METADOGG ORACLE API / LAB</p>
            <h1 className="text-2xl font-semibold">scale_dial Sweep · 384 Spiral Candy</h1>
          </div>
          <Link href="/oracle-api" className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={14} /> Oracle</Link>
        </header>

        <p className="rounded border border-amber-300/20 bg-amber-300/[0.04] p-3 text-xs leading-5 text-amber-100/80">
          Research visualization only. The spiral grid is a geometric model; risk/reward, time-to-target and gravity are
          synthetic quantities derived from candy positions, not trading signals or price predictions.
        </p>

        <section className="grid gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm md:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:items-end">
          <NumberField label="Dial from" value={from} min={0} max={1} step={0.05} onChange={setFrom} />
          <NumberField label="Dial to" value={to} min={0} max={1} step={0.05} onChange={setTo} />
          <NumberField label="Steps" value={steps} min={2} max={21} step={1} onChange={setSteps} />
          <NumberField label="RR threshold" value={rrThreshold} min={0} max={99} step={0.5} onChange={setRrThreshold} />
          <button type="button" onClick={() => void runSweep()} disabled={running} className="flex items-center justify-center gap-2 border border-cyan-200/40 bg-cyan-100/10 px-4 py-2 text-cyan-100 hover:bg-cyan-100/20 disabled:opacity-50">
            <Play size={14} /> {running ? `Sweeping ${progress}/${dials.length}` : 'Run sweep'}
          </button>
          <p className="font-mono text-[10px] text-slate-500 md:col-span-5">dials: {dials.map((d) => d.toFixed(2)).join(' · ')}</p>
          {error && <p role="alert" className="text-sm text-rose-300 md:col-span-5">{error}</p>}
        </section>

        {snapshots.length > 0 && (
          <>
            <section className="overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-4">
              <h2 className="mb-2 text-sm text-slate-300">Snapshots</h2>
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400"><tr>
                  <th className="p-1">Dial</th><th>log₁₀ r range</th><th>mean log₁₀ r</th><th>Mean RR</th><th>RR ≥ {rrThreshold}</th><th>LONG / SHORT</th><th>Median T→Target</th><th>Mean lensing</th>
                </tr></thead>
                <tbody>
                  {snapshots.map((s) => (
                    <tr key={s.dial} className="border-t border-white/5 font-mono">
                      <td className="p-1">{s.dial.toFixed(2)}</td>
                      <td>{s.log10Min.toFixed(2)} → {s.log10Max.toFixed(2)}</td>
                      <td>{s.meanLog10R.toFixed(3)}</td>
                      <td>{s.meanRR.toFixed(2)}</td>
                      <td>{s.actionable}/{s.count}</td>
                      <td>{s.long} / {s.short}</td>
                      <td>{formatHours(s.medianHours)}</td>
                      <td>{s.meanLensing.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h2 className="mb-2 text-sm text-slate-300">Mean RR by waveform across the dial</h2>
                {chart ? (
                  <>
                    <svg viewBox="0 0 600 240" className="h-64 w-full">
                      <line x1={40} y1={220} x2={580} y2={220} stroke="#334155" />
                      <line x1={40} y1={20} x2={40} y2={220} stroke="#334155" />
                      <text x={36} y={24} textAnchor="end" fontSize={10} fill="#64748b">{chart.maxRR.toFixed(1)}</text>
                      <text x={36} y={222} textAnchor="end" fontSize={10} fill="#64748b">0</text>
                      {chart.lines.map(({ wave, points, dots }) => (
                        <g key={wave}>
                          <polyline points={points} fill="none" stroke={WAVE_COLORS[wave]} strokeWidth={2} />
                          {dots.map((d) => <circle key={d.dial} cx={d.x} cy={d.y} r={3} fill={WAVE_COLORS[wave]}><title>{`${wave} @ ${d.dial.toFixed(2)}: RR ${d.rr.toFixed(2)}`}</title></circle>)}
                        </g>
                      ))}
                    </svg>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                      {WAVEFORMS.map((wave) => <span key={wave} className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: WAVE_COLORS[wave] }} />{wave}</span>)}
                    </div>
                  </>
                ) : <p className="text-xs text-slate-500">Run a sweep with at least two distinct dials to plot.</p>}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs">
                  <h2 className="mb-2 text-sm text-slate-300">Log-linear zoom check</h2>
                  <p className="text-slate-400">Expected Δ mean log₁₀ r = {SWEEP.expectedDecadesPerDial} × Δdial.</p>
                  <p className={`mt-2 font-mono ${maxLinearityError < 1e-6 ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {linearity.length ? `max error ${maxLinearityError.toExponential(2)} · ${maxLinearityError < 1e-6 ? 'LINEAR' : 'DRIFT'}` : 'needs ≥ 2 snapshots'}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-xs">
                  <h2 className="mb-2 text-sm text-slate-300">Mean RR by nearest pole (last snapshot)</h2>
                  {SUITS.map((suit) => {
                    const last = snapshots[snapshots.length - 1];
                    return (
                      <p key={suit} className="flex items-center justify-between font-mono">
                        <span className="flex items-center gap-1"><i className="inline-block h-2 w-2 rounded-full" style={{ background: SUIT_COLORS[suit] }} />{suit}</span>
                        <span>{last.rrBySuit[suit].toFixed(2)}</span>
                      </p>
                    );
                  })}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function NumberField({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs text-slate-300">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
        className="mt-1 w-full border border-white/10 bg-black/40 px-2 py-1 font-mono text-slate-100"
      />
    </label>
  );
}
