'use client';

import { Canvas } from '@react-three/fiber';
import { AlertTriangle, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import DataTornado from '@/components/3d/DataTornado';

export type SingularityOverloadProps = {
  positionCount: number;
  onDismiss?: () => void;
};

export default function SingularityOverload({ positionCount, onDismiss }: SingularityOverloadProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[100] overflow-hidden bg-[#09030a]/95"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="alertdialog"
      aria-label="魔力飽和による乱気流警告"
    >
      <Canvas camera={{ position: [0, 0, 13], fov: 52 }} dpr={[1, 1.5]}>
        <color attach="background" args={['#09030a']} />
        <ambientLight intensity={0.2} />
        <DataTornado
          s15Volume={positionCount * 180}
          s15Delta={positionCount * -12}
          wuxingPhase="FIRE"
          knotType="巻き結び（崩壊）"
          isOverdrive
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_18%,rgba(115,12,44,.34)_58%,rgba(3,1,7,.9))]" />
      <motion.div
        className="pointer-events-none absolute inset-5 border-2 border-red-400/80 sm:inset-10"
        animate={{ opacity: [0.25, 1, 0.35], scale: [1, 1.012, 1] }}
        transition={{ duration: 0.72, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute inset-0 flex items-center justify-center px-5 text-center">
        <motion.div
          className="w-full max-w-xl border border-amber-200/60 bg-[#120810]/85 p-6 shadow-[0_0_80px_rgba(239,68,68,.42)] backdrop-blur-xl sm:p-10"
          initial={{ y: 24, scale: 0.94 }}
          animate={{ y: 0, scale: 1 }}
        >
          <div className="flex items-center justify-center gap-3 font-mono text-xs uppercase tracking-[0.3em] text-red-300">
            <AlertTriangle className="h-5 w-5" /> magic saturation / singularity
          </div>
          <h2 className="mt-5 text-3xl tracking-[0.12em] text-amber-100 sm:text-5xl">DATA TORNADO OVERDRIVE</h2>
          <p className="mt-4 font-mono text-xs leading-6 text-red-100/80">{positionCount} knots exceed the stable observation field. The board has collapsed into an uncontrolled turbulence layer.</p>
          <div className="mt-6 flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-[0.24em] text-amber-200/80">
            <Radio className="h-3 w-3 animate-pulse" /> containment protocol / active
          </div>
          {onDismiss && <button type="button" onClick={onDismiss} className="pointer-events-auto mt-7 border border-amber-200/60 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-100 hover:bg-amber-100/10">Re-enter field</button>}
        </motion.div>
      </div>
    </motion.div>
  );
}
