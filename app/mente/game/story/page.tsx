'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import MenteNudge from '@/components/story/MenteNudge';
import SatoshiParam from '@/components/story/SatoshiParam';
import { shouldNudge, type NudgeEvent, type NudgeReason } from '@/lib/menteNudge';
import { SCRIPT, WRITTEN_MAIN, type ChatLine, type Dub } from '@/lib/storyScript';
import { TOTAL_BEATS } from '@/lib/story200';

/** Typewriter for the coding scene: one character every 28 ms (instant with reduced motion). */
function Terminal({ lines }: { lines: string[] }) {
  const full = lines.join('\n'); const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setN(full.length); return undefined; }
    setN(0); const t = window.setInterval(() => setN((k) => { if (k >= full.length) { window.clearInterval(t); return k; } return k + 1; }), 28);
    return () => window.clearInterval(t);
  }, [full]);
  return <pre className="overflow-x-auto bg-[#0f1220] p-3 text-[12px] leading-5 text-[#9ef0c0]" data-testid="terminal" aria-label="ストイックのコード">{full.slice(0, n)}<span className="animate-pulse">▍</span></pre>;
}

/**
 * The Alan Sillitoe game: a muted TV mouths a line (a generic face, nobody real); the player types
 * their own words into the text box, then the mouth "says" them while the subtitle fills in, beat by
 * beat. The words stay on this page (not saved, not sent). Reduced motion: no mouth movement.
 */
function DubScene({ dub, onDone }: { dub: Dub; onDone: (line: string) => void }) {
  const [line, setLine] = useState('');
  const [t, setT] = useState(-1); // -1: idle loop, 0..1: playing the player's line, 2: done
  const [loop, setLoop] = useState(0);
  const reduce = useRef(false);
  useEffect(() => { reduce.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; let raf = 0; const st = performance.now(); const f = (now: number) => { setLoop((now - st) / 1000); raf = requestAnimationFrame(f); }; raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf); }, []);
  const play = () => {
    const text = line.trim() || '……'; if (reduce.current) { setT(2); onDone(text); return; }
    const st = performance.now(); const dur = dub.beats * 450;
    const f = (now: number) => { const k = (now - st) / dur; if (k >= 1) { setT(2); onDone(text); return; } setT(k); requestAnimationFrame(f); };
    requestAnimationFrame(f);
  };
  // mouth opening: a smooth bump per beat (about 2 per second); idle loop while waiting
  const phase = t >= 0 && t <= 1 ? t * dub.beats : (loop * 2) % dub.beats;
  const open = reduce.current || t === 2 ? 0.15 : 0.15 + 0.85 * Math.abs(Math.sin(Math.PI * phase));
  const shown = t === 2 ? (line.trim() || '……') : t >= 0 ? (line.trim() || '……').slice(0, Math.ceil(t * (line.trim() || '……').length)) : '';
  return (
    <div className="space-y-2 border border-stone-300 p-3" data-testid="dub">
      <div className="relative mx-auto aspect-[4/3] w-full max-w-sm rounded-md border-4 border-[#3a3a3a] bg-[#1b2230]">
        <span className="absolute left-2 top-1 text-[10px] text-white/70">🔇 消音</span>
        <svg viewBox="0 0 160 120" className="h-full w-full" aria-label={dub.tv}>
          <ellipse cx={80} cy={62} rx={32} ry={40} fill="#cbd5e1" />
          <rect x={58} y={20} width={44} height={14} rx={6} fill="#475569" />
          <circle cx={68} cy={56} r={3} fill="#1f2937" /><circle cx={92} cy={56} r={3} fill="#1f2937" />
          <ellipse cx={80} cy={82} rx={10} ry={1.5 + 7 * open} fill="#7f1d1d" />
        </svg>
        {shown && <p className="absolute inset-x-2 bottom-2 bg-black/70 px-2 py-1 text-center text-sm text-white" data-testid="dub-sub">{shown}</p>}
      </div>
      <p className="text-[11px] text-stone-600">{dub.tv} · {dub.hint}</p>
      {t !== 2 && (
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="dub-input">口の動きに合わせる、あなたの台詞</label>
          <input id="dub-input" data-testid="dub-input" value={line} onChange={(e) => setLine(e.target.value)} maxLength={40} placeholder="口の動きに合わせて、あなたの台詞を（例：今日の潮は、満ち潮です）" className="min-w-0 flex-1 border border-stone-400 bg-white px-2 py-1 text-sm text-[#1f1f1f]" />
          <button type="button" data-testid="dub-play" disabled={t >= 0} onClick={play} className="border border-[#1f1f1f] bg-[#1f1f1f] px-3 py-1 text-sm text-white disabled:opacity-50">合わせて言う</button>
        </div>
      )}
      {t === 2 && <p className="text-sm" data-testid="dub-after">{dub.after}</p>}
      <p className="text-[10px] text-stone-500">書いた台詞は、このページの中だけ。保存も送信もしません。</p>
    </div>
  );
}

/**
 * The story player: 2- and 4-choice beats with an answer for every choice, quiz beats that build a
 * combo, a stream-style chat where BA and PE react, the coding scene as a terminal, the Satoshi
 * parameter in the header, and the Mente nudge when the player seems lost.
 */
export default function StoryPlayer() {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [chat, setChat] = useState<(ChatLine & { k: number })[]>([{ who: 'Mente', text: '配信がはじまりました。ゆっくりどうぞ。', k: 0 }]);
  const [combo, setCombo] = useState(0);
  const [best, setBest] = useState(0);
  const chatRef = useRef<HTMLDivElement>(null);
  const beat = SCRIPT[i];
  const [dubbed, setDubbed] = useState(false);

  const events = useRef<NudgeEvent[]>([{ t: Date.now(), type: 'shown' }]);
  const since = useRef(99);
  const [nudge, setNudge] = useState<NudgeReason | null>(null);
  const check = useCallback(() => { if (nudge) return; const r = shouldNudge(events.current, Date.now(), since.current); if (r) { setNudge(r); since.current = 0; } }, [nudge]);
  useEffect(() => { const t = window.setInterval(check, 5000); return () => window.clearInterval(t); }, [check]);
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }); }, [chat]);

  const pick = (c: number) => {
    if (picked !== null) return;
    setPicked(c); const ch = beat.choices[c];
    events.current = [...events.current.slice(-40), { t: Date.now(), type: 'picked' }];
    if (ch.correct === true) { setCombo((x) => { const nx = x + 1; setBest((b) => Math.max(b, nx)); return nx; }); events.current.push({ t: Date.now(), type: 'hit' }); }
    if (ch.correct === false) { setCombo(0); events.current.push({ t: Date.now(), type: 'miss' }); }
    const lines = ch.chat ?? [];
    lines.forEach((l, k) => window.setTimeout(() => setChat((cs) => [...cs.slice(-60), { ...l, k: Date.now() + k }]), 500 + k * 700));
    check();
  };
  const next = () => { if (i + 1 >= SCRIPT.length) return; setI(i + 1); setPicked(null); setDubbed(false); since.current += 1; events.current.push({ t: Date.now(), type: 'shown' }); };
  const restart = () => { setI(0); setPicked(null); setDubbed(false); setCombo(0); events.current.push({ t: Date.now(), type: 'restart' }); check(); };
  const end = i === SCRIPT.length - 1 && picked !== null;

  return (
    <main className="min-h-screen bg-white px-4 py-4 font-mono text-[#1f1f1f]">
      <div className="mx-auto max-w-5xl space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-2">
          <div>
            <p className="text-[11px] text-stone-600">イーサリアムの黄金のアイコンを探せ（仮）</p>
            <h1 className="text-lg">物語 200 — {beat.part === 'prologue' ? `プロローグ：ガレージアイランド（${beat.id}）` : `本編 ${beat.no} / ${TOTAL_BEATS}`}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <SatoshiParam />
            <span data-testid="combo" title="クイズの連続正解">🔥 コンボ {combo}（最高 {best}）</span>
            <button type="button" onClick={restart} className="underline">最初から</button>
            <Link href="/mente/game" className="underline">タイトルへ</Link>
          </div>
        </header>
        <p className="text-[11px] text-stone-500">書けた本編：{WRITTEN_MAIN} / {TOTAL_BEATS}（いまはプロローグと 1〜2 年目）。続きは順に書き足します。</p>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <section className="space-y-3" aria-live="polite" data-testid="beat">
            <p className="text-[11px] text-stone-500">場所：{beat.place} · {beat.speaker}</p>
            {beat.text.map((t) => <p key={t} className="text-sm leading-7">{t}</p>)}
            {beat.code && <Terminal lines={beat.code} />}
            {beat.dub && <DubScene key={beat.id} dub={beat.dub} onDone={(l) => { if (dubbed) return; setDubbed(true); [{ who: 'BA-80BF', text: `「${l}」…うまい` }, { who: 'PE-05F0', text: 'くちぱく せいこう！' }].forEach((c, k) => window.setTimeout(() => setChat((cs) => [...cs.slice(-60), { ...c, k: Date.now() + k }]), 400 + k * 600)); }} />}
            {(!beat.dub || dubbed) && <><p className="border-l-4 border-[#c8001a] pl-3 text-base font-semibold" data-testid="question">{beat.q}</p>
            <div className={`grid gap-2 ${beat.choices.length === 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-2'}`}>
              {beat.choices.map((c, k) => {
                const shown = picked !== null; const mine = picked === k;
                const tone = shown && c.correct === true ? '#2f6b1a' : shown && mine && c.correct === false ? '#c8001a' : '#1f1f1f';
                return <button key={c.label} type="button" data-testid={`opt-${k}`} disabled={shown} onClick={() => pick(k)} className="border-2 px-3 py-2 text-left text-sm transition-colors disabled:cursor-default" style={{ borderColor: mine ? tone : shown ? '#e7e5e4' : '#1f1f1f', color: shown && !mine && c.correct !== true ? '#78716c' : tone, background: mine ? '#fafaf9' : 'white' }}>{c.label}{shown && c.correct === true ? ' ✓' : ''}</button>;
              })}
            </div></>}
            {picked !== null && (
              <div className="space-y-2 border border-stone-200 bg-[#fafaf9] p-3" data-testid="reply">
                {beat.choices[picked].reply.map((r) => <p key={r} className="text-sm leading-7">{r}</p>)}
                {beat.fact && <p className="border-t border-stone-200 pt-2 text-[12px] text-stone-600">💡 豆知識：{beat.fact}</p>}
                {!end && <button type="button" data-testid="next" onClick={next} className="border border-[#1f1f1f] bg-[#1f1f1f] px-3 py-1 text-sm text-white">次へ ▶</button>}
                {end && <p className="text-sm">ここまでが第 2 弾。<Link href="/mente/game/year1" className="underline">2 年目のミニゲーム「指紋の書き写し」へ</Link></p>}
              </div>
            )}
          </section>

          <aside className="flex h-[26rem] flex-col border border-stone-300" aria-label="実況チャット" data-testid="chat">
            <p className="border-b border-stone-200 bg-[#0f1220] px-2 py-1 text-[11px] text-white">● 実況　BA と PE が見ています</p>
            <div ref={chatRef} className="flex-1 space-y-1 overflow-y-auto p-2 text-[12px]">
              {chat.map((l) => <p key={l.k}><span className="font-semibold" style={{ color: l.who.startsWith('BA') ? '#7a5c12' : l.who.startsWith('PE') ? '#2f6b1a' : '#57534e' }}>{l.who}</span>　{l.text}</p>)}
            </div>
          </aside>
        </div>

        {nudge && <MenteNudge reason={nudge} between="さっきの選択肢と、次の選択肢" after="どれを選んでも、物語は続く。チャットのみんなも待ってるよ。" onClose={() => setNudge(null)} />}
        <footer className="border-t border-stone-200 pt-2 text-[11px] text-stone-600">
          架空の物語です。実在の人物は登場しません。トトシ中本・サトシ顔は架空のキャラクターです。値段のあるものや賭けは出てきません。酔いどれ草は景色だけで、誰も吸いません。<br />
          取引や暮らしのことでつらいときは、ひとりで抱えずに：よりそいホットライン 0120-279-338（24 時間・無料）／いのちの電話 0570-783-556
        </footer>
      </div>
    </main>
  );
}
