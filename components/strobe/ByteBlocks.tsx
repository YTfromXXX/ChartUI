'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// A falling-blocks toy where each cell holds a BYTE FRAME of 1, 2, 4 or 8 bits.
// ↑ rotates the bits inside the one cell (a bit rotation, drawn as a 90° plane rotation in CSS).
// Click a settled cell, then a neighbour: the two swap with a flip ("strobe exchange").
// A full row clears; if its values XOR to zero it counts double ("harmony").
// Strobe: only the falling cell inverts, at most 2 times a second (well under 3 Hz), and never with reduced motion.
const COLS = 8; const ROWS = 12;
type Grid = (number | null)[][];
type Piece = { x: number; y: number; v: number; turn: number };
const empty = (): Grid => Array.from({ length: ROWS }, () => Array<number | null>(COLS).fill(null));
const rol = (v: number, bits: number) => (bits === 1 ? v ^ 1 : ((v << 1) | (v >>> (bits - 1))) & ((1 << bits) - 1));
const LAYOUT: Record<number, [number, number]> = { 1: [1, 1], 2: [2, 1], 4: [2, 2], 8: [4, 2] };
const ON = '#c8001a'; const OFF = '#f5e9e9';

function Bits({ v, bits, invert, color = ON }: { v: number; bits: number; invert?: boolean; color?: string }) {
  const [c, r] = LAYOUT[bits];
  return (
    <div className="grid h-full w-full gap-px p-0.5" style={{ gridTemplateColumns: `repeat(${c}, 1fr)`, gridTemplateRows: `repeat(${r}, 1fr)` }}>
      {Array.from({ length: bits }, (_, k) => { const on = ((v >>> (bits - 1 - k)) & 1) === 1; return <span key={k} style={{ background: on !== !!invert ? color : OFF }} />; })}
    </div>
  );
}

export default function ByteBlocks({ reduced }: { reduced: boolean }) {
  const [bits, setBits] = useState(4);
  const [grid, setGrid] = useState<Grid>(empty);
  const [piece, setPiece] = useState<Piece | null>(null);
  const [score, setScore] = useState(0);
  const [msg, setMsg] = useState('');
  const [sel, setSel] = useState<[number, number] | null>(null);
  const [flip, setFlip] = useState<Record<string, number>>({});
  const [strobe, setStrobe] = useState(false);
  const [hz, setHz] = useState(1);
  const [inv, setInv] = useState(false);
  const [running, setRunning] = useState(false);
  const rnd = useRef(0x2f6b1a);
  const next = useCallback((): Piece => { rnd.current = (Math.imul(rnd.current, 1103515245) + 12345) >>> 0; return { x: 3, y: 0, v: (rnd.current >>> 8) & ((1 << bits) - 1) || 1, turn: 0 }; }, [bits]);

  const settle = useCallback((p: Piece, g: Grid) => {
    const ng = g.map((row) => [...row]); ng[p.y][p.x] = p.v;
    let gained = 0; const kept: Grid = [];
    for (const row of ng) {
      if (row.every((c) => c !== null)) { const x = row.reduce<number>((a, c) => a ^ (c ?? 0), 0); gained += x === 0 ? 2 * COLS : COLS; setMsg(x === 0 ? '列が消えた — XOR が 0：調和（2 倍）' : '列が消えた'); } else kept.push(row);
    }
    while (kept.length < ROWS) kept.unshift(Array<number | null>(COLS).fill(null));
    setGrid(kept); setScore((s) => s + gained);
    const np = next();
    if (kept[np.y][np.x] !== null) { setRunning(false); setPiece(null); setMsg('積み上がった。もう一度。'); } else setPiece(np);
  }, [next]);

  const move = useCallback((dx: number, dy: number) => {
    if (!piece) return;
    const x = piece.x + dx; const y = piece.y + dy;
    if (x < 0 || x >= COLS) return;
    if (y >= ROWS || grid[y][x] !== null) { if (dy) settle(piece, grid); return; }
    setPiece({ ...piece, x, y });
  }, [piece, grid, settle]);
  const rotate = useCallback(() => { if (piece) setPiece({ ...piece, v: rol(piece.v, bits), turn: piece.turn + 90 }); }, [piece, bits]);
  const drop = useCallback(() => { if (!piece) return; let y = piece.y; while (y + 1 < ROWS && grid[y + 1][piece.x] === null) y += 1; settle({ ...piece, y }, grid); }, [piece, grid, settle]);

  const moveRef = useRef(move); moveRef.current = move;
  useEffect(() => { if (!running) return undefined; const t = window.setInterval(() => moveRef.current(0, 1), 650); return () => window.clearInterval(t); }, [running]);
  useEffect(() => {
    if (!running) return undefined;
    const k = (e: KeyboardEvent) => {
      const map: Record<string, () => void> = { ArrowLeft: () => move(-1, 0), ArrowRight: () => move(1, 0), ArrowDown: () => move(0, 1), ArrowUp: rotate, ' ': drop };
      if (map[e.key]) { e.preventDefault(); map[e.key](); }
    };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [running, move, rotate, drop]);
  useEffect(() => { // the strobe: one cell only, at most 2 Hz
    if (!strobe || reduced) { setInv(false); return undefined; }
    const t = window.setInterval(() => setInv((x) => !x), 1000 / (2 * Math.min(2, hz))); return () => window.clearInterval(t);
  }, [strobe, hz, reduced]);

  const start = () => { setGrid(empty()); setScore(0); setMsg(''); setSel(null); setRunning(true); setPiece(next()); };
  const click = (y: number, x: number) => {
    if (grid[y][x] === null) { setSel(null); return; }
    if (!sel) { setSel([y, x]); return; }
    const [sy, sx] = sel; setSel(null);
    if (Math.abs(sy - y) + Math.abs(sx - x) !== 1) return;
    const ng = grid.map((r) => [...r]); [ng[sy][sx], ng[y][x]] = [ng[y][x], ng[sy][sx]];
    setFlip((f) => ({ ...f, [`${sy},${sx}`]: (f[`${sy},${sx}`] ?? 0) + 180, [`${y},${x}`]: (f[`${y},${x}`] ?? 0) + 180 }));
    setGrid(ng); setMsg('ストロボ交換');
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label>バイト枠 <select value={bits} onChange={(e) => { setBits(Number(e.target.value)); setRunning(false); setPiece(null); setGrid(empty()); }} className="border border-stone-400 bg-white px-1" data-testid="bits">{[1, 2, 4, 8].map((b) => <option key={b} value={b}>{b} ビット</option>)}</select></label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={strobe} disabled={reduced} onChange={(e) => setStrobe(e.target.checked)} />ストロボ</label>
        <label>速さ <input type="range" min={0.5} max={2} step={0.5} value={hz} onChange={(e) => setHz(Number(e.target.value))} /> {hz} 回/秒</label>
        {reduced && <span className="text-stone-500">（動きを減らす設定のため、ストロボと回転は止めています）</span>}
        <button type="button" onClick={start} className="border-2 border-black bg-white px-3 py-1 font-semibold" data-testid="bb-start">▶ はじめる</button>
        <span data-testid="bb-score">得点 {score}</span>
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="grid gap-px bg-stone-300 p-px" style={{ gridTemplateColumns: `repeat(${COLS}, 2rem)` }} data-testid="bb-grid">
          {grid.map((row, y) => row.map((c, x) => {
            const here = piece && piece.x === x && piece.y === y; const key = `${y},${x}`;
            const isSel = sel && sel[0] === y && sel[1] === x;
            return (
              <button type="button" key={key} onClick={() => click(y, x)} className="h-8 w-8 bg-white" style={{ outline: isSel ? '2px solid #2b3a67' : undefined, perspective: '200px' }} aria-label={`${x},${y}`}>
                <div className="h-full w-full" style={{ transform: here ? `rotate(${reduced ? 0 : piece!.turn}deg)` : `rotateY(${reduced ? 0 : flip[key] ?? 0}deg)`, transition: reduced ? 'none' : 'transform 180ms ease-out' }}>
                  {here ? <Bits v={piece!.v} bits={bits} invert={inv} color="#2b3a67" /> : c !== null ? <Bits v={c} bits={bits} /> : null}
                </div>
              </button>);
          }))}
        </div>
        <div className="max-w-xs space-y-2 text-xs">
          <div className="grid w-40 grid-cols-3 gap-1">
            <span /><button type="button" onClick={rotate} className="border bg-white py-1">↻ 回す</button><span />
            <button type="button" onClick={() => move(-1, 0)} className="border bg-white py-1">←</button>
            <button type="button" onClick={drop} className="border bg-white py-1">落とす</button>
            <button type="button" onClick={() => move(1, 0)} className="border bg-white py-1">→</button>
          </div>
          <p>キー：← → 移動、↑ 回す（1 マスの中でビットが一つずれる）、↓ 少し落とす、スペースで一気に落とす。</p>
          <p>積んだマスを押して、となりのマスを押すと、二つが裏返って入れ替わる（ストロボ交換）。</p>
          <p>一列そろうと消える。その列のバイトの XOR が 0 なら、調和で 2 倍。</p>
          {msg && <p className="font-semibold" data-testid="bb-msg">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
