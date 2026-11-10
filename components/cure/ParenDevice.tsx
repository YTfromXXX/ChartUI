'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useCureAPIStore } from '@/lib/cureApiStore';
import { analyse, type ParenRow } from '@/lib/parenDevice';
import { todayEvent } from '@/lib/architectOrders';

function Rows({ rows, ready }: { rows: ParenRow[]; ready: boolean }) {
  return (
    <ul className="space-y-1">
      {rows.map((r) => (
        <li key={r.kitId} className="border-l-2 border-rose-300/40 pl-2">
          <span className="text-rose-100">#{r.kitId} {r.name}</span>
          {ready && <span className="ml-2 inline-block h-1.5 w-24 bg-white/10 align-middle"><span className="block h-full bg-emerald-300" style={{ width: `${r.metric * 100}%` }} /></span>}
          <span className="block break-all font-mono text-[10px] text-slate-400">{r.lines.length ? r.lines.map(([src, text]) => `{(${src}):(${text})}`).join(' ') : '{():()}'}</span>
        </li>
      ))}
    </ul>
  );
}

/** Cure-API [():()] device: library + museum → skeleton (19) / skin (3) analysis. */
export default function ParenDevice() {
  const inputs = useCureAPIStore((s) => s.parenInputs);
  const pass = useCureAPIStore((s) => s.passToParen);
  const reset = useCureAPIStore((s) => s.resetParen);
  const a = useMemo(() => analyse(inputs), [inputs]);
  const ready = inputs.library && inputs.museum;
  const galaxy = todayEvent().galaxy;

  return (
    <section id="paren" aria-label="Paren device" className="space-y-3 border-t border-rose-300/20 bg-[#0c0510] px-4 py-5 font-mono text-[11px] text-slate-200 sm:px-6">
      <div className="mx-auto max-w-[1500px] space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-rose-300">Cure-API · [():()] 装置</p>
            <p className="text-sm">図書館と博物館を渡して、骨格（19）と表皮（3）を解析する</p>
          </div>
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => pass('library')} className={`border px-2 py-1 ${inputs.library ? 'border-emerald-300/60 text-emerald-200' : 'border-white/20'}`}>図書館 {inputs.library ? '受領済' : 'を受け取る'}</button>
            <button type="button" onClick={() => pass('museum')} className={`border px-2 py-1 ${inputs.museum ? 'border-emerald-300/60 text-emerald-200' : 'border-white/20'}`}>博物館 {inputs.museum ? '受領済' : 'を受け取る'}</button>
            <button type="button" onClick={() => pass('museum', inputs.galaxy ? null : galaxy)} className={`border px-2 py-1 ${inputs.galaxy ? 'border-sky-300/60 text-sky-200' : 'border-white/20'}`}>event === GALAXY {inputs.galaxy ? `（${inputs.galaxy.arms} 腕 · ×${inputs.galaxy.twist.toFixed(2)}）` : 'オフ'}</button>
            <button type="button" onClick={reset} className="border border-white/10 px-2 py-1 text-slate-500">空にする</button>
            <Link href="/architect" className="border border-white/10 px-2 py-1 text-slate-400">C のアトリエの螺旋階段から</Link>
          </div>
        </div>

        <p className={`border p-2 ${ready ? 'border-emerald-300/40 text-emerald-100' : 'border-white/10 text-slate-400'}`}>{a.verdict}</p>

        {ready && inputs.galaxy && (
          <div className="flex flex-wrap gap-2" aria-label="Galaxy arms">
            {a.arms.map((arm) => <span key={arm.arm} className="border border-sky-300/30 px-2 py-0.5 text-sky-100">腕 {arm.arm}：#{arm.ids.join(' #')} · 平均安定 {arm.mean.toFixed(2)}</span>)}
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div><p className="mb-1 font-bold text-rose-200">骨格（19）· 安定</p><Rows rows={a.skeleton} ready={ready} /></div>
          <div><p className="mb-1 font-bold text-rose-200">表皮（3）· 感度</p><Rows rows={a.skin} ready={ready} /></div>
        </div>
      </div>
    </section>
  );
}
