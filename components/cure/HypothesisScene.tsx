'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

export type GraphPattern = 'SQUEEZE' | 'REVERSAL' | 'EXPANDING' | 'EXTENDED';
export type SceneHypothesis = 'A' | 'B';

type Props = {
  hypothesis: SceneHypothesis;
  pattern: GraphPattern;
  speed: number;
  stress: number;
  fracture: number;
  freezeFrame: number;
  triggerId: number;
};

const meshVertex = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uStress;
  uniform int uPattern;
  void main() {
    vUv = uv;
    vec3 p = position;
    float envelope = exp(-p.x * p.x * (1.0 + uStress * 5.0));
    if (uPattern == 0) {
      p.z += sin(p.x * 8.0 - uTime) * 0.12 * envelope;
      p.y *= 1.0 - 0.56 * envelope * (0.5 + 0.5 * sin(uTime));
    } else if (uPattern == 1) {
      float bounce = abs(fract(uTime * 0.22 + p.x * 0.22) * 2.0 - 1.0);
      p.z += (1.0 - bounce) * 0.4 * envelope;
      p.y += (abs(p.x) - 0.65) * 0.3;
    } else if (uPattern == 2) {
      p.z += sin(p.x * 5.0 + uTime) * 0.17 * (0.2 + uStress);
      p.x *= 1.0 + 0.2 * sin(uTime * 0.6);
      p.y *= 1.0 + 0.3 * sin(uTime * 0.6);
    } else {
      p.z += sin(uTime * 1.4 + p.x * 2.0) * 0.2;
      p.x = floor(p.x * 36.0 + 0.5) / 36.0;
      p.y = floor(p.y * 22.0 + 0.5) / 22.0;
    }
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const meshFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uStress;
  uniform float uImpact;
  uniform int uPattern;
  void main() {
    vec2 grid = abs(fract(vUv * vec2(46.0, 28.0)) - 0.5);
    float line = 1.0 - smoothstep(0.465, 0.49, min(grid.x, grid.y));
    float center = exp(-pow((vUv.x - 0.5) * 9.0, 2.0));
    float pulse = 0.5 + 0.5 * sin(uTime * 2.0 + vUv.x * 18.0);
    vec3 base = uPattern == 3 ? vec3(0.15, 0.78, 0.95) : vec3(0.95, 0.42, 0.16);
    float pixel = uPattern == 3 ? step(0.36, fract(sin(dot(floor(vUv * vec2(64.0,36.0)), vec2(12.9898,78.233))) * 43758.5453)) : 0.0;
    float glow = (0.18 + 0.55 * line + 0.35 * center * pulse + pixel * 0.4) * (1.0 + uImpact * 2.0);
    vec3 color = base * glow + vec3(1.0, 0.72, 0.28) * uImpact * center;
    gl_FragColor = vec4(color, 0.3 + 0.62 * max(line, center));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// SDF max/min operators visualize intersection and subtraction masks in the GPU shader.
const collisionFragment = /* glsl */ `
  varying vec2 vUv;
  uniform float uTime;
  uniform float uEnergy;
  void main() {
    vec2 p = (vUv - 0.5) * vec2(2.5, 1.2);
    float ball = length(p - vec2(-0.2 + 0.15 * sin(uTime), 0.0)) - 0.28;
    float bone = abs(p.y - (0.25 * sin(p.x * 3.2))) - 0.075;
    float intersectionSdf = max(ball, bone);
    float subtractionSdf = max(ball, -bone);
    float intersection = 1.0 - smoothstep(0.0, 0.035, abs(intersectionSdf));
    float cutEdge = 1.0 - smoothstep(0.0, 0.02, abs(subtractionSdf));
    float bolt = 1.0 - smoothstep(0.012, 0.035, abs(p.x - 0.18 * sin(p.y * 24.0 + uTime * 5.0)));
    vec3 color = vec3(0.02, 0.03, 0.05);
    color += vec3(0.03, 0.8, 0.95) * intersection * 0.75;
    color += vec3(0.95, 0.2, 0.1) * cutEdge * 0.55;
    color += vec3(0.8, 0.9, 1.0) * bolt * uEnergy;
    gl_FragColor = vec4(color, 0.85);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const eggVertex = /* glsl */ `
  varying vec3 vNormalLocal;
  varying vec3 vPositionLocal;
  uniform float uTime;
  uniform float uStress;
  uniform float uFracture;
  void main() {
    vNormalLocal = normal;
    vec3 p = position;
    float strain = sin(p.y * 20.0 + p.x * 11.0 + uTime * 0.4) * uStress * 0.018;
    p += normal * (strain + uFracture * 0.07 * sin(p.y * 9.0 + p.x * 6.0));
    vPositionLocal = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const eggFragment = /* glsl */ `
  varying vec3 vNormalLocal;
  varying vec3 vPositionLocal;
  uniform float uTime;
  uniform float uStress;
  uniform float uFracture;
  uniform float uTrigger;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  void main() {
    vec3 p = normalize(vPositionLocal);
    float n = hash(floor(p * 18.0));
    float crackLine = abs(fract((p.x * 8.0 + p.y * 13.0 + p.z * 5.0) * 3.0 + n * 0.14) - 0.5);
    float cracks = (1.0 - smoothstep(0.0, 0.035 + (1.0 - uStress) * 0.06, crackLine)) * uStress;
    cracks = max(cracks, uFracture * step(0.86, n) * 0.9);
    float fresnel = pow(1.0 - abs(normalize(vNormalLocal).z), 2.0);
    vec3 shell = mix(vec3(0.62, 0.75, 0.68), vec3(0.95, 0.76, 0.45), fresnel);
    vec3 color = mix(shell, vec3(1.0, 0.84, 0.25), cracks);
    float laser = (1.0 - smoothstep(0.0, 0.045, abs(vPositionLocal.x - sin(uTime * 3.0) * 0.03))) * uTrigger;
    color = mix(color, vec3(0.5, 0.95, 1.0), laser);
    gl_FragColor = vec4(color, 0.96);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const pointVertex = /* glsl */ `
  uniform float uTime;
  uniform float uTrigger;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    float t = max(0.0, uTime - uTrigger);
    vec3 p = position + normalize(position + vec3(0.01)) * min(t, 2.0) * (0.3 + aSeed * 0.7);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = (2.0 + aSeed * 3.0) * (1.0 + step(0.0, uTrigger) * min(t, 1.0)) * (5.0 / -mv.z);
    vAlpha = step(0.0, uTrigger) * exp(-t * 0.8) * (0.4 + aSeed * 0.6);
  }
`;

const pointFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(0.35, 0.85, 1.0, vAlpha * (1.0 - smoothstep(0.25, 0.5, d)));
  }
`;

function patternIndex(pattern: GraphPattern): number {
  return ({ SQUEEZE: 0, REVERSAL: 1, EXPANDING: 2, EXTENDED: 3 })[pattern];
}

function GraphMesh({ pattern, speed, stress, timeRef, triggerTimeRef }: {
  pattern: GraphPattern; speed: number; stress: number; timeRef: React.RefObject<number>; triggerTimeRef: React.RefObject<number>;
}) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: meshVertex,
    fragmentShader: meshFragment,
    side: THREE.DoubleSide,
    transparent: true,
    uniforms: { uTime: { value: 0 }, uStress: { value: stress }, uImpact: { value: 0 }, uPattern: { value: patternIndex(pattern) } },
  }), []);
  useFrame((_, delta) => {
    material.uniforms.uTime.value = timeRef.current;
    material.uniforms.uStress.value = stress;
    material.uniforms.uPattern.value = patternIndex(pattern);
    const sinceTrigger = timeRef.current - triggerTimeRef.current;
    material.uniforms.uImpact.value = sinceTrigger >= 0 ? Math.max(0, 1 - sinceTrigger / 1.5) : 0;
  });
  useEffect(() => () => material.dispose(), [material]);
  return <mesh position={[0, 0.9, 0]} material={material}><planeGeometry args={[5.6, 2.4, 100, 48]} /></mesh>;
}

function CollisionBooleanPanel({ timeRef, energy }: { timeRef: React.RefObject<number>; energy: number }) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: collisionFragment,
    transparent: true,
    uniforms: { uTime: { value: 0 }, uEnergy: { value: energy } },
  }), []);
  useFrame(() => {
    material.uniforms.uTime.value = timeRef.current;
    material.uniforms.uEnergy.value = energy;
  });
  useEffect(() => () => material.dispose(), [material]);
  return <mesh position={[0, -1.05, 0]} material={material}><planeGeometry args={[3.2, 1.55]} /></mesh>;
}

function EggMesh({ stress, fracture, timeRef, triggerTimeRef }: {
  stress: number; fracture: number; timeRef: React.RefObject<number>; triggerTimeRef: React.RefObject<number>;
}) {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: eggVertex,
    fragmentShader: eggFragment,
    uniforms: {
      uTime: { value: 0 }, uStress: { value: stress }, uFracture: { value: fracture }, uTrigger: { value: 0 },
    },
  }), []);
  useFrame(() => {
    const time = timeRef.current;
    const age = time - triggerTimeRef.current;
    material.uniforms.uTime.value = time;
    material.uniforms.uStress.value = stress;
    material.uniforms.uFracture.value = fracture;
    material.uniforms.uTrigger.value = age >= 0 ? Math.max(0, 1 - age / 2.5) : 0;
  });
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group>
      <mesh material={material} scale={[0.72, 1, 0.72]}><sphereGeometry args={[0.8, 64, 48]} /></mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.94, 0.94, 3.5, 48, 1, true]} /><meshBasicMaterial color="#67e8f9" transparent opacity={0.1} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 1.15, 0]}><cylinderGeometry args={[0.012, 0.012, 2.2, 8]} /><meshBasicMaterial color="#67e8f9" transparent opacity={0.2} /></mesh>
      <mesh position={[0, -1.2, 0]}><torusGeometry args={[0.95, 0.02, 8, 48]} /><meshBasicMaterial color="#a5f3fc" transparent opacity={0.45} /></mesh>
    </group>
  );
}

function BurstPoints({ timeRef, triggerTimeRef }: { timeRef: React.RefObject<number>; triggerTimeRef: React.RefObject<number> }) {
  const geometry = useMemo(() => {
    const count = 600;
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i += 1) {
      const y = Math.random() * 2 - 1;
      const phi = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - y * y);
      positions.set([r * Math.cos(phi) * 0.25, y * 0.25, r * Math.sin(phi) * 0.25], i * 3);
      seeds[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return geo;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: pointVertex,
    fragmentShader: pointFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uTrigger: { value: -1 } },
  }), []);
  useFrame(() => {
    material.uniforms.uTime.value = timeRef.current;
    material.uniforms.uTrigger.value = triggerTimeRef.current;
  });
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  return <points geometry={geometry} material={material} />;
}

export default function HypothesisScene({ hypothesis, pattern, speed, stress, fracture, freezeFrame, triggerId }: Props) {
  const timeRef = useRef(0);
  const triggerTimeRef = useRef(-1);
  const lastTriggerId = useRef(triggerId);

  useEffect(() => {
    if (triggerId !== lastTriggerId.current) {
      lastTriggerId.current = triggerId;
      triggerTimeRef.current = freezeFrame > 0 ? freezeFrame * 8 : timeRef.current;
    }
  }, [triggerId, freezeFrame]);

  useFrame((_, delta) => {
    timeRef.current = freezeFrame > 0 ? freezeFrame * 8 : timeRef.current + delta * speed;
  });

  return (
    <group>
      <ambientLight intensity={0.8} />
      <pointLight position={[3, 4, 5]} intensity={1.4} color="#67e8f9" />
      <gridHelper args={[8, 32, '#164e63', '#0f172a']} position={[0, -1.95, 0]} />
      {hypothesis === 'A' ? (
        <>
          <GraphMesh pattern={pattern} speed={speed} stress={stress} timeRef={timeRef} triggerTimeRef={triggerTimeRef} />
          <CollisionBooleanPanel timeRef={timeRef} energy={fracture} />
          {fracture > 0 && <mesh position={[0, 0.85, 0]}><sphereGeometry args={[0.14, 24, 16]} /><meshBasicMaterial color="#e0f2fe" /></mesh>}
        </>
      ) : (
        <>
          <EggMesh stress={stress} fracture={fracture} timeRef={timeRef} triggerTimeRef={triggerTimeRef} />
          <BurstPoints timeRef={timeRef} triggerTimeRef={triggerTimeRef} />
          {Array.from({ length: 22 }, (_, id) => {
            const angle = id * Math.PI * (3 - Math.sqrt(5));
            const y = 2.6 - 5.2 * (id + 0.5) / 22;
            const radius = Math.sqrt(Math.max(0, 1 - (y / 2.6) ** 2));
            return <mesh key={id} position={[Math.cos(angle) * radius * 2.6, y, Math.sin(angle) * radius * 2.6]}><sphereGeometry args={[0.035, 8, 6]} /><meshBasicMaterial color="#f0abfc" /></mesh>;
          })}
        </>
      )}
    </group>
  );
}
