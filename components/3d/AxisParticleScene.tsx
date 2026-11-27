'use client';

import { useEffect, useState } from 'react';
import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import type { WebGLRenderer } from 'three';
import MicroYinYangParticles from './MicroYinYangParticles';
import SingularityAxis from './SingularityAxis';

function OracleSceneFallback() {
  return (
    <svg
      aria-label="Animated Oracle particle field"
      className="absolute inset-0 h-full w-full"
      role="img"
      viewBox="0 0 800 420"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <radialGradient id="oracle-glow">
          <stop offset="0" stopColor="#0e7490" stopOpacity=".24" />
          <stop offset="1" stopColor="#020208" stopOpacity="0" />
        </radialGradient>
        <filter id="oracle-blur">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width="800" height="420" fill="#020208" />
      <ellipse cx="400" cy="210" rx="340" ry="190" fill="url(#oracle-glow)" />
      <g fill="none" stroke="#164e63" strokeDasharray="2 8" opacity=".8">
        <ellipse cx="400" cy="210" rx="100" ry="54" />
        <ellipse cx="400" cy="210" rx="180" ry="100" />
        <ellipse cx="400" cy="210" rx="275" ry="152" />
      </g>
      <path d="M400 24V396" stroke="#22d3ee" strokeOpacity=".7" />
      {Array.from({ length: 9 }, (_, index) => {
        const y = 44 + index * 41;
        const price = (100 + (4 - index) * 2.36).toFixed(2);
        return (
          <g key={y} opacity={index === 4 ? 1 : 0.62}>
            <path d={`M390 ${y}h20`} stroke={index < 4 ? '#60a5fa' : index > 4 ? '#fb7185' : '#fff'} />
            <text x="414" y={y + 3} fill="#cbd5e1" fontFamily="monospace" fontSize="9">{price}</text>
          </g>
        );
      })}
      <g className="oracle-fallback-particles">
        {Array.from({ length: 28 }, (_, index) => {
          const angle = (index / 28) * Math.PI * 2;
          const x = 400 + Math.cos(angle) * 220;
          const y = 210 + Math.sin(angle) * 118;
          const color = index % 2 === 0 ? '#bfdbfe' : '#fb7185';
          return (
            <circle key={index} cx={x} cy={y} r={index % 4 === 0 ? 2.4 : 1.5} fill={color}>
              <animate attributeName="opacity" values=".25;1;.25" dur={`${1.2 + (index % 7) * 0.2}s`} repeatCount="indefinite" />
              <animate attributeName="r" values="1;2.5;1" dur={`${1.5 + (index % 5) * 0.25}s`} repeatCount="indefinite" />
            </circle>
          );
        })}
      </g>
      <circle cx="400" cy="210" r="3" fill="#fff" filter="url(#oracle-blur)" />
      <text x="18" y="28" fill="#67e8f9" fontFamily="monospace" fontSize="10" letterSpacing="2">
        SINGULARITY AXIS // PRICE
      </text>
      <style>{`
        .oracle-fallback-particles {
          transform-box: fill-box;
          transform-origin: center;
          animation: oracle-orbit 24s linear infinite;
        }
        @keyframes oracle-orbit {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}

export default function AxisParticleScene() {
  return (
    <OracleScene />
  );
}

function OracleScene() {
  const [renderer, setRenderer] = useState<WebGLRenderer | null>(null);
  const [webglAvailable, setWebglAvailable] = useState(false);

  useEffect(() => {
    if (!renderer) return;

    const canvas = renderer.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      setWebglAvailable(false);
    };
    const handleContextRestored = () => setWebglAvailable(true);

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    };
  }, [renderer]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      {!webglAvailable && <OracleSceneFallback />}
      <Canvas
        camera={{ position: [7, 2, 11], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: 'low-power' }}
        fallback={<OracleSceneFallback />}
        onCreated={({ gl }) => {
          setRenderer(gl);
          setWebglAvailable(true);
        }}
        style={{ opacity: webglAvailable ? 1 : 0 }}
      >
        <color attach="background" args={['#020208']} />
        <SingularityAxis />
        <MicroYinYangParticles count={24000} />
        <OrbitControls enablePan={false} target={[0, 0, 0]} />
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.55} luminanceThreshold={0.28} mipmapBlur />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
