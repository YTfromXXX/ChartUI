'use client';

import { useEffect, useRef } from 'react';
import {
  buildAnimalMirrorCells,
  calculateAnimalProjectionAcceleration,
  type AnimalProjectionInput,
} from './animalProjectionEngine';

type AnimalProjectionMirrorProps = AnimalProjectionInput & {
  className?: string;
};

export default function AnimalProjectionMirror({
  volatility,
  tension,
  syncOrder,
  attractorStrength,
  braidTension,
  meanPhase,
  directionalStrength,
  className = '',
}: AnimalProjectionMirrorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<AnimalProjectionInput>({
    volatility,
    tension,
    syncOrder,
    attractorStrength,
    braidTension,
    meanPhase,
    directionalStrength,
  });
  inputRef.current = {
    volatility,
    tension,
    syncOrder,
    attractorStrength,
    braidTension,
    meanPhase,
    directionalStrength,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;
    const parent = canvas.parentElement;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let frameId = 0;
    let previousTime = 0;
    let phaseTime = 0;

    const resize = () => {
      const bounds = parent?.getBoundingClientRect();
      width = Math.max(1, bounds?.width ?? 1);
      height = Math.max(1, bounds?.height ?? 1);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const observer = typeof ResizeObserver !== 'undefined' && parent
      ? new ResizeObserver(resize)
      : undefined;
    if (parent) observer?.observe(parent);
    resize();

    const draw = (timestamp: number) => {
      const dt = previousTime === 0 ? 0 : Math.min((timestamp - previousTime) / 1000, 0.05);
      previousTime = timestamp;
      const input = inputRef.current;
      const acceleration = calculateAnimalProjectionAcceleration(input);
      phaseTime += dt * acceleration;
      const cells = buildAnimalMirrorCells(width, height, input);
      const axisX = width / 2;
      const phasePulse = 0.5 + 0.5 * Math.sin(phaseTime * 2.4);
      const cellRadius = Math.max(2.6, Math.min(5.2, width / 95));

      context.clearRect(0, 0, width, height);
      context.fillStyle = 'rgba(2, 8, 15, 0.42)';
      context.fillRect(0, 0, width, height);

      context.save();
      context.setLineDash([3, 7]);
      context.lineWidth = 1;
      context.strokeStyle = 'rgba(103, 232, 249, 0.24)';
      context.beginPath();
      context.moveTo(axisX, 0);
      context.lineTo(axisX, height);
      context.stroke();
      context.restore();

      const axisGlow = context.createLinearGradient(axisX - 2, 0, axisX + 2, 0);
      axisGlow.addColorStop(0, 'rgba(34, 211, 238, 0)');
      axisGlow.addColorStop(0.5, `rgba(165, 243, 252, ${0.48 + phasePulse * 0.25})`);
      axisGlow.addColorStop(1, 'rgba(34, 211, 238, 0)');
      context.fillStyle = axisGlow;
      context.fillRect(axisX - 2, 0, 4, height);

      for (let index = 0; index < 24; index += 1) {
        const left = cells[index];
        const right = cells[index + 24];
        if (!left || !right) continue;

        context.beginPath();
        context.moveTo(left.x, left.y);
        context.lineTo(axisX, left.y);
        context.lineTo(right.x, right.y);
        context.strokeStyle = `rgba(103, 232, 249, ${0.08 + left.energy * 0.17})`;
        context.lineWidth = 0.7;
        context.stroke();
      }

      for (const cell of cells) {
        const pulse = 0.55 + 0.45 * Math.sin(phaseTime * 2.4 + cell.phase);
        const x = axisX + (cell.x - axisX) * (0.94 + pulse * 0.06);
        const y = cell.y;
        const radius = cellRadius * (0.82 + pulse * 0.22);
        const color = cell.side < 0 ? '103, 232, 249' : '167, 243, 208';
        context.beginPath();
        context.arc(x, y, radius * 2.3, 0, Math.PI * 2);
        context.fillStyle = `rgba(${color}, ${0.045 + cell.energy * 0.08})`;
        context.fill();
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(${color}, ${0.38 + cell.energy * 0.52})`;
        context.fill();
        context.strokeStyle = `rgba(220, 252, 255, ${0.25 + pulse * 0.42})`;
        context.lineWidth = 0.7;
        context.stroke();
      }

      context.fillStyle = 'rgba(207, 250, 254, 0.72)';
      context.font = '8px ui-monospace, SFMono-Regular, Menlo, monospace';
      context.textAlign = 'center';
      context.fillText('PERMANENT Y', axisX, 12);
      context.fillStyle = 'rgba(148, 163, 184, 0.82)';
      context.textAlign = 'left';
      context.fillText('24 MIRRORED PAIRS / 48 CELLS', 10, height - 10);
      context.textAlign = 'right';
      context.fillStyle = 'rgba(103, 232, 249, 0.86)';
      context.fillText(`ENGINE ×${acceleration.toFixed(2)}`, width - 10, height - 10);

      frameId = requestAnimationFrame(draw);
    };

    frameId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 z-[5] h-full w-full ${className}`}
      aria-label="ANIMAL live projection with 48 mirrored cells around a permanent vertical Y axis"
    />
  );
}
