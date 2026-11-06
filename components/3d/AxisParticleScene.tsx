'use client';

import { OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import MicroYinYangParticles from './MicroYinYangParticles';
import SingularityAxis from './SingularityAxis';

export default function AxisParticleScene() {
  return (
    <Canvas camera={{ position: [7, 2, 11], fov: 50 }} dpr={[1, 2]} gl={{ antialias: false }}>
      <color attach="background" args={['#020208']} />
      <SingularityAxis />
      <MicroYinYangParticles count={40000} />
      <OrbitControls enablePan={false} target={[0, 0, 0]} />
      <EffectComposer>
        <Bloom intensity={0.9} luminanceThreshold={0.15} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
