'use client';

import type { Layer } from './emergence';
import { PALETTE, SHEET } from './emergence';
import type { OsElement } from './nameOs';

const C = SHEET.cell;
const W = SHEET.cols * C;
const H = SHEET.rows * C;

const OS_COLORS: Record<OsElement['kind'], string> = {
  desktop: '#64748b', dock: '#15803d', splitter: '#0284c7', panel: '#7c3aed', launcher: '#db2777',
  terminal: '#111827', menu: '#ea580c', icon: '#0a74c4', tray: '#ca8a04',
};

function CureGlyph({ x, y, color }: { x: number; y: number; color: string }) {
  // Stethoscope: ear tubes, flexible tube, chest piece.
  return (
    <g transform={`translate(${x} ${y})`} fill="none" stroke={color} strokeWidth={1.3} strokeLinecap="round">
      <path d="M4 3 C4 9 12 9 12 3" />
      <path d="M8 8.6 C8 14 13 16.5 15 13" />
      <circle cx={15.5} cy={11.6} r={2} fill="#fff" />
    </g>
  );
}

/** Renders emerged layers as a sheet of graph paper; optional Name OS overlay. */
export default function EmergenceCanvas({ layers, os, className = '' }: { layers: Layer[]; os?: OsElement[]; className?: string }) {
  const of = <K extends Layer['kind']>(kind: K) => layers.filter((l): l is Extract<Layer, { kind: K }> => l.kind === kind);
  const grid = of('grid')[0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} role="img" aria-label="Color emergence sheet">
      <defs>
        {of('hband').map((band, i) => (
          <g key={i}>
            <linearGradient id={`hb-top-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={band.top[0]} /><stop offset="1" stopColor={band.top[1]} /></linearGradient>
            <linearGradient id={`hb-bot-${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={band.bottom[0]} /><stop offset="1" stopColor={band.bottom[1]} /></linearGradient>
          </g>
        ))}
      </defs>
      <rect width={W} height={H} fill={grid ? PALETTE.paper : '#f4f4f4'} />

      {of('vband').map((band) => <rect key={`v${band.col}`} x={band.col * C} y={0} width={C} height={H} fill={band.color} />)}
      {of('hband').map((band, i) => (
        <g key={`h${i}`}>
          <rect x={0} y={band.row * C} width={W} height={C} fill={`url(#hb-top-${i})`} />
          <rect x={0} y={(band.row + 1) * C} width={W} height={C} fill={`url(#hb-bot-${i})`} />
        </g>
      ))}
      {of('wash').map((cell) => <rect key={`w${cell.col}-${cell.row}`} x={cell.col * C} y={cell.row * C} width={C} height={C} fill={PALETTE.paper} />)}
      {of('cut').map((cell) => <rect key={`c${cell.row}`} x={cell.col * C} y={cell.row * C} width={C} height={C} fill={cell.fill} />)}

      {grid && (
        <g stroke={PALETTE.rule} strokeWidth={0.6} opacity={0.75}>
          {Array.from({ length: grid.cols + 1 }, (_, i) => <line key={`gx${i}`} x1={i * C} y1={0} x2={i * C} y2={H} />)}
          {Array.from({ length: grid.rows + 1 }, (_, i) => <line key={`gy${i}`} x1={0} y1={i * C} x2={W} y2={i * C} />)}
        </g>
      )}

      {of('fold').map((fold) => {
        const x = fold.cx * C; const y = fold.cy * C;
        return (
          <g key="fold">
            <rect x={x - C} y={y} width={2 * C} height={2 * C} fill={PALETTE.gray} />
            <line x1={x - 2 * C} y1={y} x2={x + 2 * C} y2={y} stroke="#555" strokeWidth={0.8} />
            <polygon points={`${x},${y - 2 * C} ${x - 0.6 * C},${y} ${x + 0.6 * C},${y}`} fill={PALETTE.black} />
            <polygon points={`${x + 0.6 * C},${y} ${x + 2 * C},${y} ${x + 0.9 * C},${y + C}`} fill={PALETTE.ink} />
            <polyline points={`${x},${y - 2 * C} ${x - 1.2 * C},${y + 2.6 * C} ${x + 2 * C},${y}`} fill="none" stroke={PALETTE.green} strokeWidth={0.9} />
            <line x1={x} y1={y - 2 * C} x2={x + 1.2 * C} y2={y + 2.6 * C} stroke={PALETTE.green} strokeWidth={0.9} />
            <line x1={x - 1.2 * C} y1={y + 2.6 * C} x2={x + 2 * C} y2={y} stroke="#333" strokeWidth={0.6} />
          </g>
        );
      })}

      {of('glyph').map((g, i) => {
        const x = g.col * C; const y = g.row * C;
        if (g.glyph === 'cure') return <CureGlyph key={i} x={x} y={y} color={g.color} />;
        if (g.glyph === 'dot') return <circle key={i} cx={x + C / 2} cy={y + C / 2} r={1.8} fill={g.color} />;
        return <text key={i} x={x + C / 2} y={y + C * 0.72} textAnchor="middle" fontSize={g.glyph === 'btc' ? 11 : 13} fill={g.color}>{g.glyph === 'btc' ? '₿' : '='}</text>;
      })}

      {os?.filter((e) => e.kind !== 'desktop').map((e, i) => (
        <g key={`os${i}`}>
          <rect x={e.rect.x * C + 1} y={e.rect.y * C + 1} width={e.rect.w * C - 2} height={e.rect.h * C - 2} fill="none" stroke={OS_COLORS[e.kind]} strokeWidth={2} strokeDasharray="5 3" />
          <text x={e.rect.x * C + 3} y={e.kind === 'tray' ? (e.rect.y + e.rect.h) * C + 11 : Math.max(10, e.rect.y * C - 3)} fontSize={10} fontFamily="monospace" fill={OS_COLORS[e.kind]} stroke="#fff" strokeWidth={3} paintOrder="stroke">{e.kind} · {e.label} · kit#{e.kitId}</text>
        </g>
      ))}
    </svg>
  );
}
