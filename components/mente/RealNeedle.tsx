'use client';

import { useEffect, useRef } from 'react';

/**
 * A realistic analog meter: bezel, cream dial, ticks, a spring-damped needle with a shadow, and
 * glass glare. `level` is read from a ref every frame. In blackout the face goes dark and only
 * says that sound and vibration carry the signal.
 */
export default function RealNeedle({ levelRef, blackout, label }: { levelRef: React.MutableRefObject<number>; blackout: boolean; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ blackout });
  live.current = { blackout };

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const W = 360; const H = 220; const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const cx = W / 2; const cy = H * 0.86; const R = 150;
    const A0 = Math.PI * 1.15; const A1 = Math.PI * 1.85; // sweep of the dial
    let angle = A0; let omega = 0; let last = performance.now(); let raf = 0;
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (live.current.blackout) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#555'; ctx.font = 'italic bold 13px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('BLACKOUT · 音と振動で共有中', W / 2, H / 2);
        raf = requestAnimationFrame(frame); return;
      }
      // Needle: spring toward the target angle, critically under-damped for a realistic wobble.
      const target = A0 + (A1 - A0) * Math.max(0, Math.min(1, levelRef.current));
      omega += ((target - angle) * 60 - omega * 9) * dt; angle += omega * dt;

      // Bezel and face.
      const bezel = ctx.createLinearGradient(0, 0, 0, H);
      bezel.addColorStop(0, '#5a5a5a'); bezel.addColorStop(0.5, '#1d1d1d'); bezel.addColorStop(1, '#3a3a3a');
      ctx.fillStyle = bezel; ctx.fillRect(0, 0, W, H);
      const face = ctx.createRadialGradient(cx, cy - 40, 20, cx, cy, R + 20);
      face.addColorStop(0, '#fbf7ec'); face.addColorStop(1, '#ddd3bd');
      ctx.fillStyle = face; ctx.fillRect(10, 10, W - 20, H - 20);
      // Scale.
      ctx.lineCap = 'round';
      for (let i = 0; i <= 50; i += 1) {
        const a = A0 + ((A1 - A0) * i) / 50; const major = i % 5 === 0;
        ctx.strokeStyle = i >= 40 ? '#d6001c' : '#2a2520'; ctx.lineWidth = major ? 2.2 : 1;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (R - (major ? 18 : 10)), cy + Math.sin(a) * (R - (major ? 18 : 10))); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
        if (major) { ctx.fillStyle = '#2a2520'; ctx.font = '11px serif'; ctx.textAlign = 'center'; ctx.fillText(String(i / 5), cx + Math.cos(a) * (R - 30), cy + Math.sin(a) * (R - 30) + 4); }
      }
      ctx.fillStyle = '#7a0f22'; ctx.font = 'italic bold 15px serif'; ctx.textAlign = 'center'; ctx.fillText('Mente', cx, cy - 58);
      ctx.fillStyle = '#6b6255'; ctx.font = '10px sans-serif'; ctx.fillText(label, cx, cy - 42);
      // Needle shadow, needle, hub.
      const tip = (off: number) => [cx + Math.cos(angle) * (R - 6) + off, cy + Math.sin(angle) * (R - 6) + off] as const;
      ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx + 4, cy + 4); ctx.lineTo(...tip(4)); ctx.stroke();
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(...tip(0)); ctx.stroke();
      const hub = ctx.createRadialGradient(cx - 3, cy - 3, 1, cx, cy, 11);
      hub.addColorStop(0, '#888'); hub.addColorStop(1, '#111');
      ctx.fillStyle = hub; ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
      // Glass glare.
      const glare = ctx.createLinearGradient(10, 10, W * 0.6, H * 0.7);
      glare.addColorStop(0, 'rgba(255,255,255,.55)'); glare.addColorStop(0.35, 'rgba(255,255,255,.08)'); glare.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = glare; ctx.beginPath(); ctx.moveTo(10, 10); ctx.lineTo(W * 0.55, 10); ctx.quadraticCurveTo(W * 0.3, H * 0.35, 10, H * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2a2520'; ctx.font = '12px monospace'; ctx.textAlign = 'right'; ctx.fillText(levelRef.current.toFixed(2), W - 20, H - 18);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [levelRef, label]);

  return <canvas ref={canvasRef} width={360} height={220} className="w-full border-4 border-black" role="img" aria-label={`${label} meter`} />;
}
