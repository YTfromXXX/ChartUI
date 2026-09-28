'use client';

import { useEffect, useRef } from 'react';
import type { KnotFutureProjection } from './2d/KnotChart';
import type { TrueGravityTensor } from './2d/GravityHoneycomb';
import { computeProjectionGrid } from '@/lib/projectionGrid';
import { coefficientsFromMarket, planeDistances } from '@/lib/distortionField';
import { useArcanaTraps } from '@/hooks/useArcanaTraps';

export const PROJECTION_TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D'] as const;
export type ProjectionTimeframe = (typeof PROJECTION_TIMEFRAMES)[number];

export const TIMEFRAME_SPACE_SCALE: Record<ProjectionTimeframe, number> = {
  '1m': 0.58,
  '5m': 0.76,
  '15m': 1,
  '1H': 1.28,
  '4H': 1.62,
  '1D': 2,
};

type ProjectionFieldProps = {
  currentPrice?: number;
  gravityTensor?: TrueGravityTensor;
  projection?: KnotFutureProjection;
  timeframe: ProjectionTimeframe;
};

type Particle = { x: number; y: number; vx: number; vy: number; hue: number; phase: number };

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function finite(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function makeParticles(count: number, width: number, height: number): Particle[] {
  return Array.from({ length: count }, (_, index) => {
    const seed = index * 12.9898;
    return {
      x: width * (0.14 + ((Math.sin(seed) + 1) / 2) * 0.72),
      y: height * (0.16 + ((Math.sin(seed * 1.71) + 1) / 2) * 0.68),
      vx: Math.sin(seed * 2.13) * 0.42,
      vy: Math.cos(seed * 1.37) * 0.42,
      hue: index % 4,
      phase: seed,
    };
  });
}

export default function ProjectionField({ currentPrice, gravityTensor, projection, timeframe }: ProjectionFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    const parent = canvas.parentElement;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let frameId = 0;
    let previousTime = performance.now();

    const resize = () => {
      const rect = parent?.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect?.width ?? 1));
      height = Math.max(1, Math.floor(rect?.height ?? 1));
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = makeParticles(Math.max(72, Math.min(180, Math.round(width * height / 4_800))), width, height);
    };
    const observer = typeof ResizeObserver !== 'undefined' && parent ? new ResizeObserver(resize) : undefined;
    observer?.observe(parent as Element);
    resize();

    const draw = (time: number) => {
      const dt = Math.min(2, (time - previousTime) / 16.67);
      previousTime = time;
      context.clearRect(0, 0, width, height);
      const spaceScale = TIMEFRAME_SPACE_SCALE[timeframe];
      const magnitude = finite(gravityTensor?.magnitude);
      const netForce = finite(gravityTensor?.net_force);
      const verticalPressure = clamp(finite(projection?.vertical_pressure), 0, 1);
      const horizontalPressure = clamp(finite(projection?.horizontal_pressure), 0, 1);
      const { gridX, gridY, gridWidth, gridHeight, cellWidth, cellHeight } = computeProjectionGrid(width, height);
      const drift = clamp(netForce * 0.22 + (verticalPressure - horizontalPressure) * 0.36, -0.68, 0.68);

      // Arcana trap system: fit the gravity tensor to a distorted-sphere SH
      // field and feed the per-cell Dk(t) distances into the trap store so
      // armed traps can detect a breakout / accelerating approach.
      const distortionCoefficients = coefficientsFromMarket(verticalPressure, horizontalPressure, magnitude, netForce);
      useArcanaTraps.getState().recordDistances(planeDistances(distortionCoefficients), time);
      const predictionRange = clamp((0.08 + magnitude * 0.12 + verticalPressure * 0.13) * spaceScale, 0.06, 0.42);
      const boxWidth = gridWidth * clamp(0.25 + horizontalPressure * 0.28, 0.24, 0.58);
      const boxHeight = gridHeight * predictionRange;
      const boxX = gridX + gridWidth * 0.52 - boxWidth / 2;
      const boxY = gridY + gridHeight * (0.5 - drift * 0.3) - boxHeight / 2;

      context.save();
      for (let index = 0; index < 22; index += 1) {
        const y = gridY + index * (gridHeight / 22);
        const gauge = clamp(
          0.22 + magnitude * 0.46 + Math.sin(time * 0.0023 + index * 0.79 + horizontalPressure * 2) * 0.17 + (index % 4) * 0.045,
          0.05,
          1,
        );
        const hue = ['#38bdf8', '#f8d66d', '#fb7185', '#a78bfa'][index % 4];
        context.fillStyle = 'rgba(3, 10, 20, 0.58)';
        context.fillRect(width * 0.025, y + 1, width * 0.085, gridHeight / 22 - 2);
        context.fillStyle = hue;
        context.globalAlpha = 0.24 + gauge * 0.68;
        context.fillRect(width * 0.03, y + 3, width * 0.075 * gauge, gridHeight / 22 - 6);
      }

      for (let row = 0; row < 6; row += 1) {
        for (let column = 0; column < 8; column += 1) {
          const normalizedX = (column + 0.5) / 8;
          const normalizedY = (row + 0.5) / 6;
          const pressure = clamp(
            0.08 + magnitude * 0.34 + horizontalPressure * (1 - normalizedY) * 0.24 + verticalPressure * normalizedX * 0.17
              + Math.sin(time * 0.0016 + row * 1.47 + column * 0.92) * 0.09,
            0.03,
            0.92,
          );
          context.globalAlpha = pressure * 0.34;
          context.fillStyle = netForce >= 0 ? '#22d3ee' : '#fb7185';
          context.fillRect(gridX + column * cellWidth + 1, gridY + row * cellHeight + 1, cellWidth - 2, cellHeight - 2);
          context.strokeStyle = 'rgba(186, 230, 253, 0.11)';
          context.globalAlpha = 0.56;
          context.strokeRect(gridX + column * cellWidth + 0.5, gridY + row * cellHeight + 0.5, cellWidth - 1, cellHeight - 1);
        }
      }
      context.restore();

      const centers = gravityTensor?.centers ?? [];
      const particles = particlesRef.current;
      const boundaryPadding = 3;
      for (const particle of particles) {
        for (const center of centers) {
          const centerX = gridX + gridWidth * (0.1 + clamp(finite(center.normalized_position), 0, 1) * 0.8);
          const centerY = gridY + gridHeight * (center.side === 'bid' ? 0.7 : 0.3);
          const dx = centerX - particle.x;
          const dy = centerY - particle.y;
          const distance = Math.max(80, dx * dx + dy * dy);
          const pull = clamp(finite(center.strength) * 22 / distance, 0, 0.055);
          particle.vx += dx * pull * dt;
          particle.vy += dy * pull * dt;
        }
        particle.vx += Math.sin(time * 0.0014 + particle.phase + particle.y * 0.017) * 0.018 * dt;
        particle.vy += Math.cos(time * 0.0011 + particle.phase + particle.x * 0.013) * 0.018 * dt;
        particle.vx *= 0.985;
        particle.vy *= 0.985;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;

        if (particle.x < boxX + boundaryPadding) { particle.x = boxX + boundaryPadding; particle.vx = Math.abs(particle.vx) * 0.84; }
        if (particle.x > boxX + boxWidth - boundaryPadding) { particle.x = boxX + boxWidth - boundaryPadding; particle.vx = -Math.abs(particle.vx) * 0.84; }
        if (particle.y < boxY + boundaryPadding) { particle.y = boxY + boundaryPadding; particle.vy = Math.abs(particle.vy) * 0.84; }
        if (particle.y > boxY + boxHeight - boundaryPadding) { particle.y = boxY + boxHeight - boundaryPadding; particle.vy = -Math.abs(particle.vy) * 0.84; }

        context.beginPath();
        context.fillStyle = ['#67e8f9', '#fde68a', '#fda4af', '#c4b5fd'][particle.hue];
        context.globalAlpha = 0.35 + Math.sin(time * 0.003 + particle.phase) * 0.2 + magnitude * 0.3;
        context.arc(particle.x, particle.y, 0.8 + magnitude * 1.45, 0, Math.PI * 2);
        context.fill();
      }

      context.save();
      const glass = context.createLinearGradient(boxX, boxY, boxX + boxWidth, boxY + boxHeight);
      glass.addColorStop(0, 'rgba(103, 232, 249, 0.07)');
      glass.addColorStop(0.5, 'rgba(255, 255, 255, 0.14)');
      glass.addColorStop(1, netForce >= 0 ? 'rgba(74, 222, 128, 0.12)' : 'rgba(251, 113, 133, 0.14)');
      context.fillStyle = glass;
      context.globalAlpha = 1;
      context.fillRect(boxX, boxY, boxWidth, boxHeight);
      context.strokeStyle = netForce >= 0 ? '#67e8f9' : '#fda4af';
      context.lineWidth = 1.5 + magnitude * 2;
      context.shadowColor = context.strokeStyle;
      context.shadowBlur = 8 + magnitude * 18;
      context.strokeRect(boxX, boxY, boxWidth, boxHeight);
      const candleX = boxX + boxWidth * 0.5;
      const openY = boxY + boxHeight * 0.55;
      const closeY = boxY + boxHeight * (0.55 - drift * 0.35);
      context.strokeStyle = '#f8fafc';
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(candleX, boxY + boxHeight * 0.13);
      context.lineTo(candleX, boxY + boxHeight * 0.87);
      context.stroke();
      context.fillStyle = drift >= 0 ? 'rgba(74, 222, 128, 0.45)' : 'rgba(251, 113, 133, 0.45)';
      context.fillRect(candleX - Math.max(4, boxWidth * 0.035), Math.min(openY, closeY), Math.max(8, boxWidth * 0.07), Math.max(5, Math.abs(closeY - openY)));
      context.restore();

      context.fillStyle = '#d7f7ff';
      context.globalAlpha = 0.72;
      context.font = '9px ui-monospace, SFMono-Regular, monospace';
      context.fillText(`22 ARCANA MEMORY`, width * 0.026, gridY - 8);
      context.fillText(`48 MASS FIELD / ${timeframe}`, gridX, gridY - 8);
      context.fillText(`NEXT OHLC BOUNDARY ${currentPrice ? currentPrice.toFixed(2) : '—'}`, boxX + 8, boxY + 14);
      context.globalAlpha = 1;
      frameId = window.requestAnimationFrame(draw);
    };
    frameId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, [currentPrice, gravityTensor, projection, timeframe]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden="true" />;
}
