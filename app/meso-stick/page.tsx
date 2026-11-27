'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useSyntheticBtc } from '@/hooks/useSyntheticBtc';
import { FAMI_PALETTE, SPRITES } from '@/lib/famiSprites';
import { FALL, cone, dance, forecastOf, horizonAt, initStick, step, type Stick } from '@/lib/mesoStick';
import { SNEAKER_TYPES, sneakerParams } from '@/lib/moonSneaker';

const W = 720; const H = 480;
const TIER_H = 22;

/** MESO STICK — dance on a vaulting box climbing through the prediction cloud (customer D). */
export default function MesoStickPage() {
  const btc = useSyntheticBtc();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shoe, setShoe] = useState(2);
  const [hud, setHud] = useState<Stick>(initStick);
  const [best, setBest] = useState(0);
  const sim = useRef<Stick>(initStick());
  const stick = useRef({ pointer: 0, keys: 0 });
  const live = useRef({ series: btc.history, shoe });
  live.current = { series: btc.history, shoe };

  const restart = () => { sim.current = initStick(); setHud(sim.current); };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') stick.current.keys = -1;
      if (e.key === 'ArrowRight' || e.key === 'd') stick.current.keys = 1;
      if (e.key === ' ') { e.preventDefault(); sim.current = dance(sim.current); }
      if (e.key === 'r') restart();
    };
    const up = (e: KeyboardEvent) => { if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(e.key)) stick.current.keys = 0; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0; let last = performance.now(); let hudTimer = 0;
    const frame = (now: number) => {
      const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
      const { series, shoe: k } = live.current;
      const f = forecastOf(series);
      const damping = sneakerParams(k, new Date(), 0.5).cushion;
      const u = stick.current.keys || stick.current.pointer;
      // Substeps keep the pendulum stable.
      for (let i = 0; i < 4; i += 1) sim.current = step(sim.current, dt / 4, u, damping, f);
      const s = sim.current;
      canvas.dataset.theta = s.theta.toFixed(3); // readable by automation / assistive tools

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Sky darkens as you climb (deeper into the future).
      const depth = Math.min(1, s.altitude / 60);
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, `rgb(${Math.round(20 - 15 * depth)},${Math.round(40 - 30 * depth)},${Math.round(90 - 50 * depth)})`);
      sky.addColorStop(1, `rgb(${Math.round(110 - 80 * depth)},${Math.round(150 - 110 * depth)},${Math.round(200 - 120 * depth)})`);
      ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

      // Camera: the box top sits at 60 % height; world y grows upward in metres (1 m = 24 px).
      const PX = 24; const baseY = H * 0.6 + s.altitude * PX;
      const yOf = (alt: number) => baseY - alt * PX;
      // Prediction cloud: puffs on each metre band, spread by the 80 % band and drifted by μ.
      for (let alt = Math.floor(s.altitude) - 8; alt < s.altitude + 14; alt += 1) {
        if (alt < 2) continue;
        const c = cone(f, horizonAt(alt));
        const thick = Math.min(1, c.half / 0.01);
        const cx = W / 2 + Math.max(-1, Math.min(1, c.mid / 0.005)) * 160;
        const spread = 40 + thick * 260;
        for (let p = 0; p < 6; p += 1) {
          const x = cx + Math.sin(alt * 12.9898 + p * 78.233) * spread + (reduced ? 0 : Math.sin(now / 1400 + alt + p) * 8);
          const y = yOf(alt) + Math.cos(alt * 4.1 + p) * 8;
          const r = 14 + thick * 26 + ((alt * 7 + p * 13) % 9);
          ctx.fillStyle = `rgba(255,255,255,${(0.08 + 0.3 * thick).toFixed(3)})`;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Vaulting box: tiers below the dancer, narrowing upward.
      const topY = yOf(s.altitude) + 8;
      for (let t = 0; t < s.tiers; t += 1) {
        const y = topY + t * TIER_H;
        if (y > H) break;
        const wTop = 70 + t * 9; // the top tier is the narrowest
        ctx.fillStyle = t === 0 ? '#f4f1ec' : t % 2 ? '#c8a26a' : '#b88d55';
        ctx.beginPath(); ctx.moveTo(W / 2 - wTop / 2, y); ctx.lineTo(W / 2 + wTop / 2, y); ctx.lineTo(W / 2 + wTop / 2 + 4.5, y + TIER_H); ctx.lineTo(W / 2 - wTop / 2 - 4.5, y + TIER_H); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#5a3a22'; ctx.lineWidth = 1.5; ctx.stroke();
        if (t === 0) { ctx.fillStyle = '#7a0f22'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText(`${s.tiers} 段`, W / 2, y + 15); }
      }

      // Dancer: pixel sprite rotated about the feet by θ.
      ctx.save(); ctx.translate(W / 2, topY); ctx.rotate(s.theta);
      const spr = SPRITES.dancer; const px = 4; const sw = spr.rows[0].length;
      const lift = s.danceCombo && !reduced ? Math.abs(Math.sin(now / 120)) * 4 : 0;
      spr.rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === '.') return;
        ctx.fillStyle = FAMI_PALETTE[ch] ?? '#fff';
        ctx.fillRect((x - sw / 2) * px, (y - spr.rows.length) * px - lift, px, px);
      }));
      ctx.restore();

      // Near-fall: a slow red vignette (no flashing).
      const danger = Math.min(1, Math.abs(s.theta) / FALL);
      if (danger > 0.4) {
        const v = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, W * 0.7);
        v.addColorStop(0, 'rgba(214,0,28,0)'); v.addColorStop(1, `rgba(214,0,28,${((danger - 0.4) * 0.9).toFixed(2)})`);
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      }
      // Stick gauge.
      ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(W / 2 - 100, H - 24, 200, 10);
      ctx.fillStyle = '#fbbf24'; ctx.fillRect(W / 2 + Math.min(0, u) * 100, H - 24, Math.abs(u) * 100, 10);
      if (s.fallen) {
        ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(0, H / 2 - 40, W, 80);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'; ctx.fillText(`落下 · ${s.tiers} 段 · ${Math.round(s.score)} 点`, W / 2, H / 2 + 4);
        ctx.font = '13px monospace'; ctx.fillText('R でもう一度', W / 2, H / 2 + 26);
      }
      hudTimer += dt;
      if (hudTimer > 0.2) { hudTimer = 0; setHud(s); if (s.fallen) setBest((b) => Math.max(b, Math.round(s.score))); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    stick.current.pointer = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2.2));
  };

  return (
    <main className="min-h-screen bg-[#0a1020] px-3 py-5 font-mono text-slate-100 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-3">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-sky-300">by カスタマー D</p>
            <h1 className="text-2xl font-bold tracking-[0.2em]">FEMDOME MESO STICK</h1>
            <p className="text-[11px] text-slate-400">予測雲を突き抜けて上空へ。跳び箱のてっぺんで踊る。</p>
          </div>
          <nav className="flex gap-3 text-xs text-slate-400"><Link href="/stoic-room" className="hover:text-white">Stoic Room</Link><Link href="/mente" className="hover:text-white">Mente</Link></nav>
        </header>

        <canvas ref={canvasRef} width={W} height={H} onPointerMove={onPointer} onPointerLeave={() => { stick.current.pointer = 0; }} className="w-full cursor-ew-resize touch-none border-2 border-sky-200/30" aria-label="Meso stick stage" role="img" />

        <section aria-label="Meso stick HUD" className="grid gap-2 text-[11px] sm:grid-cols-4">
          <p>段 <span className="text-lg text-amber-200">{hud.tiers}</span> · 高度 {hud.altitude.toFixed(1)} m</p>
          <p>心拍 <span className="text-lg text-rose-300">{hud.bpm}</span> BPM · 傾き {(hud.theta * 57.3).toFixed(0)}°</p>
          <p>予測雲 {(hud.cloud * 100).toFixed(0)}% · 横風 {hud.wind >= 0 ? '→' : '←'} {Math.abs(hud.wind).toFixed(2)}</p>
          <p>得点 {Math.round(hud.score)} · ダンス ×{hud.danceCombo} · 最高 {best}</p>
        </section>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <select aria-label="Sneaker" value={shoe} onChange={(e) => setShoe(Number(e.target.value))} className="border border-white/20 bg-black px-1 py-0.5">
            {SNEAKER_TYPES.map((t, k) => <option key={t.key} value={k}>{t.key}. {t.type}（踏ん張り {sneakerParams(k, new Date()).cushion}）</option>)}
          </select>
          <button type="button" onClick={() => { sim.current = dance(sim.current); }} className="border border-amber-300/60 px-3 py-1">踊る（Space）</button>
          <button type="button" onClick={restart} className="border border-white/20 px-3 py-1">もう一度（R）</button>
          <span className="text-slate-400">スティック：ポインターを左右（中央がニュートラル）または ← →。BTCUSD 合成 {btc.price.toFixed(5)}（{btc.source}）</span>
        </div>
        <p className="text-[10px] text-slate-500">予測雲は合成価格の値動きから計算した 80% の予測帯。高く昇るほど遠い未来で、雲が厚く揺れも大きい。予測の傾きは横風になる。演出用で、価格予想ではない。</p>
      </div>
    </main>
  );
}
