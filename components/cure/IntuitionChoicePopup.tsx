'use client';

import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { runMonsterEngine } from '@/app/cure-api/TSMonsterEngine';
import { PATTERN_ANALYSIS, kitItem, type ChoiceOption, type Pattern } from '@/lib/cureKit';
import { useCureAPIStore } from '@/lib/cureApiStore';

const PAGE_META = {
  A: { title: 'Retro Grid A', sub: '能動 · 衝突 / 雷 · BTCUSD', color: '#fb7185' },
  B: { title: 'Retro Grid B', sub: '受容 · 包摂 / 殻 · XAUUSD', color: '#34d399' },
} as const;

/**
 * 『{A} or {B}』 two-choice popup raised by a placeholder intervention pattern.
 * Answering sends the customer to retro-grid page A (active / collision) or B (receptive / containment).
 */
export default function IntuitionChoicePopup({ pattern, onClose }: { pattern: Pattern; onClose: () => void }) {
  const router = useRouter();
  const analysis = PATTERN_ANALYSIS[pattern];
  const dialogRef = useRef<HTMLDivElement>(null);
  const oddField = useCureAPIStore((state) => state.oddField);
  const engine = useMemo(() => runMonsterEngine({
    pattern,
    oddField,
    locale: typeof navigator === 'undefined' ? undefined : navigator.language,
    prefersReducedMotion: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  }), [pattern, oddField]);
  const setIntuitionChoice = useCureAPIStore((state) => state.setIntuitionChoice);
  const setSimulationMode = useCureAPIStore((state) => state.setSimulationMode);

  useEffect(() => {
    // Fair play: focus the dialog, not either option, so neither side is preselected.
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const choose = (option: ChoiceOption) => {
    setIntuitionChoice({ pattern, page: option.page, kitId: option.kitId, text: option.text, at: Date.now() });
    setSimulationMode(option.page === 'A' ? 'hypothesisA' : 'hypothesisB');
    router.push(`/retro-grid?page=${option.page}`);
  };

  const { a, b } = engine.choice;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05020a]/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="intuition-title"
        onClick={(event) => event.stopPropagation()}
        className="relative w-full max-w-2xl overflow-hidden rounded-xl border border-rose-300/30 bg-[#0c0510] p-5 font-mono text-slate-100 shadow-[0_0_60px_rgba(251,113,133,.18)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(251,113,133,.16),transparent_60%)]" />
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 text-slate-500 hover:text-white"><X size={16} /></button>

        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-rose-300/40 bg-rose-300/10 text-xl text-rose-100">{pattern}</span>
          <div>
            <p className="text-[9px] uppercase tracking-[0.3em] text-rose-300">placeholder · 介入パターン「{analysis.name}」</p>
            <p className="mt-1 text-[10px] text-slate-400">{analysis.motion}</p>
          </div>
        </div>

        <p className="relative mt-4 text-[11px] leading-5 text-slate-300">{analysis.phenomenon}</p>
        <p className="relative mt-2 font-mono text-[9px] text-fuchsia-200/80">
          SensorySpiceKit · {engine.sensory.texture} · {engine.sensory.spice} · intensity {engine.sensory.intensity.toFixed(2)} · pulse {engine.sensory.pulseHz.toFixed(2)} Hz — {engine.sensory.cue}
        </p>

        <h2 id="intuition-title" className="relative mt-5 text-center text-base leading-7 text-white sm:text-lg">
          『<span style={{ color: PAGE_META.A.color }}>{`{${a.text}}`}</span> <span className="text-slate-500">or</span> <span style={{ color: PAGE_META.B.color }}>{`{${b.text}}`}</span>』
        </h2>
        <p className="relative mt-1 text-center text-[10px] text-slate-500">{analysis.prompt}</p>

        <div className="relative mt-4 grid gap-3 sm:grid-cols-2">
          {[a, b].map((option) => {
            const meta = PAGE_META[option.page];
            const kit = kitItem(option.kitId);
            return (
              <button
                key={option.page}
                type="button"
                onClick={() => choose(option)}
                className="group rounded-lg border bg-black/40 p-3 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2"
                style={{ borderColor: `${meta.color}66`, outlineColor: meta.color }}
              >
                <span className="block text-sm" style={{ color: meta.color }}>{`{${option.text}}`}</span>
                <span className="mt-2 block text-[10px] text-slate-300">#{kit.id} {kit.name} <span className="text-slate-500">· {kit.layer === 'skin' ? '表皮' : '骨格'}</span></span>
                <span className="block text-[9px] leading-4 text-slate-500">{kit.role}</span>
                <span className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[9px] uppercase tracking-wider text-slate-400">
                  <span>{meta.title}</span><span>{meta.sub} →</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative mt-4 flex flex-wrap gap-1 text-[9px] text-slate-500">
          <span className="mr-1">engaged kit:</span>
          {analysis.kit.map((id) => <span key={id} title={kitItem(id).role} className="rounded border border-white/10 px-1.5 py-0.5">#{id} {kitItem(id).name}</span>)}
        </div>
        <div className="relative mt-3 space-y-0.5 text-[8px] text-slate-600">
          <p>GreenCardKit · {engine.region} · {engine.notice}</p>
          <p>fair play {engine.fairPlay.ok ? '✓' : '✕'} · {engine.fairPlay.checks.filter((c) => !c.pass).map((c) => c.rule).join(' / ') || 'no preselection · balanced wording · dismissible · reversible'}</p>
          <p>Your answer is kept only in this browser to steer the exploration loop; it is not a profile or identity record.</p>
        </div>
      </div>
    </div>
  );
}
