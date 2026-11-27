'use client';

import { useRef, useState } from 'react';

// PermanentY's control wheel (a FICTIONAL device of this game): a round wheel whose holes sit on the
// golden angle (137.5°, the limit of Fibonacci ratios), with a "Fibonacci magnet" ring in its lower half.
// In the story it floats on a superconducting magnet, so it has no friction and springs back to centre.
// Here: drag left/right to bank (roll), up/down to push or pull (pitch). Release: it glides back.
const HOLES = 21; // a Fibonacci number
const GOLD = 137.50776; // degrees: 360 × (1 − 1/φ)
const FIB = [1, 1, 2, 3, 5, 8, 13, 21, 34];

export default function FibWheel({ onChange, color = '#f29b30' }: { onChange: (roll: number, pitch: number) => void; color?: string }) {
  const [rot, setRot] = useState(0); const [push, setPush] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null); const back = useRef(0);
  const set = (r: number, p: number) => { setRot(r); setPush(p); onChange(r / 90, p); };
  const down = (e: React.PointerEvent) => { cancelAnimationFrame(back.current); (e.target as Element).setPointerCapture(e.pointerId); start.current = { x: e.clientX, y: e.clientY }; };
  const move = (e: React.PointerEvent) => { if (!start.current) return; set(Math.max(-90, Math.min(90, (e.clientX - start.current.x) * 0.9)), Math.max(-1, Math.min(1, (start.current.y - e.clientY) / 60))); };
  const up = () => { start.current = null; let r = rot; let p = push; const glide = () => { r *= 0.86; p *= 0.86; if (Math.abs(r) < 0.5 && Math.abs(p) < 0.01) { set(0, 0); return; } set(r, p); back.current = requestAnimationFrame(glide); }; glide(); };
  const k = Math.min(FIB.length - 2, Math.round(Math.abs(rot) / 12)); // the Fibonacci ratio shown climbs toward φ as you turn
  return (
    <div className="space-y-1 text-[10px] text-white" data-testid="fib-wheel">
      <svg viewBox="-110 -110 220 220" className="mx-auto w-full max-w-[200px] touch-none select-none" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="slider" aria-label="フィボナッチの操縦輪：左右で傾き、上下で機首" aria-valuenow={Math.round(rot)}>
        <g transform={`translate(0 ${-push * 10}) rotate(${rot})`}>
          <circle r="96" fill="#2a2c30" stroke="#111" strokeWidth="6" />
          <path d="M -80 30 A 85 85 0 0 0 80 30" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" opacity="0.9" />
          {Array.from({ length: HOLES }, (_, n) => { const a = (n * GOLD * Math.PI) / 180; const r = 14 + 74 * Math.sqrt((n + 0.5) / HOLES); return <circle key={n} cx={r * Math.cos(a)} cy={r * Math.sin(a)} r={3 + (n % 3)} fill="#111" stroke="#555" />; })}
          <rect x="-8" y="-100" width="16" height="16" rx="3" fill={color} />
          <circle r="18" fill="#1f1f1f" stroke={color} strokeWidth="3" />
        </g>
      </svg>
      <p className="text-center">傾き {(rot / 90 * 35).toFixed(0)}°の指示・機首 {push > 0 ? '上げ' : push < 0 ? '下げ' : '水平'}　｜　穴の比 {FIB[k + 1]}/{FIB[k]} = {(FIB[k + 1] / FIB[k]).toFixed(3)}（→ φ 1.618）</p>
      <p className="text-center text-[#999]">PermanentY の操縦輪（ゲームの中の装置。超伝導の磁石で浮いているので、手を離すと中央へ戻る）</p>
    </div>
  );
}
