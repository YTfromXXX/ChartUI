'use client';

import { useEffect, useMemo, useState } from 'react';
import PixelSprite from '@/components/fami/PixelSprite';
import { transplantEyeToNose } from '@/lib/colorTransplant';
import { FACE } from '@/lib/famiSprites';

/** Mente: transplant the eyeball's (iris) colours onto the nose, as faithfully as possible. */
export default function EyeNoseTransplant() {
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const result = useMemo(() => transplantEyeToNose(t), [t]);
  const full = useMemo(() => transplantEyeToNose(1), []);

  useEffect(() => {
    if (!running) return undefined;
    const timer = window.setInterval(() => setT((v) => { const next = Math.min(1, v + 0.05); if (next >= 1) setRunning(false); return next; }), 120);
    return () => window.clearInterval(timer);
  }, [running]);

  return (
    <section aria-label="Eye to nose colour transplant" className="space-y-2 border-2 border-black bg-white/60 p-3 text-[11px]">
      <p className="inline-block bg-black px-2 py-0.5 text-xs font-bold italic text-white">鼻 ← 眼球の色彩 移植シミュレーション</p>
      <div className="flex flex-wrap items-end gap-4">
        <figure className="text-center"><PixelSprite sprite={FACE} colors={result.original} className="h-32 w-32" title="before" /><figcaption>移植前</figcaption></figure>
        <figure className="text-center"><PixelSprite sprite={FACE} colors={result.colors} className="h-32 w-32" title="transplant" /><figcaption>進行 {(t * 100).toFixed(0)}%</figcaption></figure>
        <div className="min-w-[14rem] flex-1 space-y-1">
          <div className="flex gap-2">
            <button type="button" onClick={() => { setT(0); setRunning(true); }} className="bg-[#d6001c] px-2 py-1 font-bold italic text-white">移植を開始</button>
            <button type="button" onClick={() => { setRunning(false); setT(0); }} className="border-2 border-black px-2 py-1">戻す</button>
          </div>
          <input aria-label="Transplant progress" type="range" min={0} max={1} step={0.01} value={t} onChange={(e) => { setRunning(false); setT(Number(e.target.value)); }} className="w-full accent-[#d6001c]" />
          <p>移植元：虹彩 · 移植先：鼻 {result.nosePixels} ピクセル</p>
          <p>色の再現（完了時）：ΔE*ab {full.fidelity.toFixed(2)}（0 に近いほど眼球の色そのまま）</p>
          <p>鼻の陰影の保持（完了時）：明暗の順序 {(full.structure * 100).toFixed(0)}% を維持</p>
          <p className="text-[10px] text-slate-600">方法：CIE Lab 空間で、鼻の各ピクセルを鼻の平均・ばらつきで標準化し、虹彩の平均・ばらつきへ写す（Reinhard ほか 2001 の色転写）。鼻の形と陰影は残り、色の分布だけが眼球のものになる。</p>
        </div>
      </div>
    </section>
  );
}
