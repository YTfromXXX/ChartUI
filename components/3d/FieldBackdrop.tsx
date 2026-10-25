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
  fractureCell: number;
  crossCell: number;
  crossTimestamp: number;
  percentB: number;
};

/** Metal: the 2D 48-cell crystal honeycomb with 4 cleavage lines, rendered as a backdrop plane. */
export function MetalHoneycombBackdrop({ fractureCell, crossCell, crossTimestamp, percentB }: MetalBackdropProps) {
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
  const flashMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff1b8', transparent: true, opacity: 0, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), []);
  useFrame(() => {
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

type AnimalBackdropProps = { order: number; phaseSigma: number; phase: number };

/** Animal: the 2D voxel-chained point cloud per cell, squeezed like a wormhole as r rises. */
export function AnimalVoxelBackdrop({ order, phaseSigma, phase }: AnimalBackdropProps) {
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
      pointAttr.setXYZ(index, bx * warp + wobble, by * warp + wobble * 0.6, 0);
    }
    segmentPairs.forEach(([a, b], index) => {
      lineAttr.setXYZ(index * 2, pointAttr.getX(a), pointAttr.getY(a), 0);
      lineAttr.setXYZ(index * 2 + 1, pointAttr.getX(b), pointAttr.getY(b), 0);
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
