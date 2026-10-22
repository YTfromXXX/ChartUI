'use client';

import { useEffect, useRef } from 'react';
import { MAJOR_ARCANA_KNOTS } from '@/hooks/useKnotSelection';
import { ARCANA_ATTRACTORS } from '@/lib/arcanaMatrix';
import type { MatrixPairAnalysis } from '@/lib/fieldModels';
import { MARKET_CANDIDATE_CATALOG, MATRIX_ROLES, type MarketAssetClass } from '@/lib/marketCatalog';

type ExplorerCategory = 'Grain' | 'Energy' | 'Metal' | 'Stock' | 'Currency' | 'Crypto' | 'Index' | 'Macro';

const CATEGORY_COLORS: Record<ExplorerCategory, string> = {
  Grain: '#facc15',
  Energy: '#fb923c',
  Metal: '#e2e8f0',
  Stock: '#4ade80',
  Currency: '#38bdf8',
  Crypto: '#fb7185',
  Index: '#a78bfa',
  Macro: '#c084fc',
};

const EXPLORER_CATEGORY: Record<MarketAssetClass, ExplorerCategory> = {
  agriculture: 'Grain',
  energy: 'Energy',
  metal: 'Metal',
  equity: 'Stock',
  currency: 'Currency',
  crypto: 'Crypto',
  index: 'Index',
  rates: 'Macro',
  economic: 'Macro',
};

export const EXPLORER_SYMBOLS = MARKET_CANDIDATE_CATALOG.map((asset) => ({
  symbol: asset.symbol,
  category: EXPLORER_CATEGORY[asset.assetClass],
  roleIds: asset.roleIds,
}));

type StardustSymbol = { symbol: string; category: ExplorerCategory; nx: number; ny: number; jitter: number; arcanaId: number; roleIds: readonly number[] };

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
      arcanaId: entry.roleIds[0] ?? hash % 22,
      roleIds: entry.roleIds,
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

function MatrixDistanceOverlay({ analysis, label, source, animalCentroid, animalAttractorArcanaId, animalAttractorStrength }: {
  analysis: MatrixPairAnalysis;
  label: string;
  source: string;
  animalCentroid?: { x: number; y: number; z?: number };
  animalAttractorArcanaId?: number;
  animalAttractorStrength?: number;
}) {
  const toX = (value: number) => 12 + ((value + 1) / 2) * 356;
  const toY = (value: number) => 10 + ((value + 1) / 2) * 104;
  const attractor = analysis.resonance.arcana;
  return (
    <div className="absolute inset-x-2 bottom-2 z-10 border border-violet-200/25 bg-[#020611]/90 p-2 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[8px] uppercase tracking-[0.1em]">
        <span className="text-violet-100">{label} / {source}</span>
        <span className="text-stone-400">D {analysis.distance.toFixed(3)} / {attractor.roman} {attractor.name}</span>
      </div>
      <svg viewBox="0 0 380 124" className="mt-1 h-20 w-full" role="img" aria-label={`${analysis.asset} to ${analysis.counterAsset} matrix distance ${analysis.distance.toFixed(3)}, resonance ${attractor.name}`}>
        <defs>
          <pattern id="arcana-matrix-grid" width="23" height="13" patternUnits="userSpaceOnUse">
            <path d="M23 0H0V13" fill="none" stroke="rgba(148,163,184,0.13)" strokeWidth="0.55" />
          </pattern>
        </defs>
        <rect x="12" y="10" width="356" height="104" fill="url(#arcana-matrix-grid)" />
        {ARCANA_ATTRACTORS.map((node) => {
          const x = toX(node.x);
          const y = toY(node.y);
          const active = node.id === attractor.id;
          return (
            <g key={node.id}>
              {active && <circle cx={x} cy={y} r="7" fill="rgba(196,181,253,0.16)" stroke="#c4b5fd" strokeOpacity="0.7" />}
              <circle cx={x} cy={y} r={active ? 2.8 : 1.6} fill={active ? (node.destructiveAffinity >= 0.7 ? '#fb7185' : '#c4b5fd') : '#64748b'} />
              {(active || [0, 4, 13, 16].includes(node.id)) && <text x={x + 4} y={y - 3} fill={active ? '#f8fafc' : '#64748b'} fontSize="5">{node.roman}</text>}
            </g>
          );
        })}
        <line
          x1={toX(analysis.assetPosition.x)}
          y1={toY(analysis.assetPosition.y)}
          x2={toX(analysis.counterPosition.x)}
          y2={toY(analysis.counterPosition.y)}
          stroke={attractor.destructiveAffinity >= 0.7 ? '#fb7185' : '#22d3ee'}
          strokeWidth="1.2"
          strokeDasharray="3 3"
        />
        <circle cx={toX(analysis.assetPosition.x)} cy={toY(analysis.assetPosition.y)} r="3.3" fill="#22d3ee" />
        <circle cx={toX(analysis.counterPosition.x)} cy={toY(analysis.counterPosition.y)} r="3.3" fill="#fbbf24" />
        <circle cx={toX(analysis.midpoint.x)} cy={toY(analysis.midpoint.y)} r="2.2" fill="#fff" />
        {animalCentroid && animalAttractorArcanaId !== undefined && (() => {
          const target = ARCANA_ATTRACTORS.find((node) => node.id === animalAttractorArcanaId);
          if (!target) return null;
          return (
            <g>
              <line
                x1={toX(animalCentroid.x)}
                y1={toY(animalCentroid.y)}
                x2={toX(target.x)}
                y2={toY(target.y)}
                stroke="#4ade80"
                strokeWidth={0.8 + (animalAttractorStrength ?? 0) * 1.2}
                strokeOpacity={0.35 + (animalAttractorStrength ?? 0) * 0.6}
              />
              <circle cx={toX(animalCentroid.x)} cy={toY(animalCentroid.y)} r="4" fill="none" stroke="#4ade80" strokeWidth="1.2" />
              <text x={toX(animalCentroid.x) + 5} y={toY(animalCentroid.y) - 5} fill="#86efac" fontSize="6">ANIMAL</text>
            </g>
          );
        })()}
        <text x={toX(analysis.assetPosition.x) + 5} y={toY(analysis.assetPosition.y) + 8} fill="#a5f3fc" fontSize="6">{analysis.asset}</text>
        <text x={toX(analysis.counterPosition.x) + 5} y={toY(analysis.counterPosition.y) + 8} fill="#fde68a" fontSize="6">{analysis.counterAsset}</text>
      </svg>
    </div>
  );
}

export default function MatrixGridExplorer({ height = 360, analysis, label = 'Matrix resonance', source = 'Synthetic', animalCentroid, animalAttractorArcanaId, animalAttractorStrength }: {
  height?: number;
  analysis?: MatrixPairAnalysis;
  label?: string;
  source?: string;
  animalCentroid?: { x: number; y: number; z?: number };
  animalAttractorArcanaId?: number;
  animalAttractorStrength?: number;
}) {
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
            const role = MATRIX_ROLES[star.arcanaId];
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
          context.fillText(role?.function ?? MAJOR_ARCANA_KNOTS[star.arcanaId], auraX, auraY + Math.min(width, renderHeight) * 0.2);
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
      <p className="pointer-events-none absolute left-3 top-2 font-mono text-[8px] uppercase tracking-[0.24em] text-violet-200/45">
        Explorer / {EXPLORER_SYMBOLS.length} candidates · {MATRIX_ROLES.length} arcana roles · sensor sweep to materialize
      </p>
      {analysis && (
        <MatrixDistanceOverlay
          analysis={analysis}
          label={label}
          source={source}
          animalCentroid={animalCentroid}
          animalAttractorArcanaId={animalAttractorArcanaId}
          animalAttractorStrength={animalAttractorStrength}
        />
      )}
    </div>
  );
}
