'use client';

import { useEffect, useRef } from 'react';
import { MAJOR_ARCANA_KNOTS } from '@/hooks/useKnotSelection';

type ExplorerCategory = 'Grain' | 'Metal' | 'Stock' | 'Currency' | 'Crypto' | 'Index';

const CATEGORY_COLORS: Record<ExplorerCategory, string> = {
  Grain: '#facc15',
  Metal: '#e2e8f0',
  Stock: '#4ade80',
  Currency: '#38bdf8',
  Crypto: '#fb7185',
  Index: '#a78bfa',
};

export const EXPLORER_SYMBOLS: Array<{ symbol: string; category: ExplorerCategory }> = [
  { symbol: 'WHEATUSD', category: 'Grain' }, { symbol: 'CORNUSD', category: 'Grain' }, { symbol: 'SOYBUSD', category: 'Grain' }, { symbol: 'OATSUSD', category: 'Grain' },
  { symbol: 'XAUUSD', category: 'Metal' }, { symbol: 'XAGUSD', category: 'Metal' }, { symbol: 'XPTUSD', category: 'Metal' }, { symbol: 'COPPERUSD', category: 'Metal' },
  { symbol: 'AAPL', category: 'Stock' }, { symbol: 'TSLA', category: 'Stock' }, { symbol: 'NVDA', category: 'Stock' }, { symbol: 'MSFT', category: 'Stock' }, { symbol: 'AMZN', category: 'Stock' },
  { symbol: 'EURUSD', category: 'Currency' }, { symbol: 'GBPUSD', category: 'Currency' }, { symbol: 'USDJPY', category: 'Currency' }, { symbol: 'AUDUSD', category: 'Currency' }, { symbol: 'USDCHF', category: 'Currency' }, { symbol: 'NZDUSD', category: 'Currency' },
  { symbol: 'BTCUSD', category: 'Crypto' }, { symbol: 'ETHUSD', category: 'Crypto' }, { symbol: 'SOLUSD', category: 'Crypto' }, { symbol: 'ADAUSD', category: 'Crypto' }, { symbol: 'XRPUSD', category: 'Crypto' }, { symbol: 'DOGEUSD', category: 'Crypto' }, { symbol: 'LTCUSD', category: 'Crypto' },
  { symbol: 'US500', category: 'Index' }, { symbol: 'US30', category: 'Index' }, { symbol: 'NAS100', category: 'Index' }, { symbol: 'DAX40', category: 'Index' }, { symbol: 'GER40', category: 'Index' }, { symbol: 'UK100', category: 'Index' }, { symbol: 'JPN225', category: 'Index' },
];

type StardustSymbol = { symbol: string; category: ExplorerCategory; nx: number; ny: number; jitter: number; arcanaId: number };

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  return hash;
}

function buildStardust(): StardustSymbol[] {
  const columns = 8;
  return EXPLORER_SYMBOLS.map((entry, index) => {
    const hash = hashString(entry.symbol);
    const column = index % columns;
    const row = Math.floor(index / columns);
    const rows = Math.ceil(EXPLORER_SYMBOLS.length / columns);
    return {
      ...entry,
      nx: (column + 0.5) / columns,
      ny: (row + 0.5) / rows,
      jitter: hash % 1000,
      arcanaId: hash % 22,
    };
  });
}

/**
 * Poincare-disk-style lens remap: points within `lensRadius` of the cursor
 * are pushed outward from the center along a tanh curve, giving points near
 * the very center the largest apparent spacing (magnification) that decays
 * smoothly to no distortion at the lens boundary -- the classic hyperbolic
 * "loupe" feel without needing a render-target shader pass.
 */
function poincareLensRadius(normalizedRadius: number, curvature: number): number {
  if (normalizedRadius <= 0) return 0;
  const k = Math.tanh(curvature);
  return Math.tanh(curvature * normalizedRadius) / k;
}

type TrailPoint = { x: number; y: number; time: number };
type MaterializedEntry = { activatedAt: number; lastTouchedAt: number };

const TRAIL_LIFETIME_MS = 850;
const MATERIALIZE_RADIUS = 46;
const MATERIALIZE_FADE_MS = 2200;
const LENS_RADIUS = 165;

function drawKnotGlyph(context: CanvasRenderingContext2D, x: number, y: number, seed: number, color: string, scale: number) {
  context.save();
  context.translate(x, y);
  context.scale(scale, scale);
  context.strokeStyle = color;
  context.lineWidth = 1.1;
  context.beginPath();
  for (let index = 0; index < 5; index += 1) {
    const angle = seed * 0.6 + (index / 5) * Math.PI * 2;
    const radius = 5 + Math.sin(seed + index * 1.7) * 2.4;
    const px = Math.cos(angle) * radius;
    const py = Math.sin(angle * 1.4) * radius;
    if (index === 0) context.moveTo(px, py);
    else context.quadraticCurveTo(0, 0, px, py);
  }
  context.closePath();
  context.stroke();
  context.restore();
}

export default function MatrixGridExplorer({ height = 360 }: { height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<TrailPoint[]>([]);
  const materializedRef = useRef<Map<string, MaterializedEntry>>(new Map());
  const cursorRef = useRef<{ x: number; y: number; active: boolean }>({ x: -1000, y: -1000, active: false });
  const stardustRef = useRef<StardustSymbol[]>(buildStardust());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    const parent = canvas.parentElement;
    let width = 1;
    let renderHeight = 1;
    let dpr = 1;
    let frameId = 0;

    const resize = () => {
      const rect = parent?.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect?.width ?? 1));
      renderHeight = Math.max(1, Math.floor(height));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = renderHeight * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = typeof ResizeObserver !== 'undefined' && parent ? new ResizeObserver(resize) : undefined;
    observer?.observe(parent as Element);
    resize();

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      cursorRef.current = { x, y, active: true };
      trailRef.current.push({ x, y, time: performance.now() });
      if (trailRef.current.length > 60) trailRef.current.shift();
    };
    const onPointerLeave = () => { cursorRef.current.active = false; };
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerleave', onPointerLeave);

    const draw = (time: number) => {
      context.clearRect(0, 0, width, renderHeight);
      trailRef.current = trailRef.current.filter((point) => time - point.time < TRAIL_LIFETIME_MS);
      const cursor = cursorRef.current;

      // Materialize stardust points whose position is close to a recent
      // trail point (the cursor's sensor sweep).
      for (const star of stardustRef.current) {
        const px = star.nx * width;
        const py = star.ny * renderHeight;
        const touched = trailRef.current.some((point) => Math.hypot(point.x - px, point.y - py) < MATERIALIZE_RADIUS);
        if (touched) {
          const existing = materializedRef.current.get(star.symbol);
          materializedRef.current.set(star.symbol, { activatedAt: existing?.activatedAt ?? time, lastTouchedAt: time });
        }
      }
      for (const [symbol, entry] of materializedRef.current) {
        if (time - entry.lastTouchedAt > MATERIALIZE_FADE_MS) materializedRef.current.delete(symbol);
      }

      // Major Arcana aura: the most recently materialized symbol's arcana
      // rises as a giant faint silhouette behind the field.
      const lastMaterialized = [...materializedRef.current.entries()].sort((a, b) => b[1].lastTouchedAt - a[1].lastTouchedAt)[0];
      if (lastMaterialized) {
        const star = stardustRef.current.find((entry) => entry.symbol === lastMaterialized[0]);
        if (star) {
          const age = time - lastMaterialized[1].activatedAt;
          const alpha = Math.min(0.16, age / 4000);
          const auraX = width * 0.5;
          const auraY = renderHeight * 0.46;
          const gradient = context.createRadialGradient(auraX, auraY, 0, auraX, auraY, Math.min(width, renderHeight) * 0.62);
          gradient.addColorStop(0, `rgba(167, 139, 250, ${alpha})`);
          gradient.addColorStop(1, 'rgba(167, 139, 250, 0)');
          context.fillStyle = gradient;
          context.fillRect(0, 0, width, renderHeight);
          context.save();
          context.globalAlpha = alpha * 3.2;
          context.fillStyle = '#c4b5fd';
          context.font = `700 ${Math.min(width, renderHeight) * 0.34}px ui-serif, Georgia, serif`;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(String(star.arcanaId).padStart(2, '0'), auraX, auraY);
          context.font = '10px ui-monospace, monospace';
          context.globalAlpha = alpha * 5;
          context.fillText(MAJOR_ARCANA_KNOTS[star.arcanaId], auraX, auraY + Math.min(width, renderHeight) * 0.2);
          context.restore();
        }
      }

      // Stardust field with the Poincare-disk lens applied around the cursor.
      for (const star of stardustRef.current) {
        let px = star.nx * width;
        let py = star.ny * renderHeight;
        const wobble = Math.sin(time * 0.0007 + star.jitter) * 3;
        px += wobble;
        py += Math.cos(time * 0.0006 + star.jitter) * 3;

        if (cursor.active) {
          const dx = px - cursor.x;
          const dy = py - cursor.y;
          const radius = Math.hypot(dx, dy);
          if (radius < LENS_RADIUS && radius > 0.001) {
            const normalized = radius / LENS_RADIUS;
            const lensed = poincareLensRadius(normalized, 2.6);
            const factor = (lensed * LENS_RADIUS) / radius;
            px = cursor.x + dx * factor;
            py = cursor.y + dy * factor;
          }
        }

        const materialized = materializedRef.current.get(star.symbol);
        const color = CATEGORY_COLORS[star.category];
        const nearCursor = cursor.active && Math.hypot(px - cursor.x, py - cursor.y) < LENS_RADIUS;
        const size = nearCursor ? 2.6 : 1.4;

        context.beginPath();
        context.fillStyle = color;
        context.globalAlpha = nearCursor ? 0.95 : 0.55;
        context.arc(px, py, size, 0, Math.PI * 2);
        context.fill();

        if (materialized) {
          const age = time - materialized.lastTouchedAt;
          const fade = 1 - age / MATERIALIZE_FADE_MS;
          context.globalAlpha = Math.max(0, fade);
          drawKnotGlyph(context, px, py - 14, star.jitter, color, 0.9 + (nearCursor ? 0.4 : 0));
          context.fillStyle = color;
          context.font = '8px ui-monospace, monospace';
          context.textAlign = 'center';
          context.fillText(star.symbol, px, py + 12);
        }
      }

      if (cursor.active) {
        context.save();
        context.globalAlpha = 0.5;
        context.strokeStyle = 'rgba(196, 181, 253, 0.55)';
        context.setLineDash([3, 4]);
        context.beginPath();
        context.arc(cursor.x, cursor.y, LENS_RADIUS, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }

      context.globalAlpha = 1;
      frameId = window.requestAnimationFrame(draw);
    };
    frameId = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [height]);

  return (
    <div className="relative overflow-hidden border border-violet-200/15 bg-[#04030a]" style={{ height }}>
      <canvas ref={canvasRef} className="h-full w-full touch-none" aria-label="Matrix grid explorer / symbol sensor field" />
      <p className="pointer-events-none absolute left-3 top-2 font-mono text-[8px] uppercase tracking-[0.24em] text-violet-200/45">Explorer / sensor sweep to materialize knots</p>
    </div>
  );
}
