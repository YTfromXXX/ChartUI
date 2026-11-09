'use client';

import { Activity, ChevronDown, Expand, HeartPulse, MoveHorizontal, RotateCcw, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CURE_TIMEFRAMES,
  TIMEFRAME_ORBIT_SPEED,
  TIMEFRAME_STROBE_INTERVAL_MS,
  useCureAPIStore,
  type ArcanaParameter,
  type PlaceholderState,
} from '@/lib/cureApiStore';
import CureProjectionEngine from '@/components/cure/CureProjectionEngine';
import ArcanaLoopBinder from '@/components/cure/ArcanaLoopBinder';
import { orbitPath, orbitPoint } from '@/lib/cureOrbit';
import IntuitionChoicePopup from '@/components/cure/IntuitionChoicePopup';
import { IDLE_PROMPT, PATTERN_ANALYSIS, type Pattern } from '@/lib/cureKit';

const PLACEHOLDER_OPTIONS: Exclude<PlaceholderState, 'idle'>[] = ['⚪︎', '◻︎', '(expand)', '(extend)'];

type LayerProps = {
  children: ReactNode;
  layer: 2 | 4 | 6 | 7;
  className?: string;
};

function CureLayer({ children, layer, className = '' }: LayerProps) {
  return <div className={className} style={{ zIndex: layer }}>{children}</div>;
}

function OrbitalPet() {
  const petRef = useRef<SVGGElement>(null);
  const timeframe = useCureAPIStore((state) => state.timeframe);
  const volatility = useCureAPIStore((state) => state.volatilityIndex);
  const activatePlaceholder = useCureAPIStore((state) => state.activatePlaceholder);
  const pattern = useCureAPIStore((state) => state.placeholderState);
  const oddField = useCureAPIStore((state) => state.oddField);
  const orbitSpeed = TIMEFRAME_ORBIT_SPEED[timeframe];
  const strobeInterval = TIMEFRAME_STROBE_INTERVAL_MS[timeframe];

  useEffect(() => {
    let frame = 0;
    let lastStrobe = 0;
    let phase = 0;
    let pulse = 0;
    let previousTime = 0;
    const node = petRef.current;
    if (!node) return undefined;

    const tick = (now: number) => {
      const dt = previousTime ? Math.min((now - previousTime) / 1000, 0.05) : 0;
      previousTime = now;
      phase += dt * orbitSpeed;
      if (now - lastStrobe >= strobeInterval) {
        lastStrobe = now;
        pulse = 1;
      }
      pulse *= Math.exp(-dt * 3.2);
      const noise = volatility * (Math.sin(now * 0.0093) * 7 + Math.sin(now * 0.023) * 3.5);
      // Placeholder = intervention pattern; the odd-return field widens the orbit into a free curve.
      const base = orbitPoint(phase, pattern, oddField, now / 1000);
      const x = base.x + Math.cos(phase * 2.2) * noise;
      const y = base.y + Math.sin(phase * 1.7) * noise;
      const angle = phase * 90;
      node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${angle.toFixed(1)})`);
      node.setAttribute('opacity', (0.72 + pulse * 0.28).toFixed(2));
      node.setAttribute('r', (5.5 + pulse * 3).toFixed(2));
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [orbitSpeed, strobeInterval, volatility, pattern, oddField]);

  return (
    <g
      ref={petRef}
      role="button"
      tabIndex={0}
      aria-label="Catch the orbital cell to activate placeholder"
      className="cursor-grab outline-none active:cursor-grabbing"
      onPointerDown={(event) => {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        activatePlaceholder();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') activatePlaceholder();
      }}
    >
      <circle r="13" fill="#fb7185" fillOpacity=".15" />
      <circle r="7" fill="#ffe4e6" fillOpacity=".18" />
      <circle r="5" fill="#fff1f2" stroke="#fda4af" strokeWidth="1.5" />
      <circle cx="-1.5" cy="-1.5" r="1.2" fill="white" />
    </g>
  );
}

function LensCell({ arcana, index }: { arcana: ArcanaParameter; index: number }) {
  const setArcanaAngle = useCureAPIStore((state) => state.setArcanaAngle);
  return (
    <label className="group min-w-0 rounded border border-emerald-100/10 bg-black/45 p-2 transition-colors hover:border-emerald-200/50">
      <div className="flex items-center gap-2">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-100/20 bg-emerald-100/[0.05] text-lg text-emerald-100"
          data-silhouette-id={arcana.silhouetteId}
          aria-label={`${arcana.name} silhouette placeholder`}
          title={arcana.silhouetteId}
        >
          {arcana.symbol}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[10px] text-slate-100">{String(index + 1).padStart(2, '0')} · {arcana.name}</span>
          <span className="block truncate text-[8px] uppercase tracking-wider text-slate-500">{arcana.archetype} lens</span>
        </span>
      </div>
      <span className="mt-2 flex items-center justify-between text-[8px] uppercase tracking-wider text-slate-500">
        Angle <output className="font-mono text-emerald-200">{arcana.angle.toFixed(0)}°</output>
      </span>
      <input
        aria-label={`${arcana.name} angle`}
        type="range"
        min="-180"
        max="180"
        step="1"
        value={arcana.angle}
        onChange={(event) => setArcanaAngle(arcana.id, Number(event.target.value))}
        className="mt-1 h-1 w-full accent-emerald-300"
      />
    </label>
  );
}

export default function CureApiInitialMenu() {
  const timeframe = useCureAPIStore((state) => state.timeframe);
  const setTimeframe = useCureAPIStore((state) => state.setTimeframe);
  const volatility = useCureAPIStore((state) => state.volatilityIndex);
  const setVolatility = useCureAPIStore((state) => state.setVolatilityIndex);
  const placeholderState = useCureAPIStore((state) => state.placeholderState);
  const placeholderActive = useCureAPIStore((state) => state.placeholderActive);
  const setPlaceholderState = useCureAPIStore((state) => state.setPlaceholderState);
  const closePlaceholder = useCureAPIStore((state) => state.closePlaceholder);
  const newsFeedText = useCureAPIStore((state) => state.newsFeedText);
  const setNewsFeedText = useCureAPIStore((state) => state.setNewsFeedText);
  const exParameter = useCureAPIStore((state) => state.exParameter);
  const setExParameter = useCureAPIStore((state) => state.setExParameter);
  const arcanaParameters = useCureAPIStore((state) => state.arcanaParameters);
  const simulationMode = useCureAPIStore((state) => state.simulationMode);
  const oddField = useCureAPIStore((state) => state.oddField);
  const setSimulationMode = useCureAPIStore((state) => state.setSimulationMode);
  const resetArcanaParameters = useCureAPIStore((state) => state.resetArcanaParameters);
  const [placeholderText, setPlaceholderText] = useState('');
  const [choiceFor, setChoiceFor] = useState<Pattern | null>(null);

  useEffect(() => {
    if (exParameter === 0) useCureAPIStore.getState().activatePlaceholder();
  }, [exParameter]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0c0510] p-4 font-mono text-slate-100 sm:p-6">
      <CureLayer layer={2} className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_22%_42%,rgba(251,113,133,.16),transparent_38%),linear-gradient(130deg,#0c0510,#140a18_55%,#0a0710)]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(251,113,133,.22)_1px,transparent_1px),linear-gradient(90deg,rgba(251,113,133,.22)_1px,transparent_1px)] [background-size:32px_32px]" />
      </CureLayer>

      <CureLayer layer={4} className="relative mx-auto max-w-[1500px] space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div>
            <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.35em] text-rose-300"><HeartPulse size={11} className="cure-heartbeat" /> ChartUI · Cure-API</p>
            <h1 className="mt-1 text-xl font-semibold tracking-wide sm:text-2xl">Initial Menu / Matrix Observatory</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex gap-1" aria-label="Hypothesis projection mode">
            <button type="button" aria-label="Hypothesis A expand mode" aria-pressed={simulationMode === 'hypothesisA'} onClick={() => setSimulationMode('hypothesisA')} className={`flex h-8 w-8 items-center justify-center rounded-full border ${simulationMode === 'hypothesisA' ? 'border-rose-100/60 bg-rose-100/10 text-rose-100' : 'border-white/10 text-stone-500'}`}><Expand className="h-3.5 w-3.5" /></button>
            <button type="button" aria-label="Hypothesis B extend mode" aria-pressed={simulationMode === 'hypothesisB'} onClick={() => setSimulationMode('hypothesisB')} className={`flex h-8 w-8 items-center justify-center rounded-full border ${simulationMode === 'hypothesisB' ? 'border-rose-100/60 bg-rose-100/10 text-rose-100' : 'border-white/10 text-stone-500'}`}><MoveHorizontal className="h-3.5 w-3.5" /></button>
          </div>
          <nav aria-label="Analysis navigation" className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider">
            <Link href="/matrix" className="border border-rose-200/20 px-3 py-2 text-rose-100 hover:border-rose-200/60">Matrix</Link>
            <Link href="/knot-chart" className="border border-rose-200/20 px-3 py-2 text-rose-100 hover:border-rose-200/60">Knot Chart · 48</Link>
            <Link href="/oracle-api" className="border border-white/10 px-3 py-2 text-slate-300 hover:border-white/30">Oracle</Link>
            <Link href="/cure-api/experiments" className="border border-white/10 px-3 py-2 text-slate-300 hover:border-white/30">Experiment</Link>
          </nav>
          </div>
        </header>

        <CureProjectionEngine />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,.8fr)]">
          <section className="flex min-w-0 flex-col gap-3">
            <div className="relative overflow-hidden rounded-lg border border-rose-200/15 bg-black/40 p-3">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[10px] uppercase tracking-[0.22em] text-rose-100">SPIRAL EYE · orbital cell field</h2>
                <label className="flex items-center gap-2 text-[9px] text-slate-400">
                  Timeframe
                  <select value={timeframe} onChange={(event) => setTimeframe(event.target.value as typeof timeframe)} className="border border-white/10 bg-slate-950 px-2 py-1 text-rose-100">
                    {CURE_TIMEFRAMES.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
              </div>
              <svg viewBox="0 0 640 310" className="h-[240px] w-full sm:h-[310px]" role="img" aria-label="Dotted orbital track with an interactive moving cell">
                <defs>
                  <radialGradient id="eyeGlow"><stop stopColor="#fda4af" stopOpacity=".4" /><stop offset="1" stopColor="#fda4af" stopOpacity="0" /></radialGradient>
                  <filter id="petGlow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                </defs>
                <ellipse cx="320" cy="155" rx="135" ry="78" fill="none" stroke="#fda4af" strokeOpacity=".44" strokeDasharray="2 7" strokeWidth="1.5" />
                <ellipse cx="320" cy="155" rx="112" ry="60" fill="none" stroke="#94a3b8" strokeOpacity=".13" strokeDasharray="1 9" />
                {Array.from({ length: 48 }, (_, index) => {
                  const angle = (index / 48) * Math.PI * 2;
                  const x = 320 + Math.cos(angle) * 135;
                  const y = 155 + Math.sin(angle) * 78;
                  const active = index % Math.max(1, Math.round(TIMEFRAME_STROBE_INTERVAL_MS[timeframe] / 80)) === 0;
                  return <circle key={index} cx={x} cy={y} r={active ? 2 : 1} fill={active ? '#fda4af' : '#64748b'} opacity={active ? 0.85 : 0.4} />;
                })}
                <circle cx="320" cy="155" r={70 + volatility * 55} fill="url(#eyeGlow)" opacity=".55" />
                <circle cx="320" cy="155" r="16" fill="none" stroke="#f8fafc" strokeOpacity=".45" />
                <circle cx="320" cy="155" r="4" fill="#fff" filter="url(#petGlow)" />
                <text x="320" y="188" textAnchor="middle" fill="#94a3b8" fontSize="8" letterSpacing="2">SPIRAL EYE / ORIGIN</text>
                <g transform="translate(320 155)">
                  <path d={orbitPath(placeholderState, oddField)} fill="none" stroke="#e879f9" strokeOpacity=".35" strokeWidth="1" strokeDasharray="1 4" />
                  <OrbitalPet />
                </g>
                <text x="320" y="292" textAnchor="middle" fill="#64748b" fontSize="8">ORBIT × {TIMEFRAME_ORBIT_SPEED[timeframe].toFixed(2)} · STROBE {TIMEFRAME_STROBE_INTERVAL_MS[timeframe]} ms · {placeholderState === 'idle' ? 'NO INTERVENTION' : `PATTERN ${placeholderState}`} · ODD FIELD {oddField ? `${oddField.tension.toFixed(2)} / ${(oddField.oddRatio * 100).toFixed(0)}% odd` : '— (open retro grid)'}</text>
              </svg>
              <div className="flex flex-wrap items-center gap-3 text-[9px] text-slate-400">
                <span className="inline-flex items-center gap-1"><Activity size={12} className="text-rose-300" /> Orbit speed {TIMEFRAME_ORBIT_SPEED[timeframe].toFixed(2)}×</span>
                <label className="flex min-w-[180px] flex-1 items-center gap-2">
                  Volatility {volatility.toFixed(2)}
                  <input aria-label="Volatility index" type="range" min="0" max="1" step=".01" value={volatility} onChange={(event) => setVolatility(Number(event.target.value))} className="flex-1 accent-fuchsia-300" />
                </label>
                <label className="flex items-center gap-2">EX
                  <input aria-label="EX parameter" type="range" min="0" max="1" step=".01" value={exParameter} onChange={(event) => setExParameter(Number(event.target.value))} className="w-20 accent-rose-300" />
                  <span>{exParameter.toFixed(2)}</span>
                </label>
              </div>
            </div>

            <div className="relative rounded-lg border border-violet-200/15 bg-black/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-[10px] uppercase tracking-[0.22em] text-violet-200">Placeholder / cell type definition</h2>
                <span className="text-[9px] text-slate-500">{placeholderActive ? 'INPUT ACTIVE' : placeholderState === 'idle' ? 'CATCH CELL TO ACTIVATE' : 'TYPE SET'}</span>
              </div>
              <div className={`flex min-h-11 items-center gap-2 border px-3 transition-colors ${placeholderActive ? 'border-rose-200/60 bg-rose-100/[0.06]' : 'border-white/10 bg-black/40'}`}>
                <span className="text-rose-200"><Sparkles size={14} /></span>
                <input
                  aria-label="Placeholder definition"
                  value={placeholderText}
                  onChange={(event) => setPlaceholderText(event.target.value)}
                  onFocus={() => useCureAPIStore.getState().activatePlaceholder()}
                  placeholder={placeholderState === 'idle' ? IDLE_PROMPT : PATTERN_ANALYSIS[placeholderState].prompt}
                  className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
                />
                <button type="button" aria-expanded={placeholderActive} onClick={() => placeholderActive ? closePlaceholder() : useCureAPIStore.getState().activatePlaceholder()} className="text-slate-400 hover:text-white">
                  <ChevronDown size={16} />
                </button>
              </div>
              {placeholderActive && (
                <CureLayer layer={7} className="absolute bottom-14 left-3 right-3 rounded border border-rose-200/35 bg-[#140812] p-2 shadow-2xl sm:left-auto sm:w-72">
                  <div className="mb-1 flex items-center justify-between px-1 text-[9px] uppercase tracking-wider text-slate-400">
                    <span>Choose cell type</span>
                    <button type="button" onClick={closePlaceholder} aria-label="Close type menu" className="px-1 text-slate-500 hover:text-white">×</button>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {PLACEHOLDER_OPTIONS.map((option) => (
                      <button key={option} type="button" onClick={() => { useCureAPIStore.getState().setPlaceholderState(option); setChoiceFor(option); }} title={PATTERN_ANALYSIS[option].prompt} className={`border px-2 py-2 text-xs hover:border-rose-200/60 ${placeholderState === option ? 'border-rose-200/60 bg-rose-200/10 text-rose-100' : 'border-white/10 text-slate-300'}`}>
                        {option} <span className="text-[9px] text-slate-500">{PATTERN_ANALYSIS[option].name}</span>
                      </button>
                    ))}
                  </div>
                </CureLayer>
              )}
            </div>

            {exParameter === 0 && <ArcanaLoopBinder />}

            <CureLayer layer={6} className="relative overflow-hidden rounded border border-amber-200/15 bg-black/50">
              <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2 text-[9px] uppercase tracking-[0.2em] text-amber-200"><Activity size={12} /> News Tab Zone</div>
              <label className="sr-only" htmlFor="cure-news">News ticker text</label>
              <input id="cure-news" value={newsFeedText} onChange={(event) => setNewsFeedText(event.target.value)} className="w-full bg-transparent px-3 py-2 text-[10px] text-amber-100/80 outline-none" />
              <div className="overflow-hidden border-t border-white/5 py-1.5">
                <p className="cure-news-ticker whitespace-nowrap text-[9px] text-slate-400">{newsFeedText || 'NEWS FEED EMPTY — EDIT ABOVE TO ADD A SUBTITLE'}</p>
              </div>
            </CureLayer>
          </section>

          <aside className="min-h-0 rounded-lg border border-rose-200/15 bg-black/35 p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[9px] uppercase tracking-[0.25em] text-rose-300">ARCANA / 22 LENSES</p>
                <h2 className="text-sm text-slate-100">Angle instruments</h2>
              </div>
              <button type="button" onClick={resetArcanaParameters} title="Reset all lens angles" className="rounded border border-white/10 p-2 text-slate-400 hover:text-white"><RotateCcw size={13} /></button>
            </div>
            <div className="grid max-h-[460px] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:max-h-[620px]" aria-label="22 editable arcana lens parameters">
              {arcanaParameters.map((arcana, index) => <LensCell key={arcana.id} arcana={arcana} index={index} />)}
            </div>
            <p className="mt-2 text-[8px] leading-4 text-slate-500">Angles are saved locally and modulate each lens' display orientation. No live market inference is implied.</p>
          </aside>
        </div>
      </CureLayer>
      {choiceFor && <IntuitionChoicePopup pattern={choiceFor} onClose={() => setChoiceFor(null)} />}
      <style jsx>{`
        .cure-news-ticker { width: max-content; animation: cureTicker 24s linear infinite; }
        :global(.cure-heartbeat) { animation: cureHeart 0.83s ease-in-out infinite; transform-origin: center; }
        @keyframes cureHeart { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.25); } 30% { transform: scale(0.95); } 45% { transform: scale(1.12); } }
        @keyframes cureTicker { from { transform: translateX(100%); } to { transform: translateX(-100%); } }
        @media (prefers-reduced-motion: reduce) { .cure-news-ticker { animation: none; width: auto; white-space: normal; } :global(.cure-heartbeat) { animation: none; } }
      `}</style>
    </main>
  );
}
