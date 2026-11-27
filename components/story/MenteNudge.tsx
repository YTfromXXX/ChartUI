'use client';

import { useEffect, useRef, useState } from 'react';
import { REASON_TEXT, type NudgeReason } from '@/lib/menteNudge';

/**
 * The soft popup (Mente style): "アリミノボーイに聞く？" Appears at the bottom, never blocks the page,
 * can be closed with Esc. Asking shows his "たぶん {…} のあいだ。正確には分からないが——" hint.
 */
export default function MenteNudge({ reason, between, after, onClose }: { reason: NudgeReason; between: string; after: string; onClose: () => void }) {
  const [asked, setAsked] = useState(false);
  const askRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    askRef.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div role="dialog" aria-label="アリミノボーイに聞く" data-testid="mente-nudge" className="nudge-in fixed bottom-4 left-1/2 z-[70] w-[min(92vw,26rem)] -translate-x-1/2 space-y-2 border-2 border-black bg-white p-3 shadow-[6px_6px_0_#0004]">
      <p className="inline-block bg-black px-1.5 text-[10px] font-bold italic text-white">Mente · そっと</p>
      {!asked ? (
        <>
          <p className="text-sm">{REASON_TEXT[reason]} アリミノボーイに聞いてみる？</p>
          <div className="flex justify-end gap-2 text-xs">
            <button type="button" onClick={onClose} className="border border-stone-400 px-2 py-0.5">だいじょうぶ</button>
            <button ref={askRef} type="button" data-testid="nudge-ask" onClick={() => setAsked(true)} className="border border-[#22b8c8] bg-white px-2 py-0.5">アリミノボーイに聞く</button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm" data-testid="nudge-answer">アリミノボーイ：「たぶん {between} のあいだ。正確には分からないが——{after}」</p>
          <div className="flex justify-end"><button type="button" onClick={onClose} className="border border-black px-2 py-0.5 text-xs">ありがとう</button></div>
        </>
      )}
      <style>{'.nudge-in{animation:nudge-in 500ms ease-out}@keyframes nudge-in{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}@media (prefers-reduced-motion: reduce){.nudge-in{animation:none}}'}</style>
    </div>
  );
}
