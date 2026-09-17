'use client';

import { useMemo } from 'react';

export type HexagramResult = number[];

export type ContestBoard384Props = {
  board?: number[][];
  tacticResults?: Array<{ name: string; board?: number[][]; values?: number[] }>;
  className?: string;
};

function buildDefaultBoard(): number[][] {
  return Array.from({ length: 64 }, (_, blockIndex) =>
    Array.from({ length: 6 }, (_, lineIndex) => {
      const pattern = (blockIndex * 7 + lineIndex * 11 + (blockIndex % 8) * 3) % 13;
      return pattern > 5 ? 1 : 0;
    }),
  );
}

function mergeTacticBoard(tacticResults: Array<{ name: string; board?: number[][]; values?: number[] }>): number[][] {
  if (!tacticResults.length) return buildDefaultBoard();

  const merged = Array.from({ length: 64 }, () => Array.from({ length: 6 }, () => 0));

  tacticResults.forEach((result, tacticIndex) => {
    const source = result.board?.length ? result.board : Array.from({ length: 64 }, (_, rowIndex) => {
      const values = result.values?.length ? result.values : Array.from({ length: 6 }, (_, lineIndex) => ((rowIndex + tacticIndex * 3 + lineIndex) % 2) as number);
      return values.slice(0, 6);
    });

    source.forEach((hexagram, hexagramIndex) => {
      const row = hexagramIndex % 8;
      const column = Math.floor(hexagramIndex / 8);
      const slot = row + column * 8;
      merged[slot] = merged[slot].map((value, lineIndex) => value || (hexagram[lineIndex] ?? 0));
    });
  });

  return merged;
}

function YaoLine({ value, index }: { value: number; index: number }) {
  const yang = value === 1;
  const y = 16 + index * 12;

  return (
    <g>
      {yang ? (
        <>
          <line x1="12" y1={y} x2="88" y2={y} stroke="#f8d66d" strokeWidth="2.8" strokeLinecap="round" opacity="1" />
          <circle cx="50" cy={y} r="5.4" fill="#f8d66d" opacity="0.92" />
        </>
      ) : (
        <>
          <line x1="12" y1={y} x2="88" y2={y} stroke="#2d3748" strokeWidth="2.8" strokeLinecap="round" opacity="0.45" />
          <line x1="12" y1={y} x2="40" y2={y} stroke="#2d3748" strokeWidth="2.8" strokeLinecap="round" opacity="0.28" />
          <line x1="60" y1={y} x2="88" y2={y} stroke="#2d3748" strokeWidth="2.8" strokeLinecap="round" opacity="0.28" />
        </>
      )}
    </g>
  );
}

export default function ContestBoard384({ board, tacticResults = [], className = 'grid w-full grid-cols-8 gap-2 rounded-2xl border border-cyan-400/15 bg-slate-950/80 p-2' }: ContestBoard384Props) {
  const resolvedBoard = useMemo(() => {
    if (board && board.length === 64) return board;
    return mergeTacticBoard(tacticResults);
  }, [board, tacticResults]);

  return (
    <div className={className}>
      {resolvedBoard.map((hexagram, index) => (
        <div
          key={`hexagram-${index}`}
          className="group relative overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900/80 p-2 shadow-[0_0_18px_rgba(34,211,238,0.08)] transition-all duration-500 hover:border-cyan-300/60 hover:shadow-[0_0_24px_rgba(56,189,248,0.2)]"
        >
          <div className="mb-1 text-[8px] font-medium uppercase tracking-[0.18em] text-slate-400" aria-label={`Hexagram ${index + 1}`}>
            {index + 1}
          </div>
          <svg viewBox="0 0 100 80" className="h-16 w-full" role="img" aria-label={`Contest board row ${index + 1}`}>
            <defs>
              <linearGradient id={`glow-${index}`} x1="0%" x2="100%" y1="0%" y2="0%">
                <stop offset="0%" stopColor="#f8d66d" stopOpacity="0.30" />
                <stop offset="50%" stopColor="#67e8f9" stopOpacity="0.80" />
                <stop offset="100%" stopColor="#c084fc" stopOpacity="0.45" />
              </linearGradient>
            </defs>
            <rect x="8" y="8" width="84" height="64" rx="8" fill={`url(#glow-${index})`} opacity="0.06" />
            {Array.from({ length: 6 }, (_, lineIndex) => (
              <YaoLine key={`yao-${index}-${lineIndex}`} value={hexagram[lineIndex] ?? 0} index={lineIndex} />
            ))}
          </svg>
        </div>
      ))}
    </div>
  );
}
