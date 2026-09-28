'use client';

import { ArrowLeft, Radar } from 'lucide-react';
import Link from 'next/link';
import PortfolioRadar from '@/components/3d/PortfolioRadar';
import { demoPortfolio, positionDirection } from '@/lib/portfolio';
import { fitSphericalHarmonics, angularGaussianBump, planeDistances } from '@/lib/distortionField';
import { cellAngles } from '@/lib/projectionGrid';

const PHASE_COLORS: Record<string, string> = {
  FIRE: '#f87171',
  WATER: '#38bdf8',
  WOOD: '#4ade80',
  EARTH: '#facc15',
  METAL: '#e2e8f0',
};

export default function PortfolioPage() {
  const portfolio = demoPortfolio;

  const bumps = portfolio.positions.map((position) => ({
    ...positionDirection(position.symbol),
    weight: position.volatility * 1.4,
    symbol: position.symbol,
    phase: position.phase,
  }));
  const samples = Array.from({ length: 48 }, (_, index) => {
    const { theta, phi } = cellAngles(index);
    const value = bumps.reduce((sum, bump) => sum + bump.weight * angularGaussianBump(theta, phi, bump.theta, bump.phi, 0.55), 0);
    return { theta, phi, value };
  });
  const coefficients = fitSphericalHarmonics(samples);
  const distances = planeDistances(coefficients, 1);
  const intrudingFaces = distances.filter((distance) => distance < 0).length;
  const maxIntrusion = Math.min(...distances);

  return (
    <main className="min-h-screen bg-[#02060b] px-4 py-8 text-stone-100 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between border-b border-cyan-200/15 pb-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="border border-white/10 p-2 text-stone-400 hover:border-cyan-200/40 hover:text-cyan-100" aria-label="Back">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-cyan-200/55">Portfolio radar / distortion console</p>
              <h1 className="mt-1 flex items-center gap-2 text-2xl tracking-[-0.02em] text-cyan-50"><Radar className="h-5 w-5 text-cyan-300" /> Aggregate energy sphere</h1>
            </div>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-stone-500">{portfolio.positions.length} positions linked</span>
        </div>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="overflow-hidden border border-cyan-300/20 bg-[#030712] shadow-[0_0_70px_rgba(34,211,238,0.08)]">
            <PortfolioRadar portfolio={portfolio} className="h-[560px] w-full" />
          </div>

          <aside className="flex flex-col gap-3 border border-cyan-200/15 bg-[#030813]/85 p-4">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-stone-500">48-face barrier intrusion</p>
              <p className="mt-1 font-mono text-lg text-cyan-100">{intrudingFaces} / 48 <span className="text-xs text-stone-500">faces breached</span></p>
              <p className="mt-1 font-mono text-[10px] text-stone-500">min D_k = {maxIntrusion.toFixed(3)}</p>
            </div>
            <div className="border-t border-white/10 pt-3">
              <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-stone-500">Positions / risk direction</p>
              <ul className="flex flex-col gap-2">
                {portfolio.positions.map((position) => (
                  <li key={position.symbol} className="flex items-center justify-between border border-white/10 bg-black/15 px-2.5 py-2 font-mono text-xs">
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PHASE_COLORS[position.phase] ?? '#94a3b8' }} />
                      {position.symbol}
                    </span>
                    <span className="text-stone-400">vol {position.volatility.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-white/10 pt-3 font-mono text-[9px] leading-5 text-stone-500">
              Diversification {(portfolio.diversification * 100).toFixed(0)}% / Volatility {(portfolio.volatility * 100).toFixed(0)}% / Deviation {(portfolio.totalAssetDeviation * 100).toFixed(0)}%
            </div>
          </aside>
        </section>
        <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.2em] text-stone-600">Drag &amp; rotate to inspect which asset directions bulge past the fixed 48-face barrier (D_k &lt; 0).</p>
      </div>
    </main>
  );
}
