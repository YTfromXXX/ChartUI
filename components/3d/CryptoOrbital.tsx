'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

type CryptoOrbitalProps = {
  tilt: number;
  radius: number;
  blinkHz: number;
  pnlRatio: number;
  annihilation: number;
};

const SHELLS = 3;
const PER_SHELL = 160;

const VERTEX = /* glsl */ `
  attribute float aAngle;
  attribute float aSeed;
  attribute float aShell;
  uniform float uTime;
  uniform float uRadius;
  uniform float uBlink;
  uniform float uChaos;
  varying float vAlpha;
  varying float vSeed;
  float hash(float n) { return fract(sin(n * 91.345) * 47453.5453); }
  void main() {
    float shellScale = 1.0 - aShell * 0.26;
    float angle = aAngle + uTime * (0.35 + aShell * 0.18);
    float r = uRadius * shellScale;
    vec3 p = vec3(cos(angle) * r, sin(angle) * r * 0.62, sin(angle * 2.0 + aShell) * 0.12 * r);
    float scatter = uChaos * (hash(aSeed + floor(uTime * 12.0)) - 0.5) * 2.4;
    p += vec3(scatter, hash(aSeed * 3.1 + floor(uTime * 12.0)) * scatter, scatter * 0.6);
    p *= 1.0 - smoothstep(0.92, 1.0, uChaos) * 0.9;
    float blink = 0.5 + 0.5 * sin(uTime * uBlink * 6.2831853 + aSeed * 6.2831853);
    vAlpha = mix(0.25, 1.0, pow(blink, 2.0)) * (1.0 - uChaos * 0.45 * hash(aSeed * 7.7 + floor(uTime * 20.0)));
    vSeed = aSeed;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = (2.5 + 3.0 * blink) * (260.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uChaos;
  varying float vAlpha;
  varying float vSeed;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    vec3 color = mix(uColor, vec3(1.0, 0.25, 0.35), uChaos * step(0.5, fract(vSeed * 13.0)));
    gl_FragColor = vec4(color, vAlpha * smoothstep(0.5, 0.0, d));
  }
`;

/** Electron orbital shell: tilt = direction, radius = size, blink rate = unrealised P&L, chaos = liquidation proximity. */
export function CryptoOrbitalShell({ tilt, radius, blinkHz, pnlRatio, annihilation }: CryptoOrbitalProps) {
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => {
    const count = SHELLS * PER_SHELL;
    const angle = new Float32Array(count);
    const seed = new Float32Array(count);
    const shell = new Float32Array(count);
    for (let index = 0; index < count; index += 1) {
      const s = Math.floor(index / PER_SHELL);
      angle[index] = ((index % PER_SHELL) / PER_SHELL) * Math.PI * 2;
      seed[index] = (Math.sin(index * 12.9898) * 43758.5453) % 1;
      shell[index] = s;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aAngle', new THREE.BufferAttribute(angle, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aShell', new THREE.BufferAttribute(shell, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 4);
    return geo;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: 2 },
      uBlink: { value: 1 },
      uChaos: { value: 0 },
      uColor: { value: new THREE.Color('#fde68a') },
    },
  }), []);

  useFrame(({ clock }) => {
    const u = material.uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uRadius.value += (radius - u.uRadius.value) * 0.1;
    u.uBlink.value = blinkHz;
    u.uChaos.value += (annihilation - u.uChaos.value) * 0.15;
    (u.uColor.value as THREE.Color).set(pnlRatio >= 0 ? '#fde68a' : '#fb7185');
    if (groupRef.current) groupRef.current.rotation.z += (tilt - groupRef.current.rotation.z) * 0.1;
  });

  return <group ref={groupRef}><points geometry={geometry} material={material} frustumCulled={false} /></group>;
}
