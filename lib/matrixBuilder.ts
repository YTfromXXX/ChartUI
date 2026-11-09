import type { Vec3 } from '@/lib/collisionEngine';

export type CameraCapture = {
  cameraId: number;
  direction: Vec3;
  particleMomentum: Vec3;
  mass: number;
  energy: number;
  contactArea: number;
};

export type MatrixCell = {
  id: number;
  position: Vec3;
  polarity: 'LONG' | 'SHORT';
  energy: number;
  mass: number;
  cameraCoverage: number;
  arcanaId: number;
  sigil: string;
};

export type MatrixBuildResult = {
  cells: MatrixCell[];
  polarity: 'LONG' | 'SHORT';
  energy: number;
  targetOffset: number;
  captureCount: number;
  status: 'SIMULATED';
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const magnitude = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const normalized = (v: Vec3): Vec3 => {
  const size = magnitude(v);
  return size > 1e-9 ? { x: v.x / size, y: v.y / size, z: v.z / size } : { x: 0, y: 1, z: 0 };
};

/** Reconstructs a 48-cell Fibonacci matrix from 22 mock camera observations. */
export function build48Matrix(captures: readonly CameraCapture[]): MatrixBuildResult {
  const momentum = captures.reduce<Vec3>((sum, capture) => ({
    x: sum.x + capture.particleMomentum.x * Math.max(0, capture.mass),
    y: sum.y + capture.particleMomentum.y * Math.max(0, capture.mass),
    z: sum.z + capture.particleMomentum.z * Math.max(0, capture.mass),
  }), { x: 0, y: 0, z: 0 });
  const totalMass = captures.reduce((sum, capture) => sum + Math.max(0, capture.mass), 0);
  const totalEnergy = captures.reduce((sum, capture) => sum + Math.max(0, capture.energy), 0);
  const meanContact = captures.length
    ? captures.reduce((sum, capture) => sum + Math.max(0, capture.contactArea), 0) / captures.length
    : 0;
  const polarity = momentum.y >= 0 ? 'LONG' : 'SHORT';
  const direction = normalized(momentum);
  const targetOffset = Math.sign(momentum.y || 1) * Math.min(1, totalEnergy / Math.max(1, totalMass * 10));

  const cells = Array.from({ length: 48 }, (_, id): MatrixCell => {
    const z = 1 - 2 * (id + 0.5) / 48;
    const radius = Math.sqrt(Math.max(0, 1 - z * z));
    const angle = id * GOLDEN_ANGLE;
    const position = { x: radius * Math.cos(angle), y: z, z: radius * Math.sin(angle) };
    const alignment = Math.max(0, direction.x * position.x + direction.y * position.y + direction.z * position.z);
    const localEnergy = clamp((totalEnergy / 48) * (0.5 + alignment) + meanContact * alignment, 0, 1e6);
    return {
      id,
      position,
      polarity: direction.y * position.y >= 0 ? 'LONG' : 'SHORT',
      energy: localEnergy,
      mass: totalMass / 48,
      cameraCoverage: captures.filter((capture) => {
        const view = normalized(capture.direction);
        return view.x * position.x + view.y * position.y + view.z * position.z > 0.65;
      }).length,
      arcanaId: id % 22,
      sigil: `ARCANA-${String(id % 22).padStart(2, '0')}`,
    };
  });

  return {
    cells,
    polarity,
    energy: totalEnergy,
    targetOffset,
    captureCount: captures.length,
    status: 'SIMULATED',
  };
}

/** Deterministic illustrative burst observed from 22 camera directions. */
export function createMockCameraCaptures(seed: number, contactArea: number, energy: number): CameraCapture[] {
  return Array.from({ length: 22 }, (_, cameraId) => {
    const angle = cameraId * GOLDEN_ANGLE + seed * 0.001;
    const vertical = Math.sin(cameraId * 1.7 + seed * 0.003);
    const sign = cameraId % 3 === 0 ? -1 : 1;
    const direction = normalized({ x: Math.cos(angle), y: vertical, z: Math.sin(angle) });
    const mass = 0.3 + ((cameraId * 17 + seed) % 70) / 100;
    return {
      cameraId,
      direction,
      particleMomentum: {
        x: direction.x * mass * sign,
        y: direction.y * mass * sign,
        z: direction.z * mass * sign,
      },
      mass,
      energy: energy * (0.6 + ((cameraId * 13 + seed) % 60) / 100) / 22,
      contactArea: contactArea * (0.5 + ((cameraId * 7 + seed) % 50) / 100),
    };
  });
}
