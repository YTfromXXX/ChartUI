'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FILES, FLOORS, SIZE, cpuPrompt, initialPieces, legalMoves, parsePrompt, resolveTurn, same, sqName, type Color, type Piece, type Sq, type TurnEvent } from '@/lib/promptChess';
import { rng } from '@/lib/smokeCandle';

const CELL = 46; const GAP = 34; const PAD = 24;
const floorX = (f: number) => PAD + f * (SIZE * CELL + GAP);
const pos = (s: Sq) => ({ x: floorX(s.f) + s.x * CELL + CELL / 2, y: PAD + 18 + (SIZE - 1 - s.y) * CELL + CELL / 2 });
const WIDTH = PAD * 2 + FLOORS * SIZE * CELL + (FLOORS - 1) * GAP; const HEIGHT = PAD * 2 + 18 + SIZE * CELL;
const LIMITS = [{ label: '30 秒（練習）', s: 30 }, { label: '5 分（本番）', s: 300 }];
const MAX_TURNS = 20;

/**
 * Physical prompt chess: a multi-storey car park where every piece is a knight. Both sides write
 * a prompt within the time limit, the prompts become moves, and both moves run at once.
 */
export default function PromptChess() {
  const [pieces, setPieces] = useState<Piece[]>(initialPieces);
  const [prompts, setPrompts] = useState<Record<Color, string>>({ white: '', black: '' });
  const [twoPlayers, setTwoPlayers] = useState(false);
  const [limit, setLimit] = useState(30);
  const [left, setLeft] = useState(30);
  const [turn, setTurn] = useState(1);
  const [log, setLog] = useState<{ turn: number; prompts: Record<Color, string>; why: Record<Color, string>; events: TurnEvent[] }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const rnd = useRef(rng(11));
  const alive = (c: Color) => pieces.filter((p) => p.alive && p.color === c).length;
  const over = alive('white') === 0 || alive('black') === 0 || turn > MAX_TURNS;
  const winner = over ? (alive('white') === alive('black') ? '引き分け' : alive('white') > alive('black') ? '白の勝ち' : '黒の勝ち') : null;

  const run = () => {
    if (over) return;
    const black = twoPlayers ? prompts.black : cpuPrompt('black', pieces, rnd.current);
    const rw = parsePrompt(prompts.white, 'white', pieces); const rb = parsePrompt(black, 'black', pieces);
    const out = resolveTurn(pieces, rw.move, rb.move);
    setPieces(out.pieces); setLog((l) => [{ turn, prompts: { white: prompts.white, black }, why: { white: rw.why, black: rb.why }, events: out.events }, ...l]);
    setPrompts({ white: '', black: '' }); setTurn((t) => t + 1); setLeft(limit); setSelected(null);
  };
  const runRef = useRef(run); runRef.current = run;

  useEffect(() => {
    if (over) return undefined;
    const id = window.setInterval(() => setLeft((s) => s - 1), 1000);
    return () => window.clearInterval(id);
  }, [over]);
  useEffect(() => { if (left <= 0) runRef.current(); }, [left]); // time is up: both prompts run as they are

  const sel = pieces.find((p) => p.id === selected && p.alive) ?? null;
  const targets = useMemo(() => (sel ? legalMoves(sel, pieces) : []), [sel, pieces]);
  const pick = (to: Sq) => { if (!sel) return; setPrompts((p) => ({ ...p, [sel.color]: `${sel.id} を ${sqName(to)} へ` })); setSelected(null); };

  return (
    <main className="min-h-screen bg-[#0b0d10] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-slate-400">LAB · フィジカルプロンプトチェス</p>
            <h1 className="text-2xl font-semibold">立体駐車場 — 全員ナイト（桂馬）</h1>
            <p className="max-w-3xl text-sm text-slate-300">駒はすべてナイトで、階をまたいで跳べます（3 次元の桂馬跳び、最大 24 通り）。両者が制限時間内にプロンプトを書くと、それが手に変わり、2 つの手が<strong>同時に</strong>走ります。同じ区画に着いたら衝突して両方戻り、すれ違いは取らず、止まっている相手に着地したら取ります。読めないプロンプトは「駐車のまま」です。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/lab/honeycomb-punish" className="border border-white/20 px-3 py-1">ハニカムパニッシュ</Link><Link href="/lab/crystal-baby" className="border border-white/20 px-3 py-1">クリスタルベイビー対決</Link></nav>
        </header>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs">
          <span data-testid="clock" className="rounded border border-white/20 px-3 py-1 text-base">{over ? winner : `手番 ${turn} · 残り ${left} 秒`}</span>
          {LIMITS.map((l) => <button key={l.s} type="button" onClick={() => { setLimit(l.s); setLeft(l.s); }} className="border px-2 py-1" style={{ borderColor: limit === l.s ? '#fbbf24' : '#ffffff33' }}>{l.label}</button>)}
          <label className="flex items-center gap-1"><input type="checkbox" checked={twoPlayers} onChange={(e) => setTwoPlayers(e.target.checked)} />2 人で（黒もプロンプト）</label>
          <span>白 {alive('white')} · 黒 {alive('black')}</span>
          <button type="button" onClick={() => { setPieces(initialPieces()); setTurn(1); setLog([]); setLeft(limit); }} className="border border-white/20 px-2 py-1">はじめから</button>
        </div>

        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full rounded border border-white/10 bg-[#111418]" data-testid="board">
          {Array.from({ length: FLOORS }, (_, f) => (
            <g key={f}>
              <text x={floorX(f)} y={PAD + 10} fill="#94a3b8" fontSize="12" fontFamily="monospace">{f + 1}F</text>
              {Array.from({ length: SIZE * SIZE }, (_, i) => { const x = i % SIZE; const y = Math.floor(i / SIZE); const s = { x, y, f }; const p = pos(s); const hit = targets.some((t) => same(t, s));
                return (
                  <g key={i} onClick={() => hit && pick(s)} style={{ cursor: hit ? 'pointer' : 'default' }}>
                    <rect x={p.x - CELL / 2 + 1} y={p.y - CELL / 2 + 1} width={CELL - 2} height={CELL - 2} fill={hit ? '#fbbf2433' : '#1a1f27'} stroke="#ffffff14" />
                    <line x1={p.x - CELL / 2 + 6} y1={p.y + CELL / 2 - 4} x2={p.x + CELL / 2 - 6} y2={p.y + CELL / 2 - 4} stroke="#facc1530" strokeDasharray="4 3" />
                    {y === 0 && <text x={p.x} y={HEIGHT - 6} fill="#64748b" fontSize="10" textAnchor="middle" fontFamily="monospace">{FILES[x]}</text>}
                    {x === 0 && f === 0 && <text x={PAD - 12} y={p.y + 4} fill="#64748b" fontSize="10" fontFamily="monospace">{y + 1}</text>}
                  </g>
                ); })}
              {f < FLOORS - 1 && <text x={floorX(f) + SIZE * CELL + GAP / 2} y={PAD + 18 + (SIZE * CELL) / 2} fill="#475569" fontSize="16" textAnchor="middle">⇄</text>}
            </g>
          ))}
          {pieces.filter((p) => p.alive).map((p) => { const q = pos(p.at); return (
            <g key={p.id} data-testid={`piece-${p.id}`} onClick={() => setSelected(p.id === selected ? null : p.id)} style={{ transform: `translate(${q.x}px, ${q.y}px)`, transition: 'transform 900ms cubic-bezier(.5,-0.4,.5,1.4)', cursor: 'pointer' }}>
              <circle r={17} fill={p.color === 'white' ? '#e2e8f0' : '#1e293b'} stroke={p.id === selected ? '#fbbf24' : p.color === 'white' ? '#94a3b8' : '#64748b'} strokeWidth={p.id === selected ? 3 : 1.5} />
              <text y={6} textAnchor="middle" fontSize="18" fill={p.color === 'white' ? '#0f172a' : '#e2e8f0'}>♞</text>
              <text y={-20} textAnchor="middle" fontSize="9" fill="#94a3b8" fontFamily="monospace">{p.id}</text>
            </g>
          ); })}
        </svg>

        <div className="grid gap-3 md:grid-cols-2">
          {(['white', 'black'] as Color[]).map((c) => (
            <label key={c} className="space-y-1 text-xs">
              <span className="font-mono">{c === 'white' ? '白のプロンプト' : twoPlayers ? '黒のプロンプト' : '黒（CPU）— 走るときに書きます'}</span>
              <textarea data-testid={`prompt-${c}`} disabled={c === 'black' && !twoPlayers} value={prompts[c]} onChange={(e) => setPrompts((p) => ({ ...p, [c]: e.target.value }))} rows={2}
                placeholder={c === 'white' ? '例：W1 を c3@1F へ（駒をクリックすると行き先が光ります）' : '例：B2 を d3@3F へ'} className="w-full rounded border border-white/20 bg-black/40 p-2 font-mono disabled:opacity-40" />
            </label>
          ))}
        </div>
        <button type="button" data-testid="run" onClick={run} disabled={over} className="rounded border border-amber-300/60 px-4 py-2 font-mono text-sm text-amber-200 disabled:opacity-40">同時に走らせる（時間切れでも走ります）</button>

        <ol data-testid="log" className="space-y-2 font-mono text-xs">
          {log.map((l) => (
            <li key={l.turn} className="rounded border border-white/10 p-2">
              <div className="text-slate-400">手番 {l.turn}</div>
              <div>白「{l.prompts.white || '（空）'}」→ {l.why.white}</div>
              <div>黒「{l.prompts.black || '（空）'}」→ {l.why.black}</div>
              <div className="mt-1 text-amber-200">{l.events.map((e) => e.text).join(' / ')}</div>
            </li>
          ))}
        </ol>
      </div>
    </main>
  );
}
