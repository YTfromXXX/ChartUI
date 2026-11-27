'use client';

import { useEffect, useState } from 'react';
import { WINGSPANS, landings, portAt, SQUARES, type Wingspan } from '@/lib/dualSlot';

const W = 640; const H = 230; const GROUND = 190; const STEP = 62; const X0 = 40;
const sx = (ahead: number) => X0 + ahead * STEP;
/** A flight arc from the runway to `ahead` squares, peaking at `peak` px above the ground. */
const arc = (ahead: number, peak: number) => `M${sx(0)} ${GROUND} Q${(sx(0) + sx(ahead)) / 2} ${GROUND - 2 * peak} ${sx(ahead)} ${GROUND}`;

/**
 * Port 8 · aviator: the pop-up that initialises the Dual. Pick who flies (Little, low and steady,
 * or Nephilim, the giant, high and wide) and the giant's wingspan. Every setting lands 3.5 squares
 * ahead on average; only the spread changes. No multiplier, no cash-out, no crash.
 */
export default function AviatorPopup({ square, pick, span, onDone }: { square: number; pick: 0 | 1; span: Wingspan; onDone: (pick: 0 | 1, span: Wingspan) => void }) {
  const [p, setP] = useState<0 | 1>(pick);
  const [w, setW] = useState<Wingspan>(span);
  const [t, setT] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; let raf = 0; const t0 = performance.now();
    const f = (now: number) => { setT(reduce ? 0.5 : ((now - t0) / 4000) % 1); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, []);
  const land = landings(w); const chosen = p ? land.nephilim : land.little; const peak = p ? 80 : 26;
  const targets = Object.keys(chosen).map(Number);
  // The plane glides along the chosen arc to the nearer landing, then the farther one, in turn.
  const target = targets[Math.floor(t * 2) % targets.length]; const k = (t * 2) % 1;
  const px = sx(0) + (sx(target) - sx(0)) * k; const py = GROUND - 4 * peak * k * (1 - k);
  const variance = p ? w * w : 0.25;

  return (
    <div role="dialog" aria-label="aviator の初期化" data-testid="aviator" className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl space-y-3 rounded-xl border border-sky-300/40 bg-[#0d1726] p-4 text-sm text-sky-50">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-lg font-semibold">8. aviator — Dual の初期化</p>
          <span className="font-mono text-xs text-sky-300">マス {square + 1} から飛ぶ</span>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded bg-gradient-to-b from-[#0b2440] to-[#14304d]" aria-label="飛び方と着地のマス">
          {Array.from({ length: 9 }, (_, a) => { const port = portAt(square + a); const prob = chosen[a] ?? 0; return (
            <g key={a}>
              <rect x={sx(a) - 26} y={GROUND} width="52" height="14" fill={a === 0 ? '#fcd34d' : '#334155'} stroke="#0b1220" />
              <text x={sx(a)} y={GROUND + 11} textAnchor="middle" fontSize="9" fill={a === 0 ? '#111' : '#e2e8f0'}>{((square + a) % SQUARES) + 1}</text>
              <text x={sx(a)} y={GROUND + 26} textAnchor="middle" fontSize="7" fill="#94a3b8">{port.title.slice(0, 7)}</text>
              {prob > 0 && <><ellipse cx={sx(a)} cy={GROUND - 2} rx={24} ry={5} fill="#38bdf8" opacity={0.25 + prob} /><text x={sx(a)} y={GROUND - 10} textAnchor="middle" fontSize="10" fill="#7dd3fc">{Math.round(prob * 100)}%</text></>}
            </g>
          ); })}
          {/* The other flier's arcs, faint, so the two styles can be compared. */}
          {Object.keys(p ? land.little : land.nephilim).map(Number).map((a) => <path key={`o${a}`} d={arc(a, p ? 26 : 80)} fill="none" stroke="#ffffff22" strokeDasharray="4 4" />)}
          {targets.map((a) => <path key={a} d={arc(a, peak)} fill="none" stroke="#7dd3fc" strokeWidth="1.5" strokeDasharray="6 4" />)}
          <g transform={`translate(${px} ${py})`}><path d="M-12 0 L10 -3 L14 0 L10 3 Z M-2 -1 L-6 -11 L0 -11 L4 -1 Z M-2 1 L-6 11 L0 11 L4 1 Z M-12 0 L-15 -5 L-11 -5 L-9 -1 Z" fill={p ? '#f9a8d4' : '#fde68a'} /></g>
          <text x="10" y="18" fontSize="11" fill="#cbd5e1">{p ? 'ネフェリム：高く飛んで遠くか近くへ' : 'リトル：低く飛んで 3 か 4 マス先へ'}</text>
        </svg>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex gap-1">
            {(['リトル', 'ネフェリム'] as const).map((label, k) => (
              <button key={label} type="button" data-testid={`aviator-pick-${k}`} onClick={() => setP(k as 0 | 1)} className="flex-1 rounded border px-2 py-1" style={{ borderColor: p === k ? '#7dd3fc' : '#ffffff22' }}>{label}</button>
            ))}
          </div>
          <div className="flex gap-1" aria-label="ネフェリムの翼の幅">
            {WINGSPANS.map((s) => (
              <button key={s} type="button" data-testid={`aviator-span-${s}`} onClick={() => setW(s)} disabled={!p} className="flex-1 rounded border px-2 py-1 disabled:opacity-40" style={{ borderColor: w === s ? '#f9a8d4' : '#ffffff22' }}>翼 {3.5 - s}–{3.5 + s} マス</button>
            ))}
          </div>
        </div>
        <p className="font-mono text-xs" data-testid="aviator-stats">平均 3.50 マス（どの設定でも同じ）· ばらつき {variance.toFixed(2)}</p>
        <p className="text-xs text-sky-200/70">倍率も、途中で降りる操作も、墜落もありません。飛行機は必ず着陸し、決まるのは着地するマスだけです。</p>
        <button type="button" data-testid="aviator-done" onClick={() => onDone(p, w)} className="w-full rounded-full bg-sky-300 py-1.5 font-semibold text-[#0d1726]">この設定で初期化する</button>
      </div>
    </div>
  );
}
