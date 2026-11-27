'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Status = { page: 'A' | 'B'; simulationMode: string; storedMode: string | null; timeframe: string; simulationSpeed: number; at: number };

/**
 * GreenCardKit split view: retro-grid A and B rendered side by side in two frames.
 * Both frames share one persisted store, so the stored state is a composite of A and B
 * (last writer wins). The panel shows that composite, which is exactly what a server
 * render cannot know — the reason the HydrationGate exists.
 */
export default function RetroGridSplitPage() {
  const [status, setStatus] = useState<Partial<Record<'A' | 'B', Status>>>({});

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'retro-grid-status') return;
      const data = event.data as Status & { type: string };
      setStatus((current) => ({ ...current, [data.page]: data }));
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const stored = status.A?.storedMode ?? status.B?.storedMode ?? '—';
  const diverged = status.A && status.B && status.A.simulationMode !== status.B.simulationMode;

  return (
    <main className="min-h-screen bg-[#05020a] p-3 font-mono text-xs text-slate-200">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">GreenCardKit · split view · retro grid A | B</p>
        <Link href="/retro-grid?page=A" className="text-slate-400 hover:text-white">single view →</Link>
      </header>
      <section className="mb-2 grid gap-2 rounded border border-emerald-300/25 p-2 sm:grid-cols-3" aria-label="Composite state">
        {(['A', 'B'] as const).map((page) => (
          <p key={page}>
            <span className="text-emerald-200">frame {page}</span> · {status[page] ? `${status[page]!.simulationMode} · ${status[page]!.timeframe} · ×${status[page]!.simulationSpeed}` : 'waiting…'}
          </p>
        ))}
        <p>
          <span className="text-emerald-200">composite (localStorage)</span> · {stored}
          {diverged && <span className="ml-1 text-amber-200">· frames diverge → server render cannot match → HydrationGate</span>}
        </p>
      </section>
      <div className="grid h-[calc(100vh-7rem)] grid-cols-2 gap-2">
        {(['A', 'B'] as const).map((page) => (
          <iframe key={page} title={`Retro grid ${page}`} src={`/retro-grid?page=${page}`} className="h-full w-full rounded border border-white/10 bg-black" />
        ))}
      </div>
    </main>
  );
}
