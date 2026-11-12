'use client';

import Link from 'next/link';
import DnaBubble from '@/components/DnaBubble';
import DiagnosticPopup from '@/components/cure/DiagnosticPopup';
import { useCureAPIStore, type SimulationMode } from '@/lib/cureApiStore';

const TEST_OPTIONS: {
  symbol: 'BTCUSD' | 'XAUUSD';
  mode: SimulationMode;
  collision: 'collision-A' | 'collision-B';
}[] = [
  { symbol: 'BTCUSD', mode: 'hypothesisA', collision: 'collision-A' },
  { symbol: 'XAUUSD', mode: 'hypothesisB', collision: 'collision-B' },
];

/**
 * The temporary TEST TO ZERO header. Its visibility and parts live in the Cure-API store: END TEST
 * hides it, and the bike in the bottom-right corner (BikeHeaderToggle) turns it — or any of its parts
 * — back on.
 */
export default function TestToZeroHeader() {
  const visible = useCureAPIStore((state) => state.headerVisible);
  const setVisible = useCureAPIStore((state) => state.setHeaderVisible);
  const items = useCureAPIStore((state) => state.headerItems);
  const simulationMode = useCureAPIStore((state) => state.simulationMode);
  const setSimulationMode = useCureAPIStore((state) => state.setSimulationMode);
  const active = TEST_OPTIONS.find((option) => option.mode === simulationMode) ?? TEST_OPTIONS[0];

  if (!visible) return null;

  const selectMode = (mode: SimulationMode) => setSimulationMode(mode);

  return (
    <header className="sticky top-0 z-[90] border-b border-cyan-300/20 bg-[#05090e]/95 px-4 py-3 text-slate-100 shadow-[0_8px_28px_rgba(0,0,0,.35)] backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded border border-cyan-300/40 bg-cyan-300/10 font-mono text-sm font-bold text-cyan-200">T0</span>
          <div>
            <p className="font-mono text-xs font-semibold tracking-[0.2em] text-cyan-200">TEST TO ZERO</p>
            <p className="font-mono text-[10px] tracking-wide text-slate-500">INITIAL TEST HEADER · TEMPORARY</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {items.instrument && <span className="mr-1 font-mono text-[10px] uppercase tracking-widest text-slate-500">Instrument</span>}
          {items.instrument && TEST_OPTIONS.map((option) => (
            <button
              key={option.symbol}
              type="button"
              aria-pressed={active.symbol === option.symbol}
              onClick={() => selectMode(option.mode)}
              className={`rounded border px-3 py-2 font-mono text-xs transition ${
                active.symbol === option.symbol
                  ? 'border-cyan-200/70 bg-cyan-200/15 text-cyan-100'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/30 hover:text-white'
              }`}
            >
              {option.symbol}
            </button>
          ))}
          {items.instrument && items.collision && <span aria-hidden="true" className="mx-1 h-6 border-l border-white/10" />}
          {items.collision && TEST_OPTIONS.map((option) => (
            <button
              key={option.collision}
              type="button"
              aria-pressed={active.mode === option.mode}
              onClick={() => selectMode(option.mode)}
              className={`rounded-full border px-3 py-2 font-mono text-xs transition ${
                active.mode === option.mode
                  ? 'border-amber-200/70 bg-amber-200/10 text-amber-100'
                  : 'border-white/10 text-slate-400 hover:border-white/30 hover:text-white'
              }`}
            >
              {option.collision}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {items.engine && <Link href="/cure-api/engine" className="rounded border border-fuchsia-300/40 px-3 py-2 font-mono text-[11px] text-fuchsia-200 hover:border-fuchsia-200">ENGINE</Link>}
          {items.view && <p aria-live="polite" className="rounded border border-white/10 bg-black/30 px-3 py-2 font-mono text-[11px] text-slate-300">
            VIEW: <span className="font-semibold text-white">{active.symbol}</span>
            <span className="mx-1 text-slate-600">/</span>
            <span className="text-amber-200">{active.collision}</span>
          </p>}
          <DiagnosticPopup />
          <DnaBubble />
          <button
            type="button"
            onClick={() => setVisible(false)}
            className="rounded border border-white/10 px-2 py-2 font-mono text-[10px] text-slate-500 hover:border-rose-300/40 hover:text-rose-200"
            aria-label="End temporary test header session"
            title="ヘッダーを閉じる（右下のバイクからいつでも戻せる）"
          >
            END TEST
          </button>
        </div>
      </div>
    </header>
  );
}
