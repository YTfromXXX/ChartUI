'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas, extend, useFrame, useThree, type ThreeElement } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/examples/jsm/misc/GPUComputationRenderer.js';
import { FLUID_JETS, FLUID_PARTICLES, FLUID_SIZE, pointFragmentShader, pointVertexShader, positionShader, velocityShader } from './fluidGPGPU';
import { angularGaussianBump, fitSphericalHarmonics, planeDistances } from '@/lib/distortionField';
import { cellAngles } from '@/lib/projectionGrid';
import { debugMetrics, reportBarrier } from '@/lib/debugMetrics';
import { positionDirection, type PortfolioProfile } from '@/lib/portfolio';

// ==========================================
// 1. Distortion shader: displaces a UV sphere along its normal by the fitted
//    SH coefficients, and colors it with a Plasma-style heatmap keyed to the
//    displacement (i.e. how far the portfolio's "energy sphere" protrudes
//    through the fixed 48-face polyhedron barrier at radius 1).
// ==========================================
const DistortionMaterial = shaderMaterial(
  { uC00: 0, uC10: 0, uC20: 0, uC22: 0, uTime: 0, uBaseRadius: 1 },
  `
    varying float vDisplacement;
    uniform float uC00, uC10, uC20, uC22, uTime, uBaseRadius;
    const float PI = 3.14159265359;
    float sh00() { return 0.5 * sqrt(1.0 / PI); }
    float sh10(float theta) { return 0.5 * sqrt(3.0 / PI) * cos(theta); }
    float sh20(float theta) { return 0.25 * sqrt(5.0 / PI) * (3.0 * cos(theta) * cos(theta) - 1.0); }
    float sh22(float theta, float phi) { return 0.25 * sqrt(15.0 / PI) * sin(theta) * sin(theta) * cos(2.0 * phi); }
    void main() {
      vec3 dir = normalize(position);
      float theta = acos(clamp(dir.y, -1.0, 1.0));
      float phi = atan(dir.z, dir.x);
      float wobble = sin(uTime * 0.55 + theta * 3.1 + phi * 2.0) * 0.012;
      float radius = uBaseRadius + uC00 * sh00() + uC10 * sh10(theta) + uC20 * sh20(theta) + uC22 * sh22(theta, phi) + wobble;
      vDisplacement = radius - uBaseRadius;
      vec3 displaced = dir * radius;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,
  `
    varying float vDisplacement;
    vec3 plasma(float t) {
      vec3 c0 = vec3(0.050, 0.030, 0.528);
      vec3 c1 = vec3(0.494, 0.012, 0.658);
      vec3 c2 = vec3(0.798, 0.280, 0.470);
      vec3 c3 = vec3(0.973, 0.585, 0.254);
      vec3 c4 = vec3(0.940, 0.975, 0.131);
      float x = clamp(t, 0.0, 1.0);
      if (x < 0.25) return mix(c0, c1, x / 0.25);
      if (x < 0.5) return mix(c1, c2, (x - 0.25) / 0.25);
      if (x < 0.75) return mix(c2, c3, (x - 0.5) / 0.25);
      return mix(c3, c4, (x - 0.75) / 0.25);
    }
    void main() {
      float t = clamp(vDisplacement * 3.4 + 0.5, 0.0, 1.0);
      gl_FragColor = vec4(plasma(t), 0.94);
    }
  `,
);

extend({ DistortionMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    distortionMaterial: ThreeElement<typeof DistortionMaterial>;
  }
}


// ==========================================
// 2. GPGPU fluid (FBO ping-pong via GPUComputationRenderer). Advection, wall
//    reflection/vortex generation, per-cell speed clamping, NaN guarding and
//    respawn all run in fragment passes; the CPU only updates uniforms. See
//    fluidGPGPU.ts for the shaders.
// ==========================================
const FluidPointsMaterial = shaderMaterial(
  { uPosTex: null, uVelTex: null, uPixel: 2.2, uTime: 0, uC00: 0, uC10: 0, uC20: 0, uC22: 0 },
  pointVertexShader,
  pointFragmentShader,
);

extend({ FluidPointsMaterial });

declare module '@react-three/fiber' {
  interface ThreeElements {
    fluidPointsMaterial: ThreeElement<typeof FluidPointsMaterial>;
  }
}

/** Signed per-asset fund flow: positive = inflow (volatility-weighted), the
 * long/short direction of the symbol decides which way the jet swirls. */
function usePortfolioJets(portfolio: PortfolioProfile) {
  return useMemo(() => {
    const jets = Array.from({ length: FLUID_JETS }, () => new THREE.Vector4());
    const ranked = [...portfolio.positions].sort((a, b) => b.volatility - a.volatility).slice(0, FLUID_JETS);
    ranked.forEach((position, index) => {
      const { theta, phi } = positionDirection(position.symbol);
      const flow = Math.tanh(((Number.isFinite(position.volatility) ? position.volatility : 0) - 0.4) * 3.2);
      jets[index].set(Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi), flow);
    });
    return jets;
  }, [portfolio]);
}

function FluidParticles({ portfolio }: { portfolio: PortfolioProfile }) {
  const gl = useThree((state) => state.gl);
  const pointsMaterial = useRef<any>(null);
  const coefficients = usePortfolioCoefficients(portfolio);
  const jets = usePortfolioJets(portfolio);
  const smooth = useRef({ c00: 0, c10: 0, c20: 0, c22: 0 });
  const sim = useRef<{
    gpu: GPUComputationRenderer;
    vel: ReturnType<GPUComputationRenderer['addVariable']>;
    pos: ReturnType<GPUComputationRenderer['addVariable']>;
  } | null>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const refs = new Float32Array(FLUID_PARTICLES * 2);
    for (let i = 0; i < FLUID_PARTICLES; i += 1) {
      refs[i * 2] = ((i % FLUID_SIZE) + 0.5) / FLUID_SIZE;
      refs[i * 2 + 1] = (Math.floor(i / FLUID_SIZE) + 0.5) / FLUID_SIZE;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(FLUID_PARTICLES * 3), 3));
    geo.setAttribute('aRef', new THREE.BufferAttribute(refs, 2));
    return geo;
  }, []);

  useEffect(() => {
    const gpu = new GPUComputationRenderer(FLUID_SIZE, FLUID_SIZE, gl);
    const posTexture = gpu.createTexture();
    const velTexture = gpu.createTexture();
    const posData = posTexture.image.data as Float32Array;
    let state = 90210;
    const rand = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 4294967296;
    };
    for (let i = 0; i < FLUID_PARTICLES; i += 1) {
      const angle = rand() * Math.PI * 2;
      const z = rand() * 2 - 1;
      const ring = Math.sqrt(1 - z * z);
      const radius = 1.15 + rand() * 1.5;
      posData[i * 4] = ring * Math.cos(angle) * radius;
      posData[i * 4 + 1] = z * radius;
      posData[i * 4 + 2] = ring * Math.sin(angle) * radius;
      posData[i * 4 + 3] = 0.02 + rand() * 0.95;
    }
    const vel = gpu.addVariable('textureVelocity', velocityShader, velTexture);
    const pos = gpu.addVariable('texturePosition', positionShader, posTexture);
    gpu.setVariableDependencies(vel, [vel, pos]);
    gpu.setVariableDependencies(pos, [vel, pos]);
    for (const variable of [vel, pos]) {
      Object.assign(variable.material.uniforms, {
        uTime: { value: 0 },
        uDt: { value: 1 / 60 },
        uC00: { value: 0 },
        uC10: { value: 0 },
        uC20: { value: 0 },
        uC22: { value: 0 },
      });
    }
    vel.material.uniforms.uViscosity = { value: 0.7 };
    vel.material.uniforms.uJets = { value: jets.map((jet) => jet.clone()) };
    const error = gpu.init();
    if (error !== null) {
      console.warn('Fluid GPGPU unavailable:', error);
      return undefined;
    }
    sim.current = { gpu, vel, pos };
    debugMetrics.particles = FLUID_PARTICLES;
    return () => {
      sim.current = null;
      debugMetrics.particles = 0;
      debugMetrics.minDk = 1;
      debugMetrics.pressure = 0;
      gpu.dispose?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  useFrame((_, delta) => {
    const current = sim.current;
    const material = pointsMaterial.current;
    if (!current || !material) return;
    const dt = Math.min(delta, 1 / 30);
    const s = smooth.current;
    s.c00 = THREE.MathUtils.lerp(s.c00, coefficients.c00, 0.06);
    s.c10 = THREE.MathUtils.lerp(s.c10, coefficients.c10, 0.06);
    s.c20 = THREE.MathUtils.lerp(s.c20, coefficients.c20, 0.06);
    s.c22 = THREE.MathUtils.lerp(s.c22, coefficients.c22, 0.06);
    material.uTime += dt;
    for (const variable of [current.vel, current.pos]) {
      const u = variable.material.uniforms;
      u.uTime.value = material.uTime;
      u.uDt.value = dt;
      u.uC00.value = s.c00;
      u.uC10.value = s.c10;
      u.uC20.value = s.c20;
      u.uC22.value = s.c22;
    }
    const liveJets = current.vel.material.uniforms.uJets.value as THREE.Vector4[];
    for (let i = 0; i < FLUID_JETS; i += 1) liveJets[i].lerp(jets[i], 0.05);
    current.gpu.compute();
    material.uPosTex = current.gpu.getCurrentRenderTarget(current.pos).texture;
    material.uVelTex = current.gpu.getCurrentRenderTarget(current.vel).texture;
    material.uC00 = s.c00;
    material.uC10 = s.c10;
    material.uC20 = s.c20;
    material.uC22 = s.c22;
  });

  return (
    <points frustumCulled={false} geometry={geometry}>
      <fluidPointsMaterial ref={pointsMaterial} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

type PortfolioRadarProps = { portfolio: PortfolioProfile; className?: string };

/** Fits (c00, c10, c20, c22) to a Gaussian energy bump field built from the
 * portfolio's positions -- one bump per symbol, weighted by |volatility|,
 * placed at a deterministic direction. This is the "surface fitting" step:
 * discrete positions -> continuous distorted-sphere field. */
function usePortfolioCoefficients(portfolio: PortfolioProfile) {
  return useMemo(() => {
    const bumps = portfolio.positions.map((position) => ({
      ...positionDirection(position.symbol),
      weight: Math.min(2, Math.max(0, Number.isFinite(position.volatility) ? position.volatility : 0)) * 1.4,
    }));
    const samples = Array.from({ length: 48 }, (_, index) => {
      const { theta, phi } = cellAngles(index);
      const value = bumps.reduce(
        (sum, bump) => sum + bump.weight * angularGaussianBump(theta, phi, bump.theta, bump.phi, 0.55),
        0,
      );
      return { theta, phi, value };
    });
    return fitSphericalHarmonics(samples);
  }, [portfolio]);
}

function DistortedEnergySphere({ portfolio }: { portfolio: PortfolioProfile }) {
  const materialRef = useRef<any>(null);
  const coefficients = usePortfolioCoefficients(portfolio);

  useEffect(() => {
    reportBarrier(planeDistances(coefficients, 1));
  }, [coefficients]);

  useFrame((_, delta) => {
    if (!materialRef.current) return;
    materialRef.current.uTime += delta;
    materialRef.current.uC00 = THREE.MathUtils.lerp(materialRef.current.uC00, coefficients.c00, 0.06);
    materialRef.current.uC10 = THREE.MathUtils.lerp(materialRef.current.uC10, coefficients.c10, 0.06);
    materialRef.current.uC20 = THREE.MathUtils.lerp(materialRef.current.uC20, coefficients.c20, 0.06);
    materialRef.current.uC22 = THREE.MathUtils.lerp(materialRef.current.uC22, coefficients.c22, 0.06);
  });

  return (
    <mesh>
      <sphereGeometry args={[1, 96, 72]} />
      <distortionMaterial ref={materialRef} uBaseRadius={1} side={THREE.DoubleSide} />
    </mesh>
  );
}

/** 48-face polyhedron barrier: a fixed radius-1 wireframe cage, colored per
 * face-group by how far the energy sphere protrudes through it (Dk < 0). */
function PolyhedronBarrier({ portfolio }: { portfolio: PortfolioProfile }) {
  const coefficients = usePortfolioCoefficients(portfolio);
  const distances = useMemo(() => planeDistances(coefficients, 1), [coefficients]);
  const intrusionRatio = distances.filter((distance) => distance < 0).length / distances.length;
  const barrierColor = intrusionRatio > 0.3 ? '#f97316' : intrusionRatio > 0.1 ? '#facc15' : '#38bdf8';

  return (
    <mesh>
      <sphereGeometry args={[1, 8, 6]} />
      <meshBasicMaterial color={barrierColor} wireframe transparent opacity={0.55} />
    </mesh>
  );
}

function RadarScene({ portfolio }: { portfolio: PortfolioProfile }) {
  return (
    <>
      <color attach="background" args={['#020712']} />
      <ambientLight intensity={0.9} />
      <pointLight position={[4, 4, 4]} intensity={1.4} />
      <DistortedEnergySphere portfolio={portfolio} />
      <PolyhedronBarrier portfolio={portfolio} />
      <FluidParticles portfolio={portfolio} />
      <OrbitControls enablePan={false} minDistance={2.4} maxDistance={7} autoRotate autoRotateSpeed={0.6} />
    </>
  );
}

export default function PortfolioRadar({ portfolio, className }: PortfolioRadarProps) {
  return (
    <div className={className ?? 'h-[520px] w-full'}>
      <Canvas camera={{ position: [0, 0.6, 3.4], fov: 50 }}>
        <RadarScene portfolio={portfolio} />
      </Canvas>
    </div>
  );
}
