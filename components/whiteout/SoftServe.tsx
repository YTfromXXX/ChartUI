'use client';

import type { softServe } from '@/lib/silhouette';

/** Soft-serve swirl generated from a figure's proportions. */
export default function SoftServe({ shape, className = '' }: { shape: ReturnType<typeof softServe>; className?: string }) {
  const tiers = Array.from({ length: shape.tiers }, (_, i) => i);
  const base = 34 * shape.width;
  return (
    <svg viewBox="0 0 80 110" className={className} role="img" aria-label={`Soft serve, ${shape.tiers} tiers`}>
      <path d="M22 62 L40 106 L58 62 Z" fill="#e9b872" stroke="#a16207" strokeWidth={0.8} />
      {[0, 1, 2, 3].map((k) => <line key={k} x1={26 + k * 8} y1={62} x2={40} y2={104} stroke="#a16207" strokeWidth={0.4} />)}
      {tiers.map((i) => {
        const t = i / Math.max(1, shape.tiers - 1);
        const rx = base * (1 - 0.72 * t);
        const cy = 60 - i * (40 / shape.tiers);
        const shift = Math.sin(i * 1.7) * 4 * shape.twist;
        return <ellipse key={i} cx={40 + shift} cy={cy} rx={rx} ry={4.6 - 1.6 * t} fill={i % 2 ? '#fff1f2' : '#ffe4e6'} stroke="#c8001a" strokeWidth={0.7} />;
      })}
      <path d={`M40 ${60 - shape.tiers * (40 / shape.tiers) + 2} q ${4 * shape.twist} -6 -1 -9`} fill="none" stroke="#c8001a" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  );
}
