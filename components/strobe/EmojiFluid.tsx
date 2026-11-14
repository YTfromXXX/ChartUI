'use client';

import { useEffect, useRef, useState } from 'react';

// Emoji as a fluid: each emoji is a particle carried by a smooth, swirling flow field, pushed away by
// the pointer, and turned (a plane rotation) to face the way it moves. No flashing.
const SETS: Record<string, string[]> = { '泡': ['🫧', '💧', '🫧'], 'ドン・ぱ': ['🐵', '🫛'], '星': ['⭐', '✨', '💫'], '葉': ['🍃', '🌿', '🍂'] };
type P = { x: number; y: number; vx: number; vy: number; e: string };

export default function EmojiFluid({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [set, setSet] = useState('泡');
  const [n, setN] = useState(120);
  const [visc, setVisc] = useState(0.94);
  const [turn, setTurn] = useState(true);
  const opts = useRef({ set, n, visc, turn }); opts.current = { set, n, visc, turn };
  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined;
    const ctx = cv.getContext('2d')!; const W = cv.width; const H = cv.height;
    let ps: P[] = []; let pointer: { x: number; y: number } | null = null; let raf = 0; let t = 0;
    const seed = () => { const es = SETS[opts.current.set]; ps = Array.from({ length: opts.current.n }, (_, k) => ({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, e: es[k % es.length] })); };
    seed(); let lastKey = `${opts.current.set}|${opts.current.n}`;
    const pos = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); pointer = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }; };
    const leave = () => { pointer = null; };
    cv.addEventListener('pointermove', pos); cv.addEventListener('pointerdown', pos); cv.addEventListener('pointerleave', leave);
    const speed = reduced ? 0.25 : 1;
    const frame = () => {
      const key = `${opts.current.set}|${opts.current.n}`; if (key !== lastKey) { seed(); lastKey = key; }
      t += 0.004 * speed;
      ctx.fillStyle = '#f7f5f0'; ctx.fillRect(0, 0, W, H);
      ctx.font = '22px system-ui, "Apple Color Emoji", "Noto Color Emoji", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const p of ps) {
        const a = Math.sin(p.x * 0.012 + t * 3) * Math.cos(p.y * 0.015 - t * 2) * Math.PI * 2; // a smooth swirl
        p.vx += Math.cos(a) * 0.12 * speed; p.vy += Math.sin(a) * 0.12 * speed;
        if (pointer) { const dx = p.x - pointer.x; const dy = p.y - pointer.y; const d2 = dx * dx + dy * dy; if (d2 < 6400) { const f = (1 - d2 / 6400) * 1.6; const d = Math.sqrt(d2) || 1; p.vx += (dx / d) * f; p.vy += (dy / d) * f; } }
        p.vx *= opts.current.visc; p.vy *= opts.current.visc; p.x += p.vx * speed * 2; p.y += p.vy * speed * 2;
        if (p.x < -10) p.x += W + 20; if (p.x > W + 10) p.x -= W + 20; if (p.y < -10) p.y += H + 20; if (p.y > H + 10) p.y -= H + 20;
        ctx.save(); ctx.translate(p.x, p.y); if (opts.current.turn) ctx.rotate(Math.atan2(p.vy, p.vx)); ctx.fillText(p.e, 0, 0); ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); cv.removeEventListener('pointermove', pos); cv.removeEventListener('pointerdown', pos); cv.removeEventListener('pointerleave', leave); };
  }, [reduced]);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label>絵文字 <select value={set} onChange={(e) => setSet(e.target.value)} className="border border-stone-400 bg-white px-1">{Object.keys(SETS).map((k) => <option key={k}>{k}</option>)}</select></label>
        <label>数 <input type="range" min={20} max={240} step={20} value={n} onChange={(e) => setN(Number(e.target.value))} /> {n}</label>
        <label>粘り <input type="range" min={0.85} max={0.99} step={0.01} value={visc} onChange={(e) => setVisc(Number(e.target.value))} /> {visc.toFixed(2)}</label>
        <label className="flex items-center gap-1"><input type="checkbox" checked={turn} onChange={(e) => setTurn(e.target.checked)} />進む向きに回す（平面回転）</label>
      </div>
      <canvas ref={ref} width={560} height={360} className="w-full max-w-[560px] touch-none border border-stone-300" data-testid="fluid" aria-label="絵文字の流体" />
      <p className="text-[11px] text-stone-500">指やマウスでなでると、絵文字が押し流される。点滅はない。{reduced ? '動きを減らす設定のため、ゆっくり流れる。' : ''}</p>
    </div>
  );
}
