'use client';

import { ArrowLeft, Dices } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { GRID, REGIONS, cellColors, regionAt, regionCounts, type RegionId } from '@/lib/retroGrid';

const CELL = 40;
const SIZE = GRID * CELL;

export default function RetroGridPage() {
  const [seed, setSeed] = useState(1984);
  const [chaos, setChaos] = useState(0.35);
  const [hovered, setHovered] = useState<RegionId | null>(null);

  const colors = useMemo(() => cellColors(seed, chaos), [seed, chaos]);
  const counts = useMemo(() => regionCounts(), []);

  // Region contours: draw an edge wherever neighbouring cells belong to different regions.
  const edges = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let r = 0; r < GRID; r += 1) {
      for (let c = 0; c < GRID; c += 1) {
        const here = regionAt(r, c);
        if (c + 1 < GRID && regionAt(r, c + 1) !== here) lines.push({ x1: (c + 1) * CELL, y1: r * CELL, x2: (c + 1) * CELL, y2: (r + 1) * CELL });
        if (r + 1 < GRID && regionAt(r + 1, c) !== here) lines.push({ x1: c * CELL, y1: (r + 1) * CELL, x2: (c + 1) * CELL, y2: (r + 1) * CELL });
      }
    }
    return lines;
  }, []);

  const labelAt = (id: RegionId) => {
    let sumR = 0; let sumC = 0; let n = 0;
    for (let r = 0; r < GRID; r += 1) for (let c = 0; c < GRID; c += 1) if (regionAt(r, c) === id) { sumR += r; sumC += c; n += 1; }
    return { x: ((sumC / n) + 0.5) * CELL, y: ((sumR / n) + 0.5) * CELL };
  };

  return (
    <main className="min-h-screen bg-[#07030f] p-6 font-mono text-fuchsia-100">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.3em] text-cyan-300">RETRO GRID // CHROMA DRIFT</h1>
          <Link href="/oracle-api" className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={14} /> Oracle</Link>
        </header>

        <section className="flex flex-wrap items-center gap-4 rounded border border-fuchsia-500/30 bg-black/40 p-3 text-sm">
          <label className="flex items-center gap-2">seed
            <input type="number" value={seed} onChange={(event) => setSeed(Number(event.target.value) || 0)} className="w-24 rounded bg-slate-900 px-2 py-1" />
          </label>
          <button type="button" onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))} className="flex items-center gap-1 rounded border border-cyan-400/50 px-2 py-1 text-cyan-300 hover:bg-cyan-400/10"><Dices size={14} /> reroll</button>
          <label className="flex flex-1 items-center gap-2">chaos
            <input type="range" min={0} max={1} step={0.01} value={chaos} onChange={(event) => setChaos(Number(event.target.value))} className="flex-1" />
            <span className="w-10 text-right">{chaos.toFixed(2)}</span>
          </label>
        </section>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
          <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full rounded border border-fuchsia-500/40 bg-black" style={{ imageRendering: 'pixelated' }}>
            {colors.map((fill, index) => {
              const r = Math.floor(index / GRID); const c = index % GRID;
              const id = regionAt(r, c);
              return <rect key={index} x={c * CELL} y={r * CELL} width={CELL} height={CELL} fill={fill} opacity={hovered && hovered !== id ? 0.35 : 1} onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)} />;
            })}
            {Array.from({ length: SIZE / 4 }, (_, i) => <line key={i} x1={0} x2={SIZE} y1={i * 4 + 2} y2={i * 4 + 2} stroke="#000" strokeOpacity={0.18} />)}
            {edges.map((e, i) => <line key={i} {...e} stroke="#f0abfc" strokeWidth={3} strokeLinecap="square" />)}
            {(Object.keys(REGIONS) as RegionId[]).map((id) => {
              const { x, y } = labelAt(id);
              return (
                <g key={id} pointerEvents="none" textAnchor="middle" fontFamily="monospace">
                  <text x={x} y={y - 4} fill="#fff" fontSize={22} fontWeight="bold" stroke="#000" strokeWidth={4} paintOrder="stroke">{REGIONS[id].label}</text>
                  <text x={x} y={y + 18} fill="#e9d5ff" fontSize={14} stroke="#000" strokeWidth={3} paintOrder="stroke">{(REGIONS[id].share * 100).toFixed(2)}%</text>
                </g>
              );
            })}
          </svg>

          <aside className="space-y-2 text-xs">
            {(Object.keys(REGIONS) as RegionId[]).map((id) => (
              <div key={id} onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)} className="rounded border border-white/10 bg-black/40 p-3" style={{ borderLeft: `4px solid hsl(${REGIONS[id].hue} 80% 55%)` }}>
                <p className="text-sm text-white">{REGIONS[id].label} <span className="text-slate-400">· {REGIONS[id].role}</span></p>
                <p className="text-slate-300">{counts[id]} / {GRID * GRID} cells = {((counts[id] / (GRID * GRID)) * 100).toFixed(2)}%</p>
              </div>
            ))}
          </aside>
        </div>
      </div>
    </main>
  );
}
