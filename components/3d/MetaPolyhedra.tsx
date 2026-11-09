'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { MetaNesting, MetaPolyhedronKind } from '@/lib/fieldModels';

const STEP = Math.PI / 12;

const VERTEX = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uSlip;
  uniform float uOuter;
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.2);
    float fringes = 0.5 + 0.5 * sin(dot(vPos, vec3(7.0, 5.0, 3.0)) - uTime * 6.0);
    fringes *= uSlip;
    vec3 p = vPos * (5.0 + uSlip * 4.0);
    float crack = 1.0 - smoothstep(0.0, 0.06, abs(sin(p.x * 1.7 + sin(p.y * 2.3)) * sin(p.y * 1.3 + p.z * 1.1)));
    crack *= uSlip;
    vec3 color = uColor * (0.25 + fresnel * (uOuter > 0.5 ? 0.9 : 1.4));
    color += vec3(0.4, 0.8, 1.0) * fringes * 0.5 + vec3(1.0, 0.25, 0.3) * crack;
    float alpha = (uOuter > 0.5 ? 0.12 : 0.28) + fresnel * 0.5 + crack * 0.5 + fringes * 0.15;
    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.95));
  }
`;

function geometryFor(kind: MetaPolyhedronKind) {
  switch (kind) {
    case 'tetrahedron': return new THREE.TetrahedronGeometry(1);
    case 'octahedron': return new THREE.OctahedronGeometry(1);
    case 'cube': return new THREE.BoxGeometry(1.35, 1.35, 1.35);
    case 'icosahedron': return new THREE.IcosahedronGeometry(1);
    case 'dodecahedron': return new THREE.DodecahedronGeometry(1);
    default: return new THREE.IcosahedronGeometry(1, 1);
  }
}

function makeMaterial(color: string, outer: boolean) {
  return new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uSlip: { value: 0 }, uOuter: { value: outer ? 1 : 0 } },
  });
}

type Props = { nesting: MetaNesting };

/** Matryoshka: outer polyhedron = parent index, inner polyhedra = members. Vertex count follows weight. */
export function MetaNestedPolyhedra({ nesting }: Props) {
  const nestingRef = useRef(nesting);
  nestingRef.current = nesting;
  const outerRef = useRef<THREE.Group>(null);
  const innerRefs = useRef<(THREE.Group | null)[]>([]);
  const outerMaterial = useMemo(() => makeMaterial('#67e8f9', true), []);
  const innerMaterials = useMemo(() => Array.from({ length: 6 }, () => makeMaterial('#fde68a', false)), []);
  const outerGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.55, 1), []);
  const kindKey = nesting.shells.map((shell) => shell.kind).join('|');
  const innerGeometries = useMemo(() => nesting.shells.slice(0, 6).map((shell) => geometryFor(shell.kind)), [kindKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock }) => {
    const current = nestingRef.current;
    const t = clock.elapsedTime;
    const now = Date.now();
    const outerTarget = current.outerStepIndex * STEP;
    if (outerRef.current) outerRef.current.rotation.y += (outerTarget - outerRef.current.rotation.y) * 0.2;
    outerMaterial.uniforms.uTime.value = t;
    outerMaterial.uniforms.uSlip.value = Math.min(1, current.slipCount * 0.25);
    current.shells.slice(0, 6).forEach((shell, index) => {
      const group = innerRefs.current[index];
      if (!group) return;
      const orbit = index * Math.PI / 3 + outerTarget;
      const target = shell.stepIndex * STEP;
      group.rotation.y += (target - group.rotation.y) * 0.25;
      const age = shell.broken ? Math.max(0, 1 - (now - shell.slipStartedAt) / 1800) : 0;
      const shake = shell.broken ? Math.sin(t * 60 + index) * 0.02 * (1 + age * 2) : 0;
      group.position.set(Math.cos(orbit) * 0.82 + shake, Math.sin(index * 1.7) * 0.28, Math.sin(orbit) * 0.82 - shake);
      const mat = innerMaterials[index];
      mat.uniforms.uTime.value = t;
      mat.uniforms.uSlip.value += ((shell.broken ? 0.55 + age * 0.45 : 0) - mat.uniforms.uSlip.value) * 0.2;
      (mat.uniforms.uColor.value as THREE.Color).set(shell.broken ? '#fb7185' : '#fde68a');
    });
  });

  return (
    <group>
      <group ref={outerRef}><mesh geometry={outerGeometry} material={outerMaterial} /></group>
      {nesting.shells.slice(0, 6).map((shell, index) => (
        <group key={shell.symbol} ref={(node) => { innerRefs.current[index] = node; }}>
          <mesh geometry={innerGeometries[index]} material={innerMaterials[index]} scale={0.2 + shell.weight * 1.5} />
        </group>
      ))}
    </group>
  );
}
