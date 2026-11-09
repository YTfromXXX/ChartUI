'use client';

import { useEffect, useRef } from 'react';
import {
  buildAnimalMirrorCells,
  calculateAnimalProjectionAcceleration,
  getCureTimeframeSpeed,
  RETROGRID_VERTICAL_PLAY,
  reverseDetectAnimalCandies,
  type AnimalCandyInput,
  type AnimalProjectionInput,
  type ReverseTrackedCandy,
} from './animalProjectionEngine';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type AnimalProjectionMirrorProps = AnimalProjectionInput & {
  arcanaParameters: AnimalCandyInput['arcanaParameters'];
  className?: string;
  history: readonly { price: number }[];
  latestPrice: number;
  placeholderState: AnimalCandyInput['placeholderState'];
  timeframe: AnimalCandyInput['timeframe'];
  volatilityIndex: number;
};

export default function AnimalProjectionMirror({
  volatility,
  tension,
  syncOrder,
  attractorStrength,
  braidTension,
  meanPhase,
  directionalStrength,
  arcanaParameters,
  className = '',
  history,
  latestPrice,
  placeholderState,
  timeframe,
  volatilityIndex,
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
  const candyInputRef = useRef<AnimalCandyInput>({
    volatilityIndex,
    timeframe,
    placeholderState,
    arcanaParameters,
  });
  candyInputRef.current = {
    volatilityIndex,
    timeframe,
    placeholderState,
    arcanaParameters,
  };
  const priceHistoryRef = useRef(history);
  priceHistoryRef.current = history;
  const latestPriceRef = useRef(latestPrice);
  latestPriceRef.current = latestPrice;

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
    let cachedSignature = '';
    let cachedCandies: ReverseTrackedCandy[] = [];

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
      phaseTime += dt * acceleration * getCureTimeframeSpeed(candyInputRef.current.timeframe);
      const cells = buildAnimalMirrorCells(width, height, input);
      const candyInput = candyInputRef.current;
      const signature = JSON.stringify([
        width,
        height,
        input.volatility,
        input.tension,
        input.syncOrder,
        input.attractorStrength,
        input.braidTension,
        input.meanPhase,
        input.directionalStrength,
        candyInput.volatilityIndex,
        candyInput.timeframe,
        candyInput.placeholderState,
        candyInput.arcanaParameters.map(({ id, angle, volatilityAffinity, tensionAffinity }) => [id, angle, volatilityAffinity, tensionAffinity]),
      ]);
      if (signature !== cachedSignature) {
        cachedSignature = signature;
        cachedCandies = reverseDetectAnimalCandies(width, height, input, candyInput);
      }
      const axisX = width / 2;
      const phasePulse = 0.5 + 0.5 * Math.sin(phaseTime * 2.4);
      const cellRadius = Math.max(2.6, Math.min(5.2, width / 95));

      context.clearRect(0, 0, width, height);
      context.fillStyle = 'rgba(2, 8, 15, 0.42)';
      context.fillRect(0, 0, width, height);

      const playTop = height * RETROGRID_VERTICAL_PLAY.top;
      const playBottom = height * (1 - RETROGRID_VERTICAL_PLAY.bottom);
      context.fillStyle = 'rgba(34, 211, 238, 0.035)';
      context.fillRect(0, 0, width, playTop);
      context.fillRect(0, playBottom, width, height - playBottom);
      context.setLineDash([2, 6]);
      context.lineWidth = 0.8;
      context.strokeStyle = 'rgba(34, 211, 238, 0.2)';
      context.beginPath();
      context.moveTo(0, playTop);
      context.lineTo(width, playTop);
      context.moveTo(0, playBottom);
      context.lineTo(width, playBottom);
      context.stroke();
      context.setLineDash([]);

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

      let minPrice = Number.POSITIVE_INFINITY;
      let maxPrice = Number.NEGATIVE_INFINITY;
      for (const point of priceHistoryRef.current) {
        if (!Number.isFinite(point.price)) continue;
        minPrice = Math.min(minPrice, point.price);
        maxPrice = Math.max(maxPrice, point.price);
      }
      const currentPrice = Number.isFinite(latestPriceRef.current)
        ? latestPriceRef.current
        : (minPrice + maxPrice) / 2;
      if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
        minPrice = currentPrice - 1;
        maxPrice = currentPrice + 1;
      }
      const priceSpan = Math.max(maxPrice - minPrice, Math.abs(currentPrice) * 1e-8, 1e-8);
      const targetY = clamp(
        playBottom - ((currentPrice - minPrice) / priceSpan) * (playBottom - playTop),
        playTop,
        playBottom,
      );
      const targetX = Math.max(axisX + 18, width - Math.min(width * 0.3, 154) - 30);
      context.beginPath();
      context.moveTo(axisX, targetY);
      context.lineTo(targetX, targetY);
      context.strokeStyle = `rgba(207, 250, 254, ${0.44 + phasePulse * 0.35})`;
      context.lineWidth = 1 + phasePulse;
      context.shadowColor = '#67e8f9';
      context.shadowBlur = 7 + phasePulse * 6;
      context.stroke();
      context.shadowBlur = 0;
      context.beginPath();
      context.arc(targetX, targetY, 3.2 + phasePulse * 1.4, 0, Math.PI * 2);
      context.fillStyle = '#cffafe';
      context.fill();
      context.beginPath();
      context.arc(axisX, targetY, 2.4 + phasePulse, 0, Math.PI * 2);
      context.fillStyle = '#67e8f9';
      context.fill();

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

      for (const candy of cachedCandies) {
        const pulse = 0.58 + 0.42 * Math.sin(phaseTime * 2.4 + candy.phase);
        const radius = candy.radius * (0.78 + pulse * 0.3);
        context.beginPath();
        context.arc(candy.x, candy.y, radius * 2.1, 0, Math.PI * 2);
        context.fillStyle = `hsla(${candy.hue}, 90%, 65%, ${0.035 + candy.energy * 0.055})`;
        context.fill();
        context.beginPath();
        context.arc(candy.x, candy.y, radius, 0, Math.PI * 2);
        context.fillStyle = `hsla(${candy.hue}, 96%, 77%, ${0.28 + candy.energy * 0.46})`;
        context.fill();
      }

      context.beginPath();
      context.moveTo(axisX, 0);
      context.lineTo(axisX - 4, 9);
      context.lineTo(axisX + 4, 9);
      context.closePath();
      context.fillStyle = '#cffafe';
      context.fill();
      context.beginPath();
      context.moveTo(axisX, height);
      context.lineTo(axisX - 4, height - 9);
      context.lineTo(axisX + 4, height - 9);
      context.closePath();
      context.fill();

      context.fillStyle = 'rgba(207, 250, 254, 0.72)';
      context.font = '8px ui-monospace, SFMono-Regular, Menlo, monospace';
      context.textAlign = 'center';
      context.fillText('PERMANENT Y', axisX, 12);
      context.textAlign = 'left';
      context.fillStyle = 'rgba(103, 232, 249, 0.65)';
      context.fillText('RETROGRID PLAY / 12.5%', 8, Math.max(9, playTop - 4));
      context.fillText('RETROGRID PLAY / 12.5%', 8, Math.min(height - 2, playBottom + 10));
      context.fillStyle = 'rgba(148, 163, 184, 0.82)';
      context.textAlign = 'left';
      context.fillText(
        `CURE ${candyInput.timeframe} / VOL ${(candyInput.volatilityIndex * 100).toFixed(0)}% / ${candyInput.placeholderState}`,
        10,
        height - 22,
      );
      context.fillText('48 MIRRORED CELLS / 384 CANDY TRACES', 10, height - 10);
      context.textAlign = 'right';
      context.fillStyle = 'rgba(103, 232, 249, 0.86)';
      context.fillText(`ENGINE ×${acceleration.toFixed(2)}`, width - 10, height - 10);
      context.textAlign = 'left';
      context.fillStyle = 'rgba(207, 250, 254, 0.76)';
      context.fillText('CHART TIP ↔ PERMANENT Y', Math.min(width - 150, axisX + 10), Math.max(playTop + 10, targetY - 7));

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
      aria-label={`ANIMAL live projection with 48 mirrored cells and 384 Cure-API candy traces bound to a permanent vertical Y axis; ${timeframe}, volatility ${(volatilityIndex * 100).toFixed(0)} percent`}
    />
  );
}
