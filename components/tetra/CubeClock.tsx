'use client';

import { useEffect, useState } from 'react';

/**
 * A clock made of six cubes and a frame, nothing else. All cubes ride one invisible infinite loop
 * (a lemniscate, ∞) inside the frame, placed by the wall clock every frame so the loop never
 * drifts: the gold cube is the hour (one lap per 12 h), the blue cube the minute (one lap per
 * hour), the red cube the second (one lap per minute) followed by three fading cubes 1, 2 and 3
 * seconds behind. Each cube also turns once per lap of its own unit. Noon, the top of the hour and
 * the top of the minute are all at the crossing in the middle of the ∞.
 */
const S = 220; const A = 92;
function onLoop(f: number) {
  const t = Math.PI / 2 + f * Math.PI * 2; const d = 1 + Math.sin(t) ** 2;
  return { x: S / 2 + (A * Math.cos(t)) / d, y: S / 2 + (A * Math.sin(t) * Math.cos(t)) / d };
}
const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
const FACES = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [0, 3, 7, 4]];

function Cube({ x, y, size, turn, color, opacity = 1 }: { x: number; y: number; size: number; turn: number; color: [number, number]; opacity?: number }) {
  const ca = Math.cos(turn); const sa = Math.sin(turn); const tilt = 0.6; const ct = Math.cos(tilt); const st = Math.sin(tilt);
  const p = V.map(([vx, vy, vz]) => { const rx = vx * ca + vz * sa; const rz = -vx * sa + vz * ca; const ry = vy * ct - rz * st; const rz2 = vy * st + rz * ct; return { x: x + rx * size / 2, y: y + ry * size / 2, z: rz2 }; });
  const faces = FACES.map((f, i) => ({ f, i, z: f.reduce((s, k) => s + p[k].z, 0) / 4 })).sort((a, b) => a.z - b.z).slice(3);
  return (
    <g opacity={opacity}>
      {faces.map(({ f, i }) => <polygon key={i} points={f.map((k) => `${p[k].x.toFixed(2)},${p[k].y.toFixed(2)}`).join(' ')} fill={`hsl(${color[0]} ${color[1]}% ${38 + (i % 3) * 14}%)`} stroke="#111" strokeWidth={0.6} />)}
    </g>
  );
}

export default function CubeClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0; let timer = 0;
    if (reduce) { setNow(new Date()); timer = window.setInterval(() => setNow(new Date()), 1000); }
    else { const tick = () => { setNow(new Date()); raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }
    return () => { cancelAnimationFrame(raf); window.clearInterval(timer); };
  }, []);
  const d = now ?? new Date(0);
  const sec = (d.getSeconds() + d.getMilliseconds() / 1000) / 60;
  const min = (d.getMinutes() + sec) / 60;
  const hour = ((d.getHours() % 12) + min) / 12;
  const label = now ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}` : '';
  const cubes: { f: number; size: number; color: [number, number]; turn: number; opacity?: number }[] = [
    { f: hour, size: 24, color: [44, 85] as [number, number], turn: hour * Math.PI * 2 },
    { f: min, size: 18, color: [212, 80] as [number, number], turn: min * Math.PI * 2 },
    ...[3, 2, 1].map((k) => ({ f: sec - k / 60, size: 13 - k * 2, color: [352, 85] as [number, number], turn: (sec - k / 60) * Math.PI * 2, opacity: 0.55 - k * 0.12 })),
    { f: sec, size: 14, color: [352, 90] as [number, number], turn: sec * Math.PI * 2 },
  ];
  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="w-full max-w-[260px]" role="img" aria-label={`Cube clock ${label}`} data-time={label}>
      <title>{label}</title>
      <rect x={6} y={6} width={S - 12} height={S - 12} rx={18} fill="none" stroke="currentColor" strokeWidth={6} />
      <rect x={14} y={14} width={S - 28} height={S - 28} rx={12} fill="none" stroke="currentColor" strokeWidth={1} opacity={0.4} />
      {now && cubes.map((c, i) => { const p = onLoop(((c.f % 1) + 1) % 1); return <Cube key={i} x={p.x} y={p.y} size={c.size} turn={c.turn} color={c.color} opacity={c.opacity} />; })}
    </svg>
  );
}
