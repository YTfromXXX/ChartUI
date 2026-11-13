'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import EthGlyph from '@/components/EthGlyph';
import DiceColourRewind from '@/components/faceContour/DiceColourRewind';
import { FAMILY_NAME, inFamily, type FigureType } from '@/lib/colourRule';
import { DETAILS, FRINGES, ratioText, type HairDetail, ACCENT_COLORS, ACCENT_SLOTS, BASE, BOB_VARIANTS, COLOUR_DICE, DICE_FIGURES, FACES, FIGURE_NAMES, FIGURE_TYPES, HAIR_STYLES, PONY, PONY_FIGURE, type FaceParams, isBob, type AccentSlot, STEPS, atStep, contour, diffGrid, extent, faceGrid, headGrid, iou, silhouette, type Grid, type HairStyle } from '@/lib/faceContour';

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
function Thumb({ sil, nx, ny, left = '#1f1f1f', right = '#1f1f1f' }: { sil: boolean[]; nx: number; ny: number; left?: string; right?: string }) {
  const L: string[] = []; const R: string[] = []; for (let j = 0; j < ny; j += 2) for (let i = 0; i < nx; i += 2) if (sil[j * nx + i]) (i < nx / 2 ? L : R).push(`M${i} ${j}h2v2h-2z`);
  return <svg viewBox={`0 0 ${nx} ${ny}`} className="h-16 w-14" aria-label="小さなシルエット（左右の色）"><path d={L.join('')} fill={left} /><path d={R.join('')} fill={right} /></svg>;
}

/** Head coordinates → grid cell of headGrid (x −1.35…1.35, y 1.75 at the top … −1.3). */
const toCell = (x: number, y: number, nx: number, ny: number): [number, number] => [((x + 1.35) / 2.7) * (nx - 1), ((1.75 - y) / 3.05) * (ny - 1)];

/** One of the 7 slots: the figure's silhouette with left/right colours and the accessory drawn on top. */
function AccentThumb({ sil, nx, ny, slot, seg }: { sil: boolean[]; nx: number; ny: number; slot: AccentSlot; seg?: [number, number] }) {
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
      {seg && <circle cx={seg[0]} cy={seg[1]} r={5} fill="none" stroke="#c8001a" strokeWidth={1.2} strokeDasharray="2 1.5" />}
    </svg>
  );
}

const ROUGH_COLORS = ['#c8001a', '#1f1f1f', '#2b3a67', '#7a5c12'];

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
  const [ref, setRef] = useState<'std' | 'pony'>('std');
  const refFace: FaceParams = ref === 'pony' ? FACES[PONY_FIGURE] : BASE;
  const refName = ref === 'pony' ? 'ポニーテールの顔' : '標準の顔';
  const base = useMemo(() => faceGrid(refFace, NX, NY), [refFace]);
  const grids = useMemo(() => FACES.map((f) => faceGrid(atStep(f, step, refFace), NX, NY)), [step, refFace]);
  const prev = useMemo(() => FACES.map((f) => faceGrid(atStep(f, step - 1, refFace), NX, NY)), [step, refFace]);
  // Rough default outlines: steps 1–2 only (outline and masses), relative to the chosen reference, overlaid.
  const rough = useMemo(() => FACES.map((f) => faceGrid(atStep(f, 2, refFace), NX, NY)), [refFace]);
  const diffs = grids.map((g, i) => diffGrid(g, mode === 'base' ? base : prev[i]));
  const top = extent(base).hi; const n = fine ? 16 : 8;
  const levels = Array.from({ length: n }, (_, k) => ((k + 1) * top) / (n + 1));
  const dmax = Math.max(0.01, ...diffs.map((d) => { const e = extent(d); return Math.max(Math.abs(e.lo), Math.abs(e.hi)); }));
  const dLevels = [-4, -3, -2, -1, 1, 2, 3, 4].map((k) => (k * dmax) / 5);
  const [styles, setStyles] = useState<HairStyle[]>(['ponytail', 'bob', 'buns', 'cloud']);
  const [bobOpen, setBobOpen] = useState<number | null>(null);
  const [accents, setAccents] = useState<(number | null)[]>([null, null, null, null]);
  const pick = (i: number, st: HairStyle) => setStyles((xs) => xs.map((x, k) => (k === i ? st : x)));
  const [details, setDetails] = useState<HairDetail[]>(DETAILS);
  const setDetail = (i: number, patch: Partial<HairDetail>) => setDetails((ds) => ds.map((d, k) => (k === i ? { ...d, ...patch } : d)));
  const heads = useMemo(() => FACES.map((f, i) => headGrid(atStep(f, 5), styles[i], HX, HY, details[i])), [styles, details]);
  const sils = heads.map((h) => silhouette(h));
  const bare = useMemo(() => FACES.map((f) => silhouette(headGrid(atStep(f, 5), 'none', HX, HY))), []);
  const pairs: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  const headTop = Math.max(...heads.map((h) => extent(h).hi)); const headLevels = Array.from({ length: 10 }, (_, k) => ((k + 1) * headTop) / 11);

  return (
    <main className="min-h-screen bg-[#fafaf9] px-4 py-6 font-mono text-[#1f1f1f]">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-200 pb-2">
          <div>
            <p className="text-xs text-[#c8001a]">LAB · 顔型の差分装置 · ホワイトアウト版 AB の 4 体のために</p>
            <h1 className="text-xl font-semibold">標高の等高線で、顔の輪郭を研究する</h1>
            <p className="max-w-3xl text-xs text-stone-600">顔を高さの地図にして等高線を引き、4 体を「基準の顔からの差」として大きな形から細かい形へ順に作ります。差の地図は、墨が基準より高い所、赤が低い所です。</p>
          </div>
          <nav className="flex items-center gap-3 text-xs"><span className="flex items-center gap-1" title="射出するシンボル（次の作業）"><EthGlyph size={20} color="#1f1f1f" /> 射出するシンボル</span><Link href="/lab/backlog" className="underline">やることボード</Link></nav>
        </header>

        <section className="flex flex-wrap items-center gap-2 text-xs" aria-label="段階">
          {STEPS.map((s) => <button key={s.step} type="button" data-testid={`step-${s.step}`} onClick={() => setStep(s.step)} className="border px-2 py-1" style={{ borderColor: step === s.step ? '#c8001a' : '#d6d3d1', color: step >= s.step ? '#1f1f1f' : '#78716c', background: step === s.step ? '#fff1f2' : 'white' }}>{s.step}. {s.name}</button>)}
          <label className="ml-3 flex items-center gap-1"><input type="checkbox" checked={fine} onChange={(e) => setFine(e.target.checked)} />細かい等高線（16 段）</label>
          <span className="ml-3">基準の顔：</span>
          {(['std', 'pony'] as const).map((r) => <button key={r} type="button" data-testid={`ref-${r}`} onClick={() => setRef(r)} className="border px-2 py-0.5" style={{ borderColor: ref === r ? '#c8001a' : '#d6d3d1' }}>{r === 'std' ? '標準の顔' : 'ポニーテールの顔'}</button>)}
          <span className="ml-3">差の基準：</span>
          {(['base', 'prev'] as const).map((m) => <button key={m} type="button" data-testid={`mode-${m}`} onClick={() => setMode(m)} className="border px-2 py-0.5" style={{ borderColor: mode === m ? '#1f1f1f' : '#d6d3d1' }}>{m === 'base' ? '基準の顔' : 'ひとつ前の段階'}</button>)}
        </section>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Contours g={base} levels={levels} colorOf={() => '#78716c'} label={`基準：${refName}`} testid="base" />
          {grids.map((g, i) => <Contours key={i} g={g} levels={levels} colorOf={() => '#1f1f1f'} label={`${FIGURE_NAMES[i]}（段階 ${step} まで）`} testid={`face-${i + 1}`} />)}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="space-y-1 self-center text-xs text-stone-600" data-testid="legend">
            <p>差の地図（{mode === 'base' ? '基準の顔との差' : `段階 ${step - 1} → ${step} で増えた差`}）</p>
            <p><span className="text-[#1f1f1f]">墨</span>：高い · <span className="text-[#c8001a]">赤</span>：低い</p>
            <p>線の間隔 {(dmax / 5).toFixed(3)}（最大 {dmax.toFixed(3)}）</p>
            <p className="text-[10px]">{STEPS[step - 1].name}：{STEP_NOTE[step - 1]}</p>
          </div>
          {diffs.map((d, i) => <Contours key={i} g={d} levels={dLevels} colorOf={(lv) => (lv > 0 ? '#1f1f1f' : '#c8001a')} label={`${FIGURE_NAMES[i]} − ${mode === 'base' ? refName : '前の段階'}`} testid={`diff-${i + 1}`} />)}
        </div>
        <section className="space-y-2 border-t border-stone-200 pt-3" aria-label="大まかなデフォルトの輪郭" data-testid="rough">
          <h2 className="text-sm font-semibold">4 体の大まかなデフォルトの輪郭（基準：{refName}）</h2>
          <p className="text-xs text-stone-600">段階 1〜2（輪郭と量感）だけを入れた 4 体を、同じ紙に重ねる。いちばん外側の線と、中ほどの 1 本だけを描く。{ref === 'pony' ? 'ポニーテールは基準そのものなので、ほかの 3 体がそこからどう外れるかが見える。' : '「ポニーテールの顔」に切り替えると、ポニーテールを基準にした差になる。'}</p>
          <div className="flex flex-wrap items-start gap-4">
            <svg viewBox={`0 0 ${(NX - 1) * PX} ${(NY - 1) * PX}`} className="w-64 border border-stone-200 bg-white" aria-label="3 体の輪郭の重ね合わせ">
              {rough.map((g, i) => { const hi = extent(g).hi; return [0.04, hi * 0.55].map((lv, k) => <path key={`${i}-${k}`} d={contour(g, lv).map(([a, b, c, d]) => `M${(a * PX).toFixed(1)} ${(b * PX).toFixed(1)}L${(c * PX).toFixed(1)} ${(d * PX).toFixed(1)}`).join('')} fill="none" stroke={ROUGH_COLORS[i]} strokeWidth={k === 0 ? 1.4 : 0.7} strokeDasharray={i === 2 ? '3 2' : undefined} />); })}
            </svg>
            <table className="text-xs" data-testid="rough-table"><tbody>
              <tr className="text-stone-500"><td className="pr-3">体</td><td className="pr-3">幅 rx</td><td className="pr-3">高さ ry</td><td className="pr-3">縦横比</td><td>線</td></tr>
              {FACES.map((f, i) => <tr key={i}><td className="pr-3">{FIGURE_NAMES[i]}</td><td className="pr-3">{f.rx.toFixed(2)}</td><td className="pr-3">{f.ry.toFixed(2)}</td><td className="pr-3">{(f.ry / f.rx).toFixed(2)}</td><td><span style={{ color: ROUGH_COLORS[i] }}>{i === 2 ? '- - -' : '———'}</span></td></tr>)}
            </tbody></table>
          </div>
        </section>
        <section className="space-y-2 border-t border-stone-200 pt-3" aria-label="髪型の型" data-testid="hair">
          <h2 className="text-sm font-semibold">髪型の型（VR / MR 用）— 4 体を個性よくならべる</h2>
          <p className="text-xs text-stone-600">ウィッグの作品に共通する型：1 体に<strong>シルエットの主役を 1 つ</strong>、次に質感を 1 つ、最後にアクセントを 1 つ。下の数字（IoU）は 2 体のシルエットの重なりで、1 に近いほど見分けにくい。</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {heads.map((h, i) => (
              <div key={i} className="space-y-1">
                <div className="flex flex-wrap gap-1 text-[11px]">{HAIR_STYLES.map((st) => { const on = st.id === 'bob' ? isBob(styles[i]) : styles[i] === st.id; return <button key={st.id} type="button" data-testid={`hair-${i + 1}-${st.id}`} aria-expanded={st.id === 'bob' ? bobOpen === i : undefined} onClick={() => { if (st.id === 'bob') { if (!isBob(styles[i])) pick(i, 'bob'); setBobOpen((o) => (o === i ? null : i)); } else { pick(i, st.id); setBobOpen(null); } }} className="border px-1.5" title={st.note} style={{ borderColor: on ? '#c8001a' : '#d6d3d1' }}>{st.name}{st.id === 'bob' ? (bobOpen === i ? ' ▴' : ' ▾') : ''}</button>; })}</div>
                {bobOpen === i && <div className="flex flex-wrap gap-1 border-l-2 border-[#c8001a] pl-2 text-[11px]" data-testid={`bob-variants-${i + 1}`} aria-label="ボブの新しい 4 つの型">{BOB_VARIANTS.map((v) => <button key={v.id} type="button" data-testid={`hair-${i + 1}-${v.id}`} onClick={() => pick(i, v.id)} className="border px-1.5" title={v.note} style={{ borderColor: styles[i] === v.id ? '#c8001a' : '#d6d3d1', background: styles[i] === v.id ? '#fff1f2' : 'white' }}>{v.name}</button>)}</div>}
                <div className="space-y-1 border border-stone-200 bg-white p-1.5 text-[11px]" data-testid={`detail-${i + 1}`}>
                  <div className="flex flex-wrap items-center gap-1">前髪：{FRINGES.map((fr) => <button key={fr.id} type="button" data-testid={`fringe-${i + 1}-${fr.id}`} onClick={() => setDetail(i, { fringe: fr.id })} className="border px-1" style={{ borderColor: details[i].fringe === fr.id ? '#c8001a' : '#d6d3d1' }}>{fr.name}</button>)}</div>
                  <label className="flex items-center gap-1">分け目 左:右 <input type="range" min={1} max={9} value={Math.round(details[i].split * 10)} onChange={(e) => setDetail(i, { split: Number(e.target.value) / 10 })} className="w-20" aria-label="前髪の左右の比" /> <span data-testid={`split-${i + 1}`}>{ratioText(details[i].split)}</span></label>
                  <label className="flex items-center gap-1">サイド 左 <input type="range" min={0} max={10} value={Math.round(details[i].sideL * 10)} onChange={(e) => setDetail(i, { sideL: Number(e.target.value) / 10 })} className="w-14" aria-label="左のサイドの長さ" /> 右 <input type="range" min={0} max={10} value={Math.round(details[i].sideR * 10)} onChange={(e) => setDetail(i, { sideR: Number(e.target.value) / 10 })} className="w-14" aria-label="右のサイドの長さ" /> <span>{Math.round(details[i].sideL * 10)}:{Math.round(details[i].sideR * 10)}</span></label>
                  <div className="flex flex-wrap items-center gap-1">色 左 {(Object.keys(ACCENT_COLORS) as (keyof typeof ACCENT_COLORS)[]).map((c) => <button key={`l${c}`} type="button" aria-label={`左を${c}`} onClick={() => setDetail(i, { colorL: c })} className="h-3 w-3 border" style={{ background: ACCENT_COLORS[c], borderColor: details[i].colorL === c ? '#c8001a' : 'white', outline: details[i].colorL === c ? '1px solid #c8001a' : 'none' }} />)} 右 {(Object.keys(ACCENT_COLORS) as (keyof typeof ACCENT_COLORS)[]).map((c) => <button key={`r${c}`} type="button" aria-label={`右を${c}`} onClick={() => setDetail(i, { colorR: c })} className="h-3 w-3 border" style={{ background: ACCENT_COLORS[c], borderColor: details[i].colorR === c ? '#c8001a' : 'white', outline: details[i].colorR === c ? '1px solid #c8001a' : 'none' }} />)}</div>
                  <p className="text-[10px] text-stone-600">飾り：{details[i].accent}</p>
                </div>
                <div className="flex items-end gap-2"><div className="flex-1"><Contours g={h} levels={headLevels} colorOf={() => '#1f1f1f'} label={`${FIGURE_NAMES[i]} · ${[...HAIR_STYLES, ...BOB_VARIANTS].find((x) => x.id === styles[i])?.name ?? ''}${isBob(styles[i]) && styles[i] !== 'bob' ? '（ボブ）' : ''}${accents[i] ? ` · ${ACCENT_SLOTS[accents[i]! - 1].name}` : ''}`} nx={HX} ny={HY} /></div>{(DICE_FIGURES as readonly number[]).includes(i) ? <DiceColourRewind figure={i} name={FIGURE_NAMES[i]} sil={sils[i]} nx={HX} ny={HY} /> : <Thumb sil={sils[i]} nx={HX} ny={HY} left={ACCENT_COLORS[details[i].colorL]} right={ACCENT_COLORS[details[i].colorR]} />}</div>
              </div>
            ))}
          </div>
          <table className="text-xs" data-testid="colour-rule"><tbody>
            <tr className="text-stone-500"><td className="pr-4">色の規則（統一）</td><td className="pr-4">型</td><td className="pr-4">主色（左）</td><td>族に入るか</td></tr>
            {FACES.map((_, i) => { const t = FIGURE_TYPES[i] as FigureType; const isDice = (DICE_FIGURES as readonly number[]).includes(i); const hexes = isDice ? COLOUR_DICE[i].faces.filter((f) => inFamily(f.hex, t)).map((f) => f.hex) : [ACCENT_COLORS[details[i].colorL]]; const ok = hexes.length > 0 && hexes.every((h) => inFamily(h, t)); return (
              <tr key={i}><td className="pr-4">{FIGURE_NAMES[i]}</td><td className="pr-4">{FAMILY_NAME[t]}</td><td className="pr-4">{hexes.map((h) => <span key={h} className="mr-1 inline-block h-3 w-3 align-middle" style={{ background: h }} />)}{isDice ? '（サイコロの左はこの中から）' : ''}</td><td style={{ color: ok ? '#1f1f1f' : '#c8001a' }} data-testid={`rule-${i + 1}`}>{ok ? '入る' : '外れている'}</td></tr>
            ); })}
          </tbody></table>
          <table className="text-xs" data-testid="iou"><tbody>
            <tr className="text-stone-500"><td className="pr-4">組</td><td className="pr-4">顔だけ</td><td>髪型あり</td></tr>
            {pairs.map(([a, b]) => { const v = iou(sils[a], sils[b]); return <tr key={`${a}${b}`}><td className="pr-4">{FIGURE_NAMES[a]} と {FIGURE_NAMES[b]}</td><td className="pr-4">{iou(bare[a], bare[b]).toFixed(2)}</td><td style={{ color: v < 0.75 ? '#1f1f1f' : '#c8001a' }}>{v.toFixed(2)}{v < 0.75 ? '' : '（似ている）'}</td></tr>; })}
          </tbody></table>
          <p className="text-[11px] text-stone-500">ボブの 4 つの型（ボブを押すと開く）：左右非対称・内巻き・切りそろえ・段。主役のシルエットはボブのまま、質感と輪郭の端で個性を足す。</p>
          <p className="text-[11px] text-stone-500">4 体の並び（左から）：ポニーテール（流し 7:3・右へ流れる束）／ボブ（ぱっつん 5:5・ピンク）／アリミノガール（二つの輪・片目隠し 2:8・右だけ長いサイド）／アリミノボーイ（雲・シースルー・小さな花の冠）。動くところは前髪の比、サイドの左右の長さ、左右の色。</p>
          <p className="text-[11px] text-stone-500">4 体にしたとき：顔を可愛く（丸く、額を広く、鼻とあごを小さく）すると、顔だけの重なりは 0.87〜0.95 に上がる。可愛い顔は似てくるので、見分けは髪の主役の大きさに任せる（ポニーテール・ボブ・二つの輪・雲で 0.62〜0.73）。</p>
          <p className="text-[11px] text-stone-500">これまで（3 体のとき）に分かったこと：顔の形だけでは重なりが 0.82〜0.95 で、小さく見ると見分けにくい。主役のシルエットを 3 体で変える（縦の塔・翼・ボブ）と 0.69〜0.72 まで下がる。編み込みは質感なので、シルエットはほとんど変えない（主役ではなく 2 番目に使う）。</p>
        </section>

        <section className="space-y-2 border-t border-stone-200 pt-3" aria-label="アクセサリーと色の左右差" data-testid="accents">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-sm font-semibold">ポニーテール（7 マス）— アクセサリーと色の左右差</h2>
            <span className="text-xs" aria-hidden>{ACCENT_SLOTS.map((sl) => (accents[PONY_FIGURE] === sl.id ? '◼︎' : '◻︎')).join('')}</span>
          </div>
          <p className="text-xs text-stone-600">この 7 マスを<strong>ポニーテール</strong>と定める：1 マス目が根元、7 マス目が毛先（上のポニーテールの節と同じ順）。マスは {FIGURE_NAMES[PONY_FIGURE]} の小物棚。横にスクロールして選ぶ（もう一度押すと外す）。7 マス目（毛先）は空き。</p>
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2" data-testid="accent-strip" tabIndex={0} aria-label="ポニーテールの 7 マス（横にスクロール）">
            {ACCENT_SLOTS.map((sl) => { const on = accents[PONY_FIGURE] === sl.id; const [sx, sy] = toCell(PONY[sl.id - 1][0], PONY[sl.id - 1][1], HX, HY); return (
              <button key={sl.id} type="button" data-testid={`accent-${sl.id}`} aria-pressed={on} onClick={() => setAccents((xs) => xs.map((x, k) => (k === PONY_FIGURE ? (x === sl.id ? null : sl.id) : x)))} className="flex w-44 shrink-0 snap-start flex-col justify-start space-y-1 border bg-white p-1 text-left text-[11px]" style={{ borderColor: on ? '#c8001a' : '#d6d3d1' }}>
                <span className="block text-stone-500">{sl.id} / 7 · {sl.id === 1 ? '根元' : sl.id === 7 ? '毛先' : '節'}</span>
                {sl.shape === 'open' ? <span className="flex h-36 items-center justify-center text-3xl text-stone-400" aria-hidden>◻︎</span> : <AccentThumb sil={sils[PONY_FIGURE]} nx={HX} ny={HY} slot={sl} seg={[sx, sy]} />}
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
