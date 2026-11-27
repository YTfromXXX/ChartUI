'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useCureAPIStore } from '@/lib/cureApiStore';
import { blockColors, blockDigest, blockLayout, layoutRegions, paintSandstorm } from '@/lib/retroBlocks';
import { GRID } from '@/lib/retroGrid';

// One experiment clock shared by all blocks: advanced by real time × simulation speed,
// held still at speed 0, pinned to the freeze frame in hypothesis B (as on /cure-api/experiments).
const clock = { t: 0, last: 0 };
function experimentTime(now: number) {
  if (now > clock.last) {
    const dt = clock.last ? Math.min(0.1, (now - clock.last) / 1000) : 0;
    clock.last = now;
    const { simulationSpeed, simulationMode, freezeFrame } = useCureAPIStore.getState();
    if (!(simulationMode === 'hypothesisB' && freezeFrame > 0)) clock.t += dt * simulationSpeed;
  }
  const { simulationMode, freezeFrame } = useCureAPIStore.getState();
  return simulationMode === 'hypothesisB' && freezeFrame > 0 ? freezeFrame * 60 : clock.t;
}

type Props = {
  /** 1..22 */
  id: number;
  seed: number;
  chaos: number;
  /** Strobe interval in seconds. */
  strobe: number;
  mode: 'core' | 'shell';
};

export default function SandstormBlock({ id, seed, chaos, strobe, mode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const digestRef = useRef<HTMLSpanElement>(null);
  const live = useRef({ strobe, mode });
  live.current = { strobe, mode };
  const colors = useMemo(() => blockColors(seed * 31 + id, chaos, layoutRegions(blockLayout(id - 1))), [seed, chaos, id]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const image = ctx.createImageData(GRID, GRID);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0; let lastTick = -1;
    const frame = (now: number) => {
      const time = experimentTime(now);
      const state = useCureAPIStore.getState();
      const { strobe: s, mode: m } = live.current;
      paintSandstorm(image, id, colors, {
        time,
        strobe: s,
        stress: state.volatilityIndex,
        energy: state.latestMatrix?.energy ?? 0,
        polarity: state.latestMatrix?.polarity ?? null,
        mode: m,
        reducedMotion,
      });
      ctx.putImageData(image, 0, 0);
      const tick = Math.floor(time / Math.max(0.05, s));
      if (tick !== lastTick && digestRef.current) { lastTick = tick; digestRef.current.textContent = blockDigest(id, tick); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [id, colors]);

  return (
    <>
      <canvas ref={canvasRef} width={GRID} height={GRID} className="absolute inset-0 h-full w-full" style={{ imageRendering: 'pixelated' }} aria-hidden="true" />
      <span ref={digestRef} className="pointer-events-none absolute bottom-1 left-1 z-10 rounded bg-black/60 px-1 font-mono text-[7px] text-slate-300" />
    </>
  );
}
