'use client';

import { useMemo } from 'react';
import { RASTER, bodyOf, eyeOf, hologram, type Pose } from '@/lib/silhouette';

/** Red silhouette with one eye; its boundary cells are the holographic "screen". */
export default function HoloSilhouette({ pose, className = '' }: { pose: Pose; className?: string }) {
  const body = useMemo(() => bodyOf(pose), [pose]);
  const holo = useMemo(() => hologram(pose), [pose]);
  const eye = eyeOf(pose);
  const rays = holo.boundary.filter((_, i) => i % 9 === 0);

  return (
    <svg viewBox={`0 0 ${RASTER.cols} ${RASTER.rows}`} className={className} role="img" aria-label={`Silhouette ${pose}: ${holo.edge} boundary cells encode ${holo.area} interior cells`}>
      {holo.filled.map((on, i) => on && (
        <rect key={i} x={i % RASTER.cols} y={Math.floor(i / RASTER.cols)} width={1} height={1} fill="#fecdd3" />
      ))}
      <g stroke="#b3001b" strokeLinecap="round" opacity={0.85}>
        {body.limbs.map((c, i) => <line key={i} x1={c.a[0]} y1={c.a[1]} x2={c.b[0]} y2={c.b[1]} strokeWidth={c.r * 2} />)}
      </g>
      <circle cx={body.head[0]} cy={body.head[1]} r={body.headR} fill="#b3001b" opacity={0.85} />
      {holo.boundary.map((i) => <rect key={`b${i}`} x={(i % RASTER.cols) + 0.2} y={Math.floor(i / RASTER.cols) + 0.2} width={0.6} height={0.6} fill="#5a000d" />)}
      <g stroke="#b3001b" strokeWidth={0.06} opacity={0.45}>
        {rays.map((i) => <line key={`r${i}`} x1={eye[0]} y1={eye[1]} x2={(i % RASTER.cols) + 0.5} y2={Math.floor(i / RASTER.cols) + 0.5} />)}
      </g>
      <circle cx={eye[0]} cy={eye[1]} r={0.95} fill="#fff" />
      <circle cx={eye[0] - 0.15} cy={eye[1]} r={0.45} fill="#5a000d" />
    </svg>
  );
}
