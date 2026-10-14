'use client';

import { useState } from 'react';
import KnotChart from '@/components/2d/KnotChart';
import PortfolioRadar from '@/components/3d/PortfolioRadar';
import { useStressTestStream } from '@/hooks/useStressTestStream';
import { demoPortfolio } from '@/lib/portfolio';
import type { StressMode } from '@/lib/stressTestStream';

const MODES: StressMode[] = ['knot-overload', 'sdf-breakthrough', 'long-term-spiral'];

export default function StressTestPage() {
  const [mode, setMode] = useState<StressMode>('knot-overload');
  const [running, setRunning] = useState(true);
  const knot = useStressTestStream({ mode: mode === 'sdf-breakthrough' ? 'knot-overload' : mode, enabled: running });
  const flow = useStressTestStream({ mode: 'sdf-breakthrough', enabled: running && mode === 'sdf-breakthrough', intervalMs: 80 });

  return (
    <main className="min-h-screen bg-[#02060b] p-6 text-stone-100">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        {MODES.map((item) => (
          <button key={item} onClick={() => setMode(item)} className={`rounded border px-3 py-1 ${item === mode ? 'border-cyan-300 text-cyan-200' : 'border-white/20'}`}>
            {item}
          </button>
        ))}
        <button onClick={() => setRunning((value) => !value)} className="rounded border border-white/20 px-3 py-1">{running ? 'pause' : 'run'}</button>
        <button onClick={() => { knot.reset(); flow.reset(); }} className="rounded border border-white/20 px-3 py-1">reset</button>
        <span className="text-stone-400">step {mode === 'sdf-breakthrough' ? flow.step : knot.step}</span>
      </div>
      {mode === 'sdf-breakthrough' ? (
        <PortfolioRadar portfolio={flow.portfolio ?? demoPortfolio} className="h-[560px] w-full" />
      ) : (
        <KnotChart tick={knot.tick} history={knot.history} height={480} className="h-[480px] w-full" />
      )}
    </main>
  );
}
