'use client';

import { useEffect, useRef } from 'react';
import { dollyAmount, dollyCamera, project, type DollyCamera } from '@/lib/dollyZoom';
import { FAMI_PALETTE, SPRITES, type Sprite } from '@/lib/famiSprites';
import { STATIONS, STATIONS_N, type GameState } from '@/lib/gaikotsu';

const W = 760; const H = 420;
const D0 = 16; const F0 = W * 1.6;
const EFFECT_MS = 1900;
const BEAT_MS = 400; // pixel ↔ realism swap; 2.5 Hz, under the 3 Hz flash limit

const stationXZ = (id: number): [number, number] => {
  const a = -Math.PI / 2 + (id / STATIONS_N) * Math.PI * 2;
  return [6 * Math.cos(a), 3.3 * Math.sin(a)];
};

const gray = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  return `rgb(${v},${v},${v})`;
};

function drawSprite(ctx: CanvasRenderingContext2D, sprite: Sprite, cx: number, cy: number, px: number) {
  const w = sprite.rows[0].length; const h = sprite.rows.length;
  sprite.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    ctx.fillStyle = gray(FAMI_PALETTE[ch] ?? '#ffffff');
    ctx.fillRect(Math.round(cx + (x - w / 2) * px), Math.round(cy + (y - h) * px), Math.ceil(px), Math.ceil(px));
  }));
}

/** The "realism" insert: a shaded skull with soft sockets and a jaw. */
function drawRealSkull(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const r = size / 2;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(cx + r * 0.15, cy + r * 0.05, r * 0.9, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 1.5, r * 0.1, cx, cy - r, r * 1.2);
  g.addColorStop(0, '#ffffff'); g.addColorStop(0.6, '#cfcfcf'); g.addColorStop(1, '#5c5c5c');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy - r * 1.1, r * 0.85, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(cx - r * 0.45, cy - r * 0.6, r * 0.9, r * 0.5);
  for (const sx of [-1, 1]) {
    const s = ctx.createRadialGradient(cx + sx * r * 0.32, cy - r * 1.05, 1, cx + sx * r * 0.32, cy - r * 1.05, r * 0.28);
    s.addColorStop(0, '#000'); s.addColorStop(1, '#3a3a3a');
    ctx.fillStyle = s; ctx.beginPath(); ctx.ellipse(cx + sx * r * 0.32, cy - r * 1.05, r * 0.24, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.85); ctx.lineTo(cx - r * 0.1, cy - r * 0.62); ctx.lineTo(cx + r * 0.1, cy - r * 0.62); ctx.fill();
  ctx.strokeStyle = '#222'; ctx.lineWidth = Math.max(1, r * 0.05);
  for (let i = -2; i <= 2; i += 1) { ctx.beginPath(); ctx.moveTo(cx + i * r * 0.15, cy - r * 0.55); ctx.lineTo(cx + i * r * 0.15, cy - r * 0.15); ctx.stroke(); }
  ctx.restore();
}

function polygon(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, sides: number, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i <= sides; i += 1) { const a = rot + (i / sides) * Math.PI * 2; ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a) * 0.6); }
}

export default function GaikotsuBoard({ state }: { state: GameState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef(state);
  live.current = state;

  useEffect(() => {
    const canvas = canvasRef.current; const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;
    const frame = (now: number) => {
      const s = live.current;
      const eff = s.effect;
      const t = eff && !reduced ? Math.min(1, (performance.now() - eff.at) / EFFECT_MS) : 1;
      const subject = eff ? eff.station : s.players[s.current].pos;
      const [sx, sz] = stationXZ(subject);
      const near = eff?.kind === 'dolly' ? 7.5 : 2.8;
      // At rest the camera frames the whole loop; the shot pushes in on the subject station.
      const e = eff && t < 1 && eff.kind !== 'cats' ? dollyAmount(t) : 0;
      const d = D0 + (near - D0) * e;
      const cam: DollyCamera = dollyCamera(sx * e, sz * e, d, D0, F0);
      const zooming = e > 0.02;

      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      // Floor grid (stretches during the dolly zoom).
      ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 1;
      for (let gx = -10; gx <= 10; gx += 1) {
        const a = project(cam, gx, 0, -6, W, H); const b = project(cam, gx, 0, 8, W, H);
        if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      for (let gz = -6; gz <= 8; gz += 1) {
        const a = project(cam, -10, 0, gz, W, H); const b = project(cam, 10, 0, gz, W, H);
        if (a && b) { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      }
      // Rail.
      ctx.strokeStyle = '#d4d4d4'; ctx.lineWidth = 2; ctx.beginPath();
      let pen = false;
      for (let i = 0; i <= STATIONS_N * 4; i += 1) {
        const a = -Math.PI / 2 + (i / (STATIONS_N * 4)) * Math.PI * 2;
        const p = project(cam, 6 * Math.cos(a), 0, 3.3 * Math.sin(a), W, H);
        if (!p) { pen = false; continue; } // behind the camera: lift the pen
        if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
        pen = true;
      }
      ctx.stroke();

      // Stations, far first.
      const order = STATIONS.map((st) => st.id).sort((a, b) => stationXZ(b)[1] - stationXZ(a)[1]);
      for (const id of order) {
        const [x, z] = stationXZ(id); const p = project(cam, x, 0, z, W, H);
        if (!p) continue;
        const st = STATIONS[id]; const r = Math.min(80, 0.45 * p.s);
        const owner = s.owner[id];
        ctx.lineWidth = Math.max(1, r * 0.08); ctx.strokeStyle = '#fff';
        if (st.kind === 'wheel') {
          ctx.beginPath(); ctx.ellipse(p.x, p.y, r, r * 0.6, 0, 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill(); ctx.stroke();
          for (let k = 0; k < 8; k += 1) { const a = (k / 8) * Math.PI * 2 + now / 900; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + r * Math.cos(a), p.y + r * 0.6 * Math.sin(a)); ctx.stroke(); }
        } else if (st.kind === 'death') {
          drawSprite(ctx, SPRITES.skull, p.x, p.y + r * 0.4, Math.max(1, r / 6));
        } else if (st.kind === 'devil') {
          ctx.fillStyle = '#000'; polygon(ctx, p.x, p.y, r, 3, Math.PI / 2); ctx.fill(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(p.x - r * 0.6, p.y - r * 0.3); ctx.lineTo(p.x - r * 0.9, p.y - r); ctx.lineTo(p.x - r * 0.3, p.y - r * 0.45); ctx.moveTo(p.x + r * 0.6, p.y - r * 0.3); ctx.lineTo(p.x + r * 0.9, p.y - r); ctx.lineTo(p.x + r * 0.3, p.y - r * 0.45); ctx.stroke();
        } else {
          const sides = st.kind === 'start' ? 12 : 3 + (id % 5);
          ctx.fillStyle = owner === 'you' ? '#fff' : owner === 'obaa' ? '#777' : '#000';
          polygon(ctx, p.x, p.y, r, sides); ctx.fill(); ctx.stroke();
          if (st.kind === 'start') { polygon(ctx, p.x, p.y, r * 0.6, sides); ctx.stroke(); }
        }
      }

      // Galaxy super effect around the wheel.
      if (eff?.kind === 'galaxy' && t < 1) {
        const [gx, gz] = stationXZ(eff.station); const c = project(cam, gx, 0, gz, W, H);
        if (c) for (let arm = 0; arm < 3; arm += 1) for (let i = 0; i < 70; i += 1) {
          const a = arm * 2.094 + i * 0.16 + now / 500; const rr = (i / 70) * Math.min(260, c.s * 1.6);
          ctx.fillStyle = `rgba(255,255,255,${(1 - i / 70) * 0.9 * (1 - t * 0.6)})`;
          ctx.fillRect(c.x + rr * Math.cos(a), c.y + rr * 0.6 * Math.sin(a), 2, 2);
        }
      }
      // The devil darkens the frame (a slow vignette, no flashing).
      if (eff?.kind === 'devil' && t < 1) {
        const v = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, W * 0.7);
        v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${0.85 * Math.sin(t * Math.PI)})`);
        ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      }

      // Tokens.
      (['obaa', 'you'] as const).forEach((pid, k) => {
        const [x, z] = stationXZ(s.players[pid].pos); const p = project(cam, x + (k ? 0.35 : -0.35), 0, z, W, H);
        if (!p) return;
        const px = Math.max(1.5, Math.min(9, p.s / 26));
        const isSubject = zooming && s.players[pid].pos === subject;
        const real = isSubject && Math.floor(performance.now() / BEAT_MS) % 2 === 1;
        if (real) drawRealSkull(ctx, p.x, p.y, px * 12); else drawSprite(ctx, pid === 'you' ? SPRITES.skull : SPRITES.obaa, p.x, p.y, px);
        if (s.devil.rider === pid) { ctx.fillStyle = '#fff'; ctx.font = `${Math.round(px * 5)}px monospace`; ctx.textAlign = 'center'; ctx.fillText('XV', p.x, p.y - px * 14); }
      });

      // A swarm of cats (animal resource) crosses the frame.
      if (eff?.kind === 'cats' && t < 1) {
        for (let i = 0; i < (eff.cats ?? 12); i += 1) {
          const x = -60 + ((t * 1.3 + (i * 0.137) % 1) % 1.2) * (W + 120);
          const y = H - 40 - (i % 4) * 22 - Math.abs(Math.sin(now / 120 + i)) * 6;
          drawSprite(ctx, SPRITES.cat, x, y, 2.4);
        }
      }

      ctx.fillStyle = '#fff'; ctx.font = '13px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`${STATIONS[subject].name}${zooming ? ' · SUPER DOLLY ZOOM' : ''}`, 12, H - 12);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} width={W} height={H} className="w-full border-4 border-white bg-black" role="img" aria-label="骸骨電鉄 board" />;
}
