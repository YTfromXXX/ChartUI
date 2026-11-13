'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import HachiwareWallpaper from '@/components/whiteout/HachiwareWallpaper';
import HoloSilhouette from '@/components/whiteout/HoloSilhouette';
import SoftServe from '@/components/whiteout/SoftServe';
import { buildEmergenceProgram } from '@/LAB/colorcube/emergence';
import { PLATEAUS } from '@/LAB/library/books';
import { useCureAPIStore } from '@/lib/cureApiStore';
import { CURE_KIT } from '@/lib/cureKit';
import { QUIZ } from '@/lib/quizQuantum';
import { POSES, hologram, softServe, type Pose } from '@/lib/silhouette';
import { DESIGN_CASES, TOO_MANY, knightMoves, portsOf, retest, type RetestResult } from '@/lib/whiteout';

const ORGANS = [1, 2, 3, 4, 7, 9, 10, 21]; // 背骨 心臓 肝臓 消化器 目 鼻 皮膚 毛髪
const BINDER_KEY = 'chartui-whiteout-binder';

function readQuizStep() {
  try { return Number(JSON.parse(localStorage.getItem('chartui-quiz-quantum') ?? 'null')?.step ?? 0) || 0; } catch { return 0; }
}

/** ChartUI ホワイトアウト版: one window on a white-out GPU. */
export default function WhiteoutMenuPage() {
  const intuitionChoice = useCureAPIStore((s) => s.intuitionChoice);
  const oddField = useCureAPIStore((s) => s.oddField);
  const [values, setValues] = useState<number[]>(() => {
    try { const v = JSON.parse(localStorage.getItem(BINDER_KEY) ?? 'null'); if (Array.isArray(v) && v.length === 22) return v.map(Number); } catch { /* storage unavailable */ }
    return Array(22).fill(0.5);
  });
  const [knight, setKnight] = useState(0);
  const [pose, setPose] = useState<Pose>('vet');
  const [cone, setCone] = useState<ReturnType<typeof softServe> | null>(null);
  const [ids, setIds] = useState('');
  const [run, setRun] = useState<RetestResult | null>(null);
  const [lap, setLap] = useState(0);
  const [wallpaper, setWallpaper] = useState(true);
  const quizStep = useMemo(readQuizStep, []);
  const program = useMemo(() => buildEmergenceProgram(lap), [lap]);
  const holo = useMemo(() => hologram(pose), [pose]);

  useEffect(() => { try { localStorage.setItem(BINDER_KEY, JSON.stringify(values)); } catch { /* storage unavailable */ } }, [values]);

  /** {(source):(text)} synthesised from the games, for analysis. */
  const synth = (id: number): [string, string] => {
    if (intuitionChoice?.kitId === id) return ['直感', intuitionChoice.text];
    if (id <= quizStep) return ['クイズ', `Q${id} ${QUIZ[id - 1].glyph} ${QUIZ[id - 1].reading}`];
    if (id % 2 === 1) return ['双六', program[(id - 1) / 2].verb];
    if (oddField?.pulls[id - 1] !== undefined) return ['奇数回帰', `pull ${oddField.pulls[id - 1].toFixed(2)}`];
    return ['∅', '空白の特異点'];
  };

  const legal = knightMoves(knight);
  const doRetest = () => { setRun(retest(ids)); setLap((n) => n + 1); };
  const resetRetest = () => { setIds(''); setRun(null); };

  return (
    <main className="relative min-h-screen bg-white px-3 py-6 font-mono text-[#1f1f1f] sm:px-8">
      {wallpaper && <HachiwareWallpaper />}
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-lg border border-stone-300 bg-white/95 shadow-[0_30px_80px_rgba(0,0,0,.12)]">
        {/* Window title bar */}
        <div className="flex items-center gap-2 border-b border-stone-200 bg-stone-50 px-3 py-2 text-[11px] text-stone-500">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" />
          <span className="ml-2">ChartUI ホワイトアウト版 — ./menu · retest #{lap}</span>
          <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={wallpaper} onChange={(e) => setWallpaper(e.target.checked)} /> 壁紙</label>
        </div>

        {/* Header: logo + links to each organ */}
        <header id="organs" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-stone-200 px-4 py-3">
          <p className="text-lg font-semibold tracking-wide">ChartUI <span className="text-[#c8001a]">ホワイトアウト版</span></p>
          <nav aria-label="Organs" className="flex flex-wrap gap-1 text-[11px]">
            {ORGANS.map((id) => <a key={id} href={`#kit-${id}`} className="border border-[#c8001a]/40 px-2 py-0.5 text-[#c8001a] hover:bg-[#c8001a] hover:text-white">{CURE_KIT[id - 1].name}</a>)}
          </nav>
          <nav className="ml-auto flex gap-3 text-[11px] text-stone-500">
            <Link href="/lab/colorcube" className="hover:text-black">博物館</Link>
            <Link href="/lab/library" className="hover:text-black">図書館</Link>
            <Link href="/mente" className="hover:text-black">Mente</Link>
            <Link href="/relay-flight" className="hover:text-black">リレーすごろく</Link>
            <Link href="/lab/silicon" className="hover:text-black">シリコン LAB</Link>
            <Link href="/lab/mesh" className="hover:text-black">メッシュ LAB</Link>
            <Link href="/lab/glass-knot" className="hover:text-black">ガラスの紐 LAB</Link>
            <Link href="/lab/knot-ladder" className="hover:text-black">結び目のはしご</Link>
            <Link href="/lab/card-slots" className="hover:text-black">カードスロット</Link>
            <Link href="/lab/candle-smoke" className="hover:text-black">蝋燭と煙</Link>
            <Link href="/lab/crystal-baby" className="hover:text-black">クリスタルベイビー対決</Link>
            <Link href="/lab/prompt-chess" className="hover:text-black">プロンプトチェス</Link>
            <Link href="/lab/honeycomb-punish" className="hover:text-black">ハニカムパニッシュ</Link>
            <Link href="/lab/library/entrance" className="hover:text-black">図書館の入口</Link>
            <Link href="/lab/library/reading-order" className="hover:text-black">どちらを先に読む？</Link>
            <Link href="/lab/fourier" className="hover:text-black">フーリエ</Link>
            <Link href="/lab/activist" className="hover:text-black">アクティビスト双六</Link>
            <Link href="/oracle-api/race" className="hover:text-black">ORACLE レース中継</Link>
            <Link href="/lab/spin" className="hover:text-black">スピン（花と髪）</Link>
            <Link href="/lab/dual-slot" className="hover:text-black">Dual・パチスロ</Link>
            <Link href="/lab/seat-gaze" className="hover:text-black">席と目線</Link>
            <Link href="/lab/backlog" className="hover:text-black">やることボード</Link>
            <Link href="/famidance" className="hover:text-black">ファミダンス</Link>
          </nav>
        </header>

        <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
          {/* 22 binder form (11 × 2) with the permanent knight */}
          <form aria-label="22 binder" onSubmit={(e) => e.preventDefault()}>
            <p className="mb-2 text-[10px] uppercase tracking-[0.25em] text-stone-500">22 binder · form · ♞ パーマネントナイト（2 行盤のナイトは列 ±2 で行を移る）</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 lg:grid-cols-11">
              {CURE_KIT.map((kit, i) => {
                const [src, text] = synth(kit.id);
                const isKnight = i === knight; const canJump = legal.includes(i);
                return (
                  <fieldset key={kit.id} id={`kit-${kit.id}`} className={`relative min-w-0 scroll-mt-4 border p-1.5 text-[9px] target:ring-2 target:ring-[#c8001a] ${isKnight ? 'border-black' : canJump ? 'border-[#c8001a]/60 border-dashed' : 'border-stone-200'}`}>
                    <legend className="px-0.5 text-[9px] font-semibold">#{kit.id} {kit.name}</legend>
                    <input aria-label={`${kit.name} parameter`} type="range" min={0} max={1} step={0.01} value={values[i]} onChange={(e) => setValues((v) => v.map((x, k) => (k === i ? Number(e.target.value) : x)))} className="w-full accent-[#c8001a]" />
                    <p className="line-clamp-2 break-all text-stone-500" title={`{(${src}):(${text})}`}>{`{(${src}):(${text})}`}</p>
                    <span className="flex items-center justify-between">
                      <span className="font-mono">{values[i].toFixed(2)}</span>
                      {isKnight ? <span aria-label="knight here">♞</span> : canJump ? <button type="button" onClick={() => setKnight(i)} aria-label={`knight to ${kit.name}`} className="text-[#c8001a]">♘</button> : null}
                    </span>
                  </fieldset>
                );
              })}
            </div>
            <p className="mt-1 text-[9px] text-stone-400">{'{(source):(text)}'} はゲームから合成した解析用テキスト：直感（2 択）＞ クイズ（計測済みの段）＞ 双六（出現の動詞）＞ 奇数回帰（引力）＞ ∅。</p>
          </form>

          {/* Red silhouette, one eye, holographic boundary; soft-serve event */}
          <aside className="space-y-2 text-[10px]">
            <label className="block">シルエット
              <select value={pose} onChange={(e) => { setPose(e.target.value as Pose); setCone(null); }} className="mt-1 w-full border border-stone-300 bg-white px-1 py-0.5">
                {(Object.keys(POSES) as Pose[]).map((p) => <option key={p} value={p}>{POSES[p].label} · {POSES[p].profession}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <HoloSilhouette pose={pose} className="h-56 w-auto border border-stone-200" />
              {cone && <SoftServe shape={cone} className="h-40 w-auto self-end" />}
            </div>
            <p>境界 {holo.edge} セル ⇄ 内部 {holo.area} セル · 境界／面積 {holo.ratio.toFixed(2)} · 境界の情報量 ≤ {holo.bits}（∂/4）</p>
            <p className="text-stone-500">ホログラフィック原理（領域の情報量はその境界の面積で上限づけられる）の見立て：シルエットの境界セルが内部を符号化するスクリーン。眼球はひとつ、その視点から境界へ視線を引く。</p>
            <button type="button" onClick={() => setCone(softServe(pose))} className="w-full border border-[#c8001a] px-2 py-1 text-[#c8001a] hover:bg-[#c8001a] hover:text-white">イベント：ソフトクリームを生成</button>
            {cone && <p className="text-stone-500">{cone.tiers} 段（{cone.heads.toFixed(1)} 頭身から）· ねじれ {cone.twist.toFixed(2)}（境界／面積から）</p>}
          </aside>
        </div>

        {/* retest: SNS IDs -> fictional e-mail addresses */}
        <section aria-label="retest" className="space-y-2 border-t border-stone-200 p-4 text-[11px]">
          <p className="text-[10px] uppercase tracking-[0.25em] text-stone-500">retest === () =&gt; {'{'} VR/MR: “e-mail address” {'}'}</p>
          <div className="flex flex-wrap gap-2">
            <textarea aria-label="SNS account IDs" value={ids} onChange={(e) => setIds(e.target.value)} rows={3} placeholder={'SNS アカウント ID を 1 行に 1 つ（例：@hachiware_red）'} className="min-w-[16rem] flex-1 border border-stone-300 bg-white p-2 text-black placeholder:text-stone-400" />
            <div className="flex flex-col gap-1">
              <button type="button" onClick={doRetest} className="border border-black px-3 py-1 hover:bg-black hover:text-white">retest</button>
              <button type="button" onClick={resetRetest} className="border border-stone-300 px-3 py-1 text-stone-500">clear</button>
            </div>
          </div>
          <p className="text-[9px] text-stone-400">架空のアドレスは予約済みドメイン（.example）だけを使い、どこにも届かない。本物のアドレスは保存・送信・全文表示をしない。</p>

          {run && (
            <div className="space-y-2">
              {run.next === 'split-to-mente' && (
                <div className="border border-[#c8001a] p-2">
                  <p className="font-semibold text-[#c8001a]">本物のメールアドレスを {run.realCount} 件検出（{run.entries.filter((e) => e.kind === 'real').map((e) => (e.kind === 'real' ? e.masked : '')).join(', ')}）· 保存も送信もしません</p>
                  <p className="mt-1">→ Famiポートを設計中の案件に分割し、Mente のフロントエンドへ進みます。</p>
                  <div className="mt-2 grid gap-1 sm:grid-cols-2">
                    {DESIGN_CASES.map((c) => (
                      <div key={c.title} className="border border-stone-200 p-1.5"><p className="font-semibold">{c.title}</p><p className="text-stone-500">{portsOf(c.ports).map((p) => `${p.no}.${p.title}`).join(' / ')}</p><p className="text-[9px] text-stone-400">{c.note}</p></div>
                    ))}
                  </div>
                  <Link href="/mente" className="mt-2 inline-block bg-[#c8001a] px-2 py-1 font-semibold italic text-white">Mente フロントエンドへ →</Link>
                </div>
              )}
              {run.next === 'retest' && (
                <div className="border border-black p-2">
                  <p>アドレスが多すぎます（{run.fictional.length + run.realCount} 件 &gt; {TOO_MANY}）。</p>
                  <button type="button" onClick={resetRetest} className="mt-1 border border-black px-2 py-1 hover:bg-black hover:text-white">ChartUI ホワイトアウト版をもう一度 retest する</button>
                </div>
              )}
              {run.next === 'receive' && (
                <div className="border border-stone-300 p-2">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.2em] text-stone-500">受信箱 · 無限ループ双六（retest ごとに次の周回）</p>
                  <ul className="space-y-1">
                    {run.fictional.map((entry, k) => {
                      const step = program[(k + lap) % program.length];
                      const plateau = PLATEAUS[(k + lap) % PLATEAUS.length];
                      return (
                        <li key={entry.address} className="border-l-2 border-[#c8001a] pl-2">
                          <span className="text-stone-500">to:</span> {entry.address} <span className="text-stone-400">← {entry.input}</span>
                          <br /><span className="font-semibold">双六 #{step.index + 1} · to {step.verb}</span> — {step.note} <span className="text-stone-500">／ 図書館：{plateau.no}. {plateau.title}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {run.entries.some((e) => e.kind === 'invalid') && <p className="text-stone-500">変換できない入力：{run.entries.filter((e) => e.kind === 'invalid').length} 件</p>}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
