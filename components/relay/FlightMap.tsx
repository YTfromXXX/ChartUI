'use client';

import { useMemo } from 'react';
import { mulberry32 } from '@/lib/retroGrid';
import { BOARD_LEN, type Player, type Square, type Vehicle } from '@/lib/relayFlight';

/**
 * The board as an in-flight map: a dark display with a graticule, two coastlines, the great-circle
 * route from Istanbul to Wonderland, one tick per square, each passenger's marker, and the aircraft
 * (or bus) at the current player's square.
 */
const W = 640; const H = 190;
const P0 = { x: 40, y: 150 }; const P1 = { x: 320, y: -10 }; const P2 = { x: 600, y: 150 };
export function routePoint(t: number) {
  const u = 1 - t;
  return { x: u * u * P0.x + 2 * u * t * P1.x + t * t * P2.x, y: u * u * P0.y + 2 * u * t * P1.y + t * t * P2.y, a: Math.atan2(2 * u * (P1.y - P0.y) + 2 * t * (P2.y - P1.y), 2 * u * (P1.x - P0.x) + 2 * t * (P2.x - P1.x)) };
}
const KIND_COLOR = { question: '#9fb3c8', tailwind: '#4ade80', turbulence: '#f59e0b', booth: '#e879f9', goal: '#d6001c' } as const;
const PAX = ['#f87171', '#60a5fa', '#facc15', '#a78bfa'];

export default function FlightMap({ board, players, current, vehicle }: { board: Square[]; players: Player[]; current: number; vehicle: Vehicle }) {
  const coast = useMemo(() => {
    const r = mulberry32(42); const line = (x0: number, x1: number, base: number) => {
      let d = `M${x0},${H}`; for (let x = x0; x <= x1; x += 16) d += ` L${x},${(base + (r() - 0.5) * 26).toFixed(1)}`; return `${d} L${x1},${H} Z`;
    };
    return [line(0, 250, 150), line(380, W, 140)];
  }, []);
  const me = players[current];
  const at = routePoint(me ? me.pos / (BOARD_LEN - 1) : 0);
  const left = BOARD_LEN - 1 - (me?.pos ?? 0);
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-[#06101f]">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Flight map">
        <defs><linearGradient id="fm-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0b1d36" /><stop offset="1" stopColor="#06101f" /></linearGradient></defs>
        <rect width={W} height={H} fill="url(#fm-sea)" />
        {Array.from({ length: 12 }, (_, i) => <line key={`v${i}`} x1={i * 56} x2={i * 56 + 20} y1={0} y2={H} stroke="#13304f" strokeWidth={0.7} />)}
        {Array.from({ length: 5 }, (_, i) => <path key={`h${i}`} d={`M0,${30 + i * 36} Q${W / 2},${20 + i * 36} ${W},${30 + i * 36}`} stroke="#13304f" strokeWidth={0.7} fill="none" />)}
        {coast.map((d, i) => <path key={d} d={d} fill={i ? '#1a3a2a' : '#2e2a24'} opacity={0.85} />)}
        <path d={`M${P0.x},${P0.y} Q${P1.x},${P1.y} ${P2.x},${P2.y}`} stroke="#3b6ea5" strokeWidth={1.5} strokeDasharray="5 4" fill="none" />
        {me && <path d={`M${P0.x},${P0.y} Q${P1.x},${P1.y} ${P2.x},${P2.y}`} stroke="#d6001c" strokeWidth={2.5} fill="none" pathLength={1} strokeDasharray={`${me.pos / (BOARD_LEN - 1)} 1`} style={{ transition: 'stroke-dasharray 600ms ease' }} />}
        {board.map((s) => { const p = routePoint(s.i / (BOARD_LEN - 1)); return <circle key={s.i} cx={p.x} cy={p.y} r={s.kind === 'question' ? 2.4 : 4} fill={KIND_COLOR[s.kind]} />; })}
        <text x={P0.x - 4} y={P0.y + 22} fill="#cbd5e1" fontSize={10}>IST イスタンブール</text>
        <text x={P2.x + 6} y={P2.y + 22} fill="#cbd5e1" fontSize={10} textAnchor="end">WND ワンダーランド</text>
        {players.map((pl, i) => { const p = routePoint(pl.pos / (BOARD_LEN - 1)); return (
          <g key={pl.seat} style={{ transform: `translate(${p.x + 6}px, ${p.y - 12 - i * 9}px)`, transition: 'transform 600ms ease' }}>
            <circle r={3.5} fill={PAX[i]} /><text x={6} y={3} fontSize={8} fill={PAX[i]}>{pl.seat}</text>
          </g>
        ); })}
        <g style={{ transform: `translate(${at.x}px, ${at.y}px) rotate(${at.a}rad)`, transition: 'transform 600ms ease' }}>
          {vehicle === 'plane'
            ? <path d="M12,0 L-6,-3 L-10,-12 L-13,-12 L-10,-2 L-14,-1 L-16,-5 L-18,-5 L-16,0 L-18,5 L-16,5 L-14,1 L-10,2 L-13,12 L-10,12 L-6,3 Z" fill="#f8fafc" stroke="#0f172a" strokeWidth={0.6} />
            : <g><rect x={-14} y={-6} width={28} height={12} rx={3} fill="#facc15" stroke="#0f172a" strokeWidth={0.6} /><rect x={-10} y={-4} width={18} height={4} fill="#0f172a" opacity={0.6} /></g>}
        </g>
      </svg>
      <div className="pointer-events-none absolute right-2 top-2 grid grid-cols-3 gap-x-3 rounded bg-black/50 px-2 py-1 font-mono text-[10px] text-cyan-200" data-testid="map-readout">
        <span>{vehicle === 'plane' ? '高度' : '車速'}</span><span>{vehicle === 'plane' ? '対地速度' : '乗客'}</span><span>到着まで</span>
        <span>{vehicle === 'plane' ? `${(9000 + (me?.pos ?? 0) * 950).toLocaleString()} ft` : `${30 + (me?.pos ?? 0)} km/h`}</span>
        <span>{vehicle === 'plane' ? `${780 + (me?.pos ?? 0) * 4} km/h` : `${players.length} 人`}</span>
        <span>{left} マス</span>
      </div>
    </div>
  );
}
