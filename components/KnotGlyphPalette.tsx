'use client';

import { ChevronLeft, ChevronRight, Link2, LockKeyhole, RotateCcw } from 'lucide-react';
import { MAJOR_ARCANA_KNOTS, useKnotSelection } from '@/hooks/useKnotSelection';

const KNOT_COLORS = ['#38bdf8', '#f8d66d', '#fb7185', '#a78bfa'];

type KnotGlyphPaletteProps = {
  selectedIds?: readonly number[];
  onToggle?: (id: number) => void;
  onClear?: () => void;
  page?: number;
  onPageChange?: (delta: number) => void;
  locked?: boolean;
};

function CandyKnot({ id }: { id: number }) {
  const offsets = Array.from({ length: 4 }, (_, index) => {
    const phase = id * 0.71 + index * Math.PI / 2;
    return {
      color: KNOT_COLORS[index],
      x1: 8 + Math.cos(phase) * 5,
      y1: 14 + Math.sin(phase * 1.7) * 6,
      x2: 24 + Math.cos(phase + 1.6) * 8,
      y2: 14 + Math.sin(phase * 2.1 + 0.8) * 7,
    };
  });

  return <svg viewBox="0 0 32 28" className="h-7 w-8" aria-hidden="true">
    {offsets.map((line, index) => <g key={line.color}>
      <path d={`M${line.x1} ${line.y1} Q16 ${4 + ((id + index * 3) % 8)} ${line.x2} ${line.y2}`} fill="none" stroke={line.color} strokeWidth="1.25" strokeLinecap="round" />
      <circle cx={line.x1} cy={line.y1} r="1.1" fill={line.color} />
    </g>)}
  </svg>;
}

export default function KnotGlyphPalette({
  selectedIds: controlledIds,
  onToggle,
  onClear,
  page = 0,
  onPageChange = () => undefined,
  locked = false,
}: KnotGlyphPaletteProps) {
  const selectedKnots = useKnotSelection((state) => state.selectedKnots);
  const toggleKnot = useKnotSelection((state) => state.toggleKnot);
  const clearKnots = useKnotSelection((state) => state.clearKnots);
  const usesGlobalSelection = controlledIds === undefined;
  const selectedIds = controlledIds ?? selectedKnots;
  const resolvedToggle = onToggle ?? toggleKnot;
  const resolvedClear = onClear ?? clearKnots;
  const isArcanaPalette = usesGlobalSelection && page === 0;

  return <aside className="border border-cyan-200/15 bg-[#030813]/85 p-3 shadow-[0_0_42px_rgba(34,211,238,0.06)] xl:h-[620px]" aria-label="Knot glyph selection">
    <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-3">
      <div><p className="font-mono text-[8px] uppercase tracking-[0.22em] text-cyan-200/65">{isArcanaPalette ? 'Major Arcana / 22 knots' : `Knot inventory / ${page + 1}-4`}</p><p className="mt-1 font-mono text-[9px] text-stone-400">{selectedIds.length}/{isArcanaPalette ? 22 : 88} linked</p></div>
      <button type="button" onClick={resolvedClear} disabled={selectedIds.length === 0} className="border border-white/10 p-1 text-stone-500 hover:border-cyan-200/40 hover:text-cyan-100 disabled:opacity-30" aria-label="Clear knot selection"><RotateCcw className="h-3 w-3" /></button>
    </div>
    <div className="grid grid-cols-2 gap-1.5">
      {Array.from({ length: 22 }, (_, index) => {
        const id = isArcanaPalette ? index : page * 22 + index + 1;
        const selected = selectedIds.includes(id);
        return <button key={id} type="button" onClick={() => resolvedToggle(id)} disabled={locked} aria-pressed={selected} title={isArcanaPalette ? MAJOR_ARCANA_KNOTS[index] : undefined} className={`group relative flex h-11 items-center justify-center border transition-colors disabled:cursor-not-allowed ${selected ? 'border-cyan-200/70 bg-cyan-100/[0.09] shadow-[0_0_14px_rgba(34,211,238,0.13)]' : 'border-white/10 bg-black/10 hover:border-violet-200/40'} ${locked ? 'opacity-55' : ''}`}>
          <CandyKnot id={id} />
          <span className="absolute bottom-1 right-1 font-mono text-[7px] text-stone-600 group-hover:text-stone-300">{isArcanaPalette ? String(id).padStart(2, '0') : String(index + 1).padStart(2, '0')}</span>
          {selected && <Link2 className="absolute left-1 top-1 h-2.5 w-2.5 text-cyan-100" />}
        </button>;
      })}
    </div>
    {!isArcanaPalette && <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2"><button type="button" onClick={() => onPageChange(-1)} className="p-1 text-stone-500 hover:text-cyan-100" aria-label="Previous knot page"><ChevronLeft className="h-3 w-3" /></button><span className="flex items-center gap-1 font-mono text-[8px] text-stone-500">{locked && <LockKeyhole className="h-3 w-3 text-amber-200" />}{locked ? 'selection locked' : '4-finger swipe pages'}</span><button type="button" onClick={() => onPageChange(1)} className="p-1 text-stone-500 hover:text-cyan-100" aria-label="Next knot page"><ChevronRight className="h-3 w-3" /></button></div>}
    <p className="mt-2 font-mono text-[8px] leading-4 text-stone-600">{isArcanaPalette ? 'Select Major Arcana knots to contract the eight Square Arc target zones.' : 'Select multiple knot samples to project four buy-stop and sell-step patterns into the 48-cell field.'}</p>
  </aside>;
}
