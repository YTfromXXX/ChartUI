'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import CureApiInitialMenu from '@/components/CureApiInitialMenu';
import CellConvergence from '@/components/cure/CellConvergence';
import ParenDevice from '@/components/cure/ParenDevice';

// The simulation, its portraits (designer-baby genes) and the retest live in
// components/cure/CellConvergence.tsx, shared with the global header's DIAGNOSTIC pop-up.
export default function CureApiPage() {
  return (
    <>
      <header className="border-b border-rose-300/20 bg-[#0c0510] px-4 py-4 font-mono text-slate-100 sm:px-6">
        <div className="mx-auto max-w-[1500px] space-y-3">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <Link href="/retro-grid?page=A" className="text-sm text-fuchsia-200 hover:text-white">Retro Grid A</Link>
            <Link href="/retro-grid?page=B" className="text-sm text-amber-200 hover:text-white">Retro Grid B</Link>
            <Link href="/cure-api/experiments" className="text-sm text-emerald-200 hover:text-white">Hypothesis Lab</Link>
            <Link href="/oracle-api" className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={14} /> Oracle</Link>
          </div>
          <CellConvergence />
        </div>
      </header>
      <CureApiInitialMenu />
      <ParenDevice />
    </>
  );
}
