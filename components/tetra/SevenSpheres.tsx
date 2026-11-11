'use client';

import { useEffect, useState } from 'react';

/**
 * To the one throwing the dice, a sugoroku has only seven squares. Every throw (two dice) is a
 * point in square (sum mod 7) + 1. The point cloud is split into those seven groups, each shown as
 * a sphere whose size is its share; the spheres re-sort by size, and the chosen icon inside each
 * one takes its colour and grows with it. The individual throws sit inside as dots on the golden
 * angle. Exactly three lines: ー・ー the floor the spheres rest on, - - the path of the last throw,
 * and — the board order (square 1 → 7). One nominal point, (icon), is the thrower.
 */
const W = 600; const H = 210; const BASE = 170; const GOLDEN = Math.PI * (3 - Math.sqrt(5));
export const squareOf = (sum: number) => (sum % 7) + 1;

export default function SevenSpheres({ throws, icon }: { throws: number[]; icon: string }) {
  const counts = Array.from({ length: 7 }, (_, i) => throws.filter((t) => squareOf(t) === i + 1).length);
  const max = Math.max(1, ...counts);
  const order = counts.map((c, i) => ({ sq: i + 1, c })).sort((a, b) => b.c - a.c || a.sq - b.sq);
  const slot = (sq: number) => order.findIndex((o) => o.sq === sq);
  const r = (sq: number) => 9 + 24 * Math.sqrt(counts[sq - 1] / max);
  const cx = (sq: number) => 70 + slot(sq) * 76; const cy = (sq: number) => BASE - r(sq);
  const hue = (sq: number) => (sq - 1) * (360 / 7);
  const last = throws.length ? squareOf(throws[throws.length - 1]) : null;
  const [fly, setFly] = useState(1);
  useEffect(() => { // the newest point travels along the dashed path
    if (!throws.length) return undefined; setFly(0); let raf = 0; const t0 = performance.now();
    const step = (now: number) => { const p = Math.min(1, (now - t0) / 600); setFly(p); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [throws.length]);
  const origin = { x: 22, y: 40 };
  const tx = last ? cx(last) : origin.x; const ty = last ? cy(last) : origin.y;
  const ease = fly * fly * (3 - 2 * fly);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`7 squares: ${counts.map((c, i) => `${i + 1}=${c}`).join(', ')}`}>
      <defs>
        {Array.from({ length: 7 }, (_, i) => (
          <radialGradient key={i} id={`sph-${i + 1}`} cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor={`hsl(${hue(i + 1)} 90% 92%)`} /><stop offset="0.55" stopColor={`hsl(${hue(i + 1)} 70% 62%)`} /><stop offset="1" stopColor={`hsl(${hue(i + 1)} 60% 26%)`} />
          </radialGradient>
        ))}
      </defs>
      {/* Line 1: the floor, ー・ー */}
      <line x1={10} x2={W - 10} y1={BASE + 1} y2={BASE + 1} stroke="#1f1f1f" strokeWidth={1.5} strokeDasharray="14 5 2 5" />
      {/* Line 3: board order 1 → 7, — — */}
      <polyline points={Array.from({ length: 7 }, (_, i) => `${cx(i + 1)},${cy(i + 1)}`).join(' ')} fill="none" stroke="#7a0f22" strokeWidth={1} strokeDasharray="18 6" opacity={0.6} style={{ transition: 'all 500ms ease' }} />
      {/* Line 2: the last throw, - - */}
      {last && <line x1={origin.x} y1={origin.y} x2={tx} y2={ty} stroke="#1f1f1f" strokeWidth={1} strokeDasharray="4 4" />}
      {/* The nominal point: the thrower. */}
      <text x={origin.x} y={origin.y + 5} textAnchor="middle" fontSize={13} fill="#1f1f1f">({icon})</text>
      {Array.from({ length: 7 }, (_, i) => {
        const sq = i + 1; const rad = r(sq); const n = counts[i];
        return (
          <g key={sq} style={{ transform: `translate(${cx(sq)}px, ${cy(sq)}px)`, transition: 'transform 500ms cubic-bezier(.3,.8,.3,1)' }} data-testid={`sphere-${sq}`}>
            <ellipse cx={4} cy={rad - 1} rx={rad * 0.9} ry={3} fill="#000" opacity={0.18} />
            <circle r={rad} fill={`url(#sph-${sq})`} style={{ transition: 'r 500ms ease' }} />
            {Array.from({ length: Math.min(n, 60) }, (_, k) => { const rr = rad * 0.82 * Math.sqrt((k + 0.5) / Math.min(n, 60)); const a = k * GOLDEN; return <circle key={k} cx={Math.cos(a) * rr} cy={Math.sin(a) * rr} r={1.1} fill="#fff" opacity={0.75} />; })}
            <text y={rad * 0.32} textAnchor="middle" fontSize={rad * 0.95} fontWeight="bold" fill={`hsl(${hue(sq)} 85% ${n ? 22 : 60}%)`} opacity={0.9}>{icon}</text>
            <text y={-rad - 5} textAnchor="middle" fontSize={10} fill="#1f1f1f">{sq} マス · {n}</text>
          </g>
        );
      })}
      {last && fly < 1 && <text x={origin.x + (tx - origin.x) * ease} y={origin.y + (ty - origin.y) * ease + 4} textAnchor="middle" fontSize={12} fill={`hsl(${hue(last)} 80% 35%)`} fontWeight="bold">{icon}</text>}
    </svg>
  );
}
