'use client';

import { useEffect, useRef, useState } from 'react';
import { debugMetrics } from '@/lib/debugMetrics';

type Snapshot = {
  fps: number;
  crossings: number;
  minDk: number;
  pressure: number;
  particles: number;
  gravityMax: number;
};

type Props = {
  fpsWarning?: number;
  crossingThreshold?: number;
  sampleMs?: number;
  initiallyVisible?: boolean;
};

const EMPTY: Snapshot = { fps: 0, crossings: 0, minDk: 1, pressure: 0, particles: 0, gravityMax: 0 };

function Panel({ label, value, unit, alert, corner }: { label: string; value: string; unit?: string; alert?: boolean; corner: string }) {
  return (
    <div
      className={`dbg-panel pointer-events-none absolute ${corner} min-w-[148px] rounded-md border px-3 py-2 font-mono backdrop-blur-md ${alert ? 'dbg-alert border-red-400/70 bg-red-950/40 text-red-200' : 'border-cyan-200/20 bg-slate-900/35 text-cyan-100'}`}
    >
      <div className="text-[9px] uppercase tracking-[0.22em] opacity-60">{label}</div>
      <div className="text-lg leading-tight tabular-nums">
        {value}
        {unit ? <span className="ml-1 text-[10px] opacity-60">{unit}</span> : null}
      </div>
    </div>
  );
}

/**
 * Metrics are sampled from the shared `debugMetrics` bus a few times per
 * second; the only per-frame work is one rAF that accumulates frame time into
 * plain refs, so the HUD never re-renders at frame rate.
 */
export default function DebugHUDOverlay({ fpsWarning = 30, crossingThreshold = 5000, sampleMs = 250, initiallyVisible = true }: Props) {
  const [visible, setVisible] = useState(initiallyVisible);
  const [snap, setSnap] = useState<Snapshot>(EMPTY);
  const [vignetteKey, setVignetteKey] = useState(0);
  const frames = useRef({ count: 0, last: 0, since: 0 });
  const breachRef = useRef(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        setVisible((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const f = frames.current;
    f.count = 0;
    f.last = performance.now();
    f.since = f.last;
    let raf = 0;
    const tick = (now: number) => {
      f.count += 1;
      f.last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const timer = window.setInterval(() => {
      const now = performance.now();
      const elapsed = Math.max(1, now - f.since);
      const fps = (f.count * 1000) / elapsed;
      f.count = 0;
      f.since = now;
      const breach = debugMetrics.minDk < 0;
      if (breach && !breachRef.current) setVignetteKey((key) => key + 1);
      breachRef.current = breach;
      setSnap({
        fps,
        crossings: Math.max(debugMetrics.chartCrossings, debugMetrics.streamCrossings),
        minDk: debugMetrics.minDk,
        pressure: debugMetrics.pressure,
        particles: debugMetrics.particles,
        gravityMax: debugMetrics.gravityMax,
      });
    }, sampleMs);

    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
    };
  }, [visible, sampleMs]);

  if (!visible) return null;

  const lowFps = snap.fps > 0 && snap.fps < fpsWarning;
  const overload = snap.crossings > crossingThreshold;
  const breach = snap.minDk < 0;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[9999]">
      <style>{`
        @keyframes dbg-blink { 0%,100% { opacity: 1 } 50% { opacity: .45 } }
        @keyframes dbg-glitch {
          0% { transform: translate(0,0); text-shadow: 2px 0 #f0f, -2px 0 #0ff }
          20% { transform: translate(-2px,1px); clip-path: inset(10% 0 55% 0) }
          40% { transform: translate(2px,-1px); clip-path: inset(55% 0 5% 0) }
          60% { transform: translate(-1px,0); clip-path: none }
          100% { transform: translate(0,0); text-shadow: -2px 0 #f0f, 2px 0 #0ff }
        }
        @keyframes dbg-vignette { 0% { opacity: 0 } 12% { opacity: 1 } 100% { opacity: 0 } }
        .dbg-alert { animation: dbg-blink .6s steps(2, end) infinite }
        .dbg-glitch { animation: dbg-glitch .35s steps(4, end) infinite }
        .dbg-vignette { background: radial-gradient(ellipse at center, transparent 55%, rgba(239,68,68,.65) 100%); animation: dbg-vignette .9s ease-out forwards }
        @media (prefers-reduced-motion: reduce) { .dbg-alert, .dbg-glitch { animation: none } }
      `}</style>
      {vignetteKey > 0 ? <div key={vignetteKey} className="dbg-vignette absolute inset-0" /> : null}
      <Panel corner="left-3 top-3" label="FPS" value={snap.fps.toFixed(0)} alert={lowFps} />
      <Panel corner="right-3 top-3" label="Crossings" value={snap.crossings.toLocaleString()} alert={overload} />
      <Panel corner="bottom-3 left-3" label="Pressure / min Dk" value={`${snap.pressure.toFixed(3)} / ${snap.minDk.toFixed(3)}`} alert={breach} />
      <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1">
        <div className="dbg-panel relative min-w-[148px] rounded-md border border-cyan-200/20 bg-slate-900/35 px-3 py-2 font-mono text-cyan-100 backdrop-blur-md">
          <div className="text-[9px] uppercase tracking-[0.22em] opacity-60">Active particles</div>
          <div className="text-lg tabular-nums">{snap.particles.toLocaleString()}</div>
          <div className="mt-1 text-[9px] uppercase tracking-[0.22em] opacity-60">Gravity distortion (max)</div>
          <div className="text-lg tabular-nums">{snap.gravityMax.toFixed(4)}</div>
        </div>
      </div>
      {lowFps || overload ? (
        <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded border border-red-400/70 bg-red-950/50 px-4 py-1 font-mono text-xs tracking-[0.3em] text-red-200 backdrop-blur-md dbg-alert">
          <span className="dbg-glitch inline-block">{overload ? 'WARNING: TOPOLOGY OVERLOAD' : 'WARNING: FRAME BUDGET EXCEEDED'}</span>
        </div>
      ) : null}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[9px] tracking-widest text-cyan-100/40">CTRL+SHIFT+D</div>
    </div>
  );
}
