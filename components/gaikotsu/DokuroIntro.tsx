'use client';

import { useMemo, useState } from 'react';
import GaikotsuBoard, { type BoardStats, type StationStyle } from '@/components/gaikotsu/GaikotsuBoard';
import { newGame } from '@/lib/gaikotsu';

const luminance = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const contrast = (a: number, b: number) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

/** Port 12 popup: 『髑髏電鉄』, the recommendation, and the metal-plate question analysed both ways. */
export default function DokuroIntro({ onChoose }: { onChoose: (style: StationStyle) => void }) {
  const preview = useMemo(() => newGame(12), []);
  const [stats, setStats] = useState<Record<StationStyle, BoardStats | null>>({ flat: null, metal: null });

  const rows = [
    { label: '1 フレームの描画', flat: stats.flat ? `${stats.flat.frameMs.toFixed(2)} ms` : '計測中…', metal: stats.metal ? `${stats.metal.frameMs.toFixed(2)} ms` : '計測中…' },
    // Flat: white outline on black. Metal: dark engraving on the unowned plate's mid steel (≈ 165).
    { label: '駅の文字・輪郭のコントラスト', flat: `${contrast(255, 0).toFixed(1)} : 1`, metal: `${contrast(20, 165).toFixed(1)} : 1` },
    { label: '駅の見分け方', flat: '多角形の辺の数（名前は出ない）', metal: '漢字 1 字で 22 駅すべて判別' },
    { label: '解像度', flat: '端末の画素比で描画', metal: '端末の画素比で描画（金属の地肌・面取り・鏡面の走り）' },
  ];
  const ready = stats.flat && stats.metal;
  const recommendMetal = ready ? stats.metal!.frameMs < 8 : true;

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/90 p-4 font-mono text-white" role="dialog" aria-modal="true" aria-label="髑髏電鉄 popup">
      <div className="mx-auto max-w-5xl space-y-3 border-4 border-white bg-black p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-3xl font-black tracking-[0.3em]">『髑髏電鉄』</p>
          <p className="border-2 border-white px-2 py-0.5 text-sm font-bold">オススメ：{recommendMetal ? 'Yes（金属の漢字駅）' : 'No（平面の多角形）'}</p>
        </div>
        <p className="text-sm">漢字の駅のデザインに金属的質感（解像度の良いモノクロ）を加えますか？</p>

        <div className="grid gap-3 md:grid-cols-2">
          {(['flat', 'metal'] as const).map((style) => (
            <figure key={style} className="space-y-1">
              <GaikotsuBoard state={preview} style={style} onStats={(s) => setStats((prev) => ({ ...prev, [style]: s }))} />
              <figcaption className="text-xs">{style === 'metal' ? 'Yes：金属の漢字駅' : 'No：平面の多角形'}</figcaption>
            </figure>
          ))}
        </div>

        <table className="w-full text-left text-[11px]">
          <thead className="text-white/60"><tr><th className="py-1">解析</th><th>No（平面）</th><th>Yes（金属）</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.label} className="border-t border-white/20"><td className="py-1 pr-2">{r.label}</td><td className="pr-2">{r.flat}</td><td>{r.metal}</td></tr>)}
          </tbody>
        </table>
        <p className="text-[11px] text-white/70">
          {ready
            ? `オススメの根拠：金属の描画は 1 フレーム ${stats.metal!.frameMs.toFixed(2)} ms（目安 8 ms 未満${recommendMetal ? 'で余裕あり' : 'を超える'}）。平面より ${(stats.metal!.frameMs - stats.flat!.frameMs).toFixed(2)} ms 重いが、22 駅を漢字で読める。コントラストは平面のほうが高い。`
            : '両方のパターンを描画して計測しています……'}
        </p>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => onChoose('metal')} className="border-2 border-white bg-white px-6 py-2 text-lg font-black text-black">Yes</button>
          <button type="button" onClick={() => onChoose('flat')} className="border-2 border-white px-6 py-2 text-lg font-black">No</button>
          <span className="self-center text-[11px] text-white/60">選んだパターンで発車します（あとから切り替え可）。</span>
        </div>
      </div>
    </div>
  );
}
