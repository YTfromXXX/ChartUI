'use client';

import { ArrowRight, Check, LockKeyhole, Sparkles, X } from 'lucide-react';

export type PackageTradePopupProps = {
  shape: string;
  symbols: string[];
  manaCost: number;
  confidence: number;
  onApprove: () => void;
  onReturn: () => void;
  transitioning: boolean;
};

export default function PackageTradePopup({ shape, symbols, manaCost, confidence, onApprove, onReturn, transitioning }: PackageTradePopupProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[#010509]/65 px-3 pb-4 pt-20 backdrop-blur-md sm:items-center sm:px-6">
      <div className="relative w-full max-w-xl overflow-hidden border border-cyan-200/35 bg-[#08151d]/90 p-5 shadow-[0_0_70px_rgba(34,211,238,.2)] backdrop-blur-2xl sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200 to-transparent" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.34em] text-cyan-200/70">Package trade / knot sealed</p>
            <h2 className="mt-2 text-xl tracking-[0.08em] text-stone-100">短期同時取引のセットアップ完了</h2>
          </div>
          <button type="button" onClick={onReturn} aria-label="Close package trade" className="border border-white/15 p-2 text-stone-400 transition-colors hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 border-y border-white/10 py-4 font-mono text-[9px] uppercase tracking-[0.16em]">
          <div><span className="block text-stone-500">formation</span><strong className="mt-1 block text-amber-100">{shape}</strong></div>
          <div><span className="block text-stone-500">resonance</span><strong className="mt-1 block text-cyan-100">{confidence}%</strong></div>
          <div><span className="block text-stone-500">mana cost</span><strong className="mt-1 block text-rose-100">{manaCost}</strong></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {symbols.map((symbol) => <span key={symbol} className="border border-cyan-200/20 bg-cyan-200/[0.04] px-2 py-2 font-mono text-[10px] text-cyan-100">{symbol}</span>)}
        </div>
        <p className="mt-5 flex items-center gap-2 font-mono text-[10px] leading-5 text-stone-400"><Sparkles className="h-3 w-3 shrink-0 text-amber-200" />過去の決済チケットで利益が集中した星座を、現在のポジションから連鎖配置しました。</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onReturn} disabled={transitioning} className="inline-flex items-center justify-center gap-2 border border-white/15 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-stone-400 hover:text-white disabled:opacity-40"><ArrowRight className="h-3 w-3 rotate-180" /> Matrixへ戻る</button>
          <button type="button" onClick={onApprove} disabled={transitioning} className="inline-flex items-center justify-center gap-2 border border-amber-100/55 bg-amber-100/10 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.16em] text-amber-50 shadow-[0_0_24px_rgba(245,208,111,.12)] hover:bg-amber-100/20 disabled:opacity-40"><LockKeyhole className="h-3 w-3" />{transitioning ? 'Warping...' : '一括エントリーを承認'}<Check className="h-3 w-3" /></button>
        </div>
      </div>
    </div>
  );
}