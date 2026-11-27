'use client';

import { Square } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useCureAPIStore, type ArcanaParameter } from '@/lib/cureApiStore';

const STEPS = 8;
const ARCHETYPE_COLORS: Record<string, string> = {
  volatility: '#fb7185',
  flow: '#e879f9',
  equilibrium: '#34d399',
  inertia: '#fbbf24',
  rupture: '#f97316',
};

/** 8-step loop curve of one arcana: its 4 affinities, phase-rotated by the lens angle. */
function loopCurve(arcana: ArcanaParameter): number[] {
  const affinities = [arcana.volatilityAffinity, arcana.tensionAffinity, arcana.rigidityAffinity, arcana.destructiveAffinity];
  const phase = (arcana.angle * Math.PI) / 180;
  return Array.from({ length: STEPS }, (_, step) => {
    const wave = 0.5 + 0.5 * Math.sin(phase + (step * Math.PI * 2) / STEPS);
    return Math.min(1, Math.max(0.04, 0.55 * affinities[step % 4] + 0.45 * wave));
  });
}

type LoopState = 'idle' | 'queued-on' | 'playing' | 'queued-off';

/**
 * 22-arcana loop binder (11 × 2). Each square is a loop cell: tapping it queues it,
 * and it starts or stops on the next bar boundary, like a live-loop grid.
 * Opened when EX reaches 0 (all rupture cells cured).
 */
export default function ArcanaLoopBinder() {
  const arcana = useCureAPIStore((state) => state.arcanaParameters);
  const bpm = useCureAPIStore((state) => state.projectionMetrics.bpm);
  const [loops, setLoops] = useState<Record<number, LoopState>>({});
  const [step, setStep] = useState(0);
  const [bar, setBar] = useState(0);

  const curves = useMemo(() => Object.fromEntries(arcana.map((a) => [a.id, loopCurve(a)])), [arcana]);
  const stepMsRef = useRef(500);
  stepMsRef.current = 60_000 / Math.max(30, Math.min(240, bpm || 72)) / 2; // eighth notes

  // Fixed-rate clock: BPM is updated continuously by the projection engine, so the tempo
  // is read through a ref instead of restarting the timer on every change.
  useEffect(() => {
    let elapsed = 0;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      elapsed += now - previous;
      previous = now;
      if (elapsed >= stepMsRef.current) {
        elapsed %= stepMsRef.current;
        setStep((value) => (value + 1) % STEPS);
      }
    }, 25);
    return () => window.clearInterval(timer);
  }, []);

  // Quantize: queued loops change state on the downbeat.
  useEffect(() => {
    if (step !== 0) return;
    setBar((value) => value + 1);
    setLoops((current) => {
      const next: Record<number, LoopState> = {};
      for (const [id, state] of Object.entries(current)) {
        if (state === 'queued-on' || state === 'playing') next[Number(id)] = 'playing';
      }
      return next;
    });
  }, [step]);

  const toggle = (id: number) => setLoops((current) => {
    const state = current[id] ?? 'idle';
    const next = { ...current };
    if (state === 'idle') next[id] = 'queued-on';
    else if (state === 'queued-on') delete next[id];
    else if (state === 'playing') next[id] = 'queued-off';
    else next[id] = 'playing';
    return next;
  });

  const playing = arcana.filter((a) => loops[a.id] === 'playing');
  const mix = playing.length ? playing.reduce((sum, a) => sum + curves[a.id][step], 0) / playing.length : 0;
  const binderRows = [arcana.slice(0, 11), arcana.slice(11, 22)];

  return (
    <section className="rounded-lg border border-rose-300/25 bg-[#0c0510]/80 p-3" aria-label="22 arcana loop binder">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[9px] uppercase tracking-[0.3em] text-rose-300">EX = 0 · ARCANA LOOP BINDER · 22 (11×2)</p>
          <p className="text-[9px] text-slate-500">Tap a square to queue its loop; it starts / stops on the next bar.</p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-400">
          <span>{Math.round(bpm || 72)} BPM · bar {bar} · step {step + 1}/{STEPS}</span>
          <button type="button" onClick={() => setLoops({})} aria-label="Stop all loops" className="rounded border border-white/10 p-1 hover:text-white"><Square size={11} /></button>
        </div>
      </div>

      <div className="space-y-1.5">
        {binderRows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-11">
            {row.map((a) => {
              const state = loops[a.id] ?? 'idle';
              const color = ARCHETYPE_COLORS[a.archetype] ?? '#fda4af';
              const curve = curves[a.id];
              const on = state === 'playing' || state === 'queued-off';
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  aria-pressed={on}
                  aria-label={`${a.name} loop, ${state}`}
                  title={`${a.name} · ${a.archetype} · ${state}`}
                  className="relative aspect-square overflow-hidden rounded border text-left transition-colors"
                  style={{
                    borderColor: state === 'idle' ? 'rgba(255,255,255,.08)' : color,
                    background: on ? `${color}22` : 'rgba(0,0,0,.45)',
                    animation: state.startsWith('queued') ? 'binderBlink .5s steps(2) infinite' : undefined,
                  }}
                >
                  <span className="absolute left-1 top-0.5 font-mono text-[8px] text-slate-400">{String(a.id).padStart(2, '0')}</span>
                  <span className="absolute right-1 top-0.5 text-[10px]" style={{ color }}>{a.symbol}</span>
                  <span className="absolute inset-x-1 bottom-1 flex h-1/2 items-end gap-[1px]">
                    {curve.map((value, index) => (
                      <span
                        key={index}
                        className="flex-1 rounded-[1px]"
                        style={{
                          height: `${value * 100}%`,
                          background: color,
                          opacity: on ? (index === step ? 1 : 0.4) : 0.15,
                        }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 text-[9px] text-slate-500">
        <span className="w-20">mix {playing.length}/22</span>
        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
          <span className="block h-full rounded-full bg-gradient-to-r from-rose-400 via-fuchsia-400 to-emerald-300 transition-[width] duration-100" style={{ width: `${mix * 100}%` }} />
        </span>
        <span className="w-10 text-right font-mono">{mix.toFixed(2)}</span>
      </div>
      <style jsx>{`
        @keyframes binderBlink { 50% { opacity: 0.55; } }
        @media (prefers-reduced-motion: reduce) { button { animation: none !important; } }
      `}</style>
    </section>
  );
}
