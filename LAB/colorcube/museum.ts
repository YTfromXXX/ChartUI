// colorcube museum: one weathering-steel room per Cure kit item (19 skeleton + 3 internal).
// Concept after Richard Serra: the plate's weight, lean and torque are the content; the
// visitor's path around it is the experience. Here each room is a study in realistic
// UI drawing (lighting, material, shadow, perspective) of a single plate.

import { CURE_KIT, type KitItem } from '@/lib/cureKit';

export type PlateForm = 'slab' | 'arc' | 'torqued' | 'prop' | 'spiral';

export type Room = {
  kit: KitItem;
  wing: '骨格棟' | '内部棟';
  form: PlateForm;
  /** Height relative to plan size. */
  height: number;
  /** Twist of the top edge against the base, degrees. */
  torque: number;
  /** Lean of the plate, degrees. */
  lean: number;
  /** 0 = mill-scale steel, 1 = fully rusted. */
  oxidation: number;
  /** Drawing techniques studied in this room. */
  techniques: string[];
};

const FORM_OVERRIDES: Partial<Record<number, PlateForm>> = {
  1: 'slab', // 背骨
  13: 'arc', // エアコン: parallel division lines bent into a curve
  16: 'prop', // カオス・トリガー: balanced on a hair trigger
  17: 'torqued', // 骨格維持の檻: encloses the chaos at the center
  22: 'spiral', // 砂時計: loops the spiral
};

const FORMS: PlateForm[] = ['arc', 'torqued', 'slab', 'prop', 'spiral'];

const TECHNIQUES: Record<PlateForm, string[]> = {
  slab: ['lambert shading', 'contact shadow', 'edge highlight'],
  arc: ['ruled surface', 'inside / outside shading', 'atmospheric falloff'],
  torqued: ['lofted ellipse', 'painter\'s sort', 'specular rim'],
  prop: ['balanced lean', 'cast shadow', 'occlusion seam'],
  spiral: ['path-following wall', 'depth fog', 'rust turbulence'],
};

export const MUSEUM: readonly Room[] = CURE_KIT.map((kit) => {
  const form = FORM_OVERRIDES[kit.id] ?? FORMS[kit.id % FORMS.length];
  return {
    kit,
    wing: kit.layer === 'skeleton' ? '骨格棟' : '内部棟',
    form,
    height: 0.9 + ((kit.id * 7) % 5) * 0.12,
    torque: form === 'torqued' ? 28 + (kit.id % 4) * 8 : form === 'spiral' ? 0 : (kit.id % 3) * 6,
    lean: form === 'prop' ? 14 : ((kit.id % 5) - 2) * 2,
    oxidation: 0.25 + ((kit.id * 11) % 10) / 13,
    techniques: TECHNIQUES[form],
  };
});

type V3 = [number, number, number];

/** Plan curve (x, z) of each form, unit scale. */
function planCurve(form: PlateForm): [number, number][] {
  const pts: [number, number][] = [];
  const n = 36;
  switch (form) {
    case 'slab':
      for (let i = 0; i <= 6; i += 1) pts.push([-1 + (i / 6) * 2, 0]);
      break;
    case 'arc':
      for (let i = 0; i <= n; i += 1) { const a = (-70 + (140 * i) / n) * (Math.PI / 180); pts.push([Math.sin(a) * 1.3, -Math.cos(a) * 1.3 + 0.9]); }
      break;
    case 'torqued':
      for (let i = 0; i <= n; i += 1) { const a = (i / n) * Math.PI * 2; pts.push([Math.cos(a) * 1.15, Math.sin(a) * 0.75]); }
      break;
    case 'prop':
      for (let i = 0; i <= 6; i += 1) pts.push([-1.1 + (i / 6) * 1.0, -0.15]);
      break;
    case 'spiral':
      for (let i = 0; i <= n * 2; i += 1) { const t = i / (n * 2); const a = t * Math.PI * 3; const r = 0.25 + t; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
      break;
  }
  return pts;
}

export type Quad = { points: [number, number][]; shade: number; depth: number };

/**
 * Loft the plan curve into a ruled steel surface (base -> twisted, leaning top) and
 * project it obliquely. Returns quads sorted back-to-front with a lambert shade in [0, 1].
 */
export function plateQuads(room: Room, scale = 60): Quad[] {
  const base = planCurve(room.form);
  const torque = (room.torque * Math.PI) / 180;
  const lean = Math.tan((room.lean * Math.PI) / 180);
  const h = room.height * 1.6;
  const top: V3[] = base.map(([x, z]) => [x * Math.cos(torque) - z * Math.sin(torque) + lean * h, h, x * Math.sin(torque) + z * Math.cos(torque)]);
  const bottom: V3[] = base.map(([x, z]) => [x, 0, z]);
  const project = ([x, y, z]: V3): [number, number] => [(x + z * 0.45) * scale, (-y + z * 0.32) * scale];
  const light: V3 = [-0.5, 0.6, -0.62];

  const quads: Quad[] = [];
  const addSurface = (lower: V3[], upper: V3[]) => {
    for (let i = 0; i < lower.length - 1; i += 1) {
      const a = lower[i]; const b = lower[i + 1]; const c = upper[i + 1];
      const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const nx = u[1] * v[2] - u[2] * v[1]; const ny = u[2] * v[0] - u[0] * v[2]; const nz = u[0] * v[1] - u[1] * v[0];
      const len = Math.hypot(nx, ny, nz) || 1;
      const lambert = Math.abs((nx * light[0] + ny * light[1] + nz * light[2]) / len);
      quads.push({ points: [project(a), project(b), project(c), project(upper[i])], shade: 0.18 + 0.82 * lambert, depth: (a[2] + b[2] + c[2]) / 3 });
    }
  };
  addSurface(bottom, top);
  if (room.form === 'prop') {
    // The second plate leans against the first.
    const mirror = (p: V3): V3 => [-p[0] + 0.1, p[1], -p[2] + 0.1];
    addSurface(bottom.map(mirror), top.map((p) => mirror([p[0] - 2 * lean * h, p[1], p[2]])));
  }
  return quads.sort((p, q) => q.depth - p.depth);
}

/** Weathering-steel color for a lambert shade and oxidation level. */
export function steelColor(shade: number, oxidation: number) {
  const mill = [52, 48, 46];
  const rust = [139, 58, 20];
  const mix = mill.map((m, i) => m + (rust[i] - m) * oxidation);
  return `rgb(${mix.map((c) => Math.round(Math.min(255, c * (0.35 + shade)))).join(',')})`;
}
