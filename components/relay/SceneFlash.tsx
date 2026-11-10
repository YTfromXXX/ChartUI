'use client';

import { useEffect, useRef, useState } from 'react';
import { edgeImage, edgePoints, sobel } from '@/lib/edgeLite';
import { mulberry32 } from '@/lib/retroGrid';
import type { Vehicle } from '@/lib/relayFlight';
import { SUBJECT_LABEL, type Prop, type SceneSpec } from '@/lib/sceneSpec';

/**
 * TEXT → one-frame picture, seen through the cabin window. The scene is painted procedurally from
 * a keyword spec (no network, no model) into an offscreen canvas, then revealed in three beats:
 * Sobel line art of the whole frame and a traced outline of the subject (cat, teacup, …), the
 * exposure coming up, and a live layer (lamp flicker, steam, blinking eyes, passing cloud, film
 * grain). With reduced motion it shows the finished frame at once.
 */
const W = 640; const H = 400; const HY = 272; // horizon
type Light = { x: number; y: number; r: number; c: string; flicker: boolean };
type Rand = () => number;

const SKY: Record<SceneSpec['time'], string[]> = {
  night: ['#050916', '#101b38', '#2c2746'],
  dusk: ['#18224a', '#7d4466', '#e59a5a'],
  day: ['#5a8fbf', '#a8cbe0', '#efe2c2'],
};
const FAR: Record<SceneSpec['time'], string> = { night: '#161a36', dusk: '#4a2f48', day: '#7d93a3' };
const AMBIENT: Record<SceneSpec['time'], string> = { night: '#6a74a0', dusk: '#d8b2a6', day: '#f7f4ee' };

export const WINDOW: Record<Vehicle, { x: number; y: number; w: number; h: number; r: number }> = {
  plane: { x: 96, y: 18, w: 448, h: 364, r: 150 },
  bus: { x: 26, y: 46, w: 588, h: 308, r: 16 },
};

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const q = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + q, y); ctx.arcTo(x + w, y, x + w, y + h, q); ctx.arcTo(x + w, y + h, x, y + h, q); ctx.arcTo(x, y + h, x, y, q); ctx.arcTo(x, y, x + w, y, q); ctx.closePath();
}
const lin = (ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, stops: string[]) => {
  const g = ctx.createLinearGradient(x0, y0, x1, y1); stops.forEach((c, i) => g.addColorStop(i / Math.max(1, stops.length - 1), c)); return g;
};

/** Body colour (top → bottom) per subject; architecture stays a backlit silhouette. */
const MATERIAL: Partial<Record<Prop, [string, string]>> = {
  teatable: ['#fbfaf6', '#bdb6a8'], clock: ['#d9b765', '#6a5020'], rabbit: ['#f1eee8', '#9c958a'], mushroom: ['#c23a2e', '#5a1410'], cat: ['#3a3440', '#100e14'],
  lamp: ['#e6bb60', '#6a4a1a'], desk: ['#e6bb60', '#6a4a1a'], bazaar: ['#e6bb60', '#6a4a1a'], crown: ['#f0cf6a', '#8a6418'], hat: ['#3a3a3a', '#0e0e0e'],
  sword: ['#e2e7ec', '#5a6068'], book: ['#efe6cc', '#a08a60'], door: ['#6a4428', '#2a180c'], cards: ['#fbf8f0', '#cfc8b8'],
};

/** Subject silhouettes: one path definition used for both the painting and the edge mask. */
const POS: Partial<Record<Prop, { x: number; y: number; s: number }>> = {
  mosque: { x: 320, y: HY, s: 1.15 }, palace: { x: 320, y: HY, s: 1 }, teatable: { x: 320, y: 326, s: 1.15 }, clock: { x: 470, y: 230, s: 0.85 },
  door: { x: 140, y: 300, s: 1 }, tunnel: { x: 320, y: 200, s: 1 }, sea: { x: 460, y: 90, s: 1 }, forest: { x: 170, y: 330, s: 1 },
  desert: { x: 320, y: 290, s: 1 }, carpet: { x: 320, y: 372, s: 1 }, cards: { x: 250, y: 352, s: 1 }, book: { x: 250, y: 336, s: 1 },
  bazaar: { x: 210, y: 150, s: 1 }, lamp: { x: 210, y: 300, s: 1 }, desk: { x: 210, y: 300, s: 1 }, crown: { x: 320, y: 220, s: 1 }, hat: { x: 330, y: 320, s: 1 },
};
const posOf = (p: Prop) => POS[p] ?? { x: 410, y: 344, s: 1 };

function silhouette(ctx: CanvasRenderingContext2D, p: Prop, x: number, y: number, s: number) {
  ctx.beginPath();
  const ell = (cx: number, cy: number, rx: number, ry: number, rot = 0) => { ctx.moveTo(cx + rx * Math.cos(rot), cy + rx * Math.sin(rot)); ctx.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2); };
  const tri = (pts: number[]) => { ctx.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.closePath(); };
  switch (p) {
    case 'cat':
      ell(x, y - 40 * s, 34 * s, 42 * s); ell(x + 18 * s, y - 92 * s, 22 * s, 20 * s);
      tri([x + 2 * s, y - 100 * s, x + 6 * s, y - 128 * s, x + 20 * s, y - 108 * s]); tri([x + 22 * s, y - 110 * s, x + 36 * s, y - 130 * s, x + 40 * s, y - 100 * s]);
      ctx.moveTo(x - 26 * s, y - 6 * s); ctx.bezierCurveTo(x - 80 * s, y - 4 * s, x - 76 * s, y - 60 * s, x - 56 * s, y - 72 * s);
      ctx.bezierCurveTo(x - 66 * s, y - 54 * s, x - 70 * s, y - 16 * s, x - 22 * s, y - 16 * s); ctx.closePath();
      break;
    case 'rabbit':
      ell(x, y - 38 * s, 26 * s, 38 * s); ell(x + 6 * s, y - 84 * s, 17 * s, 16 * s);
      ell(x - 3 * s, y - 120 * s, 6 * s, 26 * s, -0.18); ell(x + 13 * s, y - 118 * s, 6 * s, 26 * s, 0.22);
      break;
    case 'teatable':
      ell(x, y, 50 * s, 10 * s);
      ctx.moveTo(x - 34 * s, y - 46 * s); ctx.bezierCurveTo(x - 34 * s, y - 10 * s, x - 18 * s, y - 4 * s, x, y - 4 * s); ctx.bezierCurveTo(x + 18 * s, y - 4 * s, x + 34 * s, y - 10 * s, x + 34 * s, y - 46 * s); ctx.closePath();
      ctx.moveTo(x + 32 * s, y - 38 * s); ctx.bezierCurveTo(x + 56 * s, y - 40 * s, x + 54 * s, y - 14 * s, x + 28 * s, y - 16 * s); ctx.lineTo(x + 30 * s, y - 22 * s); ctx.bezierCurveTo(x + 46 * s, y - 22 * s, x + 46 * s, y - 34 * s, x + 32 * s, y - 32 * s); ctx.closePath();
      break;
    case 'clock': ell(x, y - 56 * s, 52 * s, 52 * s); ctx.rect(x - 7 * s, y - 120 * s, 14 * s, 14 * s); break;
    case 'crown': tri([x - 50 * s, y, x - 56 * s, y - 56 * s, x - 26 * s, y - 28 * s, x, y - 66 * s, x + 26 * s, y - 28 * s, x + 56 * s, y - 56 * s, x + 50 * s, y]); break;
    case 'hat': ell(x, y - 6 * s, 52 * s, 10 * s); ctx.rect(x - 30 * s, y - 84 * s, 60 * s, 78 * s); break;
    case 'lamp': case 'desk':
      ell(x, y - 8 * s, 30 * s, 8 * s); ctx.moveTo(x - 10 * s, y - 8 * s); ctx.lineTo(x - 18 * s, y - 50 * s); ctx.lineTo(x + 18 * s, y - 50 * s); ctx.lineTo(x + 10 * s, y - 8 * s); ctx.closePath();
      ell(x, y - 62 * s, 16 * s, 18 * s); break;
    case 'mosque': {
      const dome = (cx: number, cy: number, rx: number, ry: number) => { ctx.moveTo(cx - rx, cy); ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); ctx.closePath(); };
      ctx.rect(x - 112 * s, y - 58 * s, 224 * s, 58 * s);
      ctx.rect(x - 78 * s, y - 70 * s, 156 * s, 14 * s); dome(x, y - 68 * s, 70 * s, 64 * s);
      ctx.rect(x - 2 * s, y - 150 * s, 4 * s, 20 * s); ell(x, y - 154 * s, 4 * s, 4 * s);
      dome(x - 86 * s, y - 56 * s, 28 * s, 24 * s); dome(x + 86 * s, y - 56 * s, 28 * s, 24 * s);
      for (const dx of [-150, 150]) {
        ctx.rect(x + (dx - 6) * s, y - 196 * s, 12 * s, 196 * s); ctx.rect(x + (dx - 10) * s, y - 150 * s, 20 * s, 5 * s); ctx.rect(x + (dx - 9) * s, y - 104 * s, 18 * s, 4 * s);
        tri([x + (dx - 7) * s, y - 196 * s, x + dx * s, y - 236 * s, x + (dx + 7) * s, y - 196 * s]);
      }
      break;
    }
    case 'palace': for (let i = -3; i <= 3; i += 1) { ctx.rect(x + i * 44 * s - 8 * s, y - 90 * s, 16 * s, 90 * s); } ctx.rect(x - 150 * s, y - 106 * s, 300 * s, 18 * s); break;
    case 'book': tri([x - 60 * s, y, x - 56 * s, y - 34 * s, x, y - 26 * s, x + 56 * s, y - 34 * s, x + 60 * s, y, x, y + 6 * s]); break;
    case 'sword': ctx.rect(x - 3 * s, y - 150 * s, 6 * s, 120 * s); ctx.rect(x - 24 * s, y - 32 * s, 48 * s, 6 * s); ctx.rect(x - 4 * s, y - 26 * s, 8 * s, 26 * s); break;
    case 'mushroom': ctx.moveTo(x - 60 * s, y - 60 * s); ctx.bezierCurveTo(x - 60 * s, y - 130 * s, x + 60 * s, y - 130 * s, x + 60 * s, y - 60 * s); ctx.closePath(); ctx.rect(x - 14 * s, y - 62 * s, 28 * s, 62 * s); break;
    case 'door': ctx.moveTo(x - 34 * s, y); ctx.lineTo(x - 34 * s, y - 80 * s); ctx.arc(x, y - 80 * s, 34 * s, Math.PI, 0); ctx.lineTo(x + 34 * s, y); ctx.closePath(); break;
    case 'forest': ctx.rect(x - 10 * s, y - 120 * s, 20 * s, 120 * s); ell(x, y - 150 * s, 60 * s, 54 * s); break;
    case 'tunnel': ell(x, y, 120 * s, 90 * s); break;
    case 'sea': ell(x, y, 28 * s, 28 * s); break;
    case 'desert': ctx.moveTo(x - 220 * s, y); ctx.bezierCurveTo(x - 80 * s, y - 70 * s, x + 60 * s, y - 70 * s, x + 220 * s, y); ctx.closePath(); break;
    case 'carpet': tri([x - 120 * s, y, x - 80 * s, y - 50 * s, x + 80 * s, y - 50 * s, x + 120 * s, y]); break;
    case 'cards': ctx.rect(x - 22 * s, y - 64 * s, 44 * s, 64 * s); break;
    case 'bazaar': ctx.moveTo(x, y - 30 * s); ctx.lineTo(x, y - 18 * s); ell(x, y, 16 * s, 20 * s); break;
    default: ell(x, y - 30 * s, 30 * s, 30 * s);
  }
}

/** Paint the static scene. Returns the light sources and the eye position for the live layer. */
function paint(ctx: CanvasRenderingContext2D, spec: SceneSpec, r: Rand) {
  const lights: Light[] = [];
  const has = (p: Prop) => spec.props.includes(p);
  const far = FAR[spec.time];
  // Sky (also behind interiors, seen through an arch).
  ctx.fillStyle = lin(ctx, 0, 0, 0, HY, SKY[spec.time]); ctx.fillRect(0, 0, W, H);
  if (spec.time === 'night') {
    for (let i = 0; i < 140; i += 1) { ctx.fillStyle = `rgba(255,255,240,${0.2 + r() * 0.6})`; ctx.fillRect(r() * W, r() * HY * 0.9, r() < 0.1 ? 1.6 : 0.9, r() < 0.1 ? 1.6 : 0.9); }
  }
  if (spec.time !== 'day') {
    const mx = 470; const my = spec.time === 'night' ? 86 : 150;
    const g = ctx.createRadialGradient(mx, my, 10, mx, my, 120); g.addColorStop(0, 'rgba(255,240,210,.45)'); g.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = spec.time === 'night' ? '#f4ecd8' : '#ffd9a0'; ctx.beginPath(); ctx.arc(mx, my, 24, 0, Math.PI * 2); ctx.fill();
    if (spec.time === 'night') { ctx.fillStyle = 'rgba(160,150,130,.25)'; ctx.beginPath(); ctx.arc(mx - 7, my - 4, 6, 0, Math.PI * 2); ctx.arc(mx + 8, my + 7, 4, 0, Math.PI * 2); ctx.fill(); }
  }
  // Far layer (exterior): sea, desert, skyline, forest — softened by distance.
  ctx.save(); ctx.filter = 'blur(1.2px)';
  if (has('sea')) {
    ctx.fillStyle = lin(ctx, 0, HY - 10, 0, H, ['#0e1a33', '#09101f']); ctx.fillRect(0, HY - 10, W, H);
    for (let i = 0; i < 60; i += 1) { ctx.fillStyle = `rgba(255,230,190,${0.05 + r() * 0.2})`; const y = HY + r() * 110; ctx.fillRect(440 + (r() - 0.5) * (30 + (y - HY)), y, 8 + r() * 30, 1.2); }
  }
  if (has('desert')) { ctx.fillStyle = lin(ctx, 0, HY - 40, 0, H, ['#b07a52', '#5b3a2a']); ctx.beginPath(); ctx.moveTo(0, HY); for (let x = 0; x <= W; x += 40) ctx.quadraticCurveTo(x + 20, HY - 30 - r() * 30, x + 40, HY - 4); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.fill(); }
  if (has('forest')) for (let i = 0; i < 14; i += 1) { const x = r() * W; ctx.fillStyle = far; ctx.fillRect(x, HY - 160 - r() * 60, 8 + r() * 10, 230); ctx.beginPath(); ctx.ellipse(x + 6, HY - 170 - r() * 60, 40 + r() * 30, 34 + r() * 20, 0, 0, Math.PI * 2); ctx.fill(); }
  if (spec.world === 'ottoman' && spec.subject !== 'mosque') { ctx.fillStyle = far; silhouette(ctx, 'mosque', 140, HY, 0.55); ctx.fill(); silhouette(ctx, 'mosque', 520, HY, 0.4); ctx.fill(); }
  ctx.restore();
  // Ground or interior.
  if (spec.interior) {
    const wall = spec.world === 'ottoman' ? ['#0f3a40', '#08201f'] : ['#2f4a3a', '#1b2b22'];
    ctx.fillStyle = lin(ctx, 0, 0, 0, 290, wall);
    ctx.beginPath(); ctx.rect(0, 0, W, 292); ctx.moveTo(250, 250); ctx.lineTo(250, 120); ctx.arc(320, 120, 70, Math.PI, 0); ctx.lineTo(390, 250); ctx.closePath(); ctx.fill('evenodd'); // arched opening to the sky
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(250, 250); ctx.lineTo(250, 120); ctx.arc(320, 120, 70, Math.PI, 0); ctx.lineTo(390, 250); ctx.stroke();
    ctx.globalAlpha = 0.12; ctx.strokeStyle = spec.world === 'ottoman' ? '#9fe0d6' : '#d7e4b0'; ctx.lineWidth = 1;
    for (let y = 20; y < 280; y += 34) for (let x = (y / 34) % 2 ? 17 : 0; x < W; x += 34) {
      if (x > 240 && x < 400 && y > 40 && y < 260) continue;
      ctx.beginPath(); if (spec.world === 'ottoman') { ctx.rect(x - 7, y - 7, 14, 14); ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.rect(-7, -7, 14, 14); ctx.restore(); } else ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = lin(ctx, 0, 290, 0, H, spec.world === 'ottoman' ? ['#3a2318', '#1a0f0a'] : ['#4a3626', '#20160e']); ctx.fillRect(0, 290, W, H - 290);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; for (let i = -10; i <= 10; i += 1) { ctx.beginPath(); ctx.moveTo(320 + i * 14, 290); ctx.lineTo(320 + i * 80, H); ctx.stroke(); }
  } else if (!has('sea') && !has('desert')) {
    ctx.fillStyle = lin(ctx, 0, HY, 0, H, spec.world === 'ottoman' ? ['#2b2230', '#120d12'] : ['#29402c', '#0f1a10']); ctx.fillRect(0, HY, W, H - HY);
  }
  // Mid layer.
  if (has('palace') && spec.subject !== 'palace') { ctx.fillStyle = far; silhouette(ctx, 'palace', 320, HY, 0.8); ctx.fill(); }
  if (has('bazaar')) for (let i = 0; i < 5; i += 1) {
    const x = 60 + i * 130; ctx.fillStyle = i % 2 ? '#7a1f2b' : '#c48a3a'; ctx.beginPath(); ctx.moveTo(x - 50, 250); ctx.lineTo(x + 50, 250); ctx.lineTo(x + 60, 280); ctx.lineTo(x - 60, 280); ctx.fill();
    lights.push({ x, y: 240, r: 60, c: 'rgba(255,170,80,', flicker: true });
  }
  if (has('teatable')) {
    ctx.fillStyle = lin(ctx, 0, 300, 0, 360, ['#f4f1ea', '#c9c3b6']); ctx.beginPath(); ctx.moveTo(90, 300); ctx.lineTo(550, 300); ctx.lineTo(620, 372); ctx.lineTo(20, 372); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,110,100,.25)'; for (let i = 0; i < 9; i += 1) { ctx.beginPath(); ctx.moveTo(40 + i * 70, 372); ctx.lineTo(40 + i * 70, 400); ctx.stroke(); }
    ctx.fillStyle = '#d8d2c4'; ctx.fillRect(20, 372, 600, 28);
    for (const [cx, sc] of [[150, 0.55], [470, 0.6], [230, 0.45]] as const) cup(ctx, cx, 322, sc);
  }
  if (has('desk') || (has('lamp') && spec.interior)) {
    ctx.fillStyle = lin(ctx, 0, 300, 0, 400, ['#5a3a22', '#2a1a10']); ctx.fillRect(40, 300, 560, 100);
    ctx.fillStyle = 'rgba(240,230,200,.85)'; ctx.save(); ctx.translate(360, 330); ctx.rotate(-0.08); ctx.fillRect(-70, -18, 140, 50); ctx.restore(); // paper / miniature
    ctx.strokeStyle = '#7a0f22'; ctx.lineWidth = 1; ctx.strokeRect(300, 318, 110, 34);
  }
  if (has('carpet') && spec.subject !== 'carpet') { ctx.fillStyle = '#6e1420'; silhouette(ctx, 'carpet', 320, 396, 1.1); ctx.fill(); ctx.strokeStyle = '#d4a24a'; ctx.lineWidth = 2; ctx.stroke(); }
  if (has('mushroom') && spec.subject !== 'mushroom') { ctx.fillStyle = '#7a2a22'; silhouette(ctx, 'mushroom', 540, 380, 0.7); ctx.fill(); }
  if (has('cards') && spec.subject !== 'cards') for (let i = 0; i < 4; i += 1) { ctx.save(); ctx.translate(480 + i * 26, 360); ctx.rotate(-0.4 + i * 0.25); ctx.fillStyle = '#f7f3ea'; ctx.fillRect(-14, -40, 28, 40); ctx.fillStyle = '#c0102a'; ctx.font = '14px serif'; ctx.fillText('♥', -6, -16); ctx.restore(); }
  // Subject: dark body with a rim light on the side of the key light.
  const sp = posOf(spec.subject);
  const off = document.createElement('canvas'); off.width = W; off.height = H; const o = off.getContext('2d')!;
  o.fillStyle = lin(o, 0, sp.y - 140 * sp.s, 0, sp.y, (MATERIAL[spec.subject] ?? ['#2a2430', '#0a080c']));
  silhouette(o, spec.subject, sp.x, sp.y, sp.s); o.fill('nonzero');
  o.globalCompositeOperation = 'source-atop'; o.fillStyle = spec.time === 'day' ? 'rgba(255,255,255,.55)' : 'rgba(255,215,160,.8)';
  o.fillRect(0, 0, W, H); o.globalCompositeOperation = 'destination-out'; silhouette(o, spec.subject, sp.x + 3, sp.y + 2, sp.s); o.fill();
  // Re-fill the body (destination-out removed it) and keep only the crescent rim on top.
  const body = document.createElement('canvas'); body.width = W; body.height = H; const b = body.getContext('2d')!;
  b.fillStyle = lin(b, 0, sp.y - 140 * sp.s, 0, sp.y, (MATERIAL[spec.subject] ?? ['#2a2430', '#0a080c']));
  silhouette(b, spec.subject, sp.x, sp.y, sp.s); b.fill();
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetX = 6; ctx.shadowOffsetY = 6; ctx.drawImage(body, 0, 0); ctx.restore();
  ctx.drawImage(off, 0, 0);
  if (spec.subject === 'clock') {
    ctx.strokeStyle = '#2a2015'; ctx.lineWidth = 2; const cy = sp.y - 56 * sp.s;
    ctx.fillStyle = '#f2ead6'; ctx.beginPath(); ctx.arc(sp.x, cy, 44 * sp.s, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 12; i += 1) { const a = (i / 12) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(sp.x + Math.cos(a) * 36 * sp.s, cy + Math.sin(a) * 36 * sp.s); ctx.lineTo(sp.x + Math.cos(a) * 42 * sp.s, cy + Math.sin(a) * 42 * sp.s); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(sp.x, cy); ctx.lineTo(sp.x + 22 * sp.s, cy - 18 * sp.s); ctx.moveTo(sp.x, cy); ctx.lineTo(sp.x - 6 * sp.s, cy - 34 * sp.s); ctx.stroke();
  }
  if ((spec.subject === 'mosque' || spec.subject === 'palace') && spec.time !== 'day') {
    for (let i = -4; i <= 4; i += 1) {
      const wx = sp.x + i * 22 * sp.s; const wy = sp.y - 40 * sp.s;
      if (r() < 0.25) continue;
      ctx.fillStyle = '#ffcf7a'; ctx.beginPath(); ctx.moveTo(wx - 3 * sp.s, wy + 10 * sp.s); ctx.lineTo(wx - 3 * sp.s, wy); ctx.arc(wx, wy, 3 * sp.s, Math.PI, 0); ctx.lineTo(wx + 3 * sp.s, wy + 10 * sp.s); ctx.fill();
      lights.push({ x: wx, y: wy + 4, r: 26, c: 'rgba(255,190,110,', flicker: true });
    }
  }
  if (spec.subject === 'mushroom') { ctx.fillStyle = 'rgba(255,250,240,.9)'; for (const [dx, dy, rr2] of [[-30, -90, 8], [8, -104, 10], [36, -80, 7], [-6, -76, 5]]) { ctx.beginPath(); ctx.ellipse(sp.x + dx * sp.s, sp.y + dy * sp.s, rr2 * sp.s, rr2 * 0.7 * sp.s, 0, 0, Math.PI * 2); ctx.fill(); } }
  if (spec.subject === 'teatable') { ctx.fillStyle = '#5a2a12'; ctx.beginPath(); ctx.ellipse(sp.x, sp.y - 46 * sp.s, 30 * sp.s, 6 * sp.s, 0, 0, Math.PI * 2); ctx.fill(); }
  if (has('lamp') || has('desk')) { const lp = posOf('lamp'); if (spec.subject !== 'lamp' && spec.subject !== 'desk') { ctx.fillStyle = '#b8862e'; silhouette(ctx, 'lamp', lp.x, lp.y, 0.8); ctx.fill(); } lights.push({ x: lp.x, y: lp.y - 64, r: 190, c: 'rgba(255,170,80,', flicker: true }); }
  if (spec.time !== 'day') lights.push({ x: 470, y: spec.time === 'night' ? 86 : 150, r: 260, c: 'rgba(200,210,255,', flicker: false });
  // Ambient grade and vignette.
  ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = AMBIENT[spec.time]; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
  const v = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 420); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.6)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  const eye = spec.subject === 'cat' ? { x: sp.x + 24 * sp.s, y: sp.y - 94 * sp.s, s: sp.s } : spec.subject === 'rabbit' ? { x: sp.x + 12 * sp.s, y: sp.y - 86 * sp.s, s: sp.s } : null;
  const steam = spec.props.includes('teatable') ? posOf('teatable') : null;
  return { lights, eye, steam, sp };
}

function cup(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
  ctx.fillStyle = lin(ctx, 0, y - 46 * s, 0, y, ['#fbfaf6', '#b9b2a4']); silhouette(ctx, 'teatable', x, y, s); ctx.fill(); ctx.restore();
  ctx.fillStyle = '#5a2a12'; ctx.beginPath(); ctx.ellipse(x, y - 46 * s, 30 * s, 6 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#b08a3a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, y - 46 * s, 34 * s, 8 * s, 0, 0, Math.PI * 2); ctx.stroke();
}

export default function SceneFlash({ spec, vehicle, onTiming }: { spec: SceneSpec; vehicle: Vehicle; onTiming?: (ms: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [label, setLabel] = useState('');
  const timing = useRef(onTiming); timing.current = onTiming;

  useEffect(() => {
    const canvas = ref.current; const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    // 1) Paint the frame offscreen and time it.
    const t0 = performance.now();
    const base = document.createElement('canvas'); base.width = W; base.height = H;
    const b = base.getContext('2d')!;
    const info = paint(b, spec, mulberry32(spec.seed));
    // 2) Sobel line art of the whole frame at half size.
    const sw = W / 2; const sh = H / 2;
    const small = document.createElement('canvas'); small.width = sw; small.height = sh; const s = small.getContext('2d')!;
    s.drawImage(base, 0, 0, sw, sh);
    const lineArt = document.createElement('canvas'); lineArt.width = sw; lineArt.height = sh;
    lineArt.getContext('2d')!.putImageData(edgeImage(sobel(s.getImageData(0, 0, sw, sh).data, sw, sh), 40, [170, 230, 255]), 0, 0);
    // 3) The subject's own outline from its mask.
    s.fillStyle = '#000'; s.fillRect(0, 0, sw, sh); s.fillStyle = '#fff'; s.save(); s.scale(0.5, 0.5); silhouette(s, spec.subject, info.sp.x, info.sp.y, info.sp.s); s.fill(); s.restore();
    const outline = edgePoints(sobel(s.getImageData(0, 0, sw, sh).data, sw, sh), 200);
    const ms = performance.now() - t0;
    timing.current?.(ms);
    setLabel(`${SUBJECT_LABEL[spec.subject]} · 輪郭 ${outline.pts.length} px · 描画 ${ms.toFixed(1)} ms`);

    // Cabin chrome around the window.
    const win = WINDOW[vehicle];
    const chrome = document.createElement('canvas'); chrome.width = W; chrome.height = H; const c = chrome.getContext('2d')!;
    c.fillStyle = lin(c, 0, 0, W, H, ['#e6e8eb', '#c4c9cf', '#aeb4bb']);
    c.beginPath(); c.rect(0, 0, W, H); rr(c, win.x, win.y, win.w, win.h, win.r); c.fill('evenodd');
    c.save(); c.beginPath(); c.rect(0, 0, W, H); rr(c, win.x, win.y, win.w, win.h, win.r); c.clip('evenodd');
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 22; c.strokeStyle = '#8d949c'; c.lineWidth = 16; c.beginPath(); rr(c, win.x - 8, win.y - 8, win.w + 16, win.h + 16, win.r + 8); c.stroke(); c.restore();
    c.strokeStyle = vehicle === 'bus' ? '#1b1b1b' : '#d7dadf'; c.lineWidth = vehicle === 'bus' ? 7 : 3; c.beginPath(); rr(c, win.x, win.y, win.w, win.h, win.r); c.stroke();
    if (vehicle === 'plane') { c.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 6; i += 1) { c.beginPath(); c.arc(30, 40 + i * 64, 3, 0, Math.PI * 2); c.arc(W - 30, 40 + i * 64, 3, 0, Math.PI * 2); c.fill(); } }
    const glare = c.createLinearGradient(win.x, win.y, win.x + win.w * 0.7, win.y + win.h); glare.addColorStop(0, 'rgba(255,255,255,.16)'); glare.addColorStop(0.4, 'rgba(255,255,255,0)'); glare.addColorStop(1, 'rgba(255,255,255,.05)');
    c.save(); c.beginPath(); rr(c, win.x, win.y, win.w, win.h, win.r); c.clip(); c.fillStyle = glare; c.fillRect(0, 0, W, H); c.restore();

    // Film grain tile.
    const grain = document.createElement('canvas'); grain.width = 128; grain.height = 128; const g = grain.getContext('2d')!;
    const gd = g.createImageData(128, 128); const gr = mulberry32(spec.seed ^ 0x5bd1);
    for (let i = 0; i < gd.data.length; i += 4) { const v = gr() * 255; gd.data[i] = v; gd.data[i + 1] = v; gd.data[i + 2] = v; gd.data[i + 3] = 255; }
    g.putImageData(gd, 0, 0);
    const grainPattern = ctx.createPattern(grain, 'repeat');

    const start = performance.now(); let raf = 0;
    const frame = (now: number) => {
      const t = reduce ? 4000 : now - start; const sec = now / 1000;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save(); ctx.beginPath(); rr(ctx, win.x, win.y, win.w, win.h, win.r); ctx.clip();
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const expo = Math.min(1, Math.max(0, (t - 260) / 520));
      ctx.globalAlpha = expo * expo * (3 - 2 * expo); ctx.drawImage(base, 0, 0); ctx.globalAlpha = 1;
      // Live layer.
      if (expo > 0) {
        for (const l of info.lights) {
          const f = l.flicker ? 0.75 + 0.15 * Math.sin(sec * 7.3 + l.x) + 0.1 * Math.sin(sec * 13.1) : 1;
          const rg = ctx.createRadialGradient(l.x, l.y, 4, l.x, l.y, l.r); rg.addColorStop(0, `${l.c}${0.35 * f * expo})`); rg.addColorStop(1, `${l.c}0)`);
          ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = 'source-over';
        }
        if (info.steam) for (let k = 0; k < 3; k += 1) {
          const ph = (sec * 0.35 + k / 3) % 1; const x = info.steam.x - 10 + k * 10; const y = info.steam.y - 54 * info.steam.s - ph * 60;
          ctx.strokeStyle = `rgba(255,255,255,${0.22 * (1 - ph) * expo})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y + 20); ctx.bezierCurveTo(x + 10 * Math.sin(sec + k), y + 10, x - 10 * Math.sin(sec + k), y, x, y - 12); ctx.stroke();
        }
        if (info.eye && (sec % 4.2) > 0.18) {
          ctx.fillStyle = `rgba(230,255,150,${0.9 * expo})`; ctx.shadowColor = '#d8ff7a'; ctx.shadowBlur = 8;
          ctx.beginPath(); ctx.ellipse(info.eye.x - 7 * info.eye.s, info.eye.y, 3 * info.eye.s, 4 * info.eye.s, 0, 0, Math.PI * 2); ctx.ellipse(info.eye.x + 7 * info.eye.s, info.eye.y, 3 * info.eye.s, 4 * info.eye.s, 0, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
        }
        if (vehicle === 'plane') { // a thin cloud sliding past the glass
          const cx = ((sec * 40) % (W + 400)) - 200; const cl = ctx.createRadialGradient(cx, H * 0.75, 10, cx, H * 0.75, 180);
          cl.addColorStop(0, 'rgba(255,255,255,.10)'); cl.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = cl; ctx.fillRect(0, 0, W, H);
        }
      }
      // Line art beat and the subject trace.
      const art = t < 260 ? t / 260 : Math.max(0, 1 - (t - 260) / 900);
      if (art > 0) { ctx.globalAlpha = art; ctx.imageSmoothingEnabled = true; ctx.drawImage(lineArt, 0, 0, W, H); ctx.globalAlpha = 1; }
      const trace = Math.min(1, t / 700); const fade = t < 1600 ? 1 : Math.max(0, 1 - (t - 1600) / 600);
      if (outline.box && fade > 0) {
        ctx.fillStyle = `rgba(214,0,28,${0.95 * fade})`;
        const n = Math.floor(outline.pts.length * trace);
        for (let i = 0; i < n; i += 1) { const [x, y] = outline.pts[i]; ctx.fillRect(x * 2 - 1, y * 2 - 1, 2.2, 2.2); }
        if (trace >= 1) {
          const bx = outline.box; ctx.strokeStyle = `rgba(214,0,28,${fade})`; ctx.lineWidth = 1.5; ctx.strokeRect(bx.x0 * 2 - 6, bx.y0 * 2 - 6, (bx.x1 - bx.x0) * 2 + 12, (bx.y1 - bx.y0) * 2 + 12);
          ctx.fillStyle = `rgba(214,0,28,${fade})`; ctx.fillRect(bx.x0 * 2 - 6, bx.y0 * 2 - 22, 90, 16);
          ctx.fillStyle = `rgba(255,255,255,${fade})`; ctx.font = 'bold 11px monospace'; ctx.fillText(`${SUBJECT_LABEL[spec.subject]} · Sobel`, bx.x0 * 2 - 2, bx.y0 * 2 - 10);
        }
      }
      if (grainPattern) { ctx.globalAlpha = 0.06; ctx.globalCompositeOperation = 'overlay'; ctx.save(); ctx.translate((sec * 997) % 128, (sec * 613) % 128); ctx.fillStyle = grainPattern; ctx.fillRect(-128, -128, W + 256, H + 256); ctx.restore(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
      ctx.restore();
      ctx.drawImage(chrome, 0, 0);
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [spec, vehicle]);

  return (
    <figure className="relative">
      <canvas ref={ref} width={W} height={H} className="w-full rounded-xl" role="img" aria-label={`Scene: ${SUBJECT_LABEL[spec.subject]}`} />
      <figcaption className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-slate-200" data-testid="scene-label">{label}</figcaption>
    </figure>
  );
}
