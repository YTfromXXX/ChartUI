'use client';

import { useEffect, useRef, useState } from 'react';
import { inFamily, type FigureType } from '@/lib/colourRule';
import { COLOUR_DICE, FIGURE_TYPES } from '@/lib/faceContour';

type Pair = [number, number];
type Phase = 'idle' | 'rew' | 'play';
const STEP_MS = 350; // ≤ 3 changes per second (design rule), each one a cross-fade, never a hard flash
const MAX_BACK = 3;

/**
 * Colour intervention for one figure, Mente style: roll the colour die (left and right), and the
 * tile plays the colour history backwards like a tape (◀◀ REW, newest → oldest), then ▶ PLAY lands
 * on the new pair, filling in from the bottom up (a reversed wipe). Reduced motion: no rewind.
 */
export default function DiceColourRewind({ figure, name, sil, nx, ny }: { figure: number; name: string; sil: boolean[]; nx: number; ny: number }) {
  const die = COLOUR_DICE[figure];
  const [pair, setPair] = useState<Pair>(die.start);
  const [history, setHistory] = useState<Pair[]>([]);
  const [shown, setShown] = useState<Pair>(die.start);
  const [phase, setPhase] = useState<Phase>('idle');
  const [wipe, setWipe] = useState(1);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const L: string[] = []; const R: string[] = [];
  for (let j = 0; j < ny; j += 2) for (let i = 0; i < nx; i += 2) if (sil[j * nx + i]) (i < nx / 2 ? L : R).push(`M${i} ${j}h2v2h-2z`);

  const roll = () => {
    if (phase !== 'idle') return;
    // Colour rule: the left (main) die rolls only faces in the figure's family; the right die is free.
    const main = die.faces.map((f, i) => (inFamily(f.hex, FIGURE_TYPES[figure] as FigureType) ? i : -1)).filter((i) => i >= 0);
    const next: Pair = [main[Math.floor(Math.random() * main.length)], Math.floor(Math.random() * 6)];
    const back = [pair, ...history].slice(0, MAX_BACK + 1); // what the tape rewinds through: now, then older
    setHistory((h) => [pair, ...h].slice(0, 8)); setPair(next);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) { setShown(next); return; }
    timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [];
    setPhase('rew');
    back.forEach((p, k) => timers.current.push(window.setTimeout(() => setShown(p), k * STEP_MS)));
    const t0 = back.length * STEP_MS;
    timers.current.push(window.setTimeout(() => { setPhase('play'); setWipe(0); setShown(next); }, t0));
    timers.current.push(window.setTimeout(() => setWipe(1), t0 + 40));
    timers.current.push(window.setTimeout(() => setPhase('idle'), t0 + 900));
  };

  const [li, ri] = shown;
  const clipY = ny * (1 - wipe);
  return (
    <div className="space-y-1" data-testid={`dice-colour-${figure}`}>
      <div className="relative h-28 w-24 overflow-hidden bg-[#1f1f1f]">
        <svg viewBox={`-4 -4 ${nx + 8} ${ny + 8}`} className="h-full w-full" aria-label={`${name} の色：左 ${die.faces[pair[0]].name}・右 ${die.faces[pair[1]].name}`}>
          <defs><clipPath id={`wipe-${figure}`}><rect x={-4} y={clipY - 4} width={nx + 8} height={ny + 8} style={{ transition: wipe ? 'y 700ms ease-out' : 'none' }} /></clipPath></defs>
          <g clipPath={`url(#wipe-${figure})`}>
            <path d={L.join('')} fill={die.faces[li].hex} style={{ transition: 'fill 300ms ease' }} />
            <path d={R.join('')} fill={die.faces[ri].hex} style={{ transition: 'fill 300ms ease' }} />
          </g>
          {phase === 'rew' && [0.3, 0.7].map((f) => <line key={f} x1={-4} x2={nx + 4} y1={ny * f} y2={ny * f} stroke="white" strokeOpacity={0.25} strokeWidth={1.5} className="mente-track" />)}
        </svg>
        {phase !== 'idle' && <span className="absolute left-1 top-1 bg-black px-1 text-[10px] font-bold italic text-white" data-testid={`phase-${figure}`}>{phase === 'rew' ? '◀◀ REW' : '▶ PLAY'}</span>}
      </div>
      <button type="button" data-testid={`roll-${figure}`} onClick={roll} disabled={phase !== 'idle'} className="border border-[#1f1f1f] bg-white px-1.5 text-[11px] disabled:opacity-50">🎲 色を振る</button>
      <p className="text-[10px] text-stone-600" data-testid={`dice-names-${figure}`}>左 {die.faces[pair[0]].name} · 右 {die.faces[pair[1]].name}</p>
      <style>{`.mente-track{animation:mente-track ${STEP_MS * 4}ms linear infinite}@keyframes mente-track{from{transform:translateY(0)}to{transform:translateY(-30px)}}@media (prefers-reduced-motion: reduce){.mente-track{animation:none}}`}</style>
    </div>
  );
}
