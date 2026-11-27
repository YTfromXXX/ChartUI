'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { KRUGER_FAMILY } from '@/components/mente/KrugerBubble';
import { FEATURES, PRESETS, THROW, analyse, path, predict, syntheticCrowd, type Entry, type Shape } from '@/lib/paperPlane';

const KEY = 'chartui-mente-paper-planes-v1';
const RED = '#d6001c';

function Slide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-4 border-black bg-white/80 p-4" aria-label={title}>
      <p className="inline-block bg-black px-2 py-1 text-sm font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>{title}</p>
      {children}
    </section>
  );
}

/** Top view (wing outline from span, area and sweep) and front view (dihedral) of the folded plane. */
function PlaneViews({ s }: { s: Shape }) {
  const chord = s.area / s.span; const sweepX = Math.tan((s.sweep * Math.PI) / 180) * (s.span / 2);
  // Pixels per cm, chosen so the whole outline fits the 220 × 125 drawing area.
  const k = Math.min(200 / s.span, 115 / Math.max(sweepX + chord, chord * 1.6)); const cx = 110; const top = 12;
  const pts = [[cx, top], [cx + (s.span / 2) * k, top + (sweepX + chord * 0.4) * k], [cx + (s.span / 2) * k, top + (sweepX + chord) * k], [cx, top + chord * 1.6 * k], [cx - (s.span / 2) * k, top + (sweepX + chord) * k], [cx - (s.span / 2) * k, top + (sweepX + chord * 0.4) * k]];
  const dih = (s.dihedral * Math.PI) / 180; const half = (s.span / 2) * 3;
  return (
    <div className="flex gap-3">
      <svg viewBox="0 0 220 150" className="h-36 w-52 border-2 border-black bg-[#fffdf5]" aria-label="上から見た形">
        <polygon points={pts.map((p) => p.join(',')).join(' ')} fill="#f8fafc" stroke="#111" strokeWidth="1.5" />
        <line x1={cx} y1={top} x2={cx} y2={top + chord * 1.6 * k} stroke={RED} strokeDasharray="3 2" />
        {s.nose && <circle cx={cx} cy={top + 6} r="4" fill={RED} />}
        <text x="6" y="144" fontSize="9">上から · 翼幅 {s.span.toFixed(0)} cm · 後退角 {s.sweep.toFixed(0)}°</text>
      </svg>
      <svg viewBox="0 0 160 150" className="h-36 w-40 border-2 border-black bg-[#fffdf5]" aria-label="前から見た形">
        <line x1={80 - half * Math.cos(dih)} y1={70 - half * Math.sin(dih)} x2="80" y2="70" stroke="#111" strokeWidth="3" />
        <line x1="80" y1="70" x2={80 + half * Math.cos(dih)} y2={70 - half * Math.sin(dih)} stroke="#111" strokeWidth="3" />
        <line x1="80" y1="70" x2="80" y2="92" stroke="#111" strokeWidth="3" />
        <text x="6" y="144" fontSize="9">前から · 上反角 {s.dihedral.toFixed(0)}°</text>
      </svg>
    </div>
  );
}

const SLIDERS: { key: keyof Shape; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'span', label: '翼幅', min: 8, max: 40, step: 0.5, unit: 'cm' },
  { key: 'area', label: '翼の面積', min: 80, max: 260, step: 5, unit: 'cm²' },
  { key: 'mass', label: '重さ', min: 3, max: 12, step: 0.1, unit: 'g' },
  { key: 'margin', label: '重心の余裕（鼻の重さ）', min: -0.05, max: 0.35, step: 0.01, unit: '' },
  { key: 'dihedral', label: '上反角', min: -5, max: 25, step: 1, unit: '°' },
  { key: 'sweep', label: '後退角', min: 0, max: 65, step: 1, unit: '°' },
  { key: 'creases', label: '折り目の数', min: 2, max: 14, step: 1, unit: '' },
];

/**
 * Mente · paper-plane aviator. People fold real paper planes, enter the shape and what the flight
 * did, and Mente compares: the multiplier here is distance ÷ launch height — physics, not a payout.
 * Across many planes, which shape difference moves the multiplier most?
 */
export default function MenteAviator() {
  const [shape, setShape] = useState<Shape>({ ...PRESETS[1] });
  const [mine, setMine] = useState<Entry[]>([]);
  const [withExamples, setWithExamples] = useState(true);
  const [form, setForm] = useState({ maker: '', distance: '', height: String(THROW.height) });
  useEffect(() => { try { setMine(JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as Entry[]); } catch { /* storage blocked */ } }, []);
  const save = (list: Entry[]) => { setMine(list); try { window.localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } };

  const p = predict(shape, THROW); const flight = path(shape, THROW);
  const examples = useMemo(() => syntheticCrowd(), []);
  const pool = withExamples ? [...mine, ...examples] : mine;
  const a = analyse(pool, THROW);
  const maxD = Math.max(25, p.distance);

  const record = () => {
    const d = Number(form.distance); const h = Number(form.height); if (!(d > 0) || !(h > 0)) return;
    save([{ shape: { ...shape, maker: form.maker.trim() || 'わたし' }, measured: { distance: d, height: h } }, ...mine]);
    setForm({ ...form, distance: '' });
  };

  return (
    <main className="min-h-screen bg-[#f4efe6] px-4 py-6 text-black" style={{ fontFamily: KRUGER_FAMILY }}>
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b-4 border-black pb-2">
          <div>
            <p className="text-xs font-bold tracking-widest" style={{ color: RED }}>MENTE · 紙飛行機の AVIATOR</p>
            <h1 className="text-3xl font-black italic">倍率は、折り方で決まる</h1>
            <p className="max-w-3xl text-sm">ここでの倍率は「飛んだ距離 ÷ 投げた高さ」。お金の倍率ではなく、物理の量です。人が折った形の違いが、どれだけ倍率を変えるのかを調べます。</p>
          </div>
          <nav className="flex gap-3 text-xs"><Link href="/mente" className="underline">Mente</Link><Link href="/lab/dual-slot" className="underline">Dual・パチスロ（8. aviator）</Link></nav>
        </header>

        <Slide title="1. 折る">
          <div className="flex flex-wrap gap-1 text-xs">{PRESETS.map((s) => <button key={s.name} type="button" data-testid={`preset-${s.name}`} onClick={() => setShape({ ...s })} className="border-2 border-black px-2 py-0.5 hover:bg-black hover:text-white">{s.name}</button>)}</div>
          <div className="grid gap-4 md:grid-cols-[auto_1fr]">
            <PlaneViews s={shape} />
            <div className="grid gap-1 text-xs sm:grid-cols-2">
              {SLIDERS.map((f) => (
                <label key={f.key} className="flex items-center gap-2">
                  <span className="w-36">{f.label} {(shape[f.key] as number).toFixed(f.step < 1 ? 2 : 0)}{f.unit}</span>
                  <input type="range" min={f.min} max={f.max} step={f.step} value={shape[f.key] as number} onChange={(e) => setShape({ ...shape, [f.key]: Number(e.target.value) })} className="flex-1 accent-[#d6001c]" aria-label={f.label} />
                </label>
              ))}
              <label className="flex items-center gap-2"><input type="checkbox" checked={shape.nose} onChange={(e) => setShape({ ...shape, nose: e.target.checked })} />鼻を厚く折り込む</label>
            </div>
          </div>
        </Slide>

        <Slide title="2. 予想（同じ人が同じように投げたら）">
          <div className="flex flex-wrap items-end gap-6">
            <p className="text-6xl font-black italic" style={{ color: RED }} data-testid="multiplier">×{p.multiplier.toFixed(1)}</p>
            <div className="text-sm leading-6" data-testid="prediction">
              <p>飛距離 {p.distance.toFixed(1)} m（高さ {THROW.height} m・初速 {THROW.speed} m/s で投げたとき）</p>
              <p>滑空比 L/D 最大 {p.ld.toFixed(1)} · 縦横比 AR {p.aspect.toFixed(2)} · 翼の効率 e {p.e.toFixed(2)} · 抵抗 CD0 {p.cd0.toFixed(3)}</p>
              <p>{p.stability.word}（滑空の {Math.round(p.stability.factor * 100)}% が残る）· 滑空の速さ {p.v.toFixed(1)} m/s · 翼面荷重 {p.loading.toFixed(2)} N/m²</p>
            </div>
          </div>
          <svg viewBox={`0 0 600 130`} className="w-full border-2 border-black bg-[#fffdf5]" aria-label="横から見た飛び方">
            <line x1="20" x2="590" y1="110" y2="110" stroke="#111" />
            {Array.from({ length: Math.floor(maxD / 5) + 1 }, (_, i) => <text key={i} x={20 + (i * 5 * 570) / maxD} y="124" fontSize="9">{i * 5} m</text>)}
            <polyline points={flight.map((q) => `${20 + (q.x * 570) / maxD},${110 - (q.y / 2) * 90}`).join(' ')} fill="none" stroke={RED} strokeWidth="2.5" />
            <rect x="12" y={110 - (THROW.height / 2) * 90} width="8" height={(THROW.height / 2) * 90} fill="#111" />
          </svg>
        </Slide>

        <Slide title="3. 飛ばした記録をつける">
          <p className="text-xs">いまの形で実際に折って投げ、測った距離と投げた高さを入れてください。名前はニックネームで十分です（このブラウザの中だけに保存します）。</p>
          <div className="flex flex-wrap items-end gap-2 text-xs">
            <label>ニックネーム<input value={form.maker} onChange={(e) => setForm({ ...form, maker: e.target.value })} className="ml-1 w-28 border-2 border-black bg-white px-1 text-black" /></label>
            <label>飛んだ距離 m<input data-testid="distance" value={form.distance} onChange={(e) => setForm({ ...form, distance: e.target.value })} inputMode="decimal" className="ml-1 w-16 border-2 border-black bg-white px-1 text-black" /></label>
            <label>投げた高さ m<input value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} inputMode="decimal" className="ml-1 w-16 border-2 border-black bg-white px-1 text-black" /></label>
            <button type="button" data-testid="record" onClick={record} className="bg-black px-3 py-1 font-bold text-white">記録する</button>
            {mine.length > 0 && <button type="button" onClick={() => save([])} className="border-2 border-black px-2 py-0.5">記録を消す</button>}
          </div>
        </Slide>

        <Slide title="4. 人間側の形状差の解析">
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={withExamples} onChange={(e) => setWithExamples(e.target.checked)} />架空の例 12 機を含める（記録が少ないうちの見本。実在の人の記録ではありません）</label>
          <p className="text-xs" data-testid="analysis-n">解析した機体 {a.n}（実際の記録 {mine.length}）· 倍率のばらつき（対数の標準偏差）{a.spread.toFixed(2)}</p>
          {a.n >= 3 ? (
            <>
              <div className="space-y-1" data-testid="features">
                {a.features.map((f) => (
                  <div key={f.key} className="flex items-center gap-2 text-xs">
                    <span className="w-40">{f.label}</span>
                    <span className="relative h-4 w-64 border border-black bg-white"><span className="absolute top-0 h-full" style={{ left: f.r >= 0 ? '50%' : `${50 + f.r * 50}%`, width: `${Math.abs(f.r) * 50}%`, background: f.r >= 0 ? RED : '#111' }} /><span className="absolute left-1/2 top-0 h-full w-px bg-black" /></span>
                    <span className="w-16 font-mono">{f.r >= 0 ? '+' : ''}{f.r.toFixed(2)}</span>
                    <span className="text-[10px]">{f.r >= 0 ? '大きいほど遠くへ' : '大きいほど近くに落ちる'}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px]">相関（−1〜+1）は「倍率の対数」との関係。形の違いが一緒に変わっていると、どれが原因かまでは分かりません。条件をそろえて 1 か所ずつ変えて折ると、はっきりします。</p>
              <table className="w-full text-[11px]" data-testid="residuals"><thead><tr className="text-left"><th>機体</th><th>人</th><th className="text-right">測った倍率</th><th className="text-right">形からの予想</th><th className="text-right">差（腕前・空気）</th></tr></thead>
                <tbody>{a.residuals.slice(0, 14).map((r, i) => <tr key={i} className="border-t border-black/20"><td>{r.name}</td><td>{r.maker}</td><td className="text-right">×{r.measured.toFixed(1)}</td><td className="text-right">×{r.predicted.toFixed(1)}</td><td className="text-right font-bold" style={{ color: r.residual >= 0 ? RED : '#111' }}>{r.residual >= 0 ? '+' : ''}{(Math.exp(r.residual) * 100 - 100).toFixed(0)}%</td></tr>)}</tbody></table>
            </>
          ) : <p className="text-xs">3 機以上の記録がそろうと解析します。</p>}
          <p className="text-[10px]">モデルは教科書的な滑空の見積もり（AR・翼の効率・抵抗・重心の余裕）を単純にしたものです。実際の紙飛行機は、紙の反りや投げ方、空気の流れで大きくばらつきます。</p>
        </Slide>
      </div>
    </main>
  );
}
