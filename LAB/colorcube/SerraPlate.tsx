'use client';

import { useMemo } from 'react';
import { plateQuads, steelColor, type Room } from './museum';

/** One weathering-steel plate, drawn with lambert shading, rust turbulence and a cast shadow. */
export default function SerraPlate({ room, className = '' }: { room: Room; className?: string }) {
  const quads = useMemo(() => plateQuads(room), [room]);
  const xs = quads.flatMap((q) => q.points.map((p) => p[0]));
  const ys = quads.flatMap((q) => q.points.map((p) => p[1]));
  const minX = Math.min(...xs) - 30; const maxX = Math.max(...xs) + 50;
  const minY = Math.min(...ys) - 16; const maxY = Math.max(...ys) + 28;
  const id = `rust-${room.kit.id}`;

  return (
    <svg viewBox={[minX, minY, maxX - minX, maxY - minY].map((v) => v.toFixed(1)).join(' ')} className={className} role="img" aria-label={`${room.kit.name} steel plate, ${room.form}`}>
      <defs>
        <linearGradient id={`floor-${room.kit.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ece8e2" /><stop offset="1" stopColor="#d6d0c6" />
        </linearGradient>
        <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={3} seed={room.kit.id} result="noise" />
          <feColorMatrix in="noise" type="matrix" values={`0 0 0 0 0.62  0 0 0 0 0.26  0 0 0 0 0.08  0 0 0 -2.2 ${(0.55 + room.oxidation * 0.7).toFixed(2)}`} result="spots" />
          <feComposite in="spots" in2="SourceGraphic" operator="in" result="rust" />
          <feMerge><feMergeNode in="SourceGraphic" /><feMergeNode in="rust" /></feMerge>
        </filter>
        <filter id={`shadow-${room.kit.id}`}><feGaussianBlur stdDeviation="6" /></filter>
      </defs>

      <rect x={minX.toFixed(1)} y={minY.toFixed(1)} width={(maxX - minX).toFixed(1)} height={(maxY - minY).toFixed(1)} fill={`url(#floor-${room.kit.id})`} />
      {/* Cast shadow: base outline pushed away from the light (upper left). */}
      <g filter={`url(#shadow-${room.kit.id})`} opacity={0.35}>
        {quads.map((q, i) => (
          <polygon key={i} points={[q.points[0], q.points[1], [q.points[1][0] + 34, q.points[1][1] + 14], [q.points[0][0] + 34, q.points[0][1] + 14]].map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')} fill="#2a2420" />
        ))}
      </g>
      <g filter={`url(#${id})`}>
        {quads.map((q, i) => (
          <polygon key={i} points={q.points.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' ')} fill={steelColor(q.shade, room.oxidation)} stroke={steelColor(q.shade * 0.9, room.oxidation)} strokeWidth={0.6} />
        ))}
      </g>
      {/* Specular rim on the top edge. */}
      <g stroke="rgba(255,226,196,.45)" strokeWidth={1.1} fill="none">
        {quads.map((q, i) => <line key={i} x1={q.points[3][0].toFixed(1)} y1={q.points[3][1].toFixed(1)} x2={q.points[2][0].toFixed(1)} y2={q.points[2][1].toFixed(1)} />)}
      </g>
    </svg>
  );
}
