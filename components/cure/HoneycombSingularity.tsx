'use client';

import { useEffect, useMemo } from 'react';
import { useSpiral22 } from '@/hooks/useSpiral22';
import { useCureAPIStore } from '@/lib/cureApiStore';
import { galaxyParams, measureOdd, type OddCell, type OddMeasurement } from '@/lib/oddMeter';

type Props = {
  /** Retro-grid instrument: 22 values, cell id = index + 1. */
  retroValues: number[];
  /** Selected retro-grid cell ids (1..22), up to 7. */
  selectedCells: number[];
  /** Cure convergence center (becomes the blank singularity at the hive center). */
  cureCell?: number;
};

const HEX_R = 44;
const CX = 160;
const CY = 150;
const RING_COLORS = ['#fb7185', '#e879f9', '#fbbf24', '#34d399', '#fda4af', '#a78bfa'];

function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}

/** Ring slot k (0..5) of a pointy-top honeycomb around the center. */
function ringCenter(k: number) {
  const a = (Math.PI / 180) * (60 * k);
  const d = Math.sqrt(3) * HEX_R;
  return { x: CX + d * Math.cos(a), y: CY + d * Math.sin(a) };
}

function galaxyArms(arms: number, twist: number, handedness: number, size: number) {
  return Array.from({ length: arms }, (_, arm) => {
    const offset = (arm / arms) * Math.PI * 2;
    const points: string[] = [];
    for (let i = 0; i <= 40; i += 1) {
      const theta = (i / 40) * Math.PI * 2.6;
      const r = size * 0.08 * Math.exp(twist * theta * 0.42);
      if (r > size) break;
      const a = handedness * theta + offset;
      points.push(`${(r * Math.cos(a)).toFixed(1)},${(r * Math.sin(a)).toFixed(1)}`);
    }
    return points.join(' ');
  });
}

function InstrumentStrip({ title, measurement, selected, cure, source }: { title: string; measurement: OddMeasurement; selected: number[]; cure?: number; source?: string }) {
  const maxAbs = Math.max(1, ...measurement.cells.map((c) => Math.abs(c.target)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-[0.18em] text-slate-400">
        <span>{title}{source ? ` · ${source}` : ''}</span>
        <span className="font-mono normal-case tracking-normal">odd {(measurement.oddRatio * 100).toFixed(0)}% · ∅ {measurement.singularCount} · tension {measurement.tension.toFixed(2)}</span>
      </div>
      <div className="grid grid-cols-11 gap-1">
        {measurement.cells.map((cell: OddCell) => {
          const id = cell.index + 1;
          const isSelected = selected.includes(id);
          const hue = cell.target >= 0 ? 152 : 350;
          const strength = Math.abs(cell.target) / maxAbs;
          return (
            <div
              key={id}
              title={`#${id} · value ${cell.value.toFixed(3)} · dev ${cell.deviation.toFixed(2)}σ · step ${cell.step} → ${cell.target} (pull ${cell.pull.toFixed(2)})${cell.singular ? ' · blank singularity' : ''}`}
              className="relative flex aspect-square flex-col items-center justify-center rounded border font-mono text-[8px]"
              style={{
                borderColor: id === cure ? '#fff' : isSelected ? '#fda4af' : 'rgba(255,255,255,.08)',
                background: cell.singular ? 'transparent' : `hsla(${hue} 70% 50% / ${0.12 + strength * 0.45})`,
                borderStyle: cell.singular ? 'dashed' : 'solid',
              }}
            >
              <span className="text-slate-500">{id}</span>
              <span className={cell.singular ? 'text-rose-200' : 'text-slate-100'}>{cell.target > 0 ? `+${cell.target}` : cell.target}</span>
              {cell.singular && (
                <span
                  className="absolute h-1 w-1 rounded-full bg-rose-300"
                  style={{ [cell.pull >= 0 ? 'right' : 'left']: 2, top: '50%' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HoneycombSingularity({ retroValues, selectedCells, cureCell }: Props) {
  const spiral = useSpiral22();
  const retroMeasure = useMemo(() => measureOdd(retroValues), [retroValues]);
  const spiralMeasure = useMemo(() => measureOdd(spiral.values), [spiral.values]);
  const setOddField = useCureAPIStore((state) => state.setOddField);

  const ring = selectedCells.filter((id) => id !== cureCell).slice(0, 6);
  const galaxies = ring.length;

  // Publish the combined field; ring cells lead the harmonics so the selection steers the mover.
  const field = useMemo(() => {
    const combined = (id: number) => {
      const r = retroMeasure.cells[id - 1]?.pull ?? 0;
      const s = spiralMeasure.cells[id - 1]?.pull ?? 0;
      return Number(((r + s) / 2).toFixed(3));
    };
    const order = [...ring, ...Array.from({ length: 22 }, (_, i) => i + 1).filter((id) => !ring.includes(id))];
    return {
      pulls: order.map(combined),
      tension: Number(((retroMeasure.tension + spiralMeasure.tension) / 2).toFixed(3)),
      oddRatio: Number(((retroMeasure.oddRatio + spiralMeasure.oddRatio) / 2).toFixed(3)),
    };
  }, [retroMeasure, spiralMeasure, ring]);
  const fieldKey = JSON.stringify(field);

  useEffect(() => {
    setOddField({ ...field, updatedAt: Date.now() });
    // fieldKey captures every value of `field`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldKey, setOddField]);

  return (
    <section className="rounded border border-rose-300/25 bg-[#0c0510]/90 p-4 text-xs" aria-label="Honeycomb singularity">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[9px] uppercase tracking-[0.3em] text-rose-300">ODD-RETURN METER · HONEYCOMB 6 + SINGULARITY 1</p>
          <p className="mt-1 text-[10px] text-slate-400">Each instrument contains its deviation from center in honeycomb steps; even steps return to the nearest odd step, leaving a blank singularity (dashed).</p>
        </div>
        <span className={`font-mono text-[10px] ${galaxies === 6 && cureCell ? 'text-emerald-300' : 'text-slate-500'}`}>
          {galaxies} galaxies + {cureCell ? 1 : 0} singularity = {galaxies + (cureCell ? 1 : 0)}{(galaxies + (cureCell ? 1 : 0)) % 2 ? ' (odd)' : ' (even)'}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-3">
          <InstrumentStrip title="Retro grid 22" measurement={retroMeasure} selected={selectedCells} cure={cureCell} />
          <InstrumentStrip title="Spiral grid 22" measurement={spiralMeasure} selected={selectedCells} cure={cureCell} source={spiral.source === 'API' ? 'Oracle API' : 'local lattice'} />
        </div>

        <svg viewBox="0 0 320 300" className="w-full" role="img" aria-label="Seven-cell honeycomb with six spiral galaxies around a central singularity">
          <style>{`
            .hc-spin { transform-box: fill-box; transform-origin: center; animation: hcSpin var(--hc-dur) linear infinite; }
            @keyframes hcSpin { to { transform: rotate(var(--hc-turn)); } }
            @media (prefers-reduced-motion: reduce) { .hc-spin { animation: none; } }
          `}</style>
          {Array.from({ length: 6 }, (_, k) => {
            const { x, y } = ringCenter(k);
            const id = ring[k];
            const color = RING_COLORS[k];
            if (!id) {
              return (
                <g key={k}>
                  <polygon points={hexPoints(x, y, HEX_R - 2)} fill="none" stroke="rgba(255,255,255,.12)" strokeDasharray="3 4" />
                  <text x={x} y={y + 3} textAnchor="middle" fontSize={8} fill="#475569">select</text>
                </g>
              );
            }
            const g = galaxyParams(retroMeasure.cells[id - 1], spiralMeasure.cells[id - 1]);
            const arms = galaxyArms(g.arms, g.twist, g.handedness, HEX_R * 0.78);
            return (
              <g key={k}>
                <polygon points={hexPoints(x, y, HEX_R - 2)} fill={`${color}14`} stroke={color} strokeOpacity={0.6} />
                <g transform={`translate(${x} ${y})`}>
                  <g className="hc-spin" style={{ ['--hc-dur' as string]: `${(6 + g.twist * 6).toFixed(1)}s`, ['--hc-turn' as string]: `${g.handedness * 360}deg` }}>
                    <circle r={HEX_R * 0.78} fill="transparent" />
                    {arms.map((points, i) => <polyline key={i} points={points} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" opacity={0.35 + 0.65 * g.glow} />)}
                    <circle r={3} fill="#fff" opacity={0.85} />
                  </g>
                </g>
                <text x={x} y={y + HEX_R * 0.62} textAnchor="middle" fontSize={7} fill="#e2e8f0" stroke="#05020a" strokeWidth={2.5} paintOrder="stroke">#{id} · {g.arms} arm</text>
              </g>
            );
          })}
          <polygon points={hexPoints(CX, CY, HEX_R - 2)} fill="#05020a" stroke={cureCell ? '#fff' : 'rgba(255,255,255,.2)'} strokeDasharray={cureCell ? undefined : '3 4'} />
          <circle cx={CX} cy={CY} r={14} fill="none" stroke="#fb7185" strokeOpacity={0.6} strokeDasharray="2 3" />
          <text x={CX} y={CY + 4} textAnchor="middle" fontSize={12} fill="#fda4af">∅</text>
          <text x={CX} y={CY + HEX_R - 10} textAnchor="middle" fontSize={8} fill="#cbd5e1">{cureCell ? `CURE #${cureCell}` : 'cure center'}</text>
        </svg>
      </div>
      <p className="mt-2 text-[9px] text-slate-600">Original heuristic measurement for exploration; not a statistical test or trading signal. The combined pull field steers the Cure mover on /cure-api.</p>
    </section>
  );
}
