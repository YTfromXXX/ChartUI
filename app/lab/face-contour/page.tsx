'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import EthGlyph from '@/components/EthGlyph';
import { BASE, FACES, HAIR_STYLES, STEPS, atStep, contour, diffGrid, extent, faceGrid, headGrid, iou, silhouette, type Grid, type HairStyle } from '@/lib/faceContour';

const NX = 80; const NY = 100; const PX = 2.2;
const HX = 90; const HY = 110;

function Contours({ g, levels, colorOf, label, testid, nx = NX, ny = NY }: { g: Grid; levels: number[]; colorOf: (lv: number) => string; label: string; testid?: string; nx?: number; ny?: number }) {
  const paths = levels.map((lv) => ({ lv, d: contour(g, lv).map(([a, b, c, d]) => `M${(a * PX).toFixed(1)} ${(b * PX).toFixed(1)}L${(c * PX).toFixed(1)} ${(d * PX).toFixed(1)}`).join('') }));
  return (
    <figure className="space-y-1" data-testid={testid}>
      <svg viewBox={`0 0 ${(nx - 1) * PX} ${(ny - 1) * PX}`} className="w-full border border-stone-200 bg-white" aria-label={label}>
        {paths.map((p) => <path key={p.lv} d={p.d} fill="none" stroke={colorOf(p.lv)} strokeWidth={0.8} />)}
      </svg>
      <figcaption className="text-center text-[11px] text-stone-600">{label}</figcaption>
    </figure>
  );
}

/** The silhouette drawn small and filled — the "squint test": can the three be told apart at a glance? */
function Thumb({ sil, nx, ny }: { sil: boolean[]; nx: number; ny: number }) {
  const cells: string[] = []; for (let j = 0; j < ny; j += 2) for (let i = 0; i < nx; i += 2) if (sil[j * nx + i]) cells.push(`M${i} ${j}h2v2h-2z`);
  return <svg viewBox={`0 0 ${nx} ${ny}`} className="h-16 w-14" aria-label="小さなシルエット"><path d={cells.join('')} fill="#1f1f1f" /></svg>;
}

const STEP_NOTE = ['いちばん外側の線の形が変わる', '線の詰まり方が変わる（張った頬は密に）', '山の頂上の位置と高さが変わる', '細かい谷と山（16 段で見える）', '額の上の高原として髪が乗る（帽子ではなく地形）'];

/**
 * Face-shape difference device: a base face as a height map with contour lines, three faces built
 * from it coarse → fine (outline, masses, nose & brow, mouth & chin, hairline), and the difference
 * maps Δz (ink = higher than the reference, red = lower).
 */
export default function FaceContour() {
  const [step, setStep] = useState(1);
  const [fine, setFine] = useState(false);
  const [mode, setMode] = useState<'base' | 'prev'>('base');
  const base = useMemo(() => faceGrid(BASE, NX, NY), []);
  const grids = useMemo(() => FACES.map((f) => faceGrid(atStep(f, step), NX, NY)), [step]);
  const prev = useMemo(() => FACES.map((f) => faceGrid(atStep(f, step - 1), NX, NY)), [step]);
  const diffs = grids.map((g, i) => diffGrid(g, mode === 'base' ? base : prev[i]));
  const top = extent(base).hi; const n = fine ? 16 : 8;
  const levels = Array.from({ length: n }, (_, k) => ((k + 1) * top) / (n + 1));
  const dmax = Math.max(0.01, ...diffs.map((d) => { const e = extent(d); return Math.max(Math.abs(e.lo), Math.abs(e.hi)); }));
  const dLevels = [-4, -3, -2, -1, 1, 2, 3, 4].map((k) => (k * dmax) / 5);
  const [styles, setStyles] = useState<HairStyle[]>(['tower', 'wings', 'bob']);
  const heads = useMemo(() => FACES.map((f, i) => headGrid(atStep(f, 5), styles[i], HX, HY)), [styles]);
  const sils = heads.map((h) => silhouette(h));
  const bare = useMemo(() => FACES.map((f) => silhouette(headGrid(atStep(f, 5), 'none', HX, HY))), []);
  const pairs: [number, number][] = [[0, 1], [0, 2], [1, 2]];
  const headTop = Math.max(...heads.map((h) => extent(h).hi)); const headLevels = Array.from({ length: 10 }, (_, k) => ((k + 1) * headTop) / 11);

  return (
    <main className="min-h-screen bg-[#fafaf9] px-4 py-6 font-mono text-[#1f1f1f]">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-2">
          <div>
            <p className="text-xs text-[#c8001a]">LAB · 顔型の差分装置 · ホワイトアウト版 AB の 3 体のために</p>
            <h1 className="text-xl font-semibold">標高の等高線で、顔の輪郭を研究する</h1>
            <p className="max-w-3xl text-xs text-stone-600">顔を高さの地図にして等高線を引き、3 体を「基準の顔からの差」として大きな形から細かい形へ順に作ります。差の地図は、墨が基準より高い所、赤が低い所です。</p>
          </div>
          <nav className="flex items-center gap-3 text-xs"><span className="flex items-center gap-1" title="射出するシンボル（次の作業）"><EthGlyph size={20} color="#1f1f1f" /> 射出するシンボル</span><Link href="/lab/backlog" className="underline">やることボード</Link></nav>
        </header>

        <section className="flex flex-wrap items-center gap-2 text-xs" aria-label="段階">
          {STEPS.map((s) => <button key={s.step} type="button" data-testid={`step-${s.step}`} onClick={() => setStep(s.step)} className="border px-2 py-1" style={{ borderColor: step === s.step ? '#c8001a' : '#d6d3d1', color: step >= s.step ? '#1f1f1f' : '#78716c', background: step === s.step ? '#fff1f2' : 'white' }}>{s.step}. {s.name}</button>)}
          <label className="ml-3 flex items-center gap-1"><input type="checkbox" checked={fine} onChange={(e) => setFine(e.target.checked)} />細かい等高線（16 段）</label>
          <span className="ml-3">差の基準：</span>
          {(['base', 'prev'] as const).map((m) => <button key={m} type="button" data-testid={`mode-${m}`} onClick={() => setMode(m)} className="border px-2 py-0.5" style={{ borderColor: mode === m ? '#1f1f1f' : '#d6d3d1' }}>{m === 'base' ? '基準の顔' : 'ひとつ前の段階'}</button>)}
        </section>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Contours g={base} levels={levels} colorOf={() => '#78716c'} label="基準の顔" testid="base" />
          {grids.map((g, i) => <Contours key={i} g={g} levels={levels} colorOf={() => '#1f1f1f'} label={`${i + 1} 体目（段階 ${step} まで）`} testid={`face-${i + 1}`} />)}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1 self-center text-xs text-stone-600" data-testid="legend">
            <p>差の地図（{mode === 'base' ? '基準の顔との差' : `段階 ${step - 1} → ${step} で増えた差`}）</p>
            <p><span className="text-[#1f1f1f]">墨</span>：高い · <span className="text-[#c8001a]">赤</span>：低い</p>
            <p>線の間隔 {(dmax / 5).toFixed(3)}（最大 {dmax.toFixed(3)}）</p>
            <p className="text-[10px]">{STEPS[step - 1].name}：{STEP_NOTE[step - 1]}</p>
          </div>
          {diffs.map((d, i) => <Contours key={i} g={d} levels={dLevels} colorOf={(lv) => (lv > 0 ? '#1f1f1f' : '#c8001a')} label={`${i + 1} 体目 − ${mode === 'base' ? '基準' : '前の段階'}`} testid={`diff-${i + 1}`} />)}
        </div>
        <section className="space-y-2 border-t border-stone-200 pt-3" aria-label="髪型の型" data-testid="hair">
          <h2 className="text-sm font-semibold">髪型の型（VR / MR 用）— 3 体を個性よくそろえる</h2>
          <p className="text-xs text-stone-600">ウィッグの作品に共通する型：1 体に<strong>シルエットの主役を 1 つ</strong>、次に質感を 1 つ、最後にアクセントを 1 つ。下の数字（IoU）は 2 体のシルエットの重なりで、1 に近いほど見分けにくい。</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {heads.map((h, i) => (
              <div key={i} className="space-y-1">
                <div className="flex flex-wrap gap-1 text-[11px]">{HAIR_STYLES.map((st) => <button key={st.id} type="button" data-testid={`hair-${i + 1}-${st.id}`} onClick={() => setStyles((xs) => xs.map((x, k) => (k === i ? st.id : x)))} className="border px-1.5" title={st.note} style={{ borderColor: styles[i] === st.id ? '#c8001a' : '#d6d3d1' }}>{st.name}</button>)}</div>
                <div className="flex items-end gap-2"><div className="flex-1"><Contours g={h} levels={headLevels} colorOf={() => '#1f1f1f'} label={`${i + 1} 体目 · ${HAIR_STYLES.find((x) => x.id === styles[i])?.name ?? ''}`} nx={HX} ny={HY} /></div><Thumb sil={sils[i]} nx={HX} ny={HY} /></div>
              </div>
            ))}
          </div>
          <table className="text-xs" data-testid="iou"><tbody>
            <tr className="text-stone-500"><td className="pr-4">組</td><td className="pr-4">顔だけ</td><td>髪型あり</td></tr>
            {pairs.map(([a, b]) => { const v = iou(sils[a], sils[b]); return <tr key={`${a}${b}`}><td className="pr-4">{a + 1} と {b + 1}</td><td className="pr-4">{iou(bare[a], bare[b]).toFixed(2)}</td><td style={{ color: v < 0.75 ? '#1f1f1f' : '#c8001a' }}>{v.toFixed(2)}{v < 0.75 ? '' : '（似ている）'}</td></tr>; })}
          </tbody></table>
          <p className="text-[11px] text-stone-500">分かったこと：顔の形だけでは重なりが 0.82〜0.95 で、小さく見ると見分けにくい。主役のシルエットを 3 体で変える（縦の塔・翼・ボブ）と 0.69〜0.72 まで下がる。編み込みは質感なので、シルエットはほとんど変えない（主役ではなく 2 番目に使う）。</p>
        </section>

        <p className="text-[11px] text-stone-500">高さは顔の描き方のためのモデル（なだらかな山の重ね合わせ）で、解剖学ではありません。射出するシンボルはイーサリアム（Ξ、このプロジェクト独自のハニカムのアイコン）。「自由」のシンボルは、飛ぶほど重くなり、射出した分だけ球体の割れ目が増える — 次の作業で。</p>
      </div>
    </main>
  );
}
