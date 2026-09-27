'use client';

import { useDrag } from '@use-gesture/react';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { MAJOR_ARCANA_KNOTS } from '@/hooks/useKnotSelection';
import { useArcanaTraps } from '@/hooks/useArcanaTraps';

const TACTIC_COLORS = ['#38bdf8', '#f8d66d', '#fb7185', '#a78bfa'];

type DragGhost = { arcanaId: number; x: number; y: number } | null;

/**
 * Drag source for the 22 Major Arcana tactics. Dragging a tactic onto a
 * `[data-plane-index]` cell inside the 48-mass field (rendered by
 * TrapDropGrid) arms a trap: the system watches Dk(t)/Ak(t) for that plane
 * and fires the tactic when the distorted sphere breaks through or the
 * approach accelerates (see hooks/useArcanaTraps.ts).
 */
export default function ArcanaTacticPalette() {
  const armTrap = useArcanaTraps((state) => state.armTrap);
  const traps = useArcanaTraps((state) => state.traps);
  const [ghost, setGhost] = useState<DragGhost>(null);

  const bind = useDrag(
    ({ args, xy: [x, y], first, last, dragging }) => {
      const arcanaId = args[0] as number;
      if (first || dragging) setGhost({ arcanaId, x, y });
      if (last) {
        const target = typeof document !== 'undefined' ? document.elementFromPoint(x, y) : null;
        const planeCell = target?.closest<HTMLElement>('[data-plane-index]');
        const planeIndex = planeCell ? Number(planeCell.dataset.planeIndex) : undefined;
        if (planeIndex !== undefined && Number.isFinite(planeIndex)) armTrap(planeIndex, arcanaId);
        setGhost(null);
      }
    },
    { pointer: { touch: true }, filterTaps: true },
  );

  const armedArcanaIds = new Set(Object.values(traps).map((trap) => trap.arcanaId));

  return (
    <aside className="border border-cyan-200/15 bg-[#030813]/85 p-3" aria-label="Arcana tactic drag source">
      <p className="mb-2 font-mono text-[8px] uppercase tracking-[0.22em] text-cyan-200/65">Arcana tactics / drag onto the 48-mass field</p>
      <div className="grid grid-cols-2 gap-1.5">
        {MAJOR_ARCANA_KNOTS.map((name, id) => {
          const armed = armedArcanaIds.has(id);
          return (
            <div
              key={id}
              {...bind(id)}
              role="button"
              tabIndex={0}
              title={name}
              className={`relative flex h-11 touch-none select-none items-center justify-center border bg-black/10 px-1 text-center font-mono text-[7px] leading-tight text-stone-300 transition-colors ${armed ? 'shadow-[0_0_10px_currentColor]' : 'hover:border-violet-200/40'}`}
              style={{ borderColor: `${TACTIC_COLORS[id % 4]}${armed ? 'cc' : '55'}`, color: armed ? TACTIC_COLORS[id % 4] : undefined }}
            >
              {name}
            </div>
          );
        })}
      </div>
      <AnimatePresence>
        {ghost && (
          <motion.div
            key="ghost"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1.1, opacity: 0.92 }}
            exit={{ scale: 0.4, opacity: 0 }}
            style={{ left: ghost.x, top: ghost.y, backgroundColor: TACTIC_COLORS[ghost.arcanaId % 4] }}
            className="pointer-events-none fixed z-[999] -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 font-mono text-[9px] text-slate-950 shadow-[0_0_18px_rgba(255,255,255,0.4)]"
          >
            {MAJOR_ARCANA_KNOTS[ghost.arcanaId]}
          </motion.div>
        )}
      </AnimatePresence>
      <p className="mt-2 font-mono text-[8px] leading-4 text-stone-600">Trap fires when D_k(t)&rarr;0 (breakout) or A_k(t)&lt;0 (accelerating approach).</p>
    </aside>
  );
}
