'use client';

import { useMemo } from 'react';
import PixelSprite from '@/components/fami/PixelSprite';
import { SPRITES } from '@/lib/famiSprites';
import { SNEAKER_TYPES, moonPhase, sneakerParams } from '@/lib/moonSneaker';

/** PowerPoint request A: automatic Fibonacci-moon sneaker parameters (A–D). */
export default function MoonSneakerPanel({ scent }: { scent: number }) {
  const now = useMemo(() => new Date(), []);
  const moon = moonPhase(now);
  const rows = SNEAKER_TYPES.map((_, k) => sneakerParams(k, now, scent));

  return (
    <section aria-label="Fibonacci moon sneakers" className="space-y-2 border-2 border-black bg-white/60 p-3 text-[11px]">
      <p className="inline-block bg-black px-2 py-0.5 text-xs font-bold italic text-white">フィボナッチムーンスニーカー · 自動パラメーター</p>
      <p>月齢 {moon.age.toFixed(1)} 日 · 輝面 {(moon.illumination * 100).toFixed(0)}% · 嗅覚の入力 {scent.toFixed(2)}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map((p, k) => (
          <div key={p.key} className="border border-black/40 bg-white p-2">
            <div className="flex items-center gap-2"><PixelSprite sprite={SPRITES.sneaker} className="h-8 w-8" /><p className="font-bold">{p.key}. {p.type}{SNEAKER_TYPES[k].filled ? ' ✎' : ''}</p></div>
            <p className="text-[10px] text-slate-600">{SNEAKER_TYPES[k].note}</p>
            <ul className="mt-1 font-mono text-[10px]">
              <li>ソール層 {p.soleLayers} · スタック {p.stackMm} mm · ドロップ {p.dropMm} mm</li>
              <li>シューレース穴 {p.laceHoles} · クッション {p.cushion}</li>
              <li>嗅覚の介入予測 {p.scentIntervention}</li>
            </ul>
          </div>
        ))}
      </div>
      <details className="text-[10px]"><summary className="cursor-pointer">パラメーターベクトル（JSON）</summary><pre className="overflow-x-auto bg-black p-2 text-white">{JSON.stringify(rows, null, 1)}</pre></details>
      <p className="text-[10px] text-slate-600">寸法はフィボナッチ数、クッションは月の輝面、嗅覚の介入は鼻の入力 × 月で決まるシミュレーション値。製品・健康・取引の助言ではない。✎＝空欄を補完したタイプ。</p>
    </section>
  );
}
