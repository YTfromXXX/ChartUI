'use client';

import { useEffect, useRef } from 'react';

export type KnotTick = {
  timestamp?: number;
  price: number;
  volatility: number;
  angle: number;
  magicLength: number;
  tension: number;
  jump?: boolean;
};

export type SpiralCubePoint = { x: number; y: number; z: number };

export type KnotFutureProjection = {
  vertical_pressure: number;
  horizontal_pressure: number;
  topology: string;
  topology_label?: string;
  coordinates: readonly SpiralCubePoint[];
};

export type KnotTimelineLayer = {
  price: number;
  volatility: number;
  angle: number;
  color: string;
  opacity: number;
};

export type KnotChartProps = {
  tick?: KnotTick;
  timeline?: {
    t40m?: KnotTimelineLayer;
    t4h?: KnotTimelineLayer;
    target?: KnotTimelineLayer;
    best?: KnotTimelineLayer;
  };
  history?: readonly KnotTick[];
  className?: string;
  height?: number;
  maxTicks?: number;
  futureProjection?: KnotFutureProjection;
};

type CanvasSize = { width: number; height: number; dpr: number };

type KnotBuffer = {
  prices: Float64Array;
  volatilities: Float32Array;
  angles: Float32Array;
  lengths: Float32Array;
  tensions: Float32Array;
  jumps: Uint8Array;
  times: Float64Array;
  capacity: number;
  count: number;
  writeIndex: number;
  lastTimestamp: number;
};

const DEFAULT_COLORS = ['#38bdf8', '#f8d66d', '#fb7185', '#a78bfa'];
const TAU = Math.PI * 2;

function createBuffer(capacity: number): KnotBuffer {
  return {
    prices: new Float64Array(capacity),
    volatilities: new Float32Array(capacity),
    angles: new Float32Array(capacity),
    lengths: new Float32Array(capacity),
    tensions: new Float32Array(capacity),
    jumps: new Uint8Array(capacity),
    times: new Float64Array(capacity),
    capacity,
    count: 0,
    writeIndex: 0,
    lastTimestamp: Number.NaN,
  };
}

function writeTick(buffer: KnotBuffer, tick: KnotTick) {
  const timestamp = Number.isFinite(tick.timestamp) ? Number(tick.timestamp) : performance.now();
  if (timestamp === buffer.lastTimestamp) return;
  const index = buffer.writeIndex;
  buffer.prices[index] = Number.isFinite(tick.price) ? tick.price : 0;
  buffer.volatilities[index] = Math.max(0, Math.min(1, tick.volatility || 0));
  buffer.angles[index] = Number.isFinite(tick.angle) ? tick.angle : 0;
  buffer.lengths[index] = Math.max(0, tick.magicLength || 0);
  buffer.tensions[index] = Math.max(0, Math.min(1, tick.tension || 0));
  buffer.jumps[index] = tick.jump ? 1 : 0;
  buffer.times[index] = timestamp;
  buffer.writeIndex = (index + 1) % buffer.capacity;
  buffer.count = Math.min(buffer.count + 1, buffer.capacity);
  buffer.lastTimestamp = timestamp;
}

function readIndex(buffer: KnotBuffer, ordinal: number) {
  return (buffer.writeIndex - buffer.count + ordinal + buffer.capacity) % buffer.capacity;
}

function drawSplitLine(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, crossingX: number, crossingY: number, epsilon: number) {
  const distance = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / distance;
  const uy = (y2 - y1) / distance;
  const margin = Math.min(distance * 0.45, Math.max(0.5, epsilon / Math.max(Math.abs(ux), Math.abs(uy), 0.001)));
  const beforeX = crossingX - ux * margin;
  const beforeY = crossingY - uy * margin;
  const afterX = crossingX + ux * margin;
  const afterY = crossingY + uy * margin;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(beforeX, beforeY);
  ctx.moveTo(afterX, afterY);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawHexagon(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number) {
  ctx.beginPath();
  for (let side = 0; side < 6; side += 1) {
    const angle = rotation + (side * TAU) / 6;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (side === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawRoundedNode(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, rotation: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  const side = radius * 1.55;
  ctx.beginPath();
  ctx.roundRect(-side / 2, -side / 2, side, side, Math.max(3, radius * 0.32));
  ctx.stroke();
  ctx.restore();
}

function drawTimelinePath(ctx: CanvasRenderingContext2D, width: number, height: number, tension: number, layer: KnotTimelineLayer, targetX: number, targetY: number, layerIndex: number) {
  const spread = (layerIndex - 1.5) * width * 0.16;
  const startX = width * 0.5 + spread;
  const startY = height * 0.16 + layerIndex * height * 0.075;
  const volatilityRadius = Math.max(5, layer.volatility * Math.min(width, height) * 0.22);
  const sourceX = startX + Math.cos(layer.angle) * volatilityRadius;
  const sourceY = startY + Math.sin(layer.angle) * volatilityRadius;
  const control1X = startX + (targetX - startX) * 0.22 + Math.sin(layer.angle) * 22;
  const control1Y = startY + (targetY - startY) * 0.18;
  const control2X = targetX - (targetX - startX) * 0.22;
  const control2Y = targetY - (targetY - startY) * 0.18 + Math.cos(layer.angle) * 22;
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.strokeStyle = layer.color;
  ctx.lineWidth = 1.2 + layer.volatility * 2.4;
  ctx.beginPath();
  ctx.moveTo(sourceX, sourceY);
  ctx.bezierCurveTo(control1X, control1Y, control2X, control2Y, targetX, targetY);
  ctx.stroke();
  ctx.restore();

  const vectorLength = Math.max(8, layer.volatility * 42 + tension * 18);
  const vectorX = targetX + Math.cos(layer.angle) * vectorLength;
  const vectorY = targetY + Math.sin(layer.angle) * vectorLength;
  ctx.save();
  ctx.strokeStyle = layer.color;
  ctx.globalAlpha = Math.min(0.8, layer.opacity + 0.15);
  ctx.lineWidth = 0.8;
  drawSplitLine(ctx, targetX - Math.cos(layer.angle) * vectorLength, targetY - Math.sin(layer.angle) * vectorLength, vectorX, vectorY, targetX, targetY, 1.5 + layer.volatility * 3);
  ctx.restore();
}

function fallbackProjection(buffer: KnotBuffer, currentIndex: number): KnotFutureProjection {
  const currentPrice = buffer.prices[currentIndex];
  const previousPrice = buffer.count > 1 ? buffer.prices[readIndex(buffer, buffer.count - 2)] : currentPrice;
  const recentStart = Math.max(0, buffer.count - 12);
  const recentPrices = Array.from({ length: buffer.count - recentStart }, (_, offset) => buffer.prices[readIndex(buffer, recentStart + offset)]);
  const range = Math.max(Math.max(...recentPrices, currentPrice) - Math.min(...recentPrices, currentPrice), Math.abs(currentPrice) * 0.0001, 0.000001);
  const verticalPressure = Math.min(1, Math.abs(currentPrice - previousPrice) / range * 0.7 + buffer.tensions[currentIndex] * 0.3);
  const dwell = recentPrices.filter((price) => Math.abs(price - currentPrice) <= range * 0.18).length / Math.max(1, recentPrices.length);
  const horizontalPressure = Math.min(1, dwell * 0.7 + (1 - verticalPressure) * 0.3);
  const topology = verticalPressure > horizontalPressure * 1.18 && verticalPressure > 0.55
    ? 'trefoil'
    : horizontalPressure > verticalPressure * 1.18 && horizontalPressure > 0.55 ? 'figure_eight' : 'spiral';
  const direction = currentPrice >= previousPrice ? 1 : -1;
  return {
    vertical_pressure: verticalPressure,
    horizontal_pressure: horizontalPressure,
    topology,
    coordinates: Array.from({ length: 5 }, (_, index) => ({
      x: 0.5 + Math.sin(index * 1.15) * 0.05,
      y: Math.max(0, Math.min(1, 0.5 + direction * index * (0.08 + verticalPressure * 0.06))),
      z: 0.5 + Math.cos(index * 1.15) * 0.05,
    })),
  };
}

function drawFutureKnot(ctx: CanvasRenderingContext2D, targetX: number, targetY: number, width: number, height: number, projection: KnotFutureProjection, frame: number) {
  const vertical = Math.max(0, Math.min(1, projection.vertical_pressure));
  const horizontal = Math.max(0, Math.min(1, projection.horizontal_pressure));
  const futureWidth = Math.min(width * 0.3, 154);
  const pulse = 1 + Math.sin(frame * 0.06) * 0.045;
  const scaleX = (0.92 + horizontal * 0.5 - vertical * 0.16) * pulse;
  const scaleY = (0.88 + vertical * 0.72 - horizontal * 0.12) * pulse;
  const anchorX = targetX + futureWidth * 0.56;
  const anchorY = targetY + ((projection.coordinates.at(-1)?.y ?? 0.5) - 0.5) * height * 0.22;
  const topology = projection.topology.toLowerCase();
  const color = topology.includes('figure') ? '#fda4af' : topology.includes('trefoil') ? '#a7f3d0' : '#c4b5fd';

  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.18 + Math.max(vertical, horizontal) * 0.18;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 5]);
  ctx.beginPath();
  ctx.moveTo(targetX, targetY);
  projection.coordinates.forEach((point, index) => {
    const pointX = targetX + futureWidth * ((index + 1) / Math.max(1, projection.coordinates.length)) * (0.65 + point.x * 0.35);
    const pointY = targetY + (point.y - 0.5) * height * 0.32;
    if (index === 0) ctx.lineTo(pointX, pointY);
    else ctx.quadraticCurveTo(pointX - futureWidth * 0.08, pointY, pointX, pointY);
  });
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(anchorX, anchorY);
  ctx.scale(scaleX, scaleY);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.18 + Math.max(vertical, horizontal) * 0.3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.lineWidth = 1.2;
  ctx.setLineDash([3, 6]);
  ctx.beginPath();
  const samples = 48;
  for (let index = 0; index <= samples; index += 1) {
    const t = (index / samples) * TAU * (topology.includes('figure') ? 2 : topology.includes('trefoil') ? 3 : 1.5);
    let localX: number;
    let localY: number;
    if (topology.includes('figure')) {
      const radius = 0.42 + Math.cos(t) * 0.18;
      localX = Math.sin(t * 1.5) * radius;
      localY = Math.sin(t) * 0.82;
    } else if (topology.includes('trefoil')) {
      localX = (Math.sin(t) + 2 * Math.sin(2 * t)) / 3.2;
      localY = (Math.cos(t) - 2 * Math.cos(2 * t)) / 3.2;
    } else {
      const radius = 0.72 - (index / samples) * 0.46;
      localX = Math.cos(t) * radius;
      localY = Math.sin(t) * radius;
    }
    const pointX = localX * Math.min(width, height) * 0.14;
    const pointY = localY * Math.min(width, height) * 0.14;
    if (index === 0) ctx.moveTo(pointX, pointY);
    else ctx.lineTo(pointX, pointY);
  }
  ctx.stroke();
  ctx.restore();
}

function renderFrame(ctx: CanvasRenderingContext2D, size: CanvasSize, buffer: KnotBuffer, timeline: KnotChartProps['timeline'], futureProjection: KnotFutureProjection | undefined, frame: number) {
  const { width, height } = size;
  ctx.clearRect(0, 0, width, height);
  if (buffer.count === 0) return;

  let minPrice = Number.POSITIVE_INFINITY;
  let maxPrice = Number.NEGATIVE_INFINITY;
  for (let ordinal = 0; ordinal < buffer.count; ordinal += 1) {
    const price = buffer.prices[readIndex(buffer, ordinal)];
    minPrice = Math.min(minPrice, price);
    maxPrice = Math.max(maxPrice, price);
  }
  const priceRange = Math.max(maxPrice - minPrice, 0.000001);
  const currentIndex = readIndex(buffer, buffer.count - 1);
  const currentPrice = buffer.prices[currentIndex];
  const currentVolatility = buffer.volatilities[currentIndex];
  const currentAngle = buffer.angles[currentIndex];
  const currentMagicLength = buffer.lengths[currentIndex];
  const currentTension = buffer.tensions[currentIndex];
  const plotLeft = 20;
  const plotRight = width - 20;
  const plotTop = 18;
  const plotBottom = height - 20;
  const xScale = (plotRight - plotLeft) / Math.max(1, buffer.count - 1);
  const yScale = (plotBottom - plotTop) / priceRange;
  const projection = futureProjection ?? fallbackProjection(buffer, currentIndex);
  const forecastWidth = Math.min(width * 0.3, 154);
  const targetX = plotRight - forecastWidth - 10;
  const targetY = plotBottom - (currentPrice - minPrice) * yScale;

  if (timeline?.t40m) drawTimelinePath(ctx, width, height, currentTension, timeline.t40m, targetX, targetY, 0);
  if (timeline?.t4h) drawTimelinePath(ctx, width, height, currentTension, timeline.t4h, targetX, targetY, 1);
  if (timeline?.target) drawTimelinePath(ctx, width, height, currentTension, timeline.target, targetX, targetY, 2);
  if (timeline?.best) drawTimelinePath(ctx, width, height, currentTension, timeline.best, targetX, targetY, 3);
  drawFutureKnot(ctx, targetX, targetY, width, height, projection, frame);

  ctx.save();
  ctx.strokeStyle = '#dbeafe';
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  for (let ordinal = 0; ordinal < buffer.count; ordinal += 1) {
    const index = readIndex(buffer, ordinal);
    const x = plotLeft + ordinal * xScale;
    const y = plotBottom - (buffer.prices[index] - minPrice) * yScale;
    if (ordinal === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  for (let ordinal = Math.max(0, buffer.count - 16); ordinal < buffer.count - 1; ordinal += 1) {
    const index = readIndex(buffer, ordinal);
    const nextIndex = readIndex(buffer, ordinal + 1);
    const x1 = plotLeft + ordinal * xScale;
    const y1 = plotBottom - (buffer.prices[index] - minPrice) * yScale;
    const x2 = plotLeft + (ordinal + 1) * xScale;
    const y2 = plotBottom - (buffer.prices[nextIndex] - minPrice) * yScale;
    const jump = buffer.jumps[index] === 1 || Math.abs(buffer.prices[nextIndex] - buffer.prices[index]) > priceRange * 0.28;
    ctx.save();
    ctx.strokeStyle = jump ? '#fb7185' : '#67e8f9';
    ctx.lineWidth = jump ? 1.8 : 1.2;
    if (jump) {
      const gap = Math.max(2, 12 / Math.max(0.2, buffer.tensions[index] + 0.2));
      ctx.setLineDash([gap, gap * 1.35]);
    } else {
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  const currentRadius = 5 + currentVolatility * 17;
  ctx.save();
  ctx.strokeStyle = '#f8d66d';
  ctx.fillStyle = 'rgba(248, 214, 109, 0.12)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(targetX, targetY, currentRadius, -Math.PI * 0.8, Math.PI * 0.6);
  ctx.stroke();
  ctx.fill();
  const vectorLength = Math.max(10, currentMagicLength * 18 + currentTension * 22);
  const endX = targetX + Math.cos(currentAngle) * vectorLength;
  const endY = targetY + Math.sin(currentAngle) * vectorLength;
  drawSplitLine(ctx, targetX - Math.cos(currentAngle) * vectorLength, targetY - Math.sin(currentAngle) * vectorLength, endX, endY, targetX, targetY, currentVolatility * 5 + 2);
  ctx.restore();

  for (let distance = 1; distance <= Math.min(buffer.count - 1, 8); distance += 1) {
    const ordinal = buffer.count - 1 - distance;
    const index = readIndex(buffer, ordinal);
    const x = plotLeft + ordinal * xScale;
    const y = plotBottom - (buffer.prices[index] - minPrice) * yScale;
    const radius = Math.max(3, buffer.volatilities[index] * 11);
    ctx.save();
    ctx.globalAlpha = Math.max(0.12, 0.8 - distance * 0.08);
    ctx.strokeStyle = distance === 1 ? '#a7f3d0' : '#94a3b8';
    ctx.lineWidth = distance === 1 ? 1.5 : 1;
    if (distance === 1) drawRoundedNode(ctx, x, y, radius, buffer.angles[index]);
    else drawHexagon(ctx, x, y, radius, buffer.angles[index]);
    ctx.restore();
  }

  ctx.save();
  ctx.fillStyle = '#f8d66d';
  ctx.shadowColor = '#f8d66d';
  ctx.shadowBlur = 8 + Math.sin(frame * 0.08) * 3;
  ctx.beginPath();
  ctx.arc(targetX, targetY, 2.8, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export default function KnotChart({ tick, timeline, history, className = 'h-[360px] w-full', height = 360, maxTicks = 256, futureProjection }: KnotChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestTickData = useRef<KnotTick | undefined>(tick);
  const timelineRef = useRef(timeline);
  const futureProjectionRef = useRef(futureProjection);
  const historyRef = useRef<readonly KnotTick[] | undefined>(undefined);
  const bufferRef = useRef<KnotBuffer>(createBuffer(Math.max(16, maxTicks)));
  const sizeRef = useRef<CanvasSize>({ width: 640, height, dpr: 1 });

  useEffect(() => {
    const buffer = bufferRef.current;
    if (!history || historyRef.current === history) return;
    buffer.count = 0;
    buffer.writeIndex = 0;
    buffer.lastTimestamp = Number.NaN;
    history.forEach((item) => writeTick(buffer, item));
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    latestTickData.current = tick;
    timelineRef.current = timeline;
    futureProjectionRef.current = futureProjection;
    if (tick) writeTick(bufferRef.current, tick);
  }, [tick, timeline]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!context) return undefined;
    const parent = canvas.parentElement;
    let frame = 0;
    let animationFrame = 0;
    let running = true;
    const resize = () => {
      const rect = parent?.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.floor(rect?.width ?? 640));
      const logicalHeight = Math.max(1, Math.floor(rect?.height ?? height));
      sizeRef.current = { width, height: logicalHeight, dpr };
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(logicalHeight * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${logicalHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = typeof ResizeObserver !== 'undefined' && parent ? new ResizeObserver(resize) : undefined;
    observer?.observe(parent as Element);
    resize();
    const draw = () => {
      if (!running) return;
      renderFrame(context, sizeRef.current, bufferRef.current, timelineRef.current, futureProjectionRef.current, frame);
      frame += 1;
      animationFrame = window.requestAnimationFrame(draw);
    };
    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      running = false;
      window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
    };
  }, [height]);

  return <canvas ref={canvasRef} className={`${className} block`} role="img" aria-label="High frequency two-dimensional knot projection chart" />;
}
