'use client';

import { HeartPulse } from 'lucide-react';
import { useEffect, useState } from 'react';
import CellConvergence from '@/components/cure/CellConvergence';

/**
 * Header button that pops CELL CONVERGENCE // DIAGNOSTIC up to the very top of the screen
 * (above the header itself), on any page. Escape or ✕ closes it.
 */
export default function DiagnosticPopup() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [open]);
  return (
    <>
      <button type="button" data-testid="diag-open" onClick={() => setOpen((o) => !o)} aria-expanded={open} title="CELL CONVERGENCE // DIAGNOSTIC"
        className="flex items-center gap-1 rounded border border-rose-300/40 px-2 py-2 font-mono text-[11px] text-rose-200 hover:border-rose-200">
        <HeartPulse size={13} /> DIAG
      </button>
      {open && (
        <div role="dialog" aria-label="CELL CONVERGENCE // DIAGNOSTIC" data-testid="diag-popup" style={{ background: "#0c0510" }} className="fixed inset-x-0 top-0 z-[100] max-h-[92vh] overflow-y-auto border-b border-rose-300/30 px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,.6)] backdrop-blur">
          <div className="mx-auto max-w-[1300px]">
            <button type="button" onClick={() => setOpen(false)} className="float-right rounded border border-white/15 px-2 py-0.5 font-mono text-xs text-slate-300 hover:text-white" aria-label="閉じる">✕</button>
            <CellConvergence compact />
          </div>
        </div>
      )}
    </>
  );
}
