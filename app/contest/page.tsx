'use client';

import Link from 'next/link';
import { ArrowLeft, Gauge, ShieldCheck, Sparkles } from 'lucide-react';
import ContestBoard384 from '@/components/ContestBoard384';
import SuperRealKnot from '@/components/3d/SuperRealKnot';

function createDemoBoard(): number[][] {
  return Array.from({ length: 64 }, (_, blockIndex) =>
    Array.from({ length: 6 }, (_, lineIndex) => {
      const signal = (blockIndex * 7 + lineIndex * 5 + (blockIndex % 8)) % 9;
      return signal >= 4 ? 1 : 0;
    }),
  );
}

const demoBoard = createDemoBoard();

const tacticResults = [
  { name: 'sling_shot', values: Array.from({ length: 64 }, (_, index) => (index % 4 === 0 ? 1 : 0)) },
  { name: 'anchor', values: Array.from({ length: 64 }, (_, index) => (index % 7 === 0 ? 1 : 0)) },
  { name: 'trap', values: Array.from({ length: 64 }, (_, index) => (index % 5 === 0 ? 1 : 0)) },
  { name: 'arbitrage', values: Array.from({ length: 64 }, (_, index) => (index % 3 === 0 ? 1 : 0)) },
];

export default function ContestPage() {
  return (
    <main className="min-h-screen bg-[#040910] px-4 py-6 text-stone-100 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1800px]">
        <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link href="/gallery" className="mb-4 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500 hover:text-cyan-200">
              <ArrowLeft className="h-3 w-3" /> Arcana gallery
            </Link>
            <div className="flex items-center gap-3 text-cyan-200">
              <Gauge className="h-5 w-5" />
              <p className="font-mono text-[10px] uppercase tracking-[0.4em]">Contest arena / live evaluation</p>
            </div>
            <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] sm:text-6xl">64 卦 × 384 爻</h1>
          </div>

          <div className="flex items-center gap-3 rounded-full border border-cyan-200/20 bg-cyan-100/[0.04] px-4 py-2 font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            synchronized / 4 tactical observers
          </div>
        </header>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="overflow-hidden rounded-3xl border border-cyan-200/15 bg-slate-950/80 p-4 shadow-[0_0_60px_rgba(34,211,238,0.08)]">
            <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.34em] text-cyan-200/70">Real-time knot pressure</p>
                <h2 className="mt-1 text-xl tracking-[0.12em] text-stone-100">SuperReal Knot</h2>
              </div>
              <Sparkles className="h-4 w-4 text-amber-200" />
            </div>
            <SuperRealKnot pressure={0.82} mass={0.68} element="fire" className="h-[520px] w-full overflow-hidden rounded-2xl" />
          </div>

          <div className="rounded-3xl border border-fuchsia-200/15 bg-[#090d15]/90 p-4 shadow-[0_0_60px_rgba(244,114,182,0.08)]">
            <div className="mb-4 border-b border-white/10 pb-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.34em] text-fuchsia-200/70">Contest summary</p>
              <h2 className="mt-1 text-xl tracking-[0.12em] text-stone-100">Tactic matrix</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'volatility', value: '86%' },
                { label: 'pressure', value: '74%' },
                { label: 'precision', value: '92%' },
                { label: 'risk shielding', value: '81%' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-stone-500">{label}</p>
                  <p className="mt-3 text-2xl font-medium text-cyan-100">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-cyan-200/10 bg-cyan-100/[0.02] p-3">
              <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-stone-400">Active tactical logs</p>
              <ul className="mt-3 space-y-2 font-mono text-[11px] text-stone-300">
                {['sling_shot', 'anchor', 'trap', 'arbitrage'].map((name, index) => (
                  <li key={name} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/10 px-2 py-1.5">
                    <span>{name}</span>
                    <span className="text-cyan-200">{[84, 76, 69, 88][index]}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-cyan-200/10 bg-[#020814]/80 p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.34em] text-cyan-200/70">Contest board</p>
              <h2 className="mt-1 text-xl tracking-[0.12em] text-stone-100">8 × 8 / 64 hexagram field</h2>
            </div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-stone-500">ヤオ 1〜384</div>
          </div>

          <ContestBoard384 board={demoBoard} tacticResults={tacticResults} className="grid w-full grid-cols-8 gap-2 rounded-2xl border border-cyan-400/15 bg-slate-950/80 p-2" />
        </section>
      </div>
    </main>
  );
}
