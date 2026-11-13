'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const KEY = 'chartui-edition-title-v1';
const ORIGINAL = 'サトシ';
const PLACEHOLDER = 'ヴィタリックを探せ';

/** "ヴィタリックを探せ" / "ヴィタリック" / "  ヴィタリックを探せ版 " → "ヴィタリック". Short, plain text only. */
function nameFrom(input: string): string {
  const t = input.normalize('NFC').replace(/[\u0000-\u001f<>]/g, '').trim().replace(/版$/, '').replace(/を探せ$/, '').trim();
  return t.slice(0, 16);
}

/**
 * Event page reached from Mente's 🔄 → YES. For now it goes as far as the header:
 * the title "サトシを探せ版" whose name can be clicked; a bubble opens with an input whose
 * placeholder is "ヴィタリックを探せ", and confirming it rewrites the title.
 * The game body below the header comes in the next step.
 */
export default function MenteGame() {
  const [name, setName] = useState(ORIGINAL);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [flip, setFlip] = useState(false);
  const [tailX, setTailX] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    try { const v = window.localStorage.getItem(KEY); if (v) setName(nameFrom(v) || ORIGINAL); } catch { /* storage may be blocked */ }
  }, []);
  useEffect(() => {
    if (!open) return;
    const el = nameRef.current; if (el) setTailX(el.offsetLeft + el.offsetWidth / 2);
    inputRef.current?.focus();
  }, [open]);

  const save = (v: string) => { try { if (v === ORIGINAL) window.localStorage.removeItem(KEY); else window.localStorage.setItem(KEY, v); } catch { /* per-viewer convenience only */ } };
  const apply = () => {
    const next = nameFrom(draft) || nameFrom(PLACEHOLDER);
    setOpen(false); setDraft('');
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) { setFlip(true); window.setTimeout(() => setFlip(false), 420); }
    setName(next); save(next); nameRef.current?.focus();
  };
  const cancel = () => { setOpen(false); setDraft(''); nameRef.current?.focus(); };
  const reset = () => { setName(ORIGINAL); save(ORIGINAL); };

  return (
    <main className="min-h-screen bg-white px-4 py-4 font-mono text-[#1f1f1f]">
      <div className="mx-auto max-w-4xl space-y-4">
        <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600">
          <span>🔄 Mente から切り替え · イベント：タイトルの書き換え</span>
          <Link href="/mente" className="underline">Mente に戻る</Link>
        </p>

        <header className="relative border-b border-stone-200 pb-2" data-testid="event-header">
          <h1 className="text-lg tracking-wide">
            ChartUI <span className="text-[#c8001a]">ホワイトアウト版 AB</span> —{' '}
            <button
              ref={nameRef}
              type="button"
              data-testid="title-name"
              aria-expanded={open}
              aria-controls="title-bubble"
              onClick={() => setOpen((o) => !o)}
              className="border-b-2 border-dotted border-[#c8001a] px-0.5 transition-transform duration-300 hover:bg-[#fff1f2]"
              style={{ transform: flip ? 'rotateX(90deg)' : 'none' }}
              title="クリックして名前を書き換える"
            >
              {name}
            </button>
            を探せ版
          </h1>
          <p className="text-[11px] text-stone-500">名前をクリックすると、吹き出しが開きます。</p>

          {open && (
            <div id="title-bubble" role="dialog" aria-label="名前を書き換える" data-testid="title-bubble" style={{ left: Math.max(0, tailX - 32) }} className="absolute top-full z-20 mt-3 w-72 border-2 border-[#1f1f1f] bg-white p-3 shadow-[5px_5px_0_#0003]"
              onKeyDown={(e) => { if (e.key === 'Escape') cancel(); }}>
              <span aria-hidden className="absolute -top-[9px] left-6 h-4 w-4 rotate-45 border-l-2 border-t-2 border-[#1f1f1f] bg-white" />
              <form onSubmit={(e) => { e.preventDefault(); apply(); }} className="space-y-2">
                <label className="block text-[11px] text-stone-600" htmlFor="title-input">誰を探す？（空のまま決めると、うすい字のとおりになります）</label>
                <input id="title-input" ref={inputRef} data-testid="title-input" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={PLACEHOLDER} maxLength={24} className="w-full border border-stone-400 bg-white px-2 py-1 text-sm text-[#1f1f1f] placeholder:text-stone-500" />
                <div className="flex justify-end gap-2 text-xs">
                  <button type="button" onClick={cancel} className="border border-stone-400 px-2 py-0.5">やめる</button>
                  <button type="submit" data-testid="title-apply" className="border border-[#1f1f1f] bg-[#1f1f1f] px-2 py-0.5 text-white">決める</button>
                </div>
              </form>
            </div>
          )}
        </header>

        <section className="grid min-h-[260px] place-items-center border border-stone-200 bg-[#fafaf9] text-center" aria-label="タイトル画面（準備中）" data-testid="event-stage">
          <div className="space-y-2">
            <p className="text-2xl font-semibold" data-testid="stage-title">{name}を探せ</p>
            <p className="text-xs text-stone-600">ゲームの本編は次の作業で（ここまでが header の件）。</p>
            <p className="text-xs"><Link href="/mente/game/swarm" className="underline" data-testid="to-swarm">6〜7 年目のイベント：瓶を拾う者たち（BA と PE）</Link></p>
            <p className="text-xs"><Link href="/mente/game/chess3" className="underline" data-testid="to-chess3">フィジカルプロンプトチェス 3 ゲーム目「チョークの部屋」</Link></p>
            <p className="text-xs"><Link href="/mente/game/story" className="underline" data-testid="to-story">物語 200 を遊ぶ（プロローグ：ガレージアイランド → 1 年目）</Link></p>
            <p className="text-xs"><Link href="/mente/game/year1" className="underline" data-testid="to-year1">1〜2 年目から遊ぶ（港・アリミノボーイに聞く・指紋の書き写し）</Link></p>
            <p className="text-xs"><Link href="/mente/game/year9" className="underline" data-testid="to-year9">9 年目：クレーターのサイコロ（フォン（仮）を操縦する Luna）</Link></p>
            <p className="text-xs"><Link href="/mente/game/years" className="underline" data-testid="to-years">1〜12 年目の進行と、最後の塔（ミニゲームの仮置き）</Link></p>
            {name !== ORIGINAL && <button type="button" onClick={reset} className="text-[11px] text-stone-600 underline">もとの名前（{ORIGINAL}）に戻す</button>}
          </div>
        </section>

        <footer className="border-t border-stone-200 pt-2 text-[11px] text-stone-600">
          架空の物語です。登場する鍵・署名・残高はすべて作りものです。実在の人物を特定・描写するものではありません（名前はタイトルの言葉としてだけ使い、姿は描きません）。<br />
          取引や暮らしのことでつらいときは、ひとりで抱えずに：よりそいホットライン 0120-279-338（24 時間・無料）／いのちの電話 0570-783-556
        </footer>
      </div>
    </main>
  );
}
