'use client';

import { Repeat } from 'lucide-react';
import Link from 'next/link';
import {
  CURE_SPLIT,
  EXPLORATION_LOOP,
  SELECTED_OUTPUT_CELL,
  SPLIT_TOTAL,
  nextLoopStop,
  splitShare,
  type LoopStopId,
  type SplitKey,
} from '@/lib/cureSplit';

type Props = {
  current: LoopStopId;
  active?: SplitKey | null;
  onSelect?: (key: SplitKey | null) => void;
};

/**
 * Table of contents for the retro-grid pages. Each split part is a stacked card whose
 * CSS z-index equals its ratio weight, so higher-priority parts physically sit on top.
 */
export default function CureSplitIndex({ current, active = null, onSelect }: Props) {
  const next = nextLoopStop(current);
  return (
    <section className="rounded border border-rose-300/25 bg-[#0c0510]/90 p-4 text-xs" aria-label="Cure split table of contents">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[9px] uppercase tracking-[0.3em] text-rose-300">目次 · {SELECTED_OUTPUT_CELL.title}</p>
          <p className="mt-1 text-[10px] text-slate-400">{SELECTED_OUTPUT_CELL.detail}</p>
        </div>
        <span className="font-mono text-[10px] text-slate-500">[{CURE_SPLIT.map((p) => p.layer).join(' : ')}] = {SPLIT_TOTAL}</span>
      </div>

      <ol className="relative">
        {CURE_SPLIT.map((part, index) => {
          const isActive = active === part.key;
          return (
            <li key={part.key} className="relative" style={{ zIndex: part.layer, marginTop: index === 0 ? 0 : -6 }}>
              <button
                type="button"
                aria-pressed={isActive}
                onClick={() => onSelect?.(isActive ? null : part.key)}
                className={`block w-full rounded border bg-[#12070f] p-2 text-left shadow-[0_6px_16px_rgba(0,0,0,.55)] transition-transform hover:-translate-y-0.5 ${isActive ? 'border-white/60' : 'border-white/10'}`}
                style={{ borderLeft: `4px solid ${part.color}`, marginLeft: `${(7 - part.layer) * 4}px` }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-slate-100">z{part.layer} · {part.title}</span>
                  <span className="font-mono" style={{ color: part.color }}>{(splitShare(part) * 100).toFixed(1)}%</span>
                </span>
                <span className="mt-1 block text-[9px] leading-4 text-slate-500">{part.detail}</span>
                <span className="mt-1 block h-1 rounded-full bg-white/5">
                  <span className="block h-full rounded-full" style={{ width: `${(part.layer / 7) * 100}%`, background: part.color }} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <nav aria-label="Exploration loop" className="mt-4 flex flex-wrap items-center gap-1 border-t border-white/10 pt-3 text-[10px]">
        <Repeat size={12} className="text-rose-300" />
        {EXPLORATION_LOOP.map((stop) => (
          <Link
            key={stop.id}
            href={stop.href}
            aria-current={stop.id === current ? 'page' : undefined}
            className={`border px-2 py-1 ${stop.id === current ? 'border-rose-200/60 bg-rose-200/10 text-rose-100' : stop.id === next.id ? 'border-emerald-300/50 text-emerald-200' : 'border-white/10 text-slate-400 hover:text-white'}`}
          >
            {stop.label}{stop.id === next.id ? ' →' : ''}
          </Link>
        ))}
      </nav>
    </section>
  );
}
