'use client';

import { useEffect, useRef, useState } from 'react';
import { GOLDEN, LEVELS, emptyStats, levelY, mirrorConfig, mirrorY, summary, targetAt, type RoundStats, type Target } from '@/lib/fibMirror';
import { SNEAKER_TYPES } from '@/lib/moonSneaker';

const W = 720; const H = 400; const TOP = 40; const BOTTOM = 360;
const ROUND_MS = 30_000;
const ANGLES = {
  正面: 'none',
  俯瞰: 'rotateX(38deg)',
  斜め: 'rotateX(24deg) rotateY(-22deg)',
  ローアングル: 'rotateX(-16deg) translateY(-12px)',
} as const;
type Angle = keyof typeof ANGLES;

/** Fibonacci mirror on an enlarged screen, with game camera angles. */
export default function FibonacciMirror({ series }: { series: number[] }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [angle, setAngle] = useState<Angle>('斜め');
  const [shoe, setShoe] = useState(2);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<RoundStats>(emptyStats);
  const [left, setLeft] = useState(ROUND_MS);
  const live = useRef({ series, shoe, running });
  live.current = { series, shoe, running };
  const hand = useRef<{ x: number; y: number } | null>(null);
  const ghost = useRef<{ x: number; y: number } | null>(null);
  const round = useRef({ start: 0, n: 0, target: null as Target | null, stats: emptyStats(), seed: 1 });

  // Hand input: the pointer stands in for the tracked hand. A camera hand tracker can call
  // `hand.current = { x, y }` in canvas pixels the same way.
  const onPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const c = event.currentTarget;
    hand.current = { x: (event.nativeEvent.offsetX / c.clientWidth) * W, y: (event.nativeEvent.offsetY / c.clientHeight) * H };
  };

  const start = () => {
    round.current = { start: performance.now(), n: 0, target: null, stats: emptyStats(), seed: Math.floor(Math.random() * 1e6) };
    setStats(emptyStats()); setLeft(ROUND_MS); setRunning(true);
  };

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    let raf = 0;
    const frame = (now: number) => {
      const { series: line, shoe: k, running: on } = live.current;
      const cfg = mirrorConfig(k);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#05020a'; ctx.fillRect(0, 0, W, H);
      const pts = line.slice(-120);
      const lo = Math.min(...pts); const hi = Math.max(...pts); const span = hi - lo || 1;
      const goldenY = levelY(GOLDEN, TOP, BOTTOM);

      // Levels.
      ctx.font = '11px monospace'; ctx.textAlign = 'right';
      for (const lv of LEVELS) {
        const y = levelY(lv, TOP, BOTTOM);
        ctx.strokeStyle = lv === GOLDEN ? '#fbbf24' : 'rgba(255,255,255,.22)'; ctx.lineWidth = lv === GOLDEN ? 2 : 1;
        ctx.setLineDash(lv === GOLDEN ? [] : [4, 5]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = lv === GOLDEN ? '#fbbf24' : 'rgba(255,255,255,.55)';
        ctx.fillText(`${(lv * 100).toFixed(1)}%  ${(lo + lv * span).toFixed(5)}`, W - 6, y - 3);
      }
      ctx.fillStyle = '#fbbf24'; ctx.textAlign = 'left'; ctx.fillText('MIRROR AXIS 61.8%', 8, goldenY - 4);

      // The single price line.
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.6; ctx.beginPath();
      pts.forEach((v, i) => { const x = (i / Math.max(1, pts.length - 1)) * W * 0.95; const y = BOTTOM - ((v - lo) / span) * (BOTTOM - TOP); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      ctx.stroke();

      // Hand and its mirror (cushioned by the sneaker).
      const hd = hand.current;
      if (hd) {
        const target = { x: hd.x, y: mirrorY(hd.y, goldenY) };
        const g = ghost.current ?? target;
        ghost.current = { x: g.x + (target.x - g.x) * (1 - cfg.damping), y: g.y + (target.y - g.y) * (1 - cfg.damping) };
        ctx.strokeStyle = 'rgba(251,191,36,.35)'; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(hd.x, hd.y); ctx.lineTo(ghost.current.x, ghost.current.y); ctx.stroke(); ctx.setLineDash([]);
        for (const [p, label, color] of [[hd, '✋', '#fff'], [ghost.current, '🪞', '#fbbf24']] as const) {
          ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(p.x, p.y, cfg.hitRadius, 0, Math.PI * 2); ctx.stroke();
          ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, p.x, p.y + 6);
        }
      }

      // Round: one target at a time on a Fibonacci level.
      if (on) {
        const r = round.current;
        if (!r.target) r.target = targetAt(r.n++, r.seed, now, W);
        const t = r.target; const ty = levelY(t.level, TOP, BOTTOM); const age = now - t.born;
        const remain = 1 - age / cfg.windowMs;
        ctx.strokeStyle = '#f472b6'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(t.x, ty, cfg.hitRadius, -Math.PI / 2, -Math.PI / 2 + Math.max(0, remain) * Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(244,114,182,.25)'; ctx.beginPath(); ctx.arc(t.x, ty, cfg.hitRadius * 0.6, 0, Math.PI * 2); ctx.fill();
        const touch = (p: { x: number; y: number } | null) => p && Math.hypot(p.x - t.x, p.y - ty) <= cfg.hitRadius;
        const byHand = touch(hand.current); const byMirror = !byHand && touch(ghost.current);
        if (byHand || byMirror) {
          r.stats = { ...r.stats, hits: r.stats.hits + 1, mirrorHits: r.stats.mirrorHits + (byMirror ? 1 : 0), reactions: [...r.stats.reactions, age] };
          r.target = null; setStats(r.stats);
        } else if (remain <= 0) {
          r.stats = { ...r.stats, misses: r.stats.misses + 1 }; r.target = null; setStats(r.stats);
        }
        const rest = ROUND_MS - (now - r.start);
        if (Math.floor(rest / 500) !== Math.floor((rest + 16) / 500)) setLeft(Math.max(0, rest));
        if (rest <= 0) { setRunning(false); setLeft(0); r.target = null; }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const s = summary(stats);
  const cfg = mirrorConfig(shoe);
  const enlarge = () => { void (document.fullscreenElement ? document.exitFullscreen() : shellRef.current?.requestFullscreen?.()); };

  return (
    <section ref={shellRef} aria-label="Fibonacci mirror" className="space-y-2 border-2 border-amber-300/40 bg-[#05020a] p-3 text-[11px] text-slate-200">
      <div className="relative z-10 flex flex-wrap items-center gap-2 bg-[#05020a]">
        <p className="mr-auto font-bold text-amber-200">フィボナッチミラー · 拡大スクリーン</p>
        <select aria-label="Sneaker" value={shoe} onChange={(e) => setShoe(Number(e.target.value))} className="border border-white/20 bg-black px-1 py-0.5">
          {SNEAKER_TYPES.map((t, k) => <option key={t.key} value={k}>{t.key}. {t.type}</option>)}
        </select>
        {(Object.keys(ANGLES) as Angle[]).map((a) => (
          <button key={a} type="button" aria-pressed={angle === a} onClick={() => setAngle(a)} className={`border px-2 py-0.5 ${angle === a ? 'border-amber-200 text-amber-100' : 'border-white/15 text-slate-400'}`}>{a}</button>
        ))}
        <button type="button" onClick={enlarge} className="border border-white/30 px-2 py-0.5">⛶ 拡大スクリーン</button>
        <button type="button" onClick={start} disabled={running} className="bg-amber-300 px-3 py-0.5 font-bold text-black disabled:opacity-50">{running ? `残り ${(left / 1000).toFixed(1)} s` : '30 秒ラウンド開始'}</button>
      </div>
      {/* The tilted stage stays inside its own clipped box, so it never covers the controls. */}
      <div className="relative z-0 overflow-hidden py-2" style={{ perspective: '900px' }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerMove={onPointer}
          onPointerDown={onPointer}
          className="w-full cursor-crosshair touch-none border border-white/10"
          style={{ transform: ANGLES[angle], transformOrigin: '50% 60%', transition: 'transform .6s ease' }}
          aria-label="Fibonacci mirror stage"
        />
      </div>
      <p>
        命中 {stats.hits}（うちミラー {stats.mirrorHits}）· 逃し {stats.misses} · 正確さ {(s.accuracy * 100).toFixed(0)}% · 平均反応 {s.avg.toFixed(0)} ms · 最速 {s.best.toFixed(0)} ms
        <span className="text-slate-500"> · {cfg.label}：届く半径 {cfg.hitRadius}px、窓 {cfg.windowMs} ms、ミラーのクッション {cfg.damping.toFixed(2)}</span>
      </p>
      <p className="text-[10px] text-slate-500">手（いまはポインター。カメラのハンドトラッキングも同じ座標で差し込める）を 61.8% の黄金線で鏡映し、本物の手と鏡の手の 2 本でフィボナッチ水準に出る的を速射する。反射神経と精度のゲームで、売買のシグナルではない。</p>
    </section>
  );
}
