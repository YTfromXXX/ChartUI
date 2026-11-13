'use client';

import { useEffect, useRef, useState } from 'react';

const FACES = ['👮‍♀️', '👮'] as const;
const MASCOT = '(◕ᴗ◕)Ξ'; // サトシ顔: the face-emoji mascot born from the meter (not a real person)

/** The OP popup: an aviator circles six original "cassette stars"; at the end the サトシ顔 mascot is complete. */
function Opening({ onClose }: { onClose: () => void }) {
  const [t, setT] = useState(0);
  const reduce = useRef(false);
  const closeRef = useRef(onClose); closeRef.current = onClose; // the parent re-renders on every wink; keep the clock running
  useEffect(() => {
    reduce.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0; const start = performance.now();
    const tick = (now: number) => { setT((now - start) / 1000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', k);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', k); };
  }, []);
  const lines = ['aviator が、六つのカセット星を周回する。', 'おもちゃの王国の王様・トトシ中本は、新しい「硬貨」の形を確かめる旅に出た。', 'ヘッダーの二つの顔が、ひとつになる。', `サトシ顔、完成。 ${MASCOT}`];
  const step = Math.min(lines.length - 1, Math.floor(t / 3));
  const a = reduce.current ? step * 1.2 : t * 0.9;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="OP" data-testid="op" onClick={(e) => e.stopPropagation()} className="w-full max-w-lg space-y-2 border-2 border-black bg-[#0f1220] p-4 text-white shadow-[8px_8px_0_#0006]">
        <svg viewBox="-110 -80 220 160" className="w-full" aria-label="六つのカセット星を回る aviator">
          {Array.from({ length: 6 }, (_, i) => { const ang = (i / 6) * Math.PI * 2; const x = 70 * Math.cos(ang); const y = 45 * Math.sin(ang); return (
            <g key={i} transform={`translate(${x} ${y})`}><rect x={-10} y={-7} width={20} height={14} rx={2} fill="#fde68a" stroke="#7a5c12" /><rect x={-6} y={-7} width={12} height={4} fill="#7a5c12" /><circle cx={0} cy={3} r={1.6} fill="#7a5c12" /></g>
          ); })}
          <ellipse cx={0} cy={0} rx={70} ry={45} fill="none" stroke="#ffffff33" strokeDasharray="3 4" />
          <g transform={`translate(${70 * Math.cos(a)} ${45 * Math.sin(a)}) rotate(${(a * 180) / Math.PI + 90})`}><path d="M0 -7L5 6L0 3L-5 6Z" fill="#c8001a" /></g>
          <text x={0} y={5} textAnchor="middle" fontSize={step === lines.length - 1 ? 16 : 11} fill="white">{step === lines.length - 1 ? MASCOT : '👮‍♀️ 👮'}</text>
        </svg>
        <p className="min-h-10 text-sm" aria-live="polite">{lines[step]}</p>
        <div className="flex justify-between text-[11px] text-white/70"><span>トトシ中本・サトシ顔は架空のキャラクターです。</span><button type="button" onClick={onClose} className="border border-white/60 px-2">閉じる</button></div>
      </div>
    </div>
  );
}

/**
 * The Satoshi parameter in the header: two face emojis watch the player; every few seconds one of
 * them winks (😉) and a sparkle fades. Slow on purpose (one wink every 2.5 s). The OP button opens
 * the popup. "サトシ" here is the meter and its mascot, not a real person.
 */
export default function SatoshiParam() {
  const [wink, setWink] = useState<number | null>(null);
  const [op, setOp] = useState(false);
  useEffect(() => {
    let n = 0;
    const t = window.setInterval(() => { n += 1; setWink(n % 2); window.setTimeout(() => setWink(null), 450); }, 2500);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="flex items-center gap-2 border border-[#1f1f1f] bg-white px-2 py-1 text-xs" data-testid="satoshi-param">
      <span className="text-[10px] text-stone-600">サトシパラメーター</span>
      {FACES.map((f, i) => <span key={f} className="relative text-lg" aria-hidden>{wink === i ? '😉' : f}{wink === i && <span className="sparkle absolute -right-2 -top-1 text-[10px]">✨</span>}</span>)}
      <button type="button" data-testid="op-open" onClick={() => setOp(true)} className="border border-[#1f1f1f] px-1.5">OP</button>
      {op && <Opening onClose={() => setOp(false)} />}
      <style>{'.sparkle{animation:sparkle 450ms ease-out forwards}@keyframes sparkle{from{opacity:1;transform:scale(.6)}to{opacity:0;transform:scale(1.3)}}@media (prefers-reduced-motion: reduce){.sparkle{animation:none}}'}</style>
    </div>
  );
}
