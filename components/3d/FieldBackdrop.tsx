'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

const COLUMNS = 8;
const ROWS = 6;
const RADIUS = 0.62;
const POINTS_PER_CELL = 7;
const BACKDROP_Z = -7;

function cellCenter(column: number, row: number) {
  const horizontal = RADIUS * 1.5;
  const vertical = Math.sqrt(3) * RADIUS;
  return {
    x: (column - (COLUMNS - 1) / 2) * horizontal,
    y: (row - (ROWS - 1) / 2) * vertical + (column % 2 ? vertical / 2 : 0) - vertical / 4,
  };
}

function seeded(index: number) {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function hexReach(angle: number) {
  const local = ((angle % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3) - Math.PI / 6;
  return (RADIUS * Math.sqrt(3) / 2) / Math.cos(local);
}

type MetalBackdropProps = {
  wellDepth?: number;
  wellOffset?: number;
  distortionHeight?: number;
  fractureCell: number;
  crossCell: number;
  crossTimestamp: number;
  percentB: number;
};

/** Metal: the 2D 48-cell crystal honeycomb with 4 cleavage lines, rendered as a backdrop plane. */
export function MetalHoneycombBackdrop({ distortionHeight = 0, wellDepth = 0, wellOffset = 0, fractureCell, crossCell, crossTimestamp, percentB }: MetalBackdropProps) {
  const { hexLines, cleaveLines } = useMemo(() => {
    const hex: number[] = [];
    const cleave: number[] = [];
    for (let column = 0; column < COLUMNS; column += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        const c = cellCenter(column, row);
        for (let v = 0; v < 6; v += 1) {
          const a0 = v * Math.PI / 3;
          const a1 = (v + 1) * Math.PI / 3;
          hex.push(c.x + Math.cos(a0) * RADIUS, c.y + Math.sin(a0) * RADIUS, 0, c.x + Math.cos(a1) * RADIUS, c.y + Math.sin(a1) * RADIUS, 0);
        }
        for (let line = 0; line < 4; line += 1) {
          const angle = line * Math.PI / 4;
          const reach = hexReach(angle);
          cleave.push(c.x - Math.cos(angle) * reach, c.y - Math.sin(angle) * reach, 0, c.x + Math.cos(angle) * reach, c.y + Math.sin(angle) * reach, 0);
        }
      }
    }
    const build = (values: number[]) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
      return geometry;
    };
    return { hexLines: build(hex), cleaveLines: build(cleave) };
  }, []);
  const hexMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: '#d8bd76', transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false }), []);
  const cleaveMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: '#b38b42', transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false }), []);
  const flashRef = useRef<THREE.Mesh>(null);
  const hexBase = useMemo(() => Float32Array.from(hexLines.getAttribute('position').array as ArrayLike<number>), [hexLines]);
  const flashMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff1b8', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), []);
  useFrame(({ clock }) => {
    const attr = hexLines.getAttribute('position') as THREE.BufferAttribute;
    const lift = THREE.MathUtils.clamp(distortionHeight, -1, 1) * 1.1;
    const t = clock.getElapsedTime();
    for (let index = 0; index < attr.count; index += 1) {
      const x = hexBase[index * 3];
      const y = hexBase[index * 3 + 1];
      const sink = wellDepth * 1.6 * Math.exp(-((y - wellOffset * 2.4) ** 2) / 0.9) * Math.exp(-(x * x) / 14);
      attr.setZ(index, lift * Math.sin(x * 0.8 + y * 0.6 + t * 0.9) * Math.exp(-(x * x + y * y) / 30) - sink);
    }
    attr.needsUpdate = true;
    const mesh = flashRef.current;
    if (!mesh) return;
    const cell = crossTimestamp > 0 ? crossCell : fractureCell;
    const column = Math.floor(Math.max(0, cell) / ROWS) % COLUMNS;
    const row = Math.max(0, cell) % ROWS;
    const c = cellCenter(column, row);
    mesh.position.set(c.x, c.y, 0.01);
    const age = crossTimestamp > 0 ? Math.max(0, Date.now() - crossTimestamp) : Infinity;
    flashMaterial.opacity = Math.exp(-age / 520) * 0.45 + 0.05;
    hexMaterial.opacity = 0.18 + (percentB > 0.5 ? 0.1 : 0);
  });
  return (
    <group position={[0, 0, BACKDROP_Z]} scale={1.9}>
      <lineSegments geometry={hexLines} material={hexMaterial} />
      <lineSegments geometry={cleaveLines} material={cleaveMaterial} />
      <mesh ref={flashRef} material={flashMaterial} rotation={[0, 0, Math.PI / 6]}>
        <circleGeometry args={[RADIUS, 6]} />
      </mesh>
    </group>
  );
}

type AnimalBackdropProps = { order: number; phaseSigma: number; phase: number; wellDepth?: number; wellOffset?: number };

/** Animal: the 2D voxel-chained point cloud per cell, squeezed like a wormhole as r rises. */
export function AnimalVoxelBackdrop({ order, phaseSigma, phase, wellDepth = 0, wellOffset = 0 }: AnimalBackdropProps) {
  const total = COLUMNS * ROWS * POINTS_PER_CELL;
  const base = useMemo(() => {
    const values = new Float32Array(total * 2);
    for (let column = 0; column < COLUMNS; column += 1) {
      for (let row = 0; row < ROWS; row += 1) {
        const cell = column * ROWS + row;
        const c = cellCenter(column, row);
        for (let n = 0; n < POINTS_PER_CELL; n += 1) {
          const angle = seeded(cell * 31 + n * 7) * Math.PI * 2;
          const reach = Math.sqrt(seeded(cell * 17 + n * 13 + 5)) * RADIUS * 0.8;
          const index = (cell * POINTS_PER_CELL + n) * 2;
          values[index] = c.x + Math.cos(angle) * reach;
          values[index + 1] = c.y + Math.sin(angle) * reach;
        }
      }
    }
    return values;
  }, [total]);
  const segmentPairs = useMemo(() => {
    const pairs: [number, number][] = [];
    for (let index = 0; index < total; index += 1) {
      const cell = Math.floor(index / POINTS_PER_CELL);
      if (index + 1 < total) pairs.push([index, index + 1]);
      const next = (cell + ROWS) * POINTS_PER_CELL + (index % POINTS_PER_CELL);
      if (next < total) pairs.push([index, next]);
    }
    return pairs;
  }, [total]);
  const { pointObject, lineObject } = useMemo(() => {
    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 3), 3));
    const points = new THREE.Points(pointGeometry, new THREE.PointsMaterial({ color: '#6ee7b7', size: 0.07, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }));
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segmentPairs.length * 6), 3));
    const lines = new THREE.LineSegments(lineGeometry, new THREE.LineBasicMaterial({ color: '#6ee7b7', transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false }));
    points.frustumCulled = false;
    lines.frustumCulled = false;
    return { pointObject: points, lineObject: lines };
  }, [segmentPairs, total]);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const r = THREE.MathUtils.clamp(order, 0, 1);
    const squeeze = 1 - 0.3 * r * r;
    const pointAttr = pointObject.geometry.getAttribute('position') as THREE.BufferAttribute;
    const lineAttr = lineObject.geometry.getAttribute('position') as THREE.BufferAttribute;
    const wobbleAmp = 0.01 + phaseSigma * 0.04;
    for (let index = 0; index < total; index += 1) {
      const bx = base[index * 2];
      const by = base[index * 2 + 1];
      const radial = Math.min(1, Math.hypot(bx, by) / 3.2);
      const warp = squeeze + (1 - squeeze) * 0.35 * radial;
      const wobble = Math.sin(t * 1.4 + index * 0.37) * wobbleAmp;
      const sink = wellDepth * 1.6 * Math.exp(-((by - wellOffset * 2.4) ** 2) / 0.9) * Math.exp(-(bx * bx) / 14);
      pointAttr.setXYZ(index, bx * warp + wobble, by * warp + wobble * 0.6, -sink);
    }
    segmentPairs.forEach(([a, b], index) => {
      lineAttr.setXYZ(index * 2, pointAttr.getX(a), pointAttr.getY(a), pointAttr.getZ(a));
      lineAttr.setXYZ(index * 2 + 1, pointAttr.getX(b), pointAttr.getY(b), pointAttr.getZ(b));
    });
    pointAttr.needsUpdate = true;
    lineAttr.needsUpdate = true;
    const gold = r > 0.85;
    (pointObject.material as THREE.PointsMaterial).color.set(gold ? '#fbbf24' : '#6ee7b7');
    (lineObject.material as THREE.LineBasicMaterial).color.set(gold ? '#fbbf24' : '#6ee7b7');
    (lineObject.material as THREE.LineBasicMaterial).opacity = 0.14 + 0.25 * (0.5 + 0.5 * Math.sin(t * (1 + r * 3) + phase)) * r;
  });
  return (
    <group position={[0, 0, BACKDROP_Z]} scale={1.9}>
      <primitive object={lineObject} />
      <primitive object={pointObject} />
    </group>
  );
}

type KumoBandProps = {
  field: 'metal' | 'animal';
  center: number;
  thickness: number;
  breakTimestamp: number;
  collapseTimestamp: number;
};

const KUMO_SCALE = 40;

/** Ichimoku cloud as a tension band (Metal crystal layer) or stability zone (Animal) around the spiral. */
export function KumoBand({ field, center, thickness, breakTimestamp, collapseTimestamp }: KumoBandProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bandRef = useRef<THREE.Mesh>(null);
  const crackRef = useRef<THREE.LineSegments>(null);
  const material = useMemo(() => new THREE.MeshBasicMaterial({
    color: field === 'metal' ? '#d4a94a' : '#34d399',
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  }), [field]);
  const crackMaterial = useMemo(() => new THREE.LineBasicMaterial({ color: field === 'metal' ? '#fff1b8' : '#fb7185', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }), [field]);
  const crackGeometry = useMemo(() => {
    const values: number[] = [];
    const segments = 28;
    for (let step = 0; step < segments; step += 1) {
      const a0 = step / segments * Math.PI * 2;
      const a1 = (step + 1) / segments * Math.PI * 2;
      const j0 = Math.sin(step * 12.9) * 0.5;
      const j1 = Math.sin((step + 1) * 12.9) * 0.5;
      values.push(Math.cos(a0) * 2.28, j0, Math.sin(a0) * 2.28, Math.cos(a1) * 2.28, j1, Math.sin(a1) * 2.28);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3));
    return geometry;
  }, []);
  useFrame(() => {
    const group = groupRef.current;
    const band = bandRef.current;
    if (!group || !band) return;
    const height = THREE.MathUtils.clamp(thickness * KUMO_SCALE, 0.06, 1.6);
    group.position.y = THREE.MathUtils.lerp(group.position.y, THREE.MathUtils.clamp(center * KUMO_SCALE, -2, 2), 0.1);
    band.scale.y = THREE.MathUtils.lerp(band.scale.y, height, 0.1);
    const stamp = field === 'metal' ? breakTimestamp : collapseTimestamp;
    const age = stamp > 0 ? Math.max(0, Date.now() - stamp) : Number.POSITIVE_INFINITY;
    const fault = Math.exp(-age / 1200);
    material.opacity = 0.1 + fault * 0.25;
    crackMaterial.opacity = fault;
    if (crackRef.current) {
      crackRef.current.visible = fault > 0.03;
      crackRef.current.scale.y = height * 1.6;
    }
  });
  return (
    <group ref={groupRef}>
      <mesh ref={bandRef} material={material}>
        <cylinderGeometry args={[2.25, 2.25, 1, 64, 1, true]} />
      </mesh>
      <lineSegments ref={crackRef} geometry={crackGeometry} material={crackMaterial} visible={false} />
    </group>
  );
}

type WellShaderProps = {
  field: 'metal' | 'animal';
  depth: number;
  offset: number;
  chaos: number;
  smooth: number;
  locked: boolean;
};

const WELL_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const WELL_FRAGMENT = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uDepth;
uniform float uChaos;
uniform float uSmooth;
uniform float uField;
uniform float uLocked;
void main() {
  vec2 p = (vUv - 0.5) * vec2(2.0, 2.0);
  float r = length(vec2(p.x * 0.55, p.y));
  float hole = smoothstep(0.55, 0.0, r) * uDepth;
  // Metal: hard hex rings, chaos drops fault streaks (falling G). Animal: smooth tunnel wall that roughens as the limit cycle breaks.
  float hex = abs(sin(r * 26.0 - uTime * 0.6 * (1.0 + uField)));
  float rough = (1.0 - uSmooth) * 0.35 * sin(atan(p.y, p.x) * 7.0 + uTime * 3.0);
  float ring = smoothstep(0.92, 1.0, hex + rough * uField) * hole;
  float streak = step(0.93, fract(sin(floor(vUv.x * 40.0) * 91.7) * 4375.5));
  float fall = streak * smoothstep(0.0, 1.0, fract(vUv.y * 2.0 + uTime * 1.4 + floor(vUv.x * 40.0) * 0.13)) * uChaos * (1.0 - uField);
  vec3 tint = mix(vec3(0.85, 0.72, 0.38), vec3(0.42, 0.9, 0.7), uField);
  vec3 col = tint * ring * 1.4 + vec3(1.0, 0.93, 0.7) * fall * hole;
  col = mix(col, vec3(1.0, 0.84, 0.25) * hole * 1.8, uLocked * smoothstep(0.25, 0.0, r));
  float alpha = clamp(hole * 0.55 + ring * 0.8 + fall * hole + uLocked * hole, 0.0, 0.95);
  gl_FragColor = vec4(col, alpha);
}`;

/** Volume gravity well shader: a hole in the honeycomb backdrop at the deepest volume price band. */
export function GravityWellShader({ field, depth, offset, chaos, smooth, locked }: WellShaderProps) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: WELL_VERTEX,
    fragmentShader: WELL_FRAGMENT,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uDepth: { value: 0 },
      uChaos: { value: 0 },
      uSmooth: { value: 1 },
      uField: { value: field === 'animal' ? 1 : 0 },
      uLocked: { value: 0 },
    },
  }), [field]);
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    material.uniforms.uTime.value = clock.getElapsedTime();
    material.uniforms.uDepth.value = THREE.MathUtils.lerp(material.uniforms.uDepth.value, depth, 0.1);
    material.uniforms.uChaos.value = THREE.MathUtils.lerp(material.uniforms.uChaos.value, chaos, 0.1);
    material.uniforms.uSmooth.value = THREE.MathUtils.lerp(material.uniforms.uSmooth.value, smooth, 0.1);
    material.uniforms.uLocked.value = THREE.MathUtils.lerp(material.uniforms.uLocked.value, locked ? 1 : 0, 0.15);
    if (meshRef.current) meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, offset * 2.4 * 1.9, 0.1);
  });
  if (depth <= 0.01) return null;
  return (
    <mesh ref={meshRef} position={[0, 0, BACKDROP_Z + 0.05]} material={material}>
      <planeGeometry args={[14, 7]} />
    </mesh>
  );
}
