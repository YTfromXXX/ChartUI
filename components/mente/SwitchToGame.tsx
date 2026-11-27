'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * Mente's 🔄 ability: switch out of Mente work for a while and play.
 * The popup asks once (YES / NO). YES goes to the edition's event page; NO just closes.
 */
export default function SwitchToGame() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const noRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    noRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); opener.current?.focus(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => { setOpen(false); opener.current?.focus(); };

  return (
    <>
      <button ref={opener} type="button" data-testid="mente-switch" onClick={() => setOpen(true)} className="grid h-10 w-10 place-items-center border border-black bg-white text-xl shadow-[3px_3px_0_#0004] transition-transform active:scale-90" aria-label="切り替え（🔄 の能力）" title="🔄 切り替え">🔄</button>
      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4" onClick={close}>
          <div role="dialog" aria-modal="true" aria-labelledby="switch-title" data-testid="mente-switch-dialog" onClick={(e) => e.stopPropagation()} className="w-full max-w-sm space-y-4 border-2 border-black bg-white p-5 shadow-[8px_8px_0_#0006]">
            <p className="text-xs font-bold italic text-[#7a0f22]">🔄 Mente の能力 · 切り替え</p>
            <p id="switch-title" className="text-base font-semibold">いったん Mente での作業を切り替えてゲームをする？</p>
            <p className="text-xs text-slate-600">Mente の画面はそのまま残ります。ゲームからはいつでも戻れます。</p>
            <div className="flex justify-end gap-3">
              <button ref={noRef} type="button" data-testid="mente-switch-no" onClick={close} className="border border-black px-4 py-1 text-sm hover:bg-black hover:text-white">NO</button>
              <button type="button" data-testid="mente-switch-yes" onClick={() => router.push('/mente/game')} className="border border-black bg-black px-4 py-1 text-sm text-white hover:bg-[#7a0f22]">YES</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
