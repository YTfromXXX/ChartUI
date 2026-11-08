'use client';

import { useEffect, useState } from 'react';
import { useCureAPIStore } from '@/lib/cureApiStore';

export default function CureProjectionEffects() {
  const nonce = useCureAPIStore((state) => state.projectionGlitchNonce);
  const [activeNonce, setActiveNonce] = useState(0);

  useEffect(() => {
    if (nonce === 0) return;
    setActiveNonce(nonce);
    const timer = window.setTimeout(() => setActiveNonce(0), 460);
    return () => window.clearTimeout(timer);
  }, [nonce]);

  if (!activeNonce) return null;
  return (
    <>
      <style>{`
        @keyframes cure-projection-glitch {
          0%, 100% { opacity: 0; transform: translateX(0); }
          12% { opacity: .8; transform: translateX(5px); }
          24% { opacity: .25; transform: translateX(-8px); }
          42% { opacity: .7; transform: translateX(3px); }
          58% { opacity: .18; transform: translateX(-2px); }
          75% { opacity: .5; transform: translateX(6px); }
        }
      `}</style>
      <div
        key={activeNonce}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[100] mix-blend-screen"
        style={{ animation: 'cure-projection-glitch 460ms steps(2, end) both', background: 'repeating-linear-gradient(0deg, transparent 0 5px, rgba(103,232,249,.16) 6px, transparent 8px)' }}
      />
    </>
  );
}
