'use client';

import { Radar, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FieldDiagnostics } from '@/lib/fieldModels';
import { CRYPTO_META_EXTENSION_TABLE, buildMatrixFeedback, type FeedbackKind, type FeedbackLevel } from '@/lib/matrixFeedback';

const LEVEL_STYLE: Record<FeedbackLevel, string> = {
  idle: 'text-stone-500',
  active: 'text-cyan-200',
  alert: 'text-amber-300',
};

type Props = {
  kind: FeedbackKind;
  diagnostics?: FieldDiagnostics;
  inventoryCount: number;
};

/** Header icon that opens the Matrix Live Feedback popup (Crypto / Meta parts + extension table). */
export default function MatrixLiveFeedback({ kind, diagnostics, inventoryCount }: Props) {
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const rows = open ? buildMatrixFeedback(kind, diagnostics, { inventoryCount, now }) : [];
  const alerts = rows.filter((row) => row.level === 'alert').length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Matrix live feedback"
        aria-expanded={open}
        title="Matrix live feedback"
        className="flex h-8 w-8 items-center justify-center border border-white/10 text-stone-400 hover:border-cyan-200/45 hover:text-cyan-100"
      >
        <Radar className="h-4 w-4" />
      </button>
      {open && (
        <div role="dialog" aria-label="Matrix live feedback" className="fixed right-4 top-16 z-50 max-h-[80vh] w-[min(560px,calc(100vw-2rem))] overflow-auto border border-cyan-200/20 bg-[#030a12]/95 p-4 font-mono shadow-[0_0_60px_rgba(34,211,238,0.15)] backdrop-blur">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-[9px] uppercase tracking-[0.3em] text-cyan-200/60">Matrix live feedback</p>
              <p className="mt-1 text-sm tracking-[0.14em] text-cyan-50">{kind === 'crypto' ? 'CRYPTO / quantum cloud' : 'META / pulsar LIGO'}{alerts > 0 ? ` · ${alerts} alert` : ''}</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close matrix live feedback" className="text-stone-500 hover:text-cyan-100"><X className="h-4 w-4" /></button>
          </div>
          <table className="w-full text-left text-[10px]">
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.part}-${index}`} className="border-t border-white/5">
                  <td className="py-1 pr-2 uppercase tracking-[0.1em] text-stone-400">{row.part}</td>
                  <td className="py-1 pr-2 text-stone-500">{row.metric}</td>
                  <td className={`py-1 text-right ${LEVEL_STYLE[row.level]}`}>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mb-1 mt-4 text-[9px] uppercase tracking-[0.25em] text-cyan-200/60">Extension table</p>
          <table className="w-full text-left text-[9px]">
            <thead className="text-stone-500">
              <tr><th className="py-1 pr-2 font-normal">Indicator</th><th className="py-1 pr-2 font-normal">Crypto</th><th className="py-1 pr-2 font-normal">Meta</th><th className="py-1 font-normal">State</th></tr>
            </thead>
            <tbody>
              {CRYPTO_META_EXTENSION_TABLE.map((row) => (
                <tr key={row.indicator} className="border-t border-white/5 align-top">
                  <td className="py-1 pr-2 text-stone-300">{row.indicator}</td>
                  <td className={`py-1 pr-2 ${kind === 'crypto' ? 'text-stone-300' : 'text-stone-600'}`}>{row.crypto}</td>
                  <td className={`py-1 pr-2 ${kind === 'meta' ? 'text-stone-300' : 'text-stone-600'}`}>{row.meta}</td>
                  <td className={`py-1 ${row.status === 'live' ? 'text-emerald-300' : 'text-stone-500'}`}>{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
