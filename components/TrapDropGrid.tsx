'use client';

import { useEffect, useRef, useState } from 'react';
import { cellRect, computeProjectionGrid, PROJECTION_CELL_COUNT } from '@/lib/projectionGrid';
import { useArcanaTraps } from '@/hooks/useArcanaTraps';
import { MAJOR_ARCANA_KNOTS } from '@/hooks/useKnotSelection';

const TACTIC_COLORS = ['#38bdf8', '#f8d66d', '#fb7185', '#a78bfa'];

/**
 * Invisible drop-target grid laid over the 48-mass field. Each cell exposes
 * `data-plane-index` so ArcanaTacticPalette's drag gesture can resolve the
 * drop target via `elementFromPoint`, and renders a highlight ring + short
 * arcana label once a trap is armed on that plane.
 */
export default function TrapDropGrid() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const traps = useArcanaTraps((state) => state.traps);

  useEffect(() => {
    const parent = containerRef.current?.parentElement;
    if (!parent) return undefined;
    const resize = () => {
      const rect = parent.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    return () => observer.disconnect();
  }, []);

  const metrics = computeProjectionGrid(size.width, size.height);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      {Array.from({ length: PROJECTION_CELL_COUNT }, (_, index) => {
        const rect = cellRect(index, metrics);
        const trap = traps[index];
        const color = trap ? TACTIC_COLORS[trap.arcanaId % 4] : undefined;
        return (
          <div
            key={index}
            data-plane-index={index}
            className={`pointer-events-auto absolute border transition-colors ${trap ? 'shadow-[0_0_10px_currentColor]' : 'border-transparent hover:border-cyan-200/20'}`}
            style={{ left: rect.x, top: rect.y, width: rect.width, height: rect.height, borderColor: color ?? 'transparent', color }}
            title={trap ? `Trap armed / ${MAJOR_ARCANA_KNOTS[trap.arcanaId]}` : `Plane ${index + 1} / drop an arcana tactic here`}
          >
            {trap && (
              <span className="absolute left-0.5 top-0.5 font-mono text-[6px] uppercase tracking-wide" style={{ color }}>
                {MAJOR_ARCANA_KNOTS[trap.arcanaId].split(' ')[0]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
