export type GravityCenter = {
  side: 'bid' | 'ask';
  price: number;
  strength: number;
  normalized_position: number;
};

export type TrueGravityTensor = {
  net_force: number;
  magnitude: number;
  gradient: { x: number; y: number };
  centers: readonly GravityCenter[];
};

export type MetalHoneycombStyle = {
  fractureCell: number;
  fractureLine: number;
  flashIntensity: number;
  layerGrowth: number;
  eventTimestamp: number;
  percentB?: number;
  crossCell?: number;
  crossLine?: number;
  crossTimestamp?: number;
  sparkBoost?: number;
  distortionHeight?: number;
  faultDepth?: number;
  overheat?: number;
};

export const METAL_CLEAVAGE_LINES = 4;

const TAU = Math.PI * 2;

function finite(value: number | undefined) {
  return Number.isFinite(value) ? Number(value) : 0;
}

function deflect(x: number, y: number, width: number, height: number, tensor: TrueGravityTensor, time: number) {
  let dx = 0;
  let dy = 0;
  for (const center of tensor.centers) {
    const centerX = width * (0.16 + finite(center.normalized_position) * 0.68);
    const centerY = height * (center.side === 'bid' ? 0.72 : 0.28);
    const offsetX = centerX - x;
    const offsetY = centerY - y;
    const distanceSquared = Math.max(offsetX * offsetX + offsetY * offsetY, 900);
    const gaussian = Math.exp(-distanceSquared / Math.max(1, width * height * 0.1));
    const pull = Math.min(0.22, finite(center.strength) * 180 / distanceSquared + gaussian * finite(center.strength) * 0.09);
    dx += offsetX * pull;
    dy += offsetY * pull;
  }
  const wave = Math.sin(time * 0.001 + x * 0.015 + y * 0.01) * tensor.magnitude * 0.6;
  return { x: x + dx + wave, y: y + dy - wave };
}

export function drawGravityHoneycomb(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tensor: TrueGravityTensor | undefined,
  time: number,
) {
  if (!tensor) return;
  const columns = 8;
  const rows = 8;
  const spacing = Math.max(28, Math.min(width / 8.8, height / 8.2));
  const radius = spacing * 0.46;

  ctx.save();
  ctx.globalAlpha = 0.1 + Math.min(0.2, finite(tensor.magnitude) * 0.22);
  ctx.strokeStyle = finite(tensor.net_force) >= 0 ? '#67e8f9' : '#fda4af';
  ctx.lineWidth = 0.7;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const baseX = width * 0.12 + column * spacing + (row % 2) * spacing * 0.5;
      const baseY = height * 0.12 + row * spacing * 0.84;
      const points = Array.from({ length: 6 }, (_, side) => {
        const angle = Math.PI / 6 + side * TAU / 6;
        return deflect(baseX + Math.cos(angle) * radius, baseY + Math.sin(angle) * radius, width, height, tensor, time);
      });
      ctx.beginPath();
      points.forEach((point, side) => {
        if (side === 0) ctx.moveTo(point.x, point.y);
        else ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}


function metalLayout(width: number, height: number) {
  const columns = 8;
  const rows = 6;
  const radius = Math.min(width * 0.82 / 12.5, height * 0.72 / 11.26);
  const horizontalStep = radius * 1.5;
  const verticalStep = Math.sqrt(3) * radius;
  const gridWidth = (columns - 1) * horizontalStep + radius * 2;
  const gridHeight = (rows - 1) * verticalStep + radius * Math.sqrt(3) * 1.5;
  const originX = (width - gridWidth) / 2 + radius;
  const originY = (height - gridHeight) / 2 + radius * Math.sqrt(3) / 2;
  return { columns, rows, radius, horizontalStep, verticalStep, originX, originY };
}

function hexBoundary(radius: number, angle: number) {
  const apothem = radius * Math.sqrt(3) / 2;
  const local = ((angle % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6;
  return apothem / Math.cos(local);
}

export type CleavageCrossing = { cell: number; line: number; x: number; y: number };

/** Detects the price tip crossing one of the 4 cleavage lines of the 48-cell Metal honeycomb. */
export function findCleavageCrossing(
  width: number,
  height: number,
  previous: { x: number; y: number },
  current: { x: number; y: number },
): CleavageCrossing | undefined {
  const layout = metalLayout(width, height);
  let best = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestCenter = { x: 0, y: 0 };
  for (let column = 0; column < layout.columns; column += 1) {
    for (let row = 0; row < layout.rows; row += 1) {
      const x = layout.originX + column * layout.horizontalStep;
      const y = layout.originY + row * layout.verticalStep + (column % 2) * layout.verticalStep / 2;
      const distance = (current.x - x) ** 2 + (current.y - y) ** 2;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = column * layout.rows + row;
        bestCenter = { x, y };
      }
    }
  }
  if (best < 0 || Math.sqrt(bestDistance) > layout.radius * 0.87) return undefined;
  for (let line = 0; line < METAL_CLEAVAGE_LINES; line += 1) {
    const angle = line * Math.PI / METAL_CLEAVAGE_LINES;
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const before = (previous.x - bestCenter.x) * nx + (previous.y - bestCenter.y) * ny;
    const after = (current.x - bestCenter.x) * nx + (current.y - bestCenter.y) * ny;
    if (before * after < 0) return { cell: best, line, x: current.x, y: current.y };
  }
  return undefined;
}

export function drawMetalCrystalHoneycomb(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: MetalHoneycombStyle,
) {
  const columns = 8;
  const rows = 6;
  const radius = Math.min(width * 0.82 / 12.5, height * 0.72 / 11.26);
  const horizontalStep = radius * 1.5;
  const verticalStep = Math.sqrt(3) * radius;
  const gridWidth = (columns - 1) * horizontalStep + radius * 2;
  const gridHeight = (rows - 1) * verticalStep + radius * Math.sqrt(3) * 1.5;
  const originX = (width - gridWidth) / 2 + radius;
  const originY = (height - gridHeight) / 2 + radius * Math.sqrt(3) / 2;
  const fractureCell = Math.max(0, Math.min(columns * rows - 1, Math.floor(style.fractureCell)));
  const fractureLine = Math.max(0, Math.min(5, Math.floor(style.fractureLine)));
  const intensity = Math.max(0, Math.min(1, style.flashIntensity));
  const eventAge = style.eventTimestamp > 0 ? Math.max(0, Date.now() - style.eventTimestamp) : Number.POSITIVE_INFINITY;
  const flash = Math.exp(-eventAge / 720) * intensity;

  const centerOf = (column: number, row: number) => ({
    x: originX + column * horizontalStep,
    y: originY + row * verticalStep + (column % 2) * verticalStep / 2,
  });
  const verticesOf = (column: number, row: number) => {
    const center = centerOf(column, row);
    return Array.from({ length: 6 }, (_, vertex) => {
      const angle = vertex * Math.PI / 3;
      return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    });
  };

  ctx.save();
  ctx.lineJoin = 'round';
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const cellIndex = column * rows + row;
      const center = centerOf(column, row);
      const vertices = verticesOf(column, row);
      const selected = cellIndex === fractureCell;
      ctx.beginPath();
      vertices.forEach((vertex, index) => {
        if (index === 0) ctx.moveTo(vertex.x, vertex.y);
        else ctx.lineTo(vertex.x, vertex.y);
      });
      ctx.closePath();
      ctx.globalAlpha = selected ? 0.22 + flash * 0.25 : 0.14 + Math.abs(style.distortionHeight ?? 0) * 0.12 * (0.5 + 0.5 * Math.sin(cellIndex * 0.7 + Date.now() / 900));
      const height = style.distortionHeight ?? 0;
      ctx.fillStyle = selected ? '#fbbf24' : height > 0.05 ? '#1b2a18' : height < -0.05 ? '#2a1418' : '#101b28';
      ctx.fill();
      ctx.strokeStyle = selected && flash > 0.02 ? '#fff1b8' : '#d8bd76';
      ctx.lineWidth = selected ? 1.1 + flash * 1.6 : 0.65;
      ctx.stroke();

      if (selected && flash > 0.02) {
        const depth = Math.max(1, style.faultDepth ?? 1);
        ctx.save();
        ctx.globalAlpha = Math.min(1, flash * 1.2);
        ctx.strokeStyle = '#fff6cf';
        ctx.lineWidth = 0.8 + depth * 0.5;
        ctx.beginPath();
        ctx.moveTo(center.x, center.y - radius * 0.2);
        const steps = 5 + Math.round(depth * 2);
        for (let step = 1; step <= steps; step += 1) {
          ctx.lineTo(
            center.x + Math.sin(step * 4.7 + cellIndex) * radius * 0.18 * depth,
            center.y - radius * 0.2 + step / steps * radius * 0.5 * depth,
          );
        }
        ctx.stroke();
        ctx.restore();
      }
      const upperHalf = center.y < height / 2;
      const upperBand = (style.percentB ?? 0.5) > 0.5;
      const crossAge = (style.crossTimestamp ?? 0) > 0 ? Math.max(0, Date.now() - (style.crossTimestamp ?? 0)) : Number.POSITIVE_INFINITY;
      const crossFlash = cellIndex === style.crossCell ? Math.exp(-crossAge / 520) : 0;
      for (let line = 0; line < METAL_CLEAVAGE_LINES; line += 1) {
        const angle = line * Math.PI / METAL_CLEAVAGE_LINES;
        const reach = hexBoundary(radius, angle);
        const dx = Math.cos(angle) * reach;
        const dy = Math.sin(angle) * reach;
        ctx.beginPath();
        ctx.moveTo(center.x - dx, center.y - dy);
        ctx.lineTo(center.x + dx, center.y + dy);
        const activeLine = selected && line === fractureLine % METAL_CLEAVAGE_LINES;
        const crossLine = crossFlash > 0.02 && line === (style.crossLine ?? -1);
        const overheatSpark = (style.overheat ?? 0) > 0.05 && ((cellIndex * 5 + line + Math.floor(Date.now() / 160)) % Math.max(2, Math.round(14 - (style.overheat ?? 0) * 11)) === 0)
          ? (style.overheat ?? 0) * 0.7 : 0;
        const hot = Math.max(activeLine ? flash : crossLine ? crossFlash : 0, overheatSpark);
        const bandBoost = upperHalf && upperBand ? 0.12 : !upperHalf && !upperBand ? 0.06 : 0;
        ctx.globalAlpha = hot > 0.02 ? 0.34 + hot * 0.65 : selected ? 0.28 : 0.11 + bandBoost;
        ctx.strokeStyle = hot > 0.02 ? '#fff6cf' : upperHalf ? '#e2b85a' : '#8a6a3a';
        ctx.lineWidth = hot > 0.02 ? 0.7 + hot * 1.8 : 0.45;
        ctx.stroke();
        if (hot > 0.025) {
          ctx.save();
          ctx.fillStyle = '#fff4c2';
          ctx.shadowColor = '#ffd166';
          ctx.shadowBlur = 5 + hot * 14;
          const sparkPhase = Date.now() / 44;
          const sparkCount = 3 + Math.round(Math.max(0, Math.min(1, style.sparkBoost ?? 0)) * 9);
          for (let spark = 0; spark < sparkCount; spark += 1) {
            const t = (sparkPhase * 0.013 + spark * (0.93 / sparkCount)) % 1;
            ctx.beginPath();
            ctx.arc(center.x + dx * (2 * t - 1), center.y + dy * (2 * t - 1), 0.8 + hot * 1.4, 0, TAU);
            ctx.fill();
          }
          ctx.restore();
        }
      }
    }
  }
  ctx.globalAlpha = 0.35;
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = '#f5d98b';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(originX - radius, height / 2);
  ctx.lineTo(originX + gridWidth - radius, height / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export type AnimalVoxelStyle = {
  vortexSpeed?: number;
  hackLocked?: number;
  vortexHighlight?: number;
  vortexAcceleration?: number;
  atrPulse?: number;
  rsiSpread?: number;
  riseStrength?: number;
  collapseTimestamp?: number;
  order: number;
  phaseSigma: number;
  pulsePhase: number;
  alert: boolean;
};

const ANIMAL_POINTS_PER_CELL = 7;
const GOLDEN_ANGLE = 137.50776405 * Math.PI / 180;
const animalCloudCache = new Map<string, { x: number; y: number }[]>();

function seeded(index: number) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function animalCloud(width: number, height: number) {
  const key = `${Math.round(width)}x${Math.round(height)}`;
  const cached = animalCloudCache.get(key);
  if (cached) return cached;
  const layout = metalLayout(width, height);
  const points: { x: number; y: number }[] = [];
  for (let column = 0; column < layout.columns; column += 1) {
    for (let row = 0; row < layout.rows; row += 1) {
      const cell = column * layout.rows + row;
      const cx = layout.originX + column * layout.horizontalStep;
      const cy = layout.originY + row * layout.verticalStep + (column % 2) * layout.verticalStep / 2;
      for (let n = 0; n < ANIMAL_POINTS_PER_CELL; n += 1) {
        const angle = seeded(cell * 31 + n * 7) * TAU;
        const reach = Math.sqrt(seeded(cell * 17 + n * 13 + 5)) * layout.radius * 0.8;
        points.push({ x: cx + Math.cos(angle) * reach, y: cy + Math.sin(angle) * reach });
      }
    }
  }
  if (animalCloudCache.size > 8) animalCloudCache.clear();
  animalCloudCache.set(key, points);
  return points;
}

/**
 * Animal field: every honeycomb cell holds a seeded random point cloud joined into a voxel chain.
 * The lattice is drawn in a wormhole-like squeeze: points are drawn toward the centre as r rises,
 * and action-potential pulses travel the chain along golden-angle phases.
 */
export function drawAnimalVoxelHoneycomb(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  style: AnimalVoxelStyle,
) {
  const layout = metalLayout(width, height);
  const points = animalCloud(width, height);
  const order = Math.max(0, Math.min(1, style.order));
  const squeeze = 1 - 0.3 * order * order;
  const midX = width / 2;
  const midY = height / 2;
  const now = Date.now() / 1000;
  const total = points.length;
  const rise = Math.max(0, Math.min(1, style.riseStrength ?? 0));
  const collapseAge = (style.collapseTimestamp ?? 0) > 0 ? Math.max(0, Date.now() - (style.collapseTimestamp ?? 0)) : Number.POSITIVE_INFINITY;
  const chaos = Math.exp(-collapseAge / 1800);
  const heads = 1 + Math.round(rise * 3);
  const head = ((now * (0.12 + order * 0.5 + rise * 0.9) + style.pulsePhase / TAU) % 1) * total;
  const vortexSpeed = style.vortexSpeed ?? 0;
  const atrPulse = Math.max(0, Math.min(1, style.atrPulse ?? 0));
  const breathe = 1 + atrPulse * 0.12 * Math.sin(now * (1.5 + atrPulse * 3));
  const highlight = Math.floor(style.vortexHighlight ?? -1);
  const mapped = points.map((point, index) => {
    const dx = point.x - midX;
    const dy = point.y - midY;
    const radial = Math.hypot(dx, dy) / Math.max(1, Math.min(width, height) * 0.5);
    const warp = squeeze + (1 - squeeze) * 0.35 * Math.min(1, radial);
    const wobble = Math.sin(now * 1.4 + index * 0.37) * (0.6 + style.phaseSigma * 2.4);
    const scatter = chaos * 26;
    const cellCenterX = layout.originX + Math.floor(index / ANIMAL_POINTS_PER_CELL / layout.rows) * layout.horizontalStep;
    const cell = Math.floor(index / ANIMAL_POINTS_PER_CELL);
    const column = Math.floor(cell / layout.rows);
    const row = cell % layout.rows;
    const cellCenterY = layout.originY + row * layout.verticalStep + (column % 2) * layout.verticalStep / 2;
    const px = point.x - cellCenterX;
    const py = point.y - cellCenterY;
    const swirlAngle = now * vortexSpeed * 0.6 + (Math.hypot(px, py) / layout.radius) * vortexSpeed * 1.4;
    const vx = px * Math.cos(swirlAngle) - py * Math.sin(swirlAngle);
    const vy = px * Math.sin(swirlAngle) + py * Math.cos(swirlAngle);
    const gx = cellCenterX + vx;
    const gy = cellCenterY + vy;
    const gdx = gx - midX;
    const gdy = gy - midY;
    return {
      x: midX + gdx * warp * breathe + wobble + Math.sin(index * 12.9 + now * 5) * scatter,
      y: midY + gdy * warp * breathe + wobble * 0.6 + Math.cos(index * 7.3 + now * 4) * scatter,
    };
  });

  ctx.save();
  ctx.lineCap = 'round';
  const hue = style.alert || order > 0.85 ? '#fbbf24' : '#6ee7b7';
  for (let index = 0; index < total; index += 1) {
    const a = mapped[index];
    const cell = Math.floor(index / ANIMAL_POINTS_PER_CELL);
    const targets = [index + 1, (cell + layout.rows) * ANIMAL_POINTS_PER_CELL + (index % ANIMAL_POINTS_PER_CELL)];
    for (const target of targets) {
      if (target >= total) continue;
      const b = mapped[target];
      let wrapped = total;
      for (let pulse = 0; pulse < heads; pulse += 1) {
        const position = (head + pulse * total / heads) % total;
        wrapped = Math.min(wrapped, Math.abs(index - position), total - Math.abs(index - position));
      }
      const glow = Math.exp(-(wrapped * wrapped) / (18 + order * 40)) * (0.3 + order * 0.7);
      ctx.globalAlpha = 0.07 + glow * 0.6;
      ctx.strokeStyle = chaos > 0.3 ? '#fb7185' : glow > 0.25 ? '#ecfdf5' : hue;
      ctx.lineWidth = 0.4 + glow * 1.4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  for (let index = 0; index < total; index += 1) {
    const phaseGlow = Math.max(0, Math.sin(now * 2 + (index / ANIMAL_POINTS_PER_CELL) * GOLDEN_ANGLE)) * order;
    const marked = highlight >= 0 && index % ANIMAL_POINTS_PER_CELL === highlight;
    const size = 1.6 + phaseGlow * 1.8 + (marked ? 2.2 + (style.vortexAcceleration ? 1.5 : 0) + (style.hackLocked ? 2.5 : 0) : 0);
    ctx.globalAlpha = 0.28 + phaseGlow * 0.6;
    ctx.fillStyle = marked ? (style.hackLocked ? '#ffd740' : style.vortexAcceleration ? '#fef08a' : '#f9a8d4') : hue;
    ctx.fillRect(mapped[index].x - size / 2, mapped[index].y - size / 2, size, size);
  }
  ctx.restore();
}

export function gravityDrift(
  x: number,
  y: number,
  width: number,
  height: number,
  tensor: TrueGravityTensor | undefined,
) {
  return tensor ? deflect(x, y, width, height, tensor, 0) : { x, y };
}

export type GravityWellDrawOptions = {
  wells: readonly { price: number; depth: number }[];
  yOf: (price: number) => number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  field: 'metal' | 'animal';
  chaos: boolean;
  limitCycle: number;
  locked: boolean;
  time: number;
};

/** Volume wells: hexagonal rings shrink and sink into the grid; Metal chaos triggers falling fault cascades, Animal smoothness follows the limit cycle. */
export function drawGravityWells(ctx: CanvasRenderingContext2D, options: GravityWellDrawOptions) {
  const { wells, yOf, left, right, top, bottom, field, chaos, limitCycle, locked, time } = options;
  const width = right - left;
  const tint = field === 'metal' ? '216,189,118' : '110,231,183';
  const seconds = time / 1000;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, width, bottom - top);
  ctx.clip();
  wells.forEach((well, wellIndex) => {
    const y = yOf(well.price);
    if (!Number.isFinite(y) || y < top - 40 || y > bottom + 40) return;
    const band = 14 + well.depth * 34;
    const gradient = ctx.createLinearGradient(0, y - band, 0, y + band);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(0.5, `rgba(0,0,0,${0.18 + well.depth * 0.42})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(left, y - band, width, band * 2);
    const cx = left + width * (0.5 + 0.18 * Math.sin(wellIndex * 2.3));
    const rings = 7;
    const rough = field === 'animal' ? (1 - limitCycle) * 0.25 : 0;
    for (let k = 0; k < rings; k += 1) {
      const t = k / rings;
      const radius = (width * 0.16 + band * 1.2) * (1 - t * 0.85) * (0.5 + well.depth * 0.5);
      const cy = y + t * band * 0.9;
      ctx.beginPath();
      for (let v = 0; v <= 6; v += 1) {
        const angle = (v / 6) * Math.PI * 2 + Math.PI / 6;
        const wobble = 1 + rough * Math.sin(seconds * 3 + v * 2.1 + k);
        const px = cx + Math.cos(angle) * radius * wobble;
        const py = cy + Math.sin(angle) * radius * 0.34 * wobble;
        if (v === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = `rgba(${tint},${0.08 + t * 0.35 * well.depth})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
    if (field === 'metal' && chaos) {
      for (let i = 0; i < 9; i += 1) {
        const progress = (((seconds * 0.9 - i * 0.11) % 1) + 1) % 1;
        const x0 = left + width * ((i + 0.5) / 9);
        const startY = top;
        const endY = startY + (y - startY) * progress * progress;
        ctx.beginPath();
        ctx.moveTo(x0, startY);
        const segments = 6;
        for (let s = 1; s <= segments; s += 1) {
          ctx.lineTo(x0 + (cx - x0) * (s / segments) * progress + Math.sin(i * 9 + s * 3.7) * 6, startY + (endY - startY) * (s / segments));
        }
        ctx.strokeStyle = `rgba(255,236,170,${0.55 * (1 - progress * 0.5)})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
    if (locked && wellIndex === 0) {
      const glow = ctx.createRadialGradient(cx, y, 2, cx, y, 46);
      glow.addColorStop(0, 'rgba(255,215,64,0.55)');
      glow.addColorStop(1, 'rgba(255,215,64,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - 46, y - 46, 92, 92);
    }
  });
  ctx.restore();
}

/** Tension–ω phase-plane inset (Lissajous trajectory). */
export function drawLissajousInset(
  ctx: CanvasRenderingContext2D,
  points: readonly { x: number; y: number }[],
  box: { x: number; y: number; size: number },
  state: { chaos: boolean; stability: number; field: 'metal' | 'animal' },
) {
  if (points.length < 3) return;
  const scale = box.size / 6;
  const cx = box.x + box.size / 2;
  const cy = box.y + box.size / 2;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(box.x, box.y, box.size, box.size);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.strokeRect(box.x, box.y, box.size, box.size);
  ctx.beginPath();
  points.forEach((p, i) => {
    const x = cx + Math.max(-3, Math.min(3, p.x)) * scale;
    const y = cy + Math.max(-3, Math.min(3, p.y)) * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = state.chaos ? '#fb7185' : state.field === 'metal' ? '#fde68a' : '#6ee7b7';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '8px monospace';
  ctx.fillText(`T-ω ${state.chaos ? 'CHAOS' : state.field === 'metal' ? 'STABLE' : 'CYCLE'} ${(state.stability * 100).toFixed(0)}%`, box.x + 4, box.y + box.size - 4);
  ctx.restore();
}
