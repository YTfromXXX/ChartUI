'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import EmergenceCanvas from '@/LAB/colorcube/EmergenceCanvas';
import { buildEmergenceProgram, layersUpTo } from '@/LAB/colorcube/emergence';
import { BOARD_SIZE, START, advance, boardOrder, rollDie, stepForSquare, type BoardPage, type SugorokuState } from '@/app/cure-api/TSMonsterEngine/SugorokuKit';
import { kitItem } from '@/lib/cureKit';

const DIE = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

/** Retro-grid board game: each odd square reveals the next step of the color emergence. */
export default function EmergenceSugoroku({ page }: { page: BoardPage }) {
  const [state, setState] = useState<SugorokuState>(START);
  const order = useMemo(() => boardOrder(page), [page]);
  const program = useMemo(() => buildEmergenceProgram(state.seed), [state.seed]);
  const step = stepForSquare(state.square);
  const layers = useMemo(() => layersUpTo(program, step), [program, step]);
  const rows = [Array.from({ length: 11 }, (_, i) => i + 1), Array.from({ length: 11 }, (_, i) => i + 12)];
  const accent = page === 'A' ? '#fb7185' : '#34d399';

  return (
    <section className="rounded border p-4 text-xs" style={{ borderColor: `${accent}55`, background: '#0c0510e6' }} aria-label="Color emergence sugoroku">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[9px] uppercase tracking-[0.3em]" style={{ color: accent }}>SUGOROKU · 色彩の出現 · page {page} · lap {state.lap}</p>
          <p className="mt-1 text-[10px] text-slate-400">Roll the 6-sided die. Even squares slip to the next odd square (∅ = blank singularity); each odd square reveals the next emergence step. Passing 22 starts a new lap with a new sheet.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setState((current) => advance(current, rollDie()))} className="flex items-center gap-2 rounded border px-3 py-1.5 text-sm text-white hover:bg-white/5" style={{ borderColor: `${accent}88` }}>
            <span className="text-xl leading-none">{state.lastRoll ? DIE[state.lastRoll - 1] : '🎲'}</span> roll
          </button>
          <button type="button" onClick={() => setState(START)} className="rounded border border-white/10 px-2 py-1.5 text-slate-400 hover:text-white">reset</button>
        </div>
      </div>

      <div className="space-y-1">
        {rows.map((row, r) => (
          <div key={r} className="grid grid-cols-11 gap-1">
            {row.map((square) => {
              const kit = kitItem(order[square - 1]);
              const odd = square % 2 === 1;
              const here = square === state.square;
              const revealed = odd && stepForSquare(square) <= step;
              return (
                <div
                  key={square}
                  title={`square ${square} · #${kit.id} ${kit.name}${odd ? ` · step ${stepForSquare(square) + 1}: ${program[stepForSquare(square)].verb}` : ' · even → slips to odd'}`}
                  className="relative flex aspect-square flex-col justify-between rounded border p-1 text-[8px]"
                  style={{
                    borderColor: here ? '#fff' : square === state.slipFrom ? '#fda4af' : odd ? `${accent}55` : 'rgba(255,255,255,.08)',
                    borderStyle: odd ? 'solid' : 'dashed',
                    background: revealed ? `${accent}22` : 'transparent',
                  }}
                >
                  <span className="font-mono text-slate-500">{square}</span>
                  <span className="truncate text-slate-200">{kit.name}</span>
                  {odd ? <span className="font-mono text-[7px] text-slate-500">{program[stepForSquare(square)].verb}</span> : <span className="text-[9px] text-rose-200/70">∅</span>}
                  {here && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
        <EmergenceCanvas layers={layers} className="w-full rounded border border-white/10" />
        <div className="space-y-2 text-[10px] text-slate-300">
          <p className="font-mono text-slate-500">square {state.square}/{BOARD_SIZE} · step {step + 1}/{program.length} · seed {state.seed}{state.slipFrom ? ` · slipped from ${state.slipFrom}` : ''}</p>
          <p className="text-sm text-white">{program[step].verb}</p>
          <p>{program[step].note}</p>
          <p className="text-slate-500">#{order[state.square - 1]} {kitItem(order[state.square - 1]).name} — {kitItem(order[state.square - 1]).role}</p>
          <Link href="/lab/colorcube" className="inline-block border border-white/15 px-2 py-1 text-slate-300 hover:text-white">LAB / colorcube →</Link>
        </div>
      </div>
    </section>
  );
}
