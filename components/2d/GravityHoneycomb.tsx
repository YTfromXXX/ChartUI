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

export function gravityDrift(
  x: number,
  y: number,
  width: number,
  height: number,
  tensor: TrueGravityTensor | undefined,
) {
  return tensor ? deflect(x, y, width, height, tensor, 0) : { x, y };
}
