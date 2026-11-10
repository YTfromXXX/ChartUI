'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import KrugerBubble, { KRUGER_FAMILY, KRUGER_FONT } from '@/components/mente/KrugerBubble';
import PixelSprite from '@/components/fami/PixelSprite';
import { SPRITES } from '@/lib/famiSprites';
import { CPUS, EMETER_ROOM, METHODS, SKELETON_MEAN, STOP_STRESS, plateScore, recommendFix, runCatExperiment, type Fix } from '@/lib/eMeterLab';
import { playHaptics, skinPattern, vibrationPattern } from '@/lib/skinHaptics';
import { PAD_DEFAULTS, WEARABLES, pawPadSvg, scorePad, type PadParams } from '@/lib/pawPad';
import { download, menteReportHtml, type ReportSection } from '@/lib/menteExport';

type View = 'A' | 'B' | 'AB';

function Slide({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 border-4 border-black bg-white/70 p-4" aria-label={title}>
      <p className="inline-block bg-black px-2 py-1 text-sm font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>{title}</p>
      {children}
    </section>
  );
}

function Bar({ value, target, small = false }: { value: number; target?: number; small?: boolean }) {
  return (
    <span className={`relative inline-block h-3 ${small ? 'w-14' : 'w-40'} bg-black/15 align-middle`}>
      <span className="block h-full bg-[#d6001c]" style={{ width: `${Math.min(1, value) * 100}%` }} />
      {target !== undefined && <span className="absolute top-[-3px] h-[18px] w-0.5 bg-black" style={{ left: `${target * 100}%` }} />}
    </span>
  );
}

type AState = { fix: Fix; setFix: React.Dispatch<React.SetStateAction<Fix>>; seed: number; setSeed: React.Dispatch<React.SetStateAction<number>>; pad: PadParams; setPad: React.Dispatch<React.SetStateAction<PadParams>> };

const PAD_SLIDERS: { key: keyof PadParams; label: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'diameter', label: '直径', min: 40, max: 100, step: 1, unit: 'mm' },
  { key: 'edgeRadius', label: '角の丸み（R）', min: 0, max: 10, step: 0.5, unit: 'mm' },
  { key: 'height', label: '高さ', min: 1, max: 15, step: 0.5, unit: 'mm' },
  { key: 'gap', label: '電極の間隔', min: 1, max: 6, step: 0.5, unit: 'mm' },
  { key: 'spacing', label: '置く間隔', min: 10, max: 50, step: 1, unit: 'cm' },
];

function PawPadSlide({ pad, setPad }: { pad: PadParams; setPad: AState['setPad'] }) {
  const score = scorePad(pad);
  const rows = [{ name: '踏み石型（着けない・散歩道に置く）', injury: score.injury, mobility: score.mobility, data: score.data, note: '猫は何も着けない。自然に踏んだときだけ計測' }, ...WEARABLES];
  return (
    <Slide title="A-4 · 散歩用 肉球センサー（着けない踏み石型）">
      <KrugerBubble name="改良" text="センサーを猫に着けず、散歩道に置く。低く平らな踏み石を、角を丸めた柔らかい導電性シリコン（冷たい金属にしない）で作り、くし歯状の電極で 1 枚の肉球が両極にまたがる。歩幅に合わせて左右交互に置く。" align="full" />
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="border-2 border-black bg-white" aria-label="Paw pad drawing" dangerouslySetInnerHTML={{ __html: pawPadSvg(pad) }} />
        <div className="space-y-2 text-sm">
          {PAD_SLIDERS.map((sl) => (
            <label key={sl.key} className="block">{sl.label} <span className="float-right font-mono">{pad[sl.key]} {sl.unit}</span>
              <input type="range" min={sl.min} max={sl.max} step={sl.step} value={pad[sl.key]} onChange={(e) => setPad((p) => ({ ...p, [sl.key]: Number(e.target.value) }))} className="w-full accent-[#d6001c]" />
            </label>
          ))}
          <button type="button" onClick={() => setPad(PAD_DEFAULTS)} className="border-2 border-black px-2 py-0.5">推奨値に戻す</button>
        </div>
      </div>
      <table className="w-full text-left text-xs">
        <thead><tr className="border-b-2 border-black"><th className="w-[28%] py-1">形</th><th>けがのリスク ↓</th><th>動きやすさ ↑</th><th>データの質 ↑</th><th>メモ</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={r.name} className={`border-b border-black/20 ${i === 0 ? 'font-bold' : ''}`}>
            <td className="py-1 pr-2">{r.name}</td><td className="whitespace-nowrap"><Bar small value={r.injury} /> {r.injury.toFixed(2)}</td><td className="whitespace-nowrap"><Bar small value={r.mobility} /> {r.mobility.toFixed(2)}</td><td className="whitespace-nowrap"><Bar small value={r.data} /> {r.data.toFixed(2)}</td><td className="pl-2">{r.note}</td>
          </tr>
        ))}</tbody>
      </table>
      {score.notes.length > 0 && <div className="space-y-1">{score.notes.map((n) => <KrugerBubble key={n} name="注意" text={n} align="full" />)}</div>}
      <p className="text-xs text-slate-700">数値は形を比べるための設計上の目安で、安全性の測定値ではない。体格（肉球の幅およそ 35 mm、歩幅およそ 20〜35 cm）は個体差が大きいので、散歩の計画とあわせて獣医師に確認する。散歩は嫌がる猫に無理強いしない。</p>
    </Slide>
  );
}

function PowerPointA({ fix, setFix, seed, setSeed, pad, setPad }: AState) {
  const base = plateScore({ lean: 0, untwist: 0, rustTreatment: 0, brace: false });
  const now = plateScore(fix);
  const rec = useMemo(recommendFix, []);
  const run = useMemo(() => runCatExperiment(seed), [seed]);
  const sliders: { key: keyof Omit<Fix, 'brace'>; label: string }[] = [
    { key: 'lean', label: '傾きを直す' }, { key: 'untwist', label: 'ねじれを戻す' }, { key: 'rustTreatment', label: '錆を処理する' },
  ];

  return (
    <div className="space-y-4">
      <Slide title="A-1 · #8 e-メーター 補強シミュレーション">
        <p className="text-sm">博物館の #8 は寄りかかる 2 枚の板（{EMETER_ROOM.form}）。傾き {EMETER_ROOM.lean}°・ねじれ {EMETER_ROOM.torque}°・錆 {(EMETER_ROOM.oxidation * 100).toFixed(0)}% で、骨格 19 のうち最も弱い。</p>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 text-sm">
            {sliders.map((s) => (
              <label key={s.key} className="block">{s.label} <span className="float-right font-mono">{(fix[s.key] * 100).toFixed(0)}%</span>
                <input type="range" min={0} max={1} step={0.05} value={fix[s.key]} onChange={(e) => setFix((f) => ({ ...f, [s.key]: Number(e.target.value) }))} className="w-full accent-[#d6001c]" />
              </label>
            ))}
            <label className="flex items-center gap-2"><input type="checkbox" checked={fix.brace} onChange={(e) => setFix((f) => ({ ...f, brace: e.target.checked }))} /> 筋交い（ブレース）を入れる</label>
            {rec && <button type="button" onClick={() => setFix(rec.fix)} className="border-2 border-black px-2 py-1 font-bold">最小の補強を適用</button>}
          </div>
          <div className="space-y-1 font-mono text-sm">
            <p>安定 {base.stability.toFixed(2)} → <b>{now.stability.toFixed(2)}</b> <Bar value={now.stability} target={SKELETON_MEAN} /></p>
            <p>疲労 {base.fatigue.toFixed(2)} → <b>{now.fatigue.toFixed(2)}</b> <Bar value={now.fatigue} target={0.5} /></p>
            <p className="text-xs text-slate-700">傾き {now.lean.toFixed(1)}° · ねじれ {now.torque.toFixed(1)}° · 錆 {(now.rust * 100).toFixed(0)}%</p>
            <KrugerBubble name="判定" text={now.stability >= SKELETON_MEAN && now.fatigue <= 0.5 ? `骨格の平均 ${SKELETON_MEAN} に届いた` : `目標：安定 ${SKELETON_MEAN} 以上・疲労 0.5 以下`} align="full" />
            {rec && <p className="text-xs text-slate-700">最小の補強：傾き {(rec.fix.lean * 100).toFixed(0)}%・ねじれ戻し {(rec.fix.untwist * 100).toFixed(0)}%・錆処理 {(rec.fix.rustTreatment * 100).toFixed(0)}%・筋交い {rec.fix.brace ? 'あり' : 'なし'}。12° のねじれが弱さの主因で、少し戻すのがいちばん安い。</p>}
          </div>
        </div>
      </Slide>

      <Slide title="A-2 · 考察：e-メーターと猫">
        <div className="space-y-2">
          <KrugerBubble name="仮説 1 · なぜ人間に e-メーターが与えられたか" text="e-メーターが測るのは皮膚の電気抵抗（皮膚電気活動）。汗腺が交感神経の興奮で開くと抵抗が下がる。人間は手のひらと指先に汗腺が密集しているので、握るだけで信号が取れる。読めるのは「覚醒の高まり」であって、考えの中身ではない。" align="full" />
          <KrugerBubble name="仮説 2 · 猫は金属部分を体内に入れた方が効率がよいか" text="いいえ。猫の汗腺はほぼ肉球だけ。体内の電極は皮膚の信号を測れず、別のものを測ってしまう。そのうえ手術・麻酔・感染の負担を猫に負わせる。動物愛護管理法と 3R（代替・削減・苦痛の軽減）に照らして、愛玩動物には正当化できない。" align="full" />
          <KrugerBubble name="結論" text="猫の e-メーターは体を傷つけない形で作る：肉球の接触センサー、首輪の心拍、行動の観察、サーモカメラ。どの方法も、猫が嫌がったら中止する。" align="full" />
        </div>
        <table className="w-full text-left text-xs">
          <thead><tr className="border-b-2 border-black"><th className="py-1">方法</th><th>測るもの</th><th>質</th><th>負担</th></tr></thead>
          <tbody>
            {METHODS.map((m) => (
              <tr key={m.key} className={`border-b border-black/20 ${m.excluded ? 'text-slate-500 line-through decoration-[#d6001c]' : ''}`}>
                <td className="py-1">{m.name}</td><td>{m.measures}</td><td>{m.excluded ? '—' : m.quality.toFixed(2)}</td><td>{m.excluded ? '除外' : m.stress.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-700">除外の理由：{METHODS.find((m) => m.excluded)?.excluded}。</p>
      </Slide>

      <Slide title="A-3 · ファミコン双六 × CPU 分割率 [2:4:6:7]">
        <div className="flex flex-wrap gap-2 text-xs">
          {CPUS.map((c) => (
            <span key={c.key} className="flex items-center gap-1 border-2 border-black bg-white px-2 py-1">
              <PixelSprite sprite={c.key === 'cat' ? SPRITES.cat : c.key === 'vet' ? SPRITES.vet : c.key === 'yoga' ? SPRITES.yoga : SPRITES.obaa} className="h-6 w-6" />
              {c.name} · {c.share}/19（{((c.share / 19) * 100).toFixed(1)}%）· {c.role} · データ {run.data[c.key].toFixed(2)}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-11 gap-1" aria-label="Observation squares">
          {Array.from({ length: 22 }, (_, i) => {
            const step = run.log[i];
            return (
              <div key={i} title={step ? `${step.square}. ${step.method} · ${step.cpu} · ${step.accepted ? '参加' : '見送り'} · ストレス ${step.stress.toFixed(2)}` : `${i + 1}. 中止で未実施`} className={`aspect-square border-2 border-black p-0.5 text-[9px] ${!step ? 'bg-black/20' : step.accepted ? 'bg-white' : 'bg-[#d6001c] text-white'}`}>
                <span className="font-bold">{i + 1}</span>
                {step && <span className="block h-1 bg-black/20"><span className="block h-full bg-black" style={{ width: `${step.stress * 100}%` }} /></span>}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={() => setSeed((s) => s + 1)} className="border-2 border-black px-2 py-1 font-bold">サイコロを振り直す（seed {seed}）</button>
          <span>集めたデータ {run.total.toFixed(2)} · 最後のストレス {run.stress.toFixed(2)} · {run.stoppedAt ? `マス ${run.stoppedAt} で猫が嫌がり中止` : `22 マス完走（中止の基準 ${STOP_STRESS}）`}</span>
        </div>
        <p className="text-xs text-slate-700">白＝猫が参加、赤＝猫が見送り、灰＝中止で未実施。棒はその時点のストレス。いちばん大きな分割率（7/19）は猫本人が持つ。</p>
      </Slide>

      <PawPadSlide pad={pad} setPad={setPad} />
    </div>
  );
}

function PowerPointB() {
  const pattern = useMemo(skinPattern, []);
  const [used, setUsed] = useState<string[] | null>(null);
  const total = pattern.segments.reduce((s, x) => s + x.on + x.off, 0);
  let x = 0;
  return (
    <div className="space-y-4">
      <Slide title="B-1 · 表皮 3 → ハプティクス出力（API-B）">
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b-2 border-black"><th className="py-1">表皮</th><th>解析</th><th>ハプティクスでは</th></tr></thead>
          <tbody>{pattern.mapping.map((m) => <tr key={m.kit} className="border-b border-black/20"><td className="py-1">{m.kit}</td><td className="font-mono">{m.value}</td><td>{m.becomes}</td></tr>)}</tbody>
        </table>
        <KrugerBubble name="分割率" text="1 周期を API-B の [2:4:6:7] で分ける：基礎緊張緩和の長い押し → ズレ知覚の細かい連打（毛髪）→ ハンドルへのカウンターの強い押し → API-A へ戻る弱まるタップ。" align="full" />
      </Slide>
      <Slide title="B-2 · 波形と再生">
        <svg viewBox={`0 0 ${total} 100`} preserveAspectRatio="none" className="h-28 w-full border-2 border-black bg-white" aria-label="Haptic waveform">
          {pattern.segments.map((s, i) => {
            const rect = <rect key={i} x={x} y={100 - s.strength * 100} width={s.on} height={s.strength * 100} fill="#d6001c"><title>{`${s.source} · ${s.on} ms · 強さ ${s.strength.toFixed(2)}`}</title></rect>;
            x += s.on + s.off;
            return rect;
          })}
        </svg>
        <p className="font-mono text-xs">周期 {pattern.periodMs} ms · Vibration API パターン [{vibrationPattern(pattern.segments).join(', ')}]</p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={async () => setUsed(await playHaptics(pattern.segments))} className="bg-[#d6001c] px-3 py-1 font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>振動を再生</button>
          <span>{used === null ? 'スマートフォン（振動対応）またはゲームパッドで体感できる' : used.length ? `再生：${used.join('、')}` : 'この端末には振動の出力がない（波形のみ）'}</span>
        </div>
      </Slide>
    </div>
  );
}

/** Mente research: PowerPoint A (the e-meter) and B (skin → haptics), alone or split. */
export default function MenteResearchPage() {
  const [view, setView] = useState<View>('AB');
  const [fix, setFix] = useState<Fix>({ lean: 0, untwist: 0, rustTreatment: 0, brace: false });
  const [seed, setSeed] = useState(1);
  const [pad, setPad] = useState<PadParams>(PAD_DEFAULTS);
  const [saved, setSaved] = useState('');

  // Everything currently on the slides, for the downloads.
  const snapshot = () => {
    const plate = plateScore(fix); const run = runCatExperiment(seed); const padScore = scorePad(pad); const haptic = skinPattern();
    const data = { createdAt: new Date().toISOString(), A1: { fix, plate }, A3: { seed, run: { total: run.total, stress: run.stress, stoppedAt: run.stoppedAt, data: run.data } }, A4: { pad, score: padScore }, B: { periodMs: haptic.periodMs, mapping: haptic.mapping, vibration: vibrationPattern(haptic.segments) } };
    const sections: ReportSection[] = [
      { title: 'A-1 · #8 e-メーター 補強', lines: [`補強：傾き ${(fix.lean * 100).toFixed(0)}%・ねじれ戻し ${(fix.untwist * 100).toFixed(0)}%・錆処理 ${(fix.rustTreatment * 100).toFixed(0)}%・筋交い ${fix.brace ? 'あり' : 'なし'}`, `安定 ${plate.stability.toFixed(2)}（目標 ${SKELETON_MEAN} 以上）・疲労 ${plate.fatigue.toFixed(2)}（目標 0.5 以下）`] },
      { title: 'A-2 · 考察', lines: ['e-メーターは皮膚電気活動（汗腺を介した交感神経の覚醒）を測る。読めるのは覚醒の高まりで、考えの中身ではない。', '猫の汗腺はほぼ肉球のみ。金属電極の体内挿入は皮膚の信号を測れず、手術・麻酔・感染の負担を負わせるため除外（動物愛護管理法・3R）。'] },
      { title: 'A-3 · 双六 × CPU 分割率 [2:4:6:7]', lines: [`seed ${seed}：集めたデータ ${run.total.toFixed(2)}・最後のストレス ${run.stress.toFixed(2)}・${run.stoppedAt ? `マス ${run.stoppedAt} で中止` : '22 マス完走'}`, ...CPUS.map((c) => `${c.name} ${c.share}/19：データ ${run.data[c.key].toFixed(2)}`)] },
      { title: 'A-4 · 散歩用 肉球センサー（踏み石型）', lines: [`直径 ${pad.diameter} mm・角 R${pad.edgeRadius}・高さ ${pad.height} mm・電極間隔 ${pad.gap} mm・置く間隔 ${pad.spacing} cm`, `けがのリスク ${padScore.injury.toFixed(2)}・動きやすさ ${padScore.mobility.toFixed(2)}・データの質 ${padScore.data.toFixed(2)}`, ...padScore.notes, '数値は設計上の目安。獣医師に確認し、散歩は無理強いしない。'], svg: pawPadSvg(pad) },
      { title: 'B · 表皮 3 → ハプティクス（API-B）', lines: [...haptic.mapping.map((m) => `${m.kit}：${m.value} → ${m.becomes}`), `Vibration API：[${vibrationPattern(haptic.segments).join(', ')}]`] },
    ];
    return { data, sections };
  };
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  const save = (kind: 'html' | 'json' | 'svg') => {
    const { data, sections } = snapshot();
    if (kind === 'html') download(`mente-research-${stamp()}.html`, menteReportHtml('RESEARCH · パワーポイント A / B', sections), 'text/html');
    if (kind === 'json') download(`mente-research-${stamp()}.json`, JSON.stringify(data, null, 2), 'application/json');
    if (kind === 'svg') download(`mente-pawpad-${stamp()}.svg`, pawPadSvg(pad), 'image/svg+xml');
    setSaved(kind.toUpperCase());
  };
  return (
    <main className={`${KRUGER_FONT} min-h-screen bg-[repeating-linear-gradient(180deg,#9a9a9a_0_80px,#d0d0d0_80px_190px)] px-4 py-5 text-[#1f1f1f] sm:px-8`}>
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-serif text-4xl font-bold italic text-[#7a0f22]">Mente</p>
            <p className="inline-block bg-black px-2 py-1 text-sm font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>RESEARCH · パワーポイント A / B</p>
          </div>
          <div className="flex gap-1" role="tablist">
            {(['A', 'B', 'AB'] as const).map((v) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`border-2 border-black px-3 py-1 font-bold ${view === v ? 'bg-black text-white' : 'bg-white/70'}`}>{v === 'AB' ? 'A | B 分割' : `パワーポイント ${v}`}</button>
            ))}
            <Link href="/mente" className="border-2 border-black bg-white/70 px-3 py-1">Mente</Link>
          </div>
        </header>
        <section aria-label="Download" className="flex flex-wrap items-center gap-2 border-4 border-black bg-white/70 p-2 text-sm">
          <span className="bg-black px-2 py-0.5 font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>保存</span>
          <button type="button" onClick={() => save('html')} className="bg-[#d6001c] px-3 py-1 font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>レポート（HTML）</button>
          <button type="button" onClick={() => save('json')} className="border-2 border-black px-3 py-1 font-bold">パラメーター（JSON）</button>
          <button type="button" onClick={() => save('svg')} className="border-2 border-black px-3 py-1 font-bold">踏み石の図面（SVG）</button>
          <span className="text-xs text-slate-700">{saved ? `${saved} を保存しました` : 'いまのスライドの値（補強・双六の seed・踏み石の寸法・振動パターン）をそのまま保存する'}</span>
        </section>
        <div className={view === 'AB' ? 'grid gap-4 xl:grid-cols-2' : ''}>
          {view !== 'B' && <PowerPointA fix={fix} setFix={setFix} seed={seed} setSeed={setSeed} pad={pad} setPad={setPad} />}
          {view !== 'A' && <PowerPointB />}
        </div>
      </div>
    </main>
  );
}
