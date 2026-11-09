'use client';

import { useEffect, useMemo, useState } from 'react';
import { GreenCardKit } from '@/app/cure-api/TSMonsterEngine';
import { useCureAPIStore } from '@/lib/cureApiStore';
import {
  FAMI_PORTS, IDLECRASH_TABLE, LETTERS, answerIdleCrash, gamesRunning, initIdleCrash, mimicCell, portByNo, setDual,
  stepIdleCrash, superEffect, type IdleCrashState, type Pane,
} from '@/lib/idlecrash';
import { GRID, REGIONS, regionAt } from '@/lib/retroGrid';

const SHATTER_MS = 1400;
const QUADRANT: Record<string, [number, number]> = { A: [-1, -1], B: [1, -1], C: [-1, 1], D: [1, 1] };
const CIRCLE = { x: 3.2, y: 9.6, r: 2.1 };
const CHART = { x0: 8.7, x1: 14.6, y0: 4.5, y1: 8.6 };

export default function IdleCrash({ page }: { page: 'A' | 'B' }) {
  const [state, setState] = useState<IdleCrashState>(() => initIdleCrash());
  const [dualFor, setDualFor] = useState<number | null>(null);
  const simulationSpeed = useCureAPIStore((s) => s.simulationSpeed);
  const setSimulationMode = useCureAPIStore((s) => s.setSimulationMode);
  const tickMs = useMemo(() => {
    const regulation = GreenCardKit.regulateAnimation({
      region: typeof navigator === 'undefined' ? 'GLOBAL' : GreenCardKit.regionFromLocale(navigator.language),
      strobeIntervalMs: 600 / Math.max(0.25, Math.min(4, simulationSpeed || 1)),
      prefersReducedMotion: typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    });
    return Math.max(400, regulation.strobeIntervalMs);
  }, [simulationSpeed]);

  // クイズクオンタム holds the loop while it is open.
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const onActive = (event: Event) => setHeld(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener('quiz-quantum:active', onActive);
    return () => window.removeEventListener('quiz-quantum:active', onActive);
  }, []);

  useEffect(() => {
    if (simulationSpeed === 0 || held) return undefined;
    const timer = window.setInterval(() => setState(stepIdleCrash), tickMs);
    return () => window.clearInterval(timer);
  }, [tickMs, simulationSpeed, held]);

  // A pane shattered: finish the effect, then move A -> B (or B -> A) and start a new lap.
  useEffect(() => {
    if (state.phase !== 'shatter') return undefined;
    const timer = window.setTimeout(() => {
      const next = page === 'A' ? 'B' : 'A';
      setSimulationMode(next === 'A' ? 'hypothesisA' : 'hypothesisB');
      window.history.replaceState(null, '', `?page=${next}`);
      setState((s) => initIdleCrash(s.lap + 1));
    }, SHATTER_MS);
    return () => window.clearTimeout(timer);
  }, [state.phase, page, setSimulationMode]);

  const running = gamesRunning(state);
  const sentence = superEffect(state, tickMs / 1000, simulationSpeed);
  const cells = useMemo(() => Array.from({ length: GRID * GRID }, (_, i) => ({ i, r: Math.floor(i / GRID), c: i % GRID, region: regionAt(Math.floor(i / GRID), i % GRID) })), []);
  const maxLog = Math.max(1, ...state.history.map((m) => Math.log(m)));
  const chartPoints = state.history.map((m, i) => {
    const x = CHART.x0 + ((CHART.x1 - CHART.x0) * i) / Math.max(1, state.history.length - 1);
    const y = CHART.y1 - ((CHART.y1 - CHART.y0) * Math.log(m)) / maxLog;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');

  return (
    <section className="rounded border border-amber-300/25 bg-[#0c0510]/90 p-4 text-xs" aria-label="idlecrash">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[9px] uppercase tracking-[0.3em] text-amber-200">IDLECRASH · 22 Famiポート · page {page} · lap {state.lap}</p>
          <p className="mt-1 text-[10px] text-slate-400">Answer the old woman behind the No.9 pillar (A/B mend SIDE MENU, C/D mend POP UP). Idling raises the crash multiplier; when a pane shatters, page {page} moves to page {page === 'A' ? 'B' : 'A'}.</p>
        </div>
        <span className="font-mono text-[10px] text-slate-400">×{state.multiplier.toFixed(2)} · tick {state.tick} · {held ? 'held by クイズクオンタム' : `${Math.round(tickMs)} ms`}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="relative mx-auto aspect-square w-full max-w-[640px] overflow-hidden rounded border border-white/10">
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)`, gridTemplateRows: `repeat(${GRID}, 1fr)` }}>
            {cells.map(({ i, region }) => {
              const pane: Pane | null = region === 'side' ? 'side' : region === 'popup' ? 'popup' : null;
              const breaking = pane && state.shattered === pane;
              const h = (i * 2654435761) >>> 0;
              const integrity = pane ? state.integrity[pane] : 1;
              return (
                <div
                  key={i}
                  className="flex items-center justify-center border border-black/30 font-mono text-[9px] text-white/70"
                  style={{
                    background: `hsl(${REGIONS[region].hue} 55% ${pane ? 10 + 14 * integrity : 16}%)`,
                    transition: `transform ${SHATTER_MS}ms cubic-bezier(.3,.6,.4,1), opacity ${SHATTER_MS}ms`,
                    transform: breaking ? `translate(${(h % 200) - 100}%, ${((h >>> 8) % 300) - 50}%) rotate(${((h >>> 16) % 180) - 90}deg)` : 'none',
                    opacity: breaking ? 0 : 1,
                  }}
                >
                  {pane && !running ? mimicCell(state, pane, i) : ''}
                </div>
              );
            })}
          </div>

          <svg viewBox={`0 0 ${GRID} ${GRID}`} className="pointer-events-none absolute inset-0 h-full w-full">
            {/* No.9 pillar on the right edge, the old woman peering left behind it. */}
            <rect x={15.05} y={4} width={0.95} height={10} fill="#1c1917" stroke="#a8a29e" strokeWidth={0.04} />
            <text x={15.52} y={4.6} fontSize={0.38} textAnchor="middle" fill="#e7e5e4">No.9</text>
            <text x={14.55} y={11.6} fontSize={0.9} textAnchor="middle" opacity={state.phase === 'event' ? 1 : 0.35}>👵</text>
            <text x={14.2} y={12.6} fontSize={0.5} textAnchor="middle" opacity={state.phase === 'event' ? 1 : 0.35}>📖🔍</text>

            {running && state.shattered !== 'side' && (
              <g>
                <circle cx={CIRCLE.x} cy={CIRCLE.y} r={CIRCLE.r} fill="none" stroke="#fde68a" strokeWidth={0.06} strokeDasharray="0.2 0.15" />
                {LETTERS.map((l) => (
                  <text key={l} x={CIRCLE.x + QUADRANT[l][0] * CIRCLE.r * 0.55} y={CIRCLE.y + QUADRANT[l][1] * CIRCLE.r * 0.55 + 0.2} fontSize={0.6} textAnchor="middle" fill="#fef3c7">{l}</text>
                ))}
                <text x={CIRCLE.x} y={CIRCLE.y + 0.25} fontSize={0.7} textAnchor="middle">🍬</text>
                {state.candies.slice(-8).map((candy, k) => {
                  const t = Math.min(1, (state.tick - candy.tick + 1) / 3);
                  const [qx, qy] = QUADRANT[candy.letter];
                  const x = 0.3 + (CIRCLE.x + qx * CIRCLE.r * 0.7 - 0.3) * t;
                  const y = CIRCLE.y + qy * CIRCLE.r * 0.7 - Math.sin(t * Math.PI) * 1.4;
                  return <circle key={k} cx={x} cy={y} r={0.18} fill={['#fb7185', '#fbbf24', '#34d399', '#a78bfa'][LETTERS.indexOf(candy.letter)]} />;
                })}
              </g>
            )}
            {running && state.shattered !== 'popup' && (
              <g>
                <rect x={CHART.x0 - 0.1} y={CHART.y0 - 0.2} width={CHART.x1 - CHART.x0 + 0.2} height={CHART.y1 - CHART.y0 + 0.4} fill="#0009" />
                <polyline points={chartPoints} fill="none" stroke="#f472b6" strokeWidth={0.08} />
                <text x={CHART.x1} y={CHART.y0 + 0.35} fontSize={0.45} textAnchor="end" fill="#fbcfe8">×{state.multiplier.toFixed(2)}</text>
              </g>
            )}
            {state.phase === 'shatter' && (
              <g stroke="#fff" strokeWidth={0.05} fill="none" opacity={0.8}>
                <polyline points={state.shattered === 'side' ? '0,5 2,7 1,9 4,11 2,14' : '9,4 11,6 10,8 13,10 12,13 15,14'} />
                <polyline points={state.shattered === 'side' ? '3,4 4,7 6,8 5,11 8,13' : '12,4 13,7 15,8 14,11 15,13'} />
              </g>
            )}

            {/* BOTTOM: pane integrity. */}
            <g fontSize={0.42} fill="#fef3c7">
              <text x={0.3} y={14.6}>SIDE MENU</text>
              <rect x={0.3} y={14.85} width={6.5} height={0.35} fill="#ffffff22" />
              <rect x={0.3} y={14.85} width={6.5 * state.integrity.side} height={0.35} fill="#fbbf24" />
              <text x={8.3} y={14.6}>POP UP</text>
              <rect x={8.3} y={14.85} width={6.5} height={0.35} fill="#ffffff22" />
              <rect x={8.3} y={14.85} width={6.5 * state.integrity.popup} height={0.35} fill="#f472b6" />
            </g>
          </svg>

          {/* HEADER: スーパーエフェクト */}
          <p className="pointer-events-none absolute inset-x-0 top-0 h-1/4 overflow-hidden p-2 text-[10px] leading-4 text-cyan-50 [text-shadow:0_1px_2px_#000]">{sentence}</p>
        </div>

        <aside className="space-y-3">
          <div className={`rounded border p-3 ${state.phase === 'event' ? 'border-amber-300/60 bg-amber-300/[0.06]' : 'border-white/10'}`} aria-live="polite">
            <p className="text-[10px] text-amber-100">👵 No.9 ファミスカルの柱の陰で、老婆が本と虫眼鏡を手に食い入るように読み解いている。</p>
            {state.phase === 'event' && state.options ? (
              <>
                <p className="mt-2 text-[10px] text-slate-300">次のキャンディを、どのポートへ投げ入れますか？</p>
                <div className="mt-2 grid gap-1">
                  {state.options.map((no, k) => (
                    <button key={k} type="button" onClick={() => setState((s) => answerIdleCrash(s, LETTERS[k]))} className="border border-white/15 px-2 py-1 text-left text-[10px] hover:border-amber-200/60">
                      <span className="font-mono text-amber-200">{LETTERS[k]}</span> · {no}. {portByNo(no).title} <span className="text-slate-500">→ {k < 2 ? 'SIDE MENU' : 'POP UP'}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-1 text-[9px] text-slate-500">{state.phase === 'shatter' ? `${state.shattered === 'side' ? 'SIDE MENU' : 'POP UP'} shattered → page ${page === 'A' ? 'B' : 'A'}` : `next question at tick ${Math.ceil((state.tick + 1) / 10) * 10}`}</p>
            )}
          </div>

          <div>
            <p className="mb-1 text-[9px] uppercase tracking-[0.2em] text-slate-400">22 Famiポート</p>
            <div className="grid grid-cols-11 gap-0.5">
              {FAMI_PORTS.map((port) => (
                <button
                  key={port.no}
                  type="button"
                  onClick={() => { if (port.no === 19) window.dispatchEvent(new Event('quiz-quantum:fire')); setDualFor(port.dual ? port.no : null); }}
                  title={`${port.no}. ${port.title}${port.note ? ` — ${port.note}` : ''}${port.filled ? ' (filled)' : ''}`}
                  className="aspect-square rounded-sm border font-mono text-[8px]"
                  style={{
                    borderColor: port.no === state.portA ? '#fbbf24' : port.no === state.portB ? '#f472b6' : 'rgba(255,255,255,.1)',
                    background: port.dual ? 'rgba(167,139,250,.15)' : 'transparent',
                    borderStyle: port.filled ? 'dashed' : 'solid',
                  }}
                >
                  {port.no}
                </button>
              ))}
            </div>
            {dualFor && portByNo(dualFor).dual && (
              <div className="mt-2 rounded border border-violet-300/40 bg-[#140812] p-2 text-[10px]">
                <p className="text-violet-200">{dualFor}. {portByNo(dualFor).title} · Dual パラメーターを初期化</p>
                <div className="mt-1 flex gap-1">
                  {portByNo(dualFor).dual!.map((label, side) => (
                    <button key={label} type="button" onClick={() => { setState((s) => setDual(s, dualFor, side as 0 | 1)); setDualFor(null); }} className={`flex-1 border px-2 py-1 ${state.dual[dualFor] === side ? 'border-violet-200/70 text-white' : 'border-white/15 text-slate-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-1 text-[8px] text-slate-500">黄＝『A』 桃＝『B』 · 紫＝Dual · 破線＝空欄を補完したポート</p>
          </div>

          <table className="w-full text-left text-[9px]">
            <caption className="mb-1 text-left text-[9px] uppercase tracking-[0.2em] text-slate-400">&lt;idlecrash&gt;</caption>
            <tbody>
              {IDLECRASH_TABLE.map((row, k) => (
                <tr key={k} className="border-t border-white/5 align-top">
                  <td className="py-0.5 pr-2 text-slate-300">{row.key}</td>
                  <td className={row.filled ? 'text-amber-100' : 'text-slate-400'}>{row.value}{row.filled ? ' ✎' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[8px] text-slate-600">Simulation only — no money, odds or real trades. ✎ = filled-in blank.</p>
        </aside>
      </div>
    </section>
  );
}
