'use client';

import { ArrowLeft, Dices, FlaskConical } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useBtcUsdTicker } from '@/hooks/useBtcUsdTicker';
import { useMetalFeed } from '@/hooks/useMetalFeed';
import { TIMEFRAME_STROBE_INTERVAL_MS, useCureAPIStore } from '@/lib/cureApiStore';
import { GRID, REGIONS, cellColors, regionAt, regionCounts, type RegionId } from '@/lib/retroGrid';

const CELL = 40;
const SIZE = GRID * CELL;
const RETRO_BLOCK_LABELS = ['HEADER', 'BOTTOM', 'SIDE MENU', 'POP UP'] as const;
const MAX_SELECTED_CELLS = 7;

function generatePixelPattern(seed: number, intensity: number, accentShift: number, frame: number) {
  const rows: boolean[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const phase = frame * 0.73 + accentShift;
      const grain = Math.sin((row + seed * 1.7) * 12.9898 + (col + phase) * 78.233) * 43758.5453;
      const random = grain - Math.floor(grain);
      const wave = Math.sin((row + col * 0.7 + phase) * (0.75 + intensity)) * 0.5 + 0.5;
      rows.push(random > 0.88 - intensity * 0.38 || wave > 0.91 - intensity * 0.18);
    }
  }
  return rows;
}

export default function RetroGridPage() {
  const [seed, setSeed] = useState(1984);
  const [chaos, setChaos] = useState(0.35);
  const [hovered, setHovered] = useState<RegionId | null>(null);
  const [noiseFrame, setNoiseFrame] = useState(0);
  const [selectedCells, setSelectedCells] = useState<number[]>([]);
  const [cureText, setCureText] = useState('');
  const [isCureFormOpen, setIsCureFormOpen] = useState(false);
  const simulationSpeed = useCureAPIStore((state) => state.simulationSpeed);
  const volatilityIndex = useCureAPIStore((state) => state.volatilityIndex);
  const timeframe = useCureAPIStore((state) => state.timeframe);
  const simulationMode = useCureAPIStore((state) => state.simulationMode);
  const activeSymbol = simulationMode === 'hypothesisA' ? 'BTCUSD' : 'XAUUSD';
  const { ticker: btcTicker, isConnected: btcConnected, activity: btcActivity } = useBtcUsdTicker();
  const metalFeed = useMetalFeed(activeSymbol === 'XAUUSD');
  const activePrice = activeSymbol === 'BTCUSD' ? btcTicker?.price : metalFeed.quote?.price;
  const hasLivePrice = activeSymbol === 'BTCUSD'
    ? Boolean(btcTicker)
    : metalFeed.quote?.source === 'LIVE';
  const feedConnected = activeSymbol === 'BTCUSD' ? btcConnected : Boolean(metalFeed.quote);

  const colors = useMemo(() => cellColors(seed, chaos), [seed, chaos]);
  const counts = useMemo(() => regionCounts(), []);
  const strobeIntervalMs = TIMEFRAME_STROBE_INTERVAL_MS[timeframe] || 220;
  const relativeRange = activeSymbol === 'BTCUSD'
    ? btcActivity.range / 100
    : metalFeed.volatility / 80;
  const relativeVelocity = activeSymbol === 'BTCUSD'
    ? btcActivity.priceVelocity
    : activePrice && activePrice > 0 ? Math.abs(metalFeed.priceVelocity / activePrice) * 1600 : 0;
  const chartNoise = Math.min(1, Math.max(
    0.025,
    activeSymbol === 'BTCUSD'
      ? btcActivity.volatility * 0.65 + btcActivity.range * 0.35
      : metalFeed.volatility * 0.7 + Math.min(1, relativeVelocity) * 0.3,
  ));
  const chartVelocity = Math.min(2.5, Math.max(0.1, relativeVelocity));
  const strobeSeconds = Math.max(
    0.08,
    strobeIntervalMs / 1000 / Math.max(0.25, simulationSpeed) / (0.65 + chartVelocity * 0.7),
  );
  const localSand = chartNoise * (0.8 + chartVelocity * 0.2);

  useEffect(() => {
    const timer = window.setInterval(() => setNoiseFrame((frame) => frame + 1), strobeSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [strobeSeconds]);

  useEffect(() => {
    setSelectedCells([]);
    setCureText('');
    setIsCureFormOpen(false);
  }, [activeSymbol]);

  const retroBlocks = useMemo(
    () => Array.from({ length: 22 }, (_, index) => {
      const region = Object.values(REGIONS)[index % Object.keys(REGIONS).length];
      const baseColor = region.tint ?? '#67e8f9';
      const accent = activeSymbol === 'BTCUSD'
        ? (index % 2 === 0 ? '#9be7ff' : '#ffb86b')
        : (index % 2 === 0 ? '#fff1b8' : '#f4a261');
      const cellNoise = Math.min(1, chartNoise * (0.72 + (index % 7) * 0.055) + (index % 4) * 0.025);
      const cellVelocity = chartVelocity * (0.78 + (index % 5) * 0.09);
      const intensity = Math.min(1, cellNoise * 0.72 + volatilityIndex * 0.18 + (index % 5) * 0.025);
      const label = RETRO_BLOCK_LABELS[index % RETRO_BLOCK_LABELS.length];
      const symbolSeed = activeSymbol.split('').reduce((value, char) => value + char.charCodeAt(0), 0);
      const pixels = generatePixelPattern(seed + symbolSeed + index * 3, intensity, index * 0.81, noiseFrame);
      return { id: index + 1, label, baseColor, accent, intensity, cellNoise, cellVelocity, pixels };
    }),
    [activeSymbol, chartNoise, chartVelocity, noiseFrame, seed, strobeSeconds, volatilityIndex],
  );

  const toggleCell = (id: number) => {
    setSelectedCells((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : current.length < MAX_SELECTED_CELLS ? [...current, id] : current);
    setIsCureFormOpen(false);
  };

  const sourceCell = selectedCells[0];
  const cureCell = selectedCells[1];

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
      <style jsx>{`
        @keyframes retroSand {
          0% {
            transform: translate3d(-2px, 0, 0);
            opacity: 0.42;
          }
          50% {
            transform: translate3d(2px, 1px, 0);
            opacity: 0.9;
          }
          100% {
            transform: translate3d(-1px, -1px, 0);
            opacity: 0.52;
          }
        }
      `}</style>

      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex items-center justify-between">
          <h1 className="text-xl tracking-[0.3em] text-cyan-300">RETRO GRID // CHROMA DRIFT</h1>
          <nav className="flex items-center gap-4">
            <Link href="/cure-api/experiments" className="flex items-center gap-1 text-sm text-cyan-200 hover:text-white"><FlaskConical size={14} /> Hypothesis Lab</Link>
            <Link href="/oracle-api" className="flex items-center gap-1 text-sm text-slate-400 hover:text-white"><ArrowLeft size={14} /> Oracle</Link>
          </nav>
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

        <section className="rounded border border-cyan-300/30 bg-[#050b12]/90 p-4 shadow-[0_0_28px_rgba(34,211,238,0.08)]">
          <div className="mb-4 flex items-center justify-between gap-3 text-[10px] uppercase tracking-[0.25em] text-cyan-200">
            <div>
              <p className="text-cyan-300">VR / MR // permanent y axis mesh</p>
              <h2 className="mt-1 text-sm tracking-[0.18em] text-white">22-square drifter lattice / {activeSymbol}</h2>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className={`rounded border px-2 py-1 ${hasLivePrice ? 'border-emerald-300/30 text-emerald-200' : 'border-amber-300/30 text-amber-200'}`}>
                {hasLivePrice ? 'LIVE FEED' : activeSymbol === 'XAUUSD' && metalFeed.quote ? 'SYNTHETIC FEED' : 'WAITING FOR FEED'}
              </span>
              <span className="rounded border border-cyan-400/30 bg-cyan-400/5 px-2 py-1 text-cyan-100">
                {timeframe} / {simulationSpeed.toFixed(1)}x · {strobeSeconds.toFixed(2)}s
              </span>
            </div>
          </div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400">
            <span>
              {activePrice
                ? `${activeSymbol} ${activePrice.toLocaleString(undefined, { maximumFractionDigits: 4 })} · noise ${chartNoise.toFixed(2)} · flow ${chartVelocity.toFixed(2)}`
                : `${activeSymbol} price waiting${feedConnected ? ' · feed connected, awaiting quote' : ' · feed disconnected'}`}
            </span>
            <span>
              {hasLivePrice ? 'LIVE PRICE' : activeSymbol === 'XAUUSD' && metalFeed.quote ? 'SYNTHETIC PRICE' : 'NO LIVE PRICE'}
              {' · '}{selectedCells.length}/{MAX_SELECTED_CELLS} selected · 22/22 noise fields
            </span>
          </div>

          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-amber-300"
              style={{ width: `${Math.min(100, 18 + localSand * 62)}%`, animation: `retroSand ${Math.max(0.15, strobeSeconds)}s ease-in-out infinite alternate` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {retroBlocks.map((block) => (
              <div
                key={block.id}
                className={`relative rounded-xl border bg-[#080d16] p-2 transition-colors ${
                  selectedCells.includes(block.id) ? 'border-cyan-200/70' : 'border-white/10'
                }`}
                style={{
                  boxShadow: selectedCells.includes(block.id) ? `0 0 24px ${block.accent}66` : `0 0 18px ${block.baseColor}55`,
                }}
              >
                <button
                  type="button"
                  aria-pressed={selectedCells.includes(block.id)}
                  aria-label={`Select noise cell ${block.id}, ${block.label}, ${block.cellNoise.toFixed(2)} noise`}
                  onClick={() => toggleCell(block.id)}
                  className="absolute inset-2 z-10 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-200"
                />
                <div className="relative h-32 overflow-hidden rounded-lg border border-white/10 bg-[#040812]">
                  <div className="absolute inset-x-0 top-0 h-[22%]" style={{ background: block.baseColor, opacity: 0.9 }} />
                  <div className="absolute left-0 top-[18%] h-[62%] w-[18%] rounded-r-md" style={{ background: block.accent, opacity: 0.7 }} />
                  <div className="absolute right-0 top-[28%] h-[42%] w-[34%] rounded-l-md border border-white/10" style={{ background: block.baseColor, opacity: 0.55 }} />
                  <div className="absolute inset-x-0 bottom-0 h-[18%]" style={{ background: block.baseColor, opacity: 0.8 }} />
                  <div className="absolute inset-0 grid grid-cols-8 grid-rows-8 gap-[3px] p-2">
                    {block.pixels.map((active, index) => (
                      <span
                        key={`${block.id}-${index}`}
                        className="rounded-[2px] transition-all"
                        style={{
                          background: active ? block.accent : 'rgba(148, 163, 184, 0.1)',
                          opacity: active ? Math.min(1, 0.38 + block.intensity) : 0.12 + block.cellNoise * 0.12,
                          boxShadow: active ? `0 0 8px ${block.accent}` : 'none',
                          transform: active ? `translateY(${Math.sin((index + block.id) * 0.8 + noiseFrame) * 1.2}px)` : 'translateY(0)',
                        }}
                      />
                    ))}
                  </div>
                  {block.id === cureCell && (
                    <button
                      type="button"
                      aria-label={`Open Cure note for cell ${block.id}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setIsCureFormOpen(true);
                      }}
                      className="absolute left-1/2 top-1/2 z-20 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/80 bg-cyan-100/20 text-[8px] font-bold text-white shadow-[0_0_24px_rgba(103,232,249,.95)]"
                    >
                      CURE
                    </button>
                  )}
                  {selectedCells.includes(block.id) && (
                    <span className="pointer-events-none absolute right-2 top-2 z-20 grid h-5 w-5 place-items-center rounded-full border border-white/60 bg-black/80 text-[9px] text-white">
                      {selectedCells.indexOf(block.id) + 1}
                    </span>
                  )}
                </div>
                <div className="pointer-events-none mt-2 flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.12em] text-slate-300">
                  <span style={{ color: block.baseColor }}>{block.label} · #{block.id}</span>
                  <span className="text-right text-slate-400">N {block.cellNoise.toFixed(2)} / V {block.cellVelocity.toFixed(2)}</span>
                </div>
                {block.id === sourceCell && cureCell && (
                  <p className="pointer-events-none mt-1 text-[8px] uppercase tracking-widest text-cyan-200">NOISE SOURCE → CURE #{cureCell}</p>
                )}
              </div>
            ))}
          </div>
          {selectedCells.length === 0 && (
            <p className="mt-4 text-[10px] text-slate-500">Select any cell to add it to the observation set. The first is the noise source; the second defines its Cure convergence point.</p>
          )}
          {selectedCells.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-[10px]">
              <p className="text-slate-300">
                {sourceCell && cureCell
                  ? `CELL #${sourceCell} NOISE CONVERGES AT CURE CENTER #${cureCell}. Tap the center to write a note.`
                  : 'Choose a second cell to place the Cure convergence center.'}
              </p>
              <button type="button" onClick={() => { setSelectedCells([]); setIsCureFormOpen(false); }} className="rounded border border-white/15 px-2 py-1 text-slate-400 hover:text-white">CLEAR CELLS</button>
            </div>
          )}
          {isCureFormOpen && cureCell && (
            <form className="mt-3 rounded-lg border border-cyan-200/30 bg-black/40 p-3" onSubmit={(event) => event.preventDefault()}>
              <label htmlFor="cure-note" className="mb-2 block text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                Cure center · {activeSymbol} · cell #{cureCell}
              </label>
              <textarea
                id="cure-note"
                value={cureText}
                onChange={(event) => setCureText(event.target.value)}
                placeholder="Record an observation about the converging noise pattern…"
                rows={3}
                className="w-full resize-y rounded border border-white/10 bg-[#05090e] p-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-cyan-200/50"
              />
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
