'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useCureAPIStore, type HeaderItems, type SimulationMode } from '@/lib/cureApiStore';

/**
 * The bike in the corner: an "ideal form" motorcycle (Fami port 22, バイク魂) that opens the header
 * popup. The TEST TO ZERO header can be closed with END TEST; this popup is how it comes back, and
 * where each of its parts (instrument, collision, view, engine link) is switched on or off.
 * Everything is kept in the Cure-API store, so the choice survives a reload.
 */
const ITEM_LABEL: Record<keyof HeaderItems, string> = { instrument: '銘柄（BTCUSD／XAUUSD）', collision: 'collision-A／B', view: 'VIEW 表示', engine: 'エンジンメニューへのリンク' };

function IdealBike({ glow, spin }: { glow: boolean; spin: boolean }) {
  return (
    <svg viewBox="0 0 96 56" className="h-12 w-20" aria-hidden>
      <defs>
        <linearGradient id="bike-body" x1="0" x2="1"><stop offset="0" stopColor="#ff2bd6" /><stop offset="0.5" stopColor="#00e5ff" /><stop offset="1" stopColor="#ffe600" /></linearGradient>
        <radialGradient id="bike-wheel"><stop offset="0.6" stopColor="#05040c" /><stop offset="0.8" stopColor="#00e5ff" /><stop offset="1" stopColor="#05040c" /></radialGradient>
      </defs>
      {/* Hubless wheels: rings that turn on hover. */}
      {[[20, 40], [76, 40]].map(([cx, cy]) => (
        <g key={cx} style={{ transformOrigin: `${cx}px ${cy}px`, animation: spin ? 'bike-spin 0.8s linear infinite' : undefined }}>
          <circle cx={cx} cy={cy} r={14} fill="url(#bike-wheel)" stroke="#ffffff" strokeWidth={0.8} />
          {[0, 60, 120].map((a) => <line key={a} x1={cx + Math.cos((a * Math.PI) / 180) * 9} y1={cy + Math.sin((a * Math.PI) / 180) * 9} x2={cx + Math.cos(((a + 180) * Math.PI) / 180) * 9} y2={cy + Math.sin(((a + 180) * Math.PI) / 180) * 9} stroke="#ff2bd6" strokeWidth={0.8} opacity={0.7} />)}
        </g>
      ))}
      {/* One continuous aerodynamic fairing, no visible engine: the ideal form. */}
      <path d="M8 34 Q18 14 44 16 L64 12 Q86 10 92 30 Q80 26 70 30 L52 34 Q34 30 24 34 Z" fill="url(#bike-body)" stroke="#ffffff" strokeWidth={0.8} style={{ filter: glow ? 'drop-shadow(0 0 6px #ff2bd6)' : undefined }} />
      <path d="M60 14 Q70 4 82 10" fill="none" stroke="#ffffff" strokeWidth={1.5} />
      <circle cx={88} cy={24} r={2} fill="#ffe600" />
    </svg>
  );
}

export default function BikeHeaderToggle() {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const headerVisible = useCureAPIStore((s) => s.headerVisible);
  const headerItems = useCureAPIStore((s) => s.headerItems);
  const setHeaderVisible = useCureAPIStore((s) => s.setHeaderVisible);
  const setHeaderItem = useCureAPIStore((s) => s.setHeaderItem);
  const simulationMode = useCureAPIStore((s) => s.simulationMode);
  const setSimulationMode = useCureAPIStore((s) => s.setSimulationMode);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    dialog.current?.querySelector<HTMLElement>('input, button, select, a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); opener.current?.focus(); }
      if (e.key === 'Tab' && dialog.current) { // keep focus inside the popup
        const els = [...dialog.current.querySelectorAll<HTMLElement>('input, button, select, a')]; if (!els.length) return;
        const first = els[0]; const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <style>{'@keyframes bike-spin { to { transform: rotate(360deg); } } @media (prefers-reduced-motion: reduce) { [style*="bike-spin"] { animation: none !important; } }'}</style>
      <button
        ref={opener} type="button" onClick={() => setOpen((o) => !o)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        aria-haspopup="dialog" aria-expanded={open} aria-label={`ヘッダー機能（いまは${headerVisible ? 'オン' : 'オフ'}）`} data-testid="bike"
        className="fixed bottom-3 right-3 z-[95] rounded-xl border border-white/20 bg-[#05040c]/90 p-1 shadow-[0_0_18px_#ff2bd655] backdrop-blur transition hover:scale-105"
      >
        <IdealBike glow={!headerVisible || hover} spin={hover} />
        <span className={`absolute -top-1.5 -left-1.5 rounded-full px-1.5 font-mono text-[9px] font-bold ${headerVisible ? 'bg-[#00ffa3] text-black' : 'bg-[#ff2bd6] text-black'}`}>{headerVisible ? 'ON' : 'OFF'}</span>
      </button>
      {open && (
        <div ref={dialog} role="dialog" aria-modal="true" aria-label="ヘッダー機能" data-testid="header-popup"
          className="fixed bottom-20 right-3 z-[96] w-[min(92vw,320px)] space-y-2 rounded-xl border-2 border-transparent bg-[#07060f] p-3 font-mono text-xs text-slate-100 shadow-[0_0_30px_#00e5ff44]"
          style={{ borderImage: 'linear-gradient(120deg,#ff2bd6,#00e5ff,#ffe600) 1' }}>
          <p className="tracking-[0.3em] text-[#ffe600]">BIKE 魂 · ポート 22 · ヘッダー機能</p>
          <label className="flex items-center justify-between gap-2 rounded border border-white/15 p-2">
            <span>ヘッダーを表示する</span>
            <input type="checkbox" role="switch" aria-checked={headerVisible} checked={headerVisible} onChange={(e) => setHeaderVisible(e.target.checked)} aria-label="ヘッダーを表示する" className="h-4 w-8 accent-[#00ffa3]" />
          </label>
          <fieldset className="space-y-1 rounded border border-white/15 p-2" disabled={!headerVisible}>
            <legend className="px-1 text-slate-400">ヘッダーに出すもの</legend>
            {(Object.keys(ITEM_LABEL) as (keyof HeaderItems)[]).map((k) => (
              <label key={k} className={`flex items-center gap-2 ${headerVisible ? '' : 'opacity-40'}`}><input type="checkbox" checked={headerItems[k]} onChange={(e) => setHeaderItem(k, e.target.checked)} />{ITEM_LABEL[k]}</label>
            ))}
          </fieldset>
          <fieldset className="flex items-center gap-2 rounded border border-white/15 p-2">
            <legend className="px-1 text-slate-400">ヘッダーを開いたときの銘柄</legend>
            {([['hypothesisA', 'BTCUSD · A'], ['hypothesisB', 'XAUUSD · B']] as [SimulationMode, string][]).map(([m, label]) => (
              <button key={m} type="button" aria-pressed={simulationMode === m} onClick={() => setSimulationMode(m)} className={`rounded border px-2 py-1 ${simulationMode === m ? 'border-[#00e5ff] text-[#00e5ff]' : 'border-white/20 text-slate-400'}`}>{label}</button>
            ))}
          </fieldset>
          <div className="flex items-center justify-between">
            <Link href="/cure-api/engine" onClick={() => setOpen(false)} className="text-[#ff8ae8] underline">エンジンメニューへ</Link>
            <button type="button" onClick={() => { setOpen(false); opener.current?.focus(); }} className="rounded border border-white/20 px-2 py-0.5">閉じる（Esc）</button>
          </div>
          <p className="text-[10px] text-slate-500">理想形態のバイク：エンジンを見せない一枚の外殻と、ハブのない車輪。設定はこの端末に保存される。</p>
        </div>
      )}
    </>
  );
}
