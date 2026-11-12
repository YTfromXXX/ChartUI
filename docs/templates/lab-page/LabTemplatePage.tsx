'use client';

// TEMPLATE — copy to app/lab/<your-lab>/page.tsx, rename the component, and import from lib/.
// Rules already met here (docs/design-rules.md): synthetic data is labelled, nothing flashes,
// time-based animation with dt ≥ 0, reduced motion respected, text contrast ≥ 4.5 : 1.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { step, syntheticBars } from './labTemplate';

export default function LabTemplatePage() {
  const [seed, setSeed] = useState(1);
  const bars = useMemo(() => syntheticBars(seed), [seed]);
  const result = useMemo(() => step(bars), [bars]);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = performance.now(); let raf = 0;
    const frame = (now: number) => {
      const dt = Math.max(0, now - last) / 1000; last = Math.max(last, now);
      setPhase((p) => (p + dt * (reduce ? 0.1 : 0.5)) % 1); // ≤ 0.5 Hz: well under the 3 Hz limit
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame); return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <main className="min-h-screen bg-[#0b0d10] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-5xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-slate-400">LAB · TEMPLATE</p>
            <h1 className="text-2xl font-semibold">LAB title</h1>
            <p className="text-sm text-slate-300">One paragraph: what you see, what you do, what decides the outcome. Prices are synthetic.</p>
          </div>
          <nav className="font-mono text-xs"><Link href="/menu" className="border border-white/20 px-3 py-1">Menu</Link></nav>
        </header>
        <div className="h-2 w-full bg-white/10"><div className="h-2 bg-amber-300" style={{ width: `${phase * 100}%` }} /></div>
        <p data-testid="result" className="font-mono text-sm">last {result.last.toFixed(2)} · change {(result.change * 100).toFixed(2)}%</p>
        <button type="button" onClick={() => setSeed((s) => s + 1)} className="border border-white/20 px-3 py-1 font-mono text-xs">New seed</button>
      </div>
    </main>
  );
}
