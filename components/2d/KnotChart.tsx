'use client';

import { useEffect, useRef, type MouseEvent, type TouchEvent } from 'react';
import { drawGravityHoneycomb, gravityDrift, type TrueGravityTensor } from './GravityHoneycomb';

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

export type GuidePointer = { x: number; y: number };
export type ProjectionGesture =
  | { type: 'toggle-selection-lock' }
  | { type: 'time-scale'; delta: number }
  | { type: 'rotate-intrusion'; delta: number }
  | { type: 'set-shell-scale'; scale: number }
  | { type: 'open-ticket'; intent: 'buy-stop' | 'sell-step' }
  | { type: 'cycle-pattern'; delta: number }
  | { type: 'change-inventory-page'; delta: number };

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
  gravityTensor?: TrueGravityTensor;
  guideTracking?: boolean;
  guidePointer?: GuidePointer;
  onGuideTrackingChange?: (active: boolean) => void;
  onGuidePointerChange?: (pointer: GuidePointer) => void;
  selectedKnotIds?: readonly number[];
  gridTimeScale?: number;
  shellScale?: number;
  intrusionRotation?: number;
  patternOffset?: number;
  onGesture?: (gesture: ProjectionGesture) => void;
};

type CanvasSize = { width: number; height: number; dpr: number };
type TouchPoints = { length: number; [index: number]: { clientX: number; clientY: number } };

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

function drawSquareArc(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  sweep: number,
) {
  const steps = 14;
  ctx.beginPath();
  for (let step = 0; step <= steps; step += 1) {
    const angle = startAngle + sweep * step / steps;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const scale = radius / Math.max(Math.abs(cosine), Math.abs(sine), 0.001);
    const x = centerX + cosine * scale;
    const y = centerY + sine * scale;
    if (step === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

type ShellIntrusion = {
  colorIndex: number;
  angle: number;
  distortion: number;
};

function drawIntrusionHoneycomb(
  ctx: CanvasRenderingContext2D,
  gridLeft: number,
  gridTop: number,
  cellWidth: number,
  cellHeight: number,
  columns: number,
  rows: number,
  intrusion: ShellIntrusion,
  tension: number,
) {
  const cellRadius = Math.min(cellWidth, cellHeight) * 0.24;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      const x = gridLeft + (column + 0.5) * cellWidth;
      const y = gridTop + (row + 0.5) * cellHeight;
      const colorIndex = (intrusion.colorIndex + index) % DEFAULT_COLORS.length;
      const rotation = intrusion.angle + (row % 2) * Math.PI / 6;
      ctx.save();
      ctx.strokeStyle = DEFAULT_COLORS[colorIndex];
      ctx.globalAlpha = 0.11 + tension * 0.12;
      ctx.lineWidth = 0.65;
      ctx.beginPath();
      for (let side = 0; side <= 6; side += 1) {
        const angle = rotation + side * TAU / 6;
        const pointX = x + Math.cos(angle) * cellRadius;
        const pointY = y + Math.sin(angle) * cellRadius;
        if (side === 0) ctx.moveTo(pointX, pointY);
        else ctx.lineTo(pointX, pointY);
      }
      ctx.stroke();
      ctx.restore();

      if (column < columns - 1) {
        ctx.save();
        ctx.strokeStyle = DEFAULT_COLORS[colorIndex];
        ctx.globalAlpha = 0.08 + tension * 0.08;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x + cellRadius * 0.86, y);
        ctx.lineTo(x + cellWidth - cellRadius * 0.86, y + (row % 2 ? cellHeight * 0.08 : -cellHeight * 0.08));
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  for (let pattern = 0; pattern < 4; pattern += 1) {
    const color = DEFAULT_COLORS[(intrusion.colorIndex + pattern) % DEFAULT_COLORS.length];
    const topColumn = (intrusion.colorIndex * 2 + pattern * 2) % columns;
    const bottomColumn = (intrusion.colorIndex * 3 + pattern * 3 + 1) % columns;
    const topWidth = cellWidth * (0.58 + pattern * 0.11);
    const bottomWidth = cellWidth * (1.28 - pattern * 0.13);
    const topHeight = cellHeight * (0.14 + pattern * 0.035);
    const bottomHeight = cellHeight * (0.3 - pattern * 0.035);

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.12 + tension * 0.1;
    ctx.fillRect(
      gridLeft + topColumn * cellWidth + (cellWidth - topWidth) * 0.5,
      gridTop + cellHeight * 0.32 + pattern * cellHeight * 0.08,
      topWidth,
      topHeight,
    );
    ctx.fillRect(
      gridLeft + bottomColumn * cellWidth + (cellWidth - bottomWidth) * 0.5,
      gridTop + cellHeight * (rows - 1.45) - pattern * cellHeight * 0.06,
      bottomWidth,
      bottomHeight,
    );
    ctx.restore();
  }
}

function drawStrategyStepBoxes(
  ctx: CanvasRenderingContext2D,
  gridLeft: number,
  gridTop: number,
  cellWidth: number,
  cellHeight: number,
  columns: number,
  rows: number,
  selectedKnotIds: readonly number[],
  tension: number,
) {
  if (selectedKnotIds.length === 0) return;
  const selectionSeed = selectedKnotIds.reduce((total, id, index) => total + id * (index + 3), 0);
  for (let pattern = 0; pattern < 4; pattern += 1) {
    const knotId = selectedKnotIds[pattern % selectedKnotIds.length];
    const color = DEFAULT_COLORS[pattern];
    const buyColumn = (selectionSeed + knotId + pattern * 2) % columns;
    const sellColumn = (selectionSeed + knotId * 3 + pattern * 3 + 1) % columns;
    const buyWidth = cellWidth * (0.54 + ((knotId + pattern) % 3) * 0.12);
    const sellWidth = cellWidth * (1.22 - ((knotId + pattern) % 3) * 0.1);
    const buyY = gridTop + cellHeight * (0.22 + pattern * 0.17);
    const sellY = gridTop + cellHeight * (rows - 1.22 - pattern * 0.13);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.18 + tension * 0.14;
    ctx.lineWidth = 0.8;
    ctx.setLineDash(pattern % 2 === 0 ? [3, 3] : [1, 2]);
    ctx.strokeRect(gridLeft + buyColumn * cellWidth + (cellWidth - buyWidth) * 0.5, buyY, buyWidth, cellHeight * 0.13);
    ctx.fillRect(gridLeft + sellColumn * cellWidth + (cellWidth - sellWidth) * 0.5, sellY, sellWidth, cellHeight * 0.22);
    ctx.restore();
  }
}

function drawComplexPlaneGuides(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  targetX: number,
  targetY: number,
  tension: number,
  pricePhase: number,
  frame: number,
  guidePointer: GuidePointer | undefined,
  selectedKnotIds: readonly number[],
  gridTimeScale: number,
  shellScale: number,
  intrusionRotation: number,
  patternOffset: number,
) {
  const columns = 8;
  const rows = 6;
  const gridLeft = width * 0.045;
  const gridRight = width * 0.955;
  const gridTop = height * 0.055;
  const gridBottom = height * 0.945;
  const cellWidth = (gridRight - gridLeft) / columns;
  const cellHeight = (gridBottom - gridTop) / rows;
  const upperHeight = cellHeight * 2;
  const originX = width * (guidePointer?.x ?? 0.72);
  const originY = guidePointer ? height * guidePointer.y : gridTop + upperHeight * 0.52;
  const phase = frame * 0.012 * gridTimeScale + intrusionRotation;
  const distortion = Math.min(0.3, 0.07 + tension * 0.16 + Math.abs(Math.sin(pricePhase)) * 0.09);
  const shellRadiusX = Math.min(width, height) * (0.22 + distortion * 0.22) * shellScale;
  const shellRadiusY = Math.min(width, height) * (0.15 + distortion * 0.16) * shellScale;
  const shellDeltaX = (originX - targetX) / Math.max(shellRadiusX, 1);
  const shellDeltaY = (originY - targetY) / Math.max(shellRadiusY, 1);
  const shellDistance = shellDeltaX ** 2 + shellDeltaY ** 2;
  const intrusion = guidePointer && shellDistance <= 1
    ? {
      colorIndex: (Math.floor((((Math.atan2(shellDeltaY, shellDeltaX) + TAU) % TAU) / TAU) * DEFAULT_COLORS.length) + patternOffset) % DEFAULT_COLORS.length,
      angle: Math.atan2(shellDeltaY, shellDeltaX),
      distortion,
    }
    : undefined;
  const chromaticGlyphs = [
    { color: DEFAULT_COLORS[0], x: -1, y: -1 },
    { color: DEFAULT_COLORS[1], x: 1, y: -1 },
    { color: DEFAULT_COLORS[2], x: 1, y: 1 },
    { color: DEFAULT_COLORS[3], x: -1, y: 1 },
  ];
  const cardinalDirections = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  ctx.save();
  ctx.strokeStyle = '#7dd3fc';
  ctx.globalAlpha = 0.11;
  ctx.lineWidth = 0.6;
  for (let column = 0; column <= columns; column += 1) {
    const x = gridLeft + cellWidth * column;
    ctx.beginPath();
    ctx.moveTo(x, gridTop);
    ctx.lineTo(x, gridBottom);
    ctx.stroke();
  }
  for (let row = 0; row <= rows; row += 1) {
    const y = gridTop + cellHeight * row;
    ctx.beginPath();
    ctx.moveTo(gridLeft, y);
    ctx.lineTo(gridRight, y);
    ctx.stroke();
  }
  ctx.restore();

  const cornerAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = gridLeft + column * cellWidth;
      const y = gridTop + row * cellHeight;
      const cellPhase = phase + row * 0.67 + column * 0.49;
      const cellIndex = row * columns + column;
      const priceMotion = Math.sin(pricePhase + cellPhase);
      const corner = (row + column * 2) % 4;
      const cornerX = x + (corner === 1 || corner === 2 ? cellWidth : 0);
      const cornerY = y + (corner >= 2 ? cellHeight : 0);
      const radius = Math.min(cellWidth, cellHeight) * (0.22 + Math.abs(Math.sin(cellPhase)) * 0.16);
      const arcAngle = Math.min(
        Math.PI / 2 * 0.94,
        (0.26 + Math.abs(Math.cos(cellPhase)) * 0.58 + tension * 0.1) * Math.PI / 2,
      );
      const startAngle = cornerAngles[corner];

      ctx.save();
      ctx.strokeStyle = DEFAULT_COLORS[(row + column) % DEFAULT_COLORS.length];
      ctx.globalAlpha = 0.1 + tension * 0.1;
      ctx.lineWidth = 0.55 + (row + column) % 2 * 0.2;
      ctx.beginPath();
      ctx.arc(cornerX, cornerY, radius, startAngle, startAngle + arcAngle);
      ctx.stroke();
      ctx.restore();

      const centerX = x + cellWidth * 0.5;
      const centerY = y + cellHeight * 0.5;
      const crossArm = Math.min(cellWidth, cellHeight) * (0.08 + Math.abs(Math.sin(cellPhase)) * 0.06);
      ctx.save();
      ctx.strokeStyle = '#e0f2fe';
      ctx.globalAlpha = 0.055 + tension * 0.08;
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.moveTo(centerX - crossArm, centerY);
      ctx.lineTo(centerX + crossArm, centerY);
      ctx.moveTo(centerX, centerY - crossArm);
      ctx.lineTo(centerX, centerY + crossArm);
      ctx.stroke();
      ctx.restore();

      chromaticGlyphs.forEach((glyph, glyphIndex) => {
        const direction = cardinalDirections[glyphIndex];
        const perpendicular = { x: -direction.y, y: direction.x };
        const glyphArm = crossArm * (0.5 + (cellIndex % 4) * 0.08);
        const travel = priceMotion * Math.min(cellWidth, cellHeight) * 0.12;
        const movingCenterX = centerX + direction.x * travel;
        const movingCenterY = centerY + direction.y * travel;
        const isTShape = glyphIndex % 2 === 1;
        ctx.save();
        ctx.strokeStyle = glyph.color;
        const selected = intrusion?.colorIndex === glyphIndex;
        ctx.globalAlpha = selected ? 0.45 : 0.1 + tension * 0.12;
        ctx.shadowColor = selected ? glyph.color : 'transparent';
        ctx.shadowBlur = selected ? 5 : 0;
        ctx.lineWidth = selected ? 1.1 : 0.65;
        ctx.beginPath();
        if (isTShape) {
          ctx.moveTo(
            movingCenterX - perpendicular.x * glyphArm * 0.6,
            movingCenterY - perpendicular.y * glyphArm * 0.6,
          );
          ctx.lineTo(
            movingCenterX + perpendicular.x * glyphArm * 0.6,
            movingCenterY + perpendicular.y * glyphArm * 0.6,
          );
          ctx.moveTo(movingCenterX, movingCenterY);
          ctx.lineTo(
            movingCenterX + direction.x * glyphArm,
            movingCenterY + direction.y * glyphArm,
          );
        } else {
          ctx.moveTo(
            movingCenterX - perpendicular.x * glyphArm * 0.55,
            movingCenterY - perpendicular.y * glyphArm * 0.55,
          );
          ctx.lineTo(movingCenterX, movingCenterY);
          ctx.lineTo(
            movingCenterX + direction.x * glyphArm,
            movingCenterY + direction.y * glyphArm,
          );
        }
        ctx.stroke();
        ctx.restore();
      });
    }
  }

  if (intrusion) {
    ctx.save();
    ctx.strokeStyle = DEFAULT_COLORS[intrusion.colorIndex];
    ctx.globalAlpha = 0.44;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath();
    ctx.ellipse(targetX, targetY, shellRadiusX, shellRadiusY, intrusion.angle, 0, TAU);
    ctx.stroke();
    ctx.restore();
    drawIntrusionHoneycomb(ctx, gridLeft, gridTop, cellWidth, cellHeight, columns, rows, intrusion, tension);
  }
  drawStrategyStepBoxes(ctx, gridLeft, gridTop, cellWidth, cellHeight, columns, rows, selectedKnotIds, tension);

  ctx.save();
  ctx.strokeStyle = '#c4b5fd';
  ctx.globalAlpha = 0.28;
  ctx.lineWidth = 0.8;
  ctx.setLineDash([3, 7]);
  ctx.beginPath();
  ctx.moveTo(gridLeft, originY);
  ctx.lineTo(gridRight, originY);
  ctx.moveTo(originX, gridTop);
  ctx.lineTo(originX, gridBottom);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  const upperRadii = [0.04, 0.07, 0.1, 0.13].map((ratio) => Math.min(width, height) * ratio);
  upperRadii.forEach((radius, index) => {
    ctx.save();
    ctx.strokeStyle = DEFAULT_COLORS[index];
    const selected = intrusion?.colorIndex === index;
    ctx.globalAlpha = selected ? 0.62 : 0.25 + tension * 0.14;
    ctx.shadowColor = DEFAULT_COLORS[index];
    ctx.shadowBlur = selected ? 16 : 5 + index * 2;
    ctx.lineWidth = selected ? 1.8 : 0.8 + index * 0.22;
    drawSquareArc(
      ctx,
      originX,
      originY,
      radius,
      phase + index * 0.72,
      Math.PI * (0.62 + index * 0.11),
    );
    ctx.stroke();
    ctx.restore();
  });

  const chartRadii = [0.052, 0.09, 0.145].map((ratio) => Math.min(width, height) * ratio);
  chartRadii.forEach((radius, index) => {
    const startAngle = Math.PI + phase * 0.7 + index * 0.45;
    const arcAngle = Math.PI * (0.38 + index * 0.18);
    ctx.save();
    ctx.strokeStyle = DEFAULT_COLORS[(index + 1) % DEFAULT_COLORS.length];
    ctx.globalAlpha = 0.14 + tension * 0.16;
    ctx.lineWidth = 0.65 + index * 0.28;
    ctx.beginPath();
    ctx.arc(
      targetX,
      targetY,
      radius,
      startAngle,
      startAngle + arcAngle,
      true,
    );
    ctx.stroke();
    ctx.restore();

  });

  const spokeCount = 8;
  const ringCount = 6;
  const webRadius = Math.min(width, height) * 0.22;
  const webNodes: Array<{ x: number; y: number; angle: number; color: string }> = [];
  for (let ring = 0; ring < ringCount; ring += 1) {
    for (let spoke = 0; spoke < spokeCount; spoke += 1) {
      const nodeIndex = ring * spokeCount + spoke;
      const angle = spoke * TAU / spokeCount + Math.sin(pricePhase + nodeIndex * 0.37) * 0.09;
      const radius = webRadius * (0.22 + ring * 0.14) + Math.cos(pricePhase * 0.7 + nodeIndex) * 3;
      const x = targetX + Math.cos(angle) * radius;
      const y = targetY + Math.sin(angle) * radius;
      const color = DEFAULT_COLORS[spoke % DEFAULT_COLORS.length];
      webNodes.push({ x, y, angle, color });

      const fragmentRadius = 4 + ring * 1.1;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI);
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.17 + tension * 0.12;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (const side of [0, 1, 2, 4]) {
        const start = side * TAU / 6;
        const end = (side + 1) * TAU / 6;
        ctx.moveTo(Math.cos(start) * fragmentRadius, Math.sin(start) * fragmentRadius);
        ctx.lineTo(Math.cos(end) * fragmentRadius, Math.sin(end) * fragmentRadius);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  webNodes.forEach((node, nodeIndex) => {
    const ring = Math.floor(nodeIndex / spokeCount);
    const spoke = nodeIndex % spokeCount;
    const inwardNode = ring > 0 ? webNodes[(ring - 1) * spokeCount + spoke] : undefined;
    const clockwiseNode = webNodes[ring * spokeCount + (spoke + 1) % spokeCount];
    ctx.save();
    ctx.strokeStyle = node.color;
    ctx.globalAlpha = 0.1 + tension * 0.1;
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    if (inwardNode && (nodeIndex + ring) % 5 !== 0) {
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(inwardNode.x, inwardNode.y);
    }
    if ((nodeIndex + spoke) % 4 !== 0) {
      ctx.moveTo(node.x, node.y);
      ctx.lineTo(clockwiseNode.x, clockwiseNode.y);
    }
    ctx.stroke();
    ctx.restore();

    const relativeX = node.x - targetX;
    const relativeY = node.y - targetY;
    const horizontal = Math.abs(relativeX) >= Math.abs(relativeY);
    const wallX = horizontal ? (relativeX >= 0 ? gridRight + 6 : gridLeft - 6) : node.x;
    const wallY = horizontal ? node.y : (relativeY >= 0 ? gridBottom + 6 : gridTop - 6);
    const routeLength = Math.min(cellWidth, cellHeight) * 0.18;
    const perpendicular = horizontal ? { x: 0, y: 1 } : { x: 1, y: 0 };
    for (let point = 0; point < 7; point += 1) {
      const progress = point / 6;
      const hexStep = Math.sin(progress * TAU * 2.5 + pricePhase + nodeIndex * 0.31) * routeLength;
      const pointX = node.x + (wallX - node.x) * progress + perpendicular.x * hexStep;
      const pointY = node.y + (wallY - node.y) * progress + perpendicular.y * hexStep;
      ctx.save();
      ctx.fillStyle = node.color;
      ctx.globalAlpha = 0.12 + progress * 0.24 + tension * 0.1;
      ctx.shadowColor = node.color;
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.arc(pointX, pointY, 0.8 + (point % 3) * 0.35, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  });

  ctx.save();
  ctx.strokeStyle = '#f8d66d';
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(targetX - width * 0.18, targetY);
  ctx.lineTo(targetX + width * 0.075, targetY);
  ctx.moveTo(targetX, targetY - height * 0.13);
  ctx.lineTo(targetX, targetY + height * 0.13);
  ctx.stroke();
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

function drawFutureKnot(ctx: CanvasRenderingContext2D, targetX: number, targetY: number, width: number, height: number, projection: KnotFutureProjection, gravityTensor: TrueGravityTensor | undefined, frame: number) {
  const vertical = Math.max(0, Math.min(1, projection.vertical_pressure));
  const horizontal = Math.max(0, Math.min(1, projection.horizontal_pressure));
  const futureWidth = Math.min(width * 0.3, 154);
  const pulse = 1 + Math.sin(frame * 0.06) * 0.045;
  const scaleX = (0.92 + horizontal * 0.5 - vertical * 0.16) * pulse;
  const scaleY = (0.88 + vertical * 0.72 - horizontal * 0.12) * pulse;
  const undistortedAnchorX = targetX + futureWidth * 0.56;
  const undistortedAnchorY = targetY + ((projection.coordinates.at(-1)?.y ?? 0.5) - 0.5) * height * 0.22;
  const anchor = gravityDrift(undistortedAnchorX, undistortedAnchorY, width, height, gravityTensor);
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
    const pathPoint = gravityDrift(
      targetX + futureWidth * ((index + 1) / Math.max(1, projection.coordinates.length)) * (0.65 + point.x * 0.35),
      targetY + (point.y - 0.5) * height * 0.32,
      width,
      height,
      gravityTensor,
    );
    const pointX = pathPoint.x;
    const pointY = pathPoint.y;
    if (index === 0) ctx.lineTo(pointX, pointY);
    else ctx.quadraticCurveTo(pointX - futureWidth * 0.08, pointY, pointX, pointY);
  });
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(anchor.x, anchor.y);
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

function renderFrame(ctx: CanvasRenderingContext2D, size: CanvasSize, buffer: KnotBuffer, timeline: KnotChartProps['timeline'], futureProjection: KnotFutureProjection | undefined, gravityTensor: TrueGravityTensor | undefined, guidePointer: GuidePointer | undefined, selectedKnotIds: readonly number[], gridTimeScale: number, shellScale: number, intrusionRotation: number, patternOffset: number, frame: number) {
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
  const rawTargetY = plotBottom - (currentPrice - minPrice) * yScale;
  const targetY = Math.max(height * 0.18, Math.min(height * 0.82, rawTargetY));
  const gravityTarget = gravityDrift(targetX, targetY, width, height, gravityTensor);

  drawGravityHoneycomb(ctx, width, height, gravityTensor, frame * 16.67);
  const pricePhase = ((currentPrice - minPrice) / priceRange) * TAU + currentAngle;
  drawComplexPlaneGuides(ctx, width, height, gravityTarget.x, gravityTarget.y, currentTension, pricePhase, frame, guidePointer, selectedKnotIds, gridTimeScale, shellScale, intrusionRotation, patternOffset);
  if (timeline?.t40m) drawTimelinePath(ctx, width, height, currentTension, timeline.t40m, gravityTarget.x, gravityTarget.y, 0);
  if (timeline?.t4h) drawTimelinePath(ctx, width, height, currentTension, timeline.t4h, gravityTarget.x, gravityTarget.y, 1);
  if (timeline?.target) drawTimelinePath(ctx, width, height, currentTension, timeline.target, gravityTarget.x, gravityTarget.y, 2);
  if (timeline?.best) drawTimelinePath(ctx, width, height, currentTension, timeline.best, gravityTarget.x, gravityTarget.y, 3);
  drawFutureKnot(ctx, gravityTarget.x, gravityTarget.y, width, height, projection, gravityTensor, frame);

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
  ctx.arc(gravityTarget.x, gravityTarget.y, currentRadius, -Math.PI * 0.8, Math.PI * 0.6);
  ctx.stroke();
  ctx.fill();
  const vectorLength = Math.max(10, currentMagicLength * 18 + currentTension * 22);
  const endX = gravityTarget.x + Math.cos(currentAngle) * vectorLength;
  const endY = gravityTarget.y + Math.sin(currentAngle) * vectorLength;
  drawSplitLine(ctx, gravityTarget.x - Math.cos(currentAngle) * vectorLength, gravityTarget.y - Math.sin(currentAngle) * vectorLength, endX, endY, gravityTarget.x, gravityTarget.y, currentVolatility * 5 + 2);
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
  ctx.arc(gravityTarget.x, gravityTarget.y, 2.8, 0, TAU);
  ctx.fill();
  ctx.restore();
}

export default function KnotChart({ tick, timeline, history, className = 'h-[360px] w-full', height = 360, maxTicks = 256, futureProjection, gravityTensor, guideTracking = false, guidePointer, onGuideTrackingChange, onGuidePointerChange, selectedKnotIds = [], gridTimeScale = 1, shellScale = 1, intrusionRotation = 0, patternOffset = 0, onGesture }: KnotChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latestTickData = useRef<KnotTick | undefined>(tick);
  const timelineRef = useRef(timeline);
  const futureProjectionRef = useRef(futureProjection);
  const gravityTensorRef = useRef(gravityTensor);
  const guideTrackingRef = useRef(guideTracking);
  const guidePointerRef = useRef<GuidePointer | undefined>(guidePointer);
  const selectedKnotIdsRef = useRef<readonly number[]>(selectedKnotIds);
  const gestureStartRef = useRef<{ count: number; x: number; y: number; lastX: number; lastY: number; distance: number; shellScale: number; timestamp: number } | undefined>(undefined);
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
    gravityTensorRef.current = gravityTensor;
    guideTrackingRef.current = guideTracking;
    selectedKnotIdsRef.current = selectedKnotIds;
    if (tick) writeTick(bufferRef.current, tick);
  }, [tick, timeline, futureProjection, gravityTensor, guideTracking, selectedKnotIds]);

  useEffect(() => {
    if (!guidePointer) return;
    guidePointerRef.current = {
      x: Math.max(0, Math.min(1, guidePointer.x)),
      y: Math.max(0, Math.min(1, guidePointer.y)),
    };
  }, [guidePointer]);

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
      const logicalHeight = Math.max(1, Math.min(height, Math.floor(rect?.height || height)));
      sizeRef.current = { width, height: logicalHeight, dpr };
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(logicalHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = typeof ResizeObserver !== 'undefined' && parent ? new ResizeObserver(resize) : undefined;
    observer?.observe(parent as Element);
    resize();
    const draw = () => {
      if (!running) return;
      renderFrame(context, sizeRef.current, bufferRef.current, timelineRef.current, futureProjectionRef.current, gravityTensorRef.current, guideTrackingRef.current ? guidePointerRef.current : undefined, selectedKnotIdsRef.current, gridTimeScale, shellScale, intrusionRotation, patternOffset, frame);
      frame += 1;
      animationFrame = window.requestAnimationFrame(draw);
    };
    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      running = false;
      window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
    };
  }, [height, gridTimeScale, shellScale, intrusionRotation, patternOffset]);

  const updateGuidePointer = (event: MouseEvent<HTMLCanvasElement>) => {
    if (!guideTrackingRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pointer = {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(rect.width, 1))),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(rect.height, 1))),
    };
    guidePointerRef.current = pointer;
    onGuidePointerChange?.(pointer);
  };

  const touchCenter = (touches: TouchPoints) => {
    const x = Array.from({ length: touches.length }, (_, index) => touches[index].clientX).reduce((total, value) => total + value, 0) / Math.max(touches.length, 1);
    const y = Array.from({ length: touches.length }, (_, index) => touches[index].clientY).reduce((total, value) => total + value, 0) / Math.max(touches.length, 1);
    return { x, y };
  };

  const touchDistance = (touches: TouchPoints) => touches.length < 2 ? 0 : Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);

  const updateTouchPointer = (event: TouchEvent<HTMLCanvasElement>, clientX: number, clientY: number) => {
    if (!guideTrackingRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pointer = { x: Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(rect.width, 1))), y: Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(rect.height, 1))) };
    guidePointerRef.current = pointer;
    onGuidePointerChange?.(pointer);
  };

  const handleTouchStart = (event: TouchEvent<HTMLCanvasElement>) => {
    const center = touchCenter(event.touches);
    gestureStartRef.current = { count: event.touches.length, x: center.x, y: center.y, lastX: center.x, lastY: center.y, distance: touchDistance(event.touches), shellScale, timestamp: performance.now() };
    if (event.touches.length === 1) updateTouchPointer(event, center.x, center.y);
  };

  const handleTouchMove = (event: TouchEvent<HTMLCanvasElement>) => {
    const start = gestureStartRef.current;
    if (!start || event.touches.length !== start.count) return;
    const center = touchCenter(event.touches);
    start.lastX = center.x;
    start.lastY = center.y;
    if (start.count === 1) {
      updateTouchPointer(event, center.x, center.y);
    } else if (start.count === 2 && start.distance > 0) {
      const ratio = touchDistance(event.touches) / start.distance;
      if (Math.abs(ratio - 1) > 0.06) onGesture?.({ type: 'set-shell-scale', scale: start.shellScale * ratio });
    }
  };

  const handleTouchEnd = (event: TouchEvent<HTMLCanvasElement>) => {
    if (event.touches.length > 0) return;
    const start = gestureStartRef.current;
    gestureStartRef.current = undefined;
    if (!start) return;
    const deltaX = start.lastX - start.x;
    const deltaY = start.lastY - start.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (start.count === 2 && distance < 18 && performance.now() - start.timestamp < 320) {
      onGesture?.({ type: 'toggle-selection-lock' });
    } else if (start.count === 2 && distance >= 28) {
      if (Math.abs(deltaX) >= Math.abs(deltaY)) onGesture?.({ type: 'rotate-intrusion', delta: Math.sign(deltaX) * 0.16 });
      else onGesture?.({ type: 'time-scale', delta: Math.sign(deltaY) * -0.12 });
    } else if (start.count === 3 && distance >= 32) {
      if (Math.abs(deltaY) > Math.abs(deltaX)) onGesture?.({ type: 'open-ticket', intent: deltaY < 0 ? 'buy-stop' : 'sell-step' });
      else onGesture?.({ type: 'cycle-pattern', delta: Math.sign(deltaX) });
    } else if (start.count >= 4 && Math.abs(deltaX) >= 32 && Math.abs(deltaX) > Math.abs(deltaY)) {
      onGesture?.({ type: 'change-inventory-page', delta: Math.sign(deltaX) });
    }
  };

  return <canvas ref={canvasRef} onMouseMove={updateGuidePointer} onDoubleClick={() => onGuideTrackingChange?.(!guideTrackingRef.current)} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} className={`${className} block touch-none ${guideTracking ? 'cursor-crosshair' : ''}`} role="img" aria-label="High frequency two-dimensional knot projection chart" />;
}
