export type Vec3 = { x: number; y: number; z: number };

export type CollisionParameters = {
  friction: number;
  gravityWell: number;
  /** Fractal spike/sole rebound coefficient, clamped to 0..1. */
  fractalRestitution: number;
};

export type CollisionInput = {
  ballCenter: Vec3;
  ballRadius: number;
  skeletonStart: Vec3;
  skeletonEnd: Vec3;
  skeletonRadius: number;
};

export type CollisionResult = {
  collided: boolean;
  contactPoint: Vec3;
  penetration: number;
  contactArea: number;
  intersectionVolume: number;
  differenceVolume: number;
  energyRelease: number;
  reboundVelocity: Vec3;
};

export type LuminanceProbe = {
  width: number;
  height: number;
  mean: number;
  peak: number;
  samples: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (v: Vec3, factor: number): Vec3 => ({ x: v.x * factor, y: v.y * factor, z: v.z * factor });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const length = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const normalize = (v: Vec3): Vec3 => {
  const magnitude = length(v);
  return magnitude > 1e-9 ? scale(v, 1 / magnitude) : { x: 0, y: 1, z: 0 };
};

function closestPointOnSegment(point: Vec3, start: Vec3, end: Vec3): Vec3 {
  const segment = sub(end, start);
  const denominator = dot(segment, segment);
  const t = denominator > 0 ? clamp(dot(sub(point, start), segment) / denominator, 0, 1) : 0;
  return add(start, scale(segment, t));
}

/**
 * Stable analytic contact proxy for a spherical price cluster and capsule-like
 * indicator boundary. The reported volumes are geometric estimates for display;
 * they are not a mesh CSG operation or a physical market measurement.
 */
export function solveBallSkeletonContact(
  input: CollisionInput,
  parameters: CollisionParameters,
  incomingVelocity: Vec3 = { x: 0, y: -1, z: 0 },
): CollisionResult {
  const ballRadius = Math.max(0, input.ballRadius);
  const skeletonRadius = Math.max(0, input.skeletonRadius);
  const closest = closestPointOnSegment(input.ballCenter, input.skeletonStart, input.skeletonEnd);
  const offset = sub(input.ballCenter, closest);
  const distance = length(offset);
  const radiusSum = ballRadius + skeletonRadius;
  const penetration = Math.max(0, radiusSum - distance);
  const collided = penetration > 0 && radiusSum > 0;
  const normal = normalize(offset);

  if (!collided) {
    return {
      collided: false,
      contactPoint: closest,
      penetration: 0,
      contactArea: 0,
      intersectionVolume: 0,
      differenceVolume: (4 / 3) * Math.PI * ballRadius ** 3,
      energyRelease: 0,
      reboundVelocity: incomingVelocity,
    };
  }

  const contactRadius = Math.sqrt(Math.max(0, 2 * ballRadius * penetration - penetration ** 2));
  const contactArea = Math.PI * contactRadius ** 2;
  const sphereVolume = (4 / 3) * Math.PI * ballRadius ** 3;
  const overlapFraction = clamp(penetration / Math.max(radiusSum, 1e-9), 0, 1);
  const intersectionVolume = sphereVolume * overlapFraction ** 2 * (3 - 2 * overlapFraction);
  const differenceVolume = Math.max(0, sphereVolume - intersectionVolume);

  const friction = clamp(parameters.friction, 0, 1);
  const gravityWell = clamp(parameters.gravityWell, 0, 1);
  const restitution = clamp(parameters.fractalRestitution, 0, 1);
  const normalSpeed = dot(incomingVelocity, normal);
  const normalVelocity = scale(normal, normalSpeed);
  const tangentVelocity = sub(incomingVelocity, normalVelocity);
  const reboundVelocity = add(
    scale(normalVelocity, -restitution),
    scale(tangentVelocity, 1 - friction),
  );
  const energyRelease = contactArea * (0.25 + 0.75 * restitution) * (1 + gravityWell);

  return {
    collided,
    contactPoint: add(closest, scale(normal, skeletonRadius)),
    penetration,
    contactArea,
    intersectionVolume,
    differenceVolume,
    energyRelease,
    reboundVelocity,
  };
}

/**
 * Samples a deterministic low-resolution contact mask from the analytic collision
 * proxy. It is intentionally not presented as GPU framebuffer readback.
 */
export function sampleContactLuminance(contactArea: number, energy: number, size = 32): LuminanceProbe {
  const dimension = Math.max(4, Math.min(128, Math.floor(size)));
  const radius = Math.sqrt(Math.max(0, contactArea) / Math.PI);
  let sum = 0;
  let peak = 0;
  for (let y = 0; y < dimension; y += 1) {
    for (let x = 0; x < dimension; x += 1) {
      const nx = ((x + 0.5) / dimension) * 2 - 1;
      const ny = ((y + 0.5) / dimension) * 2 - 1;
      const distance = Math.hypot(nx, ny);
      const edge = Math.max(0, 1 - distance / Math.max(0.03, radius));
      const lightning = Math.max(0, 1 - Math.abs(nx - Math.sin(ny * 22) * 0.08) * dimension * 0.12);
      const luminance = clamp(edge * 0.65 + lightning * Math.min(1, Math.max(0, energy)) * 0.35, 0, 1);
      sum += luminance;
      peak = Math.max(peak, luminance);
    }
  }
  return { width: dimension, height: dimension, mean: sum / (dimension * dimension), peak, samples: dimension * dimension };
}

export async function hashExperimentRecord(record: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable; experiment digest was not created.');
  const canonical = JSON.stringify(record);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
