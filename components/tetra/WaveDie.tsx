'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { CELLS, RATIOS, cellProgress, fairness, freqOf, wave } from '@/lib/waveDie';

/**
 * The wave die as a 2 × 3 grid of always-moving waves. Drag a cell onto another to swap their faces
 * (mouse, pen or finger). Hover — or long-press on a phone — to see that cell's progress: where its
 * wave is in its cycle, how long until its next crest, its long-run share, and how often its face
 * has come up so far. Keyboard: focus a cell and use the arrow keys to swap it with a neighbour.
 */
const PIP: Record<number, [number, number][]> = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
const NEON = ['#ff2bd6', '#00f0ff', '#b6ff00', '#ffb000', '#7c5cff', '#ff4d4d'];
const LONG_MS = 450;

type Props = { layout: number[]; onLayout: (l: number[]) => void; counts: Record<number, number>; total: number; flash: number[] };

export default function WaveDie({ layout, onLayout, counts, total, flash }: Props) {
  const [now, setNow] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; over: number | null; x: number; y: number } | null>(null);
  const press = useRef<{ cell: number; x: number; y: number; timer: number; moved: boolean } | null>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shares = useMemo(() => fairness(12000, 3), []);

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0; let timer = 0;
    if (reduce) { setNow(Date.now()); timer = window.setInterval(() => setNow(Date.now()), 500); }
    else { const tick = () => { setNow(Date.now()); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }
    return () => { cancelAnimationFrame(raf); window.clearInterval(timer); };
  }, []);

  const swap = (a: number, b: number) => { if (a === b) return; const l = [...layout]; [l[a], l[b]] = [l[b], l[a]]; onLayout(l); };
  const cellAt = (x: number, y: number) => cellRefs.current.findIndex((el) => { const r = el?.getBoundingClientRect(); return !!r && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; });

  const onDown = (cell: number) => (e: PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const timer = window.setTimeout(() => { if (press.current && !press.current.moved) { setPinned((p) => (p === cell ? null : cell)); press.current = null; } }, LONG_MS);
    press.current = { cell, x: e.clientX, y: e.clientY, timer, moved: false };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = press.current; if (!p) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) { p.moved = true; window.clearTimeout(p.timer); setPinned(null); }
    if (p.moved) { const over = cellAt(e.clientX, e.clientY); setDrag({ from: p.cell, over: over >= 0 ? over : null, x: e.clientX, y: e.clientY }); }
  };
  const onUp = () => {
    const p = press.current; if (p) window.clearTimeout(p.timer);
    if (p?.moved && drag?.over !== null && drag?.over !== undefined) swap(p.cell, drag.over);
    press.current = null; setDrag(null);
  };
  const onKey = (cell: number) => (e: KeyboardEvent<HTMLDivElement>) => {
    const col = cell % 3; const row = Math.floor(cell / 3);
    const to: Record<string, number> = { ArrowLeft: col > 0 ? cell - 1 : cell, ArrowRight: col < 2 ? cell + 1 : cell, ArrowUp: row > 0 ? cell - 3 : cell, ArrowDown: row < 1 ? cell + 3 : cell };
    if (e.key in to) { e.preventDefault(); swap(cell, to[e.key]); window.setTimeout(() => cellRefs.current[to[e.key]]?.focus(), 0); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPinned((p) => (p === cell ? null : cell)); }
  };

  const info = pinned ?? hover;
  const wavePath = (cell: number) => {
    const pts: string[] = []; const W = 96; const H = 30;
    for (let i = 0; i <= 48; i += 1) { const x = (i / 48) * W; const t = now - (48 - i) * 18; pts.push(`${x.toFixed(1)},${(H / 2 - wave(cell, t) * (H / 2 - 3)).toFixed(1)}`); }
    return pts.join(' ');
  };

  return (
    <div className="relative select-none">
      <div className="grid grid-cols-3 gap-1.5" role="grid" aria-label="Wave die">
        {Array.from({ length: CELLS }, (_, cell) => {
          const face = layout[cell]; const pr = cellProgress(cell, now); const c = NEON[cell];
          const isOver = drag && drag.over === cell && drag.from !== cell; const isFrom = drag?.from === cell;
          return (
            <div
              key={cell} ref={(el) => { cellRefs.current[cell] = el; }} role="gridcell" tabIndex={0} data-cell={cell} data-face={face}
              aria-label={`マス ${cell + 1}：面 ${face}、位相 ${Math.round(pr.phase * 100)}%、次の山まで ${(pr.nextCrestMs / 1000).toFixed(2)} 秒`}
              onPointerDown={onDown(cell)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
              onMouseEnter={() => setHover(cell)} onMouseLeave={() => setHover((h) => (h === cell ? null : h))} onKeyDown={onKey(cell)}
              onFocus={() => setHover(cell)} onBlur={() => setHover((h) => (h === cell ? null : h))} onContextMenu={(e) => e.preventDefault()}
              className={`relative cursor-grab touch-none overflow-hidden rounded border bg-black/70 px-1 py-0.5 transition ${isOver ? 'scale-105' : ''} ${isFrom ? 'opacity-40' : ''} ${flash.includes(cell) ? 'ring-2 ring-white' : ''}`}
              style={{ borderColor: c, boxShadow: `0 0 ${isOver ? 16 : 8}px ${c}66, inset 0 0 12px ${c}22` }}
            >
              <div className="flex items-center justify-between font-mono text-[9px]" style={{ color: c }}>
                <span>[{'~'.repeat(4)}]</span>
                <svg viewBox="-12 -12 24 24" className="h-4 w-4">{PIP[face].map(([x, y], i) => <circle key={i} cx={x * 6} cy={y * 6} r={2.2} fill={c} />)}</svg>
              </div>
              <svg viewBox="0 0 96 30" className="h-7 w-full" aria-hidden>
                <line x1={0} x2={96} y1={15} y2={15} stroke={c} strokeOpacity={0.2} />
                <polyline points={wavePath(cell)} fill="none" stroke={c} strokeWidth={1.6} style={{ filter: `drop-shadow(0 0 2px ${c})` }} />
              </svg>
              <div className="h-0.5 w-full bg-white/10"><div className="h-0.5" style={{ width: `${pr.phase * 100}%`, background: c }} /></div>
            </div>
          );
        })}
      </div>
      {drag && <div className="pointer-events-none fixed z-50 rounded border bg-black/80 px-2 py-0.5 font-mono text-xs" style={{ left: drag.x + 10, top: drag.y + 10, borderColor: NEON[drag.from], color: NEON[drag.from] }}>面 {layout[drag.from]} → {drag.over !== null ? `マス ${drag.over + 1}` : '…'}</div>}
      {info !== null && (() => {
        const pr = cellProgress(info, now); const face = layout[info]; const got = counts[face] ?? 0; const c = NEON[info];
        return (
          <div className="mt-1.5 space-y-0.5 rounded border bg-black/85 p-2 font-mono text-[10px]" style={{ borderColor: c, color: c }} data-testid="cell-info" role="status">
            <p className="text-xs font-bold">マス {info + 1}（{Math.floor(info / 3) + 1} 段 {(info % 3) + 1} 列）· 面 {face}{pinned === info ? ' · 📌 長押しで固定中' : ''}</p>
            <p>波 {freqOf(info).toFixed(3)} Hz（比 {RATIOS[info].label}）· 周期 {(pr.periodMs / 1000).toFixed(2)} 秒</p>
            <div className="flex items-center gap-1"><span>位相</span><div className="h-1.5 flex-1 bg-white/10"><div className="h-1.5" style={{ width: `${pr.phase * 100}%`, background: c }} /></div><span>{Math.round(pr.phase * 100)}%（山は 50%）</span></div>
            <p>次の山まで {(pr.nextCrestMs / 1000).toFixed(2)} 秒 · いまの高さ {pr.height >= 0 ? '+' : ''}{pr.height.toFixed(2)}</p>
            <div className="flex items-center gap-1"><span>出た回数</span><div className="relative h-1.5 flex-1 bg-white/10"><div className="h-1.5" style={{ width: `${total ? Math.min(100, (got / total) * 100 * 3) : 0}%`, background: c }} /><span className="absolute top-[-2px] h-2.5 w-px bg-white" style={{ left: `${Math.min(100, shares[info] * 300)}%` }} /></div><span>{got} / {total}（{total ? ((got / total) * 100).toFixed(1) : '0.0'}%・このマスの長期 {(shares[info] * 100).toFixed(1)}%）</span></div>
          </div>
        );
      })()}
    </div>
  );
}
