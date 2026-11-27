'use client';

import { memo, useEffect, useRef } from 'react';
import type { Sigil } from '@/lib/sigilGenerator';

const SIZE = 120;
const C = SIZE / 2;

function hexPoints(radius: number) {
  return Array.from({ length: 6 }, (_, side) => {
    const angle = Math.PI / 6 + side * Math.PI / 3;
    return `${(C + Math.cos(angle) * radius).toFixed(1)},${(C + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(' ');
}

function spiralPath(turns: number) {
  if (turns <= 0) return '';
  const steps = turns * 28;
  let path = '';
  for (let step = 0; step <= steps; step += 1) {
    const angle = (step / 28) * Math.PI * 2;
    const radius = 4 + (step / steps) * 22;
    path += `${step === 0 ? 'M' : 'L'}${(C + Math.cos(angle) * radius).toFixed(1)} ${(C + Math.sin(angle) * radius).toFixed(1)} `;
  }
  return path;
}

/**
 * Holographic sigil. React renders only the discrete structure (dots, border, spiral turns);
 * stroke width and vortex rotation are eased in a rAF loop that mutates the SVG directly.
 */
function SigilHologramView({ sigil }: { sigil: Sigil }) {
  const sigilRef = useRef(sigil);
  sigilRef.current = sigil;
  const strokeGroup = useRef<SVGGElement>(null);
  const vortex = useRef<SVGPathElement>(null);
  const dotGroup = useRef<SVGGElement>(null);
  const glow = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let frame = 0;
    let width = sigilRef.current.strokeWidth;
    let angle = 0;
    let last = performance.now();
    const loop = (time: number) => {
      const dt = Math.min(0.05, (time - last) / 1000);
      last = time;
      const current = sigilRef.current;
      width += (current.strokeWidth - width) * Math.min(1, dt * 6);
      angle += (40 + current.vortexTurns * 55) * dt * (current.direction === 'short' ? -1 : 1);
      strokeGroup.current?.setAttribute('stroke-width', width.toFixed(2));
      vortex.current?.setAttribute('transform', `rotate(${angle.toFixed(1)} ${C} ${C})`);
      dotGroup.current?.setAttribute('transform', `rotate(${(-angle * 0.25).toFixed(1)} ${C} ${C})`);
      glow.current?.setAttribute('opacity', current.locked ? (0.55 + 0.35 * Math.sin(time * 0.006)).toFixed(2) : '0');
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  const color = sigil.locked ? '#fbbf24' : '#67e8f9';
  return (
    <div className="pointer-events-none select-none border border-cyan-200/25 bg-black/45 p-2 font-mono backdrop-blur-sm" aria-label="Tarot parameter sigil">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-28 w-28" role="img" aria-label={sigil.text}>
        <circle ref={glow} cx={C} cy={C} r="50" fill="none" stroke="#fbbf24" strokeWidth="6" opacity="0" style={{ filter: 'blur(5px)' }} />
        <g ref={strokeGroup} stroke={color} fill="none" strokeWidth={sigil.strokeWidth} strokeLinecap="round">
          {sigil.border === 'dashed' && <polygon points={hexPoints(50)} strokeDasharray="5 4" />}
          {sigil.border === 'double' && <><polygon points={hexPoints(50)} /><polygon points={hexPoints(45)} /></>}
          {sigil.border === 'none' && <polygon points={hexPoints(50)} opacity="0.25" />}
          <path ref={vortex} d={spiralPath(sigil.vortexTurns)} opacity="0.85" />
        </g>
        <g ref={dotGroup} fill={color}>
          {Array.from({ length: sigil.dots }, (_, index) => {
            const angle = (index / Math.max(1, sigil.dots)) * Math.PI * 2 - Math.PI / 2;
            return <circle key={index} cx={C + Math.cos(angle) * 36} cy={C + Math.sin(angle) * 36} r="2.2" />;
          })}
        </g>
        <text x={C} y={C + 5} textAnchor="middle" fontSize="15" fill={color}>{sigil.numeral}</text>
        <text x={C} y={C + 22} textAnchor="middle" fontSize="9" fill={color} opacity="0.8">{sigil.suitGlyph} {sigil.directionGlyph}</text>
      </svg>
      <p className={`mt-1 max-w-[170px] break-words text-[8px] leading-3 ${sigil.locked ? 'text-amber-300' : 'text-cyan-100/80'}`}>{sigil.text}</p>
      {sigil.locked && <p className="text-[8px] uppercase tracking-[0.14em] text-amber-300">singularity · {sigil.singularity} · snapshot saved</p>}
    </div>
  );
}

const SigilHologram = memo(SigilHologramView, (prev, next) => prev.sigil.text === next.sigil.text && prev.sigil.locked === next.sigil.locked && prev.sigil.strokeWidth === next.sigil.strokeWidth);
export default SigilHologram;
