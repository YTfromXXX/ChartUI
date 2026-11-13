'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DEFAULT_OUTCOMES, OUTCOME_RANGE, YEARS, finale, type Outcomes } from '@/lib/storyYears';

/**
 * The 12-year plan with the four placeholder mini-games (years 3, 6, 9, 10), and a preview of how
 * their results set up the final stage (Luna hacks the aviator; the player flies to the tower and lands).
 * Until the mini-games exist, their results can be set by hand here.
 */
export default function Years() {
  const [o, setO] = useState<Outcomes>(DEFAULT_OUTCOMES);
  // The year-2 result from a played run, if any (per viewer).
  useEffect(() => { try { const r = JSON.parse(window.localStorage.getItem('chartui-golden-run-v1') ?? 'null'); if (r && typeof r.copy === 'number') setO((x) => ({ ...x, copy: r.copy })); } catch { /* none */ } }, []);
  const f = finale(o);
  return (
    <main className="min-h-screen bg-white px-4 py-4 font-mono text-[#1f1f1f]">
      <div className="mx-auto max-w-5xl space-y-4">
        <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600">
          <span>イーサリアムの黄金のアイコンを探せ（仮）· 12 年の進行</span>
          <span className="flex gap-3"><Link href="/mente/game" className="underline">タイトルへ</Link><Link href="/mente" className="underline">Mente に戻る</Link></span>
        </p>
        <header className="border-b border-stone-200 pb-2">
          <h1 className="text-lg">1〜12 年目と、最後の塔</h1>
          <p className="text-xs text-stone-600">3・6・9・10 年目のミニゲーム（仮置き）の結果が、最後の面を変えます。最後の面：Luna が aviator をハックし、あなたが操縦して、ハニカムアイランドの塔の上の甲板に着陸する。</p>
        </header>

        <ol className="space-y-1.5 text-xs" data-testid="years">
          {YEARS.map((y) => (
            <li key={y.year} className="grid grid-cols-[3.5rem_1fr] gap-2 border-l-2 pl-2" style={{ borderColor: y.mini ? '#c8001a' : '#e7e5e4' }} data-testid={`year-${y.year}`}>
              <span className="font-semibold">{y.year} 年目</span>
              <div>
                <p><span className="text-stone-500">{y.chapter} · </span>{y.event}</p>
                {y.mini && (
                  <div className="mt-1 border border-stone-200 bg-[#fafaf9] p-2">
                    <p className="font-semibold">ミニゲーム（仮置き）：{y.mini.name} <span className="font-normal text-stone-500">— {y.mini.who}</span>{y.route && <> · <Link href={y.route} className="underline">遊ぶ</Link></>}</p>
                    <p>{y.mini.how}</p>
                    <p className="text-[#c8001a]">→ {y.mini.changes}</p>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>

        <section className="grid gap-3 border-t border-stone-200 pt-3 sm:grid-cols-2" aria-label="最後の面の下見" data-testid="finale">
          <div className="space-y-2 text-xs">
            <h2 className="text-sm font-semibold">ミニゲームの結果（仮に手で決める）</h2>
            {(Object.keys(OUTCOME_RANGE) as (keyof Outcomes)[]).map((k) => (
              <label key={k} className="block">
                {OUTCOME_RANGE[k].label}：<span data-testid={`out-${k}`}>{o[k]}</span>
                <input type="range" min={OUTCOME_RANGE[k].min} max={OUTCOME_RANGE[k].max} value={o[k]} onChange={(e) => setO({ ...o, [k]: Number(e.target.value) })} className="block w-full" aria-label={OUTCOME_RANGE[k].label} />
              </label>
            ))}
          </div>
          <div className="space-y-1 border border-stone-200 p-2 text-xs">
            <h2 className="text-sm font-semibold">最後の面（ラスボス：旋回する自動操縦）</h2>
            <p>塔の輪の大きさ：<span data-testid="f-ring">{f.ring.toFixed(2)}</span>（Luna のハックの正確さ）</p>
            <p>飛び立つときの重さ：{f.startWeight.toFixed(2)} → 塔まで持つ割合 <span data-testid="f-reach">{Math.round(f.reach * 100)}%</span>（「自由」は飛ぶほど重くなる）</p>
            <p>自動操縦の見張りの輪：<span data-testid="f-watch">{f.watchRings}</span> 重</p>
            <p>高度計の正直さ：<span data-testid="f-alt">{Math.round(f.altimeter * 100)}%</span>（低いほど、ストイックの暴落のチャートが重なって見える）</p>
            <p>乗り込んだ BA と PE：<span data-testid="f-crew">{f.crew}</span></p>
            <p className="pt-1 text-[11px] text-stone-600">最後の面は着陸です。塔にぶつかる演出はなく、触れると機体が押し戻されてやり直しになります。</p>
          </div>
        </section>

        <footer className="border-t border-stone-200 pt-2 text-[11px] text-stone-600">
          架空の物語です。登場する名前・鍵・指紋はすべて作りものです。<br />
          取引や暮らしのことでつらいときは、ひとりで抱えずに：よりそいホットライン 0120-279-338（24 時間・無料）／いのちの電話 0570-783-556
        </footer>
      </div>
    </main>
  );
}
