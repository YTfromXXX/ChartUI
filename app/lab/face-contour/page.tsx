'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import EthGlyph from '@/components/EthGlyph';
import { ACCENT_COLORS, ACCENT_SLOTS, BASE, BOB_VARIANTS, FACES, HAIR_STYLES, isBob, type AccentSlot, STEPS, atStep, contour, diffGrid, extent, faceGrid, headGrid, iou, silhouette, type Grid, type HairStyle } from '@/lib/faceContour';

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

/** Head coordinates → grid cell of headGrid (x −1.35…1.35, y 1.75 at the top … −1.3). */
const toCell = (x: number, y: number, nx: number, ny: number): [number, number] => [((x + 1.35) / 2.7) * (nx - 1), ((1.75 - y) / 3.05) * (ny - 1)];

/** One of the 7 slots: the figure's silhouette with left/right colours and the accessory drawn on top. */
function AccentThumb({ sil, nx, ny, slot }: { sil: boolean[]; nx: number; ny: number; slot: AccentSlot }) {
  const L: string[] = []; const R: string[] = [];
  for (let j = 0; j < ny; j += 2) for (let i = 0; i < nx; i += 2) if (sil[j * nx + i]) (i < nx / 2 ? L : R).push(`M${i} ${j}h2v2h-2z`);
  const marks = slot.at.map(([x, y], k) => {
    const [cx, cy] = toCell(x, y, nx, ny);
    switch (slot.shape) {
      case 'flower': return <g key={k}>{[0, 72, 144, 216, 288].map((a) => <circle key={a} cx={cx + 4 * Math.cos((a * Math.PI) / 180)} cy={cy + 4 * Math.sin((a * Math.PI) / 180)} r={3} fill="white" stroke={ACCENT_COLORS.red} strokeWidth={1} />)}<circle cx={cx} cy={cy} r={2} fill={ACCENT_COLORS.red} /></g>;
      case 'ribbon': return <path key={k} d={`M${cx} ${cy}l-7 -5v10z M${cx} ${cy}l7 -5v10z`} fill={ACCENT_COLORS.red} stroke="white" strokeWidth={0.8} />;
      case 'comb': return <g key={k}><rect x={cx - 9} y={cy - 2} width={18} height={4} fill="white" stroke={ACCENT_COLORS.bronze} strokeWidth={1} />{Array.from({ length: 6 }, (_, t) => <line key={t} x1={cx - 7.5 + t * 3} y1={cy - 2} x2={cx - 7.5 + t * 3} y2={cy - 7} stroke={ACCENT_COLORS.bronze} strokeWidth={1} />)}</g>;
      case 'pins': return <line key={k} x1={cx - 4} y1={cy - 2} x2={cx + 4} y2={cy + 2} stroke="white" strokeWidth={1.6} />;
      case 'feather': return <path key={k} d={`M${cx} ${cy}q8 -14 2 -24q-10 10 -2 24z`} fill="white" stroke={ACCENT_COLORS.bronze} strokeWidth={1} />;
      case 'beads': return <circle key={k} cx={cx} cy={cy} r={2.6} fill="white" stroke={x < 0 ? ACCENT_COLORS.red : ACCENT_COLORS.indigo} strokeWidth={1.2} />;
      default: return null;
    }
  });
  return (
    <svg viewBox={`-4 -4 ${nx + 8} ${ny + 8}`} className="mx-auto h-36 w-32" aria-label={slot.name}>
      <path d={L.join('')} fill={ACCENT_COLORS[slot.left]} /><path d={R.join('')} fill={ACCENT_COLORS[slot.right]} />
      {marks}
    </svg>
  );
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
  const [bobOpen, setBobOpen] = useState<number | null>(null);
  const [who, setWho] = useState(2);
  const [accents, setAccents] = useState<(number | null)[]>([null, null, null]);
  const pick = (i: number, st: HairStyle) => setStyles((xs) => xs.map((x, k) => (k === i ? st : x)));
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
                <div className="flex flex-wrap gap-1 text-[11px]">{HAIR_STYLES.map((st) => { const on = st.id === 'bob' ? isBob(styles[i]) : styles[i] === st.id; return <button key={st.id} type="button" data-testid={`hair-${i + 1}-${st.id}`} aria-expanded={st.id === 'bob' ? bobOpen === i : undefined} onClick={() => { if (st.id === 'bob') { if (!isBob(styles[i])) pick(i, 'bob'); setBobOpen((o) => (o === i ? null : i)); } else { pick(i, st.id); setBobOpen(null); } }} className="border px-1.5" title={st.note} style={{ borderColor: on ? '#c8001a' : '#d6d3d1' }}>{st.name}{st.id === 'bob' ? (bobOpen === i ? ' ▴' : ' ▾') : ''}</button>; })}</div>
                {bobOpen === i && <div className="flex flex-wrap gap-1 border-l-2 border-[#c8001a] pl-2 text-[11px]" data-testid={`bob-variants-${i + 1}`} aria-label="ボブの新しい 4 つの型">{BOB_VARIANTS.map((v) => <button key={v.id} type="button" data-testid={`hair-${i + 1}-${v.id}`} onClick={() => pick(i, v.id)} className="border px-1.5" title={v.note} style={{ borderColor: styles[i] === v.id ? '#c8001a' : '#d6d3d1', background: styles[i] === v.id ? '#fff1f2' : 'white' }}>{v.name}</button>)}</div>}
                <div className="flex items-end gap-2"><div className="flex-1"><Contours g={h} levels={headLevels} colorOf={() => '#1f1f1f'} label={`${i + 1} 体目 · ${[...HAIR_STYLES, ...BOB_VARIANTS].find((x) => x.id === styles[i])?.name ?? ''}${isBob(styles[i]) && styles[i] !== 'bob' ? '（ボブ）' : ''}${accents[i] ? ` · ${ACCENT_SLOTS[accents[i]! - 1].name}` : ''}`} nx={HX} ny={HY} /></div><Thumb sil={sils[i]} nx={HX} ny={HY} /></div>
              </div>
            ))}
          </div>
          <table className="text-xs" data-testid="iou"><tbody>
            <tr className="text-stone-500"><td className="pr-4">組</td><td className="pr-4">顔だけ</td><td>髪型あり</td></tr>
            {pairs.map(([a, b]) => { const v = iou(sils[a], sils[b]); return <tr key={`${a}${b}`}><td className="pr-4">{a + 1} と {b + 1}</td><td className="pr-4">{iou(bare[a], bare[b]).toFixed(2)}</td><td style={{ color: v < 0.75 ? '#1f1f1f' : '#c8001a' }}>{v.toFixed(2)}{v < 0.75 ? '' : '（似ている）'}</td></tr>; })}
          </tbody></table>
          <p className="text-[11px] text-stone-500">ボブの 4 つの型（ボブを押すと開く）：左右非対称・内巻き・切りそろえ・段。主役のシルエットはボブのまま、質感と輪郭の端で個性を足す。</p>
          <p className="text-[11px] text-stone-500">分かったこと：顔の形だけでは重なりが 0.82〜0.95 で、小さく見ると見分けにくい。主役のシルエットを 3 体で変える（縦の塔・翼・ボブ）と 0.69〜0.72 まで下がる。編み込みは質感なので、シルエットはほとんど変えない（主役ではなく 2 番目に使う）。</p>
        </section>

        <section className="space-y-2 border-t border-stone-200 pt-3" aria-label="アクセサリーと色の左右差" data-testid="accents">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-sm font-semibold">アクセサリーと色の左右差（7 マス）</h2>
            <span className="text-xs" aria-hidden>{ACCENT_SLOTS.map((sl) => (accents[who] === sl.id ? '◼︎' : '◻︎')).join('')}</span>
            <span className="flex gap-1 text-[11px]">{[0, 1, 2].map((i) => <button key={i} type="button" data-testid={`accent-who-${i + 1}`} onClick={() => setWho(i)} className="border px-1.5" style={{ borderColor: who === i ? '#c8001a' : '#d6d3d1' }}>{i + 1} 体目</button>)}</span>
          </div>
          <p className="text-xs text-stone-600">横にスクロールして、{who + 1} 体目に合うマスを選ぶ（もう一度押すと外す）。左右の色の差と、飾りの位置の差で「片寄せ」を作る。7 マス目は空き。</p>
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2" data-testid="accent-strip" tabIndex={0} aria-label="7 マス（横にスクロール）">
            {ACCENT_SLOTS.map((sl) => { const on = accents[who] === sl.id; return (
              <button key={sl.id} type="button" data-testid={`accent-${sl.id}`} aria-pressed={on} onClick={() => setAccents((xs) => xs.map((x, k) => (k === who ? (x === sl.id ? null : sl.id) : x)))} className="flex w-44 shrink-0 snap-start flex-col justify-start space-y-1 border bg-white p-1 text-left text-[11px]" style={{ borderColor: on ? '#c8001a' : '#d6d3d1' }}>
                <span className="block text-stone-500">{sl.id} / 7</span>
                {sl.shape === 'open' ? <span className="flex h-36 items-center justify-center text-3xl text-stone-400" aria-hidden>◻︎</span> : <AccentThumb sil={sils[who]} nx={HX} ny={HY} slot={sl} />}
                <span className="block font-semibold">{sl.name}</span>
                <span className="block text-[10px] text-stone-600">{sl.note}</span>
              </button>
            ); })}
          </div>
        </section>

        <p className="text-[11px] text-stone-500">高さは顔の描き方のためのモデル（なだらかな山の重ね合わせ）で、解剖学ではありません。射出するシンボルはイーサリアム（Ξ、このプロジェクト独自のハニカムのアイコン）。「自由」のシンボルは、飛ぶほど重くなり、射出した分だけ球体の割れ目が増える — 次の作業で。</p>
      </div>
    </main>
  );
}
