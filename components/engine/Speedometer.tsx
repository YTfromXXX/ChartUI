'use client';

import { useEffect, useRef } from 'react';
import { MAX_RPM, MAX_SPEED, type Car, type CarReading } from '@/lib/engineMenu';
import { wave } from '@/lib/waveDie';

/**
 * A future dashboard speedometer in the Mente meter's language (chrome bezel, spring-damped needle
 * with a shadow, glass glare), coloured by the car's three colours. Main dial: speed 0–300 with the
 * shared green / yellow / red bands. Sub-dial: RPM ×1000 from friction. Bar: temperature from the
 * width of the forecast. The needle idles on the shared wave die (the car's own cell), so the four
 * cars breathe with the dancers. No blinking.
 */
const W = 320; const H = 268; const CX = 160; const CY = 128; const R = 98;
const A0 = Math.PI * 0.75; const A1 = Math.PI * 2.25;

export default function Speedometer({ car, reading }: { car: Car; reading: CarReading }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef(reading); live.current = reading;

  useEffect(() => {
    const canvas = ref.current; const ctx = canvas?.getContext('2d'); if (!canvas || !ctx) return undefined;
    const dpr = Math.min(3, window.devicePixelRatio || 1); canvas.width = W * dpr; canvas.height = H * dpr;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let angle = A0; let omega = 0; let tach = A0; let tachW = 0; let last = performance.now(); let raf = 0;
    const at = (v: number) => A0 + (A1 - A0) * Math.max(0, Math.min(1, v));
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; const r = live.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      // Face.
      const face = ctx.createRadialGradient(CX, CY - 20, 10, CX, CY, R + 20);
      face.addColorStop(0, '#16142a'); face.addColorStop(0.7, '#0a0916'); face.addColorStop(1, `${car.primary}33`);
      ctx.fillStyle = face; ctx.beginPath(); ctx.arc(CX, CY, R + 16, 0, Math.PI * 2); ctx.fill();
      // Chrome bezel.
      const chrome = ctx.createLinearGradient(0, CY - R - 20, 0, CY + R + 20);
      chrome.addColorStop(0, '#f2f4f8'); chrome.addColorStop(0.45, '#6b7080'); chrome.addColorStop(0.55, '#2a2d38'); chrome.addColorStop(1, '#9aa0b0');
      ctx.strokeStyle = chrome; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(CX, CY, R + 13, 0, Math.PI * 2); ctx.stroke();
      // Flowing three-colour rim (the only moving colour).
      const shift = reduce ? 0 : (now / 6000) * Math.PI * 2;
      let rim: CanvasGradient | string = car.primary;
      if ('createConicGradient' in ctx) {
        const cg = (ctx as CanvasRenderingContext2D & { createConicGradient: (a: number, x: number, y: number) => CanvasGradient }).createConicGradient(shift, CX, CY);
        [car.primary, car.secondary, car.accent, car.primary].forEach((c, i) => cg.addColorStop(i / 3, c)); rim = cg;
      }
      ctx.strokeStyle = rim; ctx.lineWidth = 3; ctx.shadowColor = car.primary; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(CX, CY, R + 6, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
      // Shared meaning bands: green / yellow / red.
      for (const [from, to, c] of [[0, 0.4, '#2fbf4a'], [0.4, 0.8, '#ffd400'], [0.8, 1, '#ff3b3b']] as const) {
        ctx.strokeStyle = c; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(CX, CY, R - 6, at(from), at(to)); ctx.stroke();
      }
      // Ticks and numbers.
      ctx.lineCap = 'round';
      for (let i = 0; i <= 30; i += 1) {
        const a = at(i / 30); const major = i % 5 === 0;
        ctx.strokeStyle = major ? '#ffffff' : '#ffffff88'; ctx.lineWidth = major ? 2.2 : 1;
        ctx.beginPath(); ctx.moveTo(CX + Math.cos(a) * (R - (major ? 26 : 18)), CY + Math.sin(a) * (R - (major ? 26 : 18))); ctx.lineTo(CX + Math.cos(a) * (R - 12), CY + Math.sin(a) * (R - 12)); ctx.stroke();
        if (major) { ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i * 10), CX + Math.cos(a) * (R - 38), CY + Math.sin(a) * (R - 38)); }
      }
      // Main needle: spring toward the speed, idling on the car's wave cell.
      const idle = reduce ? 0 : wave(car.cell, Date.now()) * 0.012;
      const target = at(r.speed / MAX_SPEED + idle);
      omega += ((target - angle) * 55 - omega * 8.5) * dt; angle += omega * dt;
      const tip = (off: number, len: number) => [CX + Math.cos(angle) * len + off, CY + Math.sin(angle) * len + off] as const;
      ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(CX + 4, CY + 4); ctx.lineTo(...tip(4, R - 14)); ctx.stroke();
      ctx.strokeStyle = car.accent; ctx.lineWidth = 3; ctx.shadowColor = car.accent; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.moveTo(CX - Math.cos(angle) * 14, CY - Math.sin(angle) * 14); ctx.lineTo(...tip(0, R - 14)); ctx.stroke(); ctx.shadowBlur = 0;
      const hub = ctx.createRadialGradient(CX - 3, CY - 3, 1, CX, CY, 12); hub.addColorStop(0, '#ffffff'); hub.addColorStop(0.4, car.secondary); hub.addColorStop(1, '#111');
      ctx.fillStyle = hub; ctx.beginPath(); ctx.arc(CX, CY, 11, 0, Math.PI * 2); ctx.fill();
      // Digital speed and gear.
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'; ctx.fillText(r.speed.toFixed(0), CX, CY + 44);
      ctx.fillStyle = '#ffffffaa'; ctx.font = '10px monospace'; ctx.fillText('km/h（予測の速さ）', CX, CY + 62);
      ctx.strokeStyle = car.accent; ctx.lineWidth = 1.5; ctx.strokeRect(CX - 14, CY - 52, 28, 26);
      ctx.fillStyle = car.accent; ctx.font = 'bold 20px monospace'; ctx.fillText(r.gear, CX, CY - 38);
      // Sub-dial: RPM from friction.
      const sx = 272; const sy = 222; const sr = 30; const s0 = Math.PI * 0.8; const s1 = Math.PI * 2.2;
      ctx.fillStyle = '#0a0916'; ctx.beginPath(); ctx.arc(sx, sy, sr + 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = car.secondary; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, sr + 4, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(sx, sy, sr - 3, s0 + (s1 - s0) * 0.75, s1); ctx.stroke();
      for (let i = 0; i <= MAX_RPM; i += 1) { const a = s0 + ((s1 - s0) * i) / MAX_RPM; ctx.fillStyle = '#ffffff'; ctx.font = '8px monospace'; ctx.fillText(String(i), sx + Math.cos(a) * (sr - 12), sy + Math.sin(a) * (sr - 12)); }
      const tTarget = r.rpm === null ? s0 : s0 + (s1 - s0) * (r.rpm / MAX_RPM);
      tachW += ((tTarget - tach) * 40 - tachW * 7) * dt; tach += tachW * dt;
      ctx.strokeStyle = car.secondary; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + Math.cos(tach) * (sr - 4), sy + Math.sin(tach) * (sr - 4)); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = '8px monospace'; ctx.fillText(r.rpm === null ? '未計測' : `×1000 摩擦`, sx, sy + sr + 12);
      // Temperature bar: width of the forecast.
      ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.font = '8px monospace'; ctx.fillText('C', 18, 256); ctx.fillText('H', 92, 256);
      const tg = ctx.createLinearGradient(28, 0, 88, 0); tg.addColorStop(0, '#3d7bff'); tg.addColorStop(0.6, '#ffd400'); tg.addColorStop(1, '#ff3b3b');
      ctx.fillStyle = '#ffffff22'; ctx.fillRect(28, 250, 60, 7); ctx.fillStyle = tg; ctx.fillRect(28, 250, 60 * r.temp, 7);
      ctx.fillStyle = '#ffffffaa'; ctx.fillText('温度＝予測の幅', 18, 242);
      // Glass glare.
      const glare = ctx.createLinearGradient(CX - R, CY - R, CX + R * 0.2, CY + R * 0.4);
      glare.addColorStop(0, 'rgba(255,255,255,.16)'); glare.addColorStop(0.5, 'rgba(255,255,255,0)');
      ctx.fillStyle = glare; ctx.beginPath(); ctx.arc(CX, CY, R + 8, Math.PI * 1.05, Math.PI * 1.75); ctx.lineTo(CX, CY); ctx.closePath(); ctx.fill();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [car]);

  return <canvas ref={ref} width={W} height={H} className="w-full" role="img" aria-label={`${car.name} speedometer ${reading.speed.toFixed(0)} km/h gear ${reading.gear}${reading.rpm === null ? '' : ` rpm ${reading.rpm.toFixed(1)}`}`} />;
}
