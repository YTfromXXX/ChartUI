'use client';

import { useEffect, useRef, useState } from 'react';
import { HAND, ease, gazeAngle, makeSeats, type Seat } from '@/lib/seatGaze';

const NAMES = ['あなた', 'CPU 南', 'CPU 西', 'CPU 北'];

/**
 * The live Tetra Arcana table drawn as seat points on the complex plane (lib/seatGaze): each seat's
 * value (表面積 : 質量) is its real river size + 1 and its real hand size, given slowly (τ = 3 s).
 * The seat whose turn it is looks at the table; everyone else watches that seat.
 */
export default function TableGaze({ hands, rivers, turn, playing }: { hands: number[]; rivers: number[]; turn: number; playing: boolean }) {
  const [seats, setSeats] = useState<Seat[]>(() => makeSeats(4));
  const live = useRef(seats); live.current = seats;
  const want = useRef({ hands, rivers, turn, playing }); want.current = { hands, rivers, turn, playing };
  useEffect(() => {
    let last = performance.now(); let raf = 0;
    const f = (now: number) => {
      const dt = Math.min(0.1, Math.max(0, now - last) / 1000); last = Math.max(last, now); const w = want.current;
      const targeted = live.current.map((s) => ({ ...s, target: { area: (w.rivers[s.k] ?? 0) + 1, mass: w.hands[s.k] ?? 0 }, gaze: !w.playing || s.k === w.turn ? { kind: 'table' as const } : { kind: 'seat' as const, to: w.turn } }));
      setSeats(ease(targeted, dt)); raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, []);
  const R = 70; const C = 100; const P = (re: number, im: number) => ({ x: C + re * R, y: C - im * R });
  return (
    <svg viewBox="0 0 200 200" className="h-52 w-52" data-testid="table-gaze" aria-label="卓の席と目線">
      <circle cx={C} cy={C} r={R} fill="#0b1020" stroke="#00f0ff55" />
      {seats.map((s) => {
        const p = P(s.z.re, s.z.im); const a = gazeAngle(s, seats); const h = (15 * Math.PI) / 180; const L = 34;
        return (
          <g key={s.k} data-testid={`tg-${s.k}`} data-area={s.area.toFixed(2)} data-mass={s.mass.toFixed(2)}>
            <path d={`M${p.x} ${p.y} L${p.x + L * Math.cos(a - h)} ${p.y - L * Math.sin(a - h)} L${p.x + L * Math.cos(a + h)} ${p.y - L * Math.sin(a + h)} Z`} fill={s.colour} opacity={s.k === turn ? 0.45 : 0.2} />
            <circle cx={p.x} cy={p.y} r={4 + 2.4 * Math.sqrt(s.area)} fill={s.colour} fillOpacity={0.15 + 0.85 * Math.min(1, s.mass / (HAND + 1))} stroke={s.colour} strokeWidth={s.k === turn ? 2.5 : 1} />
            <text x={p.x} y={p.y + (s.z.im >= 0 ? -14 : 20)} textAnchor="middle" fontSize="7.5" fill="#cbd5e1" pointerEvents="none">{s.wind} {NAMES[s.k]} {s.area.toFixed(1)}:{s.mass.toFixed(1)}</text>
          </g>
        );
      })}
    </svg>
  );
}
