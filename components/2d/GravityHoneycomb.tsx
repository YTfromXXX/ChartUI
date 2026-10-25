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
      ctx.globalAlpha = selected ? 0.22 + flash * 0.25 : 0.14;
      ctx.fillStyle = selected ? '#fbbf24' : '#101b28';
      ctx.fill();
      ctx.strokeStyle = selected && flash > 0.02 ? '#fff1b8' : '#d8bd76';
      ctx.lineWidth = selected ? 1.1 + flash * 1.6 : 0.65;
      ctx.stroke();

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
        const hot = activeLine ? flash : crossLine ? crossFlash : 0;
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
          for (let spark = 0; spark < 3; spark += 1) {
            const t = (sparkPhase * 0.013 + spark * 0.31) % 1;
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
  const head = ((now * (0.12 + order * 0.5) + style.pulsePhase / TAU) % 1) * total;
  const mapped = points.map((point, index) => {
    const dx = point.x - midX;
    const dy = point.y - midY;
    const radial = Math.hypot(dx, dy) / Math.max(1, Math.min(width, height) * 0.5);
    const warp = squeeze + (1 - squeeze) * 0.35 * Math.min(1, radial);
    const wobble = Math.sin(now * 1.4 + index * 0.37) * (0.6 + style.phaseSigma * 2.4);
    return { x: midX + dx * warp + wobble, y: midY + dy * warp + wobble * 0.6 };
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
      const wrapped = Math.min(Math.abs(index - head), total - Math.abs(index - head));
      const glow = Math.exp(-(wrapped * wrapped) / (18 + order * 40)) * (0.3 + order * 0.7);
      ctx.globalAlpha = 0.07 + glow * 0.6;
      ctx.strokeStyle = glow > 0.25 ? '#ecfdf5' : hue;
      ctx.lineWidth = 0.4 + glow * 1.4;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  for (let index = 0; index < total; index += 1) {
    const phaseGlow = Math.max(0, Math.sin(now * 2 + (index / ANIMAL_POINTS_PER_CELL) * GOLDEN_ANGLE)) * order;
    const size = 1.6 + phaseGlow * 1.8;
    ctx.globalAlpha = 0.28 + phaseGlow * 0.6;
    ctx.fillStyle = hue;
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
