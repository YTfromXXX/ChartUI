'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import HypothesisScene, { type GraphPattern, type SceneHypothesis } from '@/components/cure/HypothesisScene';

type Props = {
  hypothesis: SceneHypothesis;
  pattern: GraphPattern;
  speed: number;
  stress: number;
  fracture: number;
  freezeFrame: number;
  triggerId: number;
};

export default function HypothesisCanvas(props: Props) {
  return (
    <Canvas camera={{ position: [0, 0, 7.5], fov: 48 }} dpr={[1, 1.5]} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={['#02040a']} />
      <HypothesisScene {...props} />
      <OrbitControls enablePan={false} minDistance={5} maxDistance={12} />
    </Canvas>
  );
}
