'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import GlassKnot from '@/components/cure/GlassKnot';
import MentePhone, { type PhoneScreen } from '@/components/mente/MentePhone';
import { useCureAPIStore } from '@/lib/cureApiStore';
import { MENTE_MEMBERS } from '@/lib/menteChat';
import { useMenteInbox } from '@/lib/menteInbox';
import { CHECKPOINTS, LETTERS, QUIZ, arrange, fallbackStep, fiftyFifty, live22, telephone } from '@/lib/quizQuantum';
import { REGIONS } from '@/lib/retroGrid';

const BEAT = 700;
const STORE_KEY = 'chartui-quiz-quantum';
type Phase = 'reveal' | 'answer' | 'confirm' | 'suspense' | 'result' | 'collision';

function loadProgress(): { step: number; lap: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (raw && Number.isInteger(raw.step) && Number.isInteger(raw.lap)) return { step: Math.min(21, Math.max(0, raw.step)), lap: raw.lap };
  } catch { /* storage unavailable */ }
  return { step: 0, lap: 0 };
}

function saveProgress(step: number, lap: number) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ step, lap })); } catch { /* storage unavailable */ }
}

/** Split a prompt into fired chunks separated by "...." beats. */
function beatsFor(prompt: string) {
  const chunks = prompt.split(/(?<=[、，,？?])/).map((c) => c.trim()).filter(Boolean);
  return chunks.flatMap((chunk, i) => (i === 0 ? [chunk] : ['....', chunk]));
}

/** 19. クイズクオンタム on retro-grid page B: 22 steps, ABCD, glass-tube knot, amenities. */
export default function QuizQuantum() {
  const [{ step, lap }, setProgress] = useState(loadProgress);
  const [phase, setPhase] = useState<Phase>('reveal');
  const [beat, setBeat] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [dots, setDots] = useState(0);
  const [removed, setRemoved] = useState<number[]>([]);
  const [used, setUsed] = useState({ fifty: false, live: false, phone: false });
  const [liveResult, setLiveResult] = useState<ReturnType<typeof live22> | null>(null);
  const [fiftyRule, setFiftyRule] = useState('');
  const [phone, setPhone] = useState<{ screen: PhoneScreen; result: ReturnType<typeof telephone> } | null>(null);
  const [collision, setCollision] = useState<'wrong' | 'clear' | null>(null);
  const setSimulationMode = useCureAPIStore((s) => s.setSimulationMode);
  const notify = useMenteInbox((s) => s.notify);

  // Arriving from a Mente notification: bring the quiz into view.
  useEffect(() => {
    if (window.location.hash === '#quiz-quantum') window.setTimeout(() => document.getElementById('quiz-quantum')?.scrollIntoView({ block: 'start' }), 200);
  }, []);

  // While the quiz is open, idlecrash holds its loop so the page does not switch mid-question.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('quiz-quantum:active', { detail: true }));
    return () => { window.dispatchEvent(new CustomEvent('quiz-quantum:active', { detail: false })); };
  }, []);

  const q = QUIZ[step];
  const { order, correct } = useMemo(() => arrange(q, lap), [q, lap]);
  const promptBeats = useMemo(() => beatsFor(q.prompt), [q]);
  const totalBeats = promptBeats.length + 4;

  // Fire the question chunk by chunk, then the options one per beat.
  useEffect(() => {
    if (phase !== 'reveal') return undefined;
    if (beat >= totalBeats) { setPhase('answer'); return undefined; }
    const timer = window.setTimeout(() => setBeat((b) => b + 1), BEAT);
    return () => window.clearTimeout(timer);
  }, [phase, beat, totalBeats]);

  // "...." between chunks and during the suspense.
  useEffect(() => {
    const timer = window.setInterval(() => setDots((d) => (d + 1) % 5), BEAT / 4);
    return () => window.clearInterval(timer);
  }, []);

  const nextQuestion = useCallback((nextStep: number, nextLap: number) => {
    setProgress({ step: nextStep, lap: nextLap });
    saveProgress(nextStep, nextLap);
    setPhase('reveal'); setBeat(0); setPicked(null); setRemoved([]); setLiveResult(null); setFiftyRule('');
  }, []);

  // Suspense: four "...." beats after the final answer, then the result.
  useEffect(() => {
    if (phase !== 'suspense') return undefined;
    const timer = window.setTimeout(() => setPhase('result'), BEAT * 4);
    return () => window.clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'result' || picked === null) return undefined;
    const right = picked === correct;
    const timer = window.setTimeout(() => {
      if (right && step < QUIZ.length - 1) { nextQuestion(step + 1, lap); return; }
      setCollision(right ? 'clear' : 'wrong');
      notify({
        source: 'quiz',
        title: right ? '22 段を登りきった' : `Q${q.id} で衝突`,
        body: right ? 'ガラス管の結び目が閉じた。次の周回へ' : `正解は ${LETTERS[correct]}『${q.options[order[correct]]}』。チェックポイント ${fallbackStep(step)} からページ A を経て再開`,
        href: '/retro-grid?page=B#quiz-quantum',
      });
      setPhase('collision');
    }, 1800);
    return () => window.clearTimeout(timer);
  }, [phase, picked, correct, step, lap, nextQuestion]);

  // Collision of HEADER / BOTTOM / SIDE MENU / POP UP, then the loop back to page A.
  useEffect(() => {
    if (phase !== 'collision') return undefined;
    const timer = window.setTimeout(() => {
      const nextStep = collision === 'clear' ? 0 : fallbackStep(step);
      saveProgress(nextStep, lap + 1);
      setSimulationMode('hypothesisA');
      window.history.replaceState(null, '', '?page=A');
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [phase, collision, step, lap, setSimulationMode]);

  const optionsShown = Math.max(0, beat - promptBeats.length);
  const answered = step + (phase === 'result' && picked === correct ? 1 : 0);
  const busy = phase !== 'answer' && phase !== 'confirm';

  return (
    <section id="quiz-quantum" className="relative overflow-hidden rounded border border-sky-200/25 bg-[#05020a] p-4 text-xs" aria-label="19 Quiz Quantum">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[9px] uppercase tracking-[0.3em] text-sky-200">Famiポート 19 · クイズクオンタム · retro grid B · lap {lap}</p>
          <p className="mt-1 text-[10px] text-slate-400">記号学と楔形文字の発生を計測イベントとして、22 段を一段ずつ。正解ごとにガラス管の結び目が 1 区間ずつ現れる。誤答は衝突してページ A へ（チェックポイント {CHECKPOINTS.join(' / ')} から再開）。</p>
        </div>
        <span className="font-mono text-[10px] text-slate-500">{answered}/22 measured</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[9rem_minmax(0,1fr)_minmax(0,1fr)]">
        {/* 22-step staircase */}
        <ol className="flex flex-col-reverse gap-[3px]" aria-label="22 steps">
          {QUIZ.map((item, i) => {
            const done = i < answered; const here = i === step;
            return (
              <li
                key={item.id}
                className="flex items-center justify-between px-2 py-[3px] font-mono text-[9px]"
                style={{
                  marginLeft: `${(21 - i) * 2}px`,
                  background: here ? 'linear-gradient(90deg,#fde68a,#f59e0b)' : done ? 'linear-gradient(90deg,#1e3a5f,#0f172a)' : 'linear-gradient(90deg,#1c1917,#0c0a09)',
                  color: here ? '#1c1917' : done ? '#bae6fd' : '#78716c',
                  boxShadow: here ? '0 0 14px rgba(245,158,11,.6), inset 0 -2px 0 rgba(0,0,0,.35)' : 'inset 0 -2px 0 rgba(0,0,0,.5)',
                  borderTop: CHECKPOINTS.includes(i + 1) ? '1px solid #fbbf24' : undefined,
                }}
              >
                <span>{i + 1}</span><span>{done ? item.glyph : here ? '◆' : ''}</span>
              </li>
            );
          })}
        </ol>

        {/* Question */}
        <div className="flex flex-col gap-3">
          <div className="min-h-[96px] rounded border border-sky-200/20 bg-gradient-to-b from-[#0b1f3a] to-[#05020a] p-3 text-[13px] leading-6 text-white">
            <p className="mb-1 text-[9px] uppercase tracking-[0.25em] text-sky-300">Q{q.id} · {q.layer === 'semiotics' ? '記号学' : '楔形文字'} · {q.source}</p>
            {promptBeats.slice(0, Math.min(beat + 1, promptBeats.length)).map((chunk, i) => (
              chunk === '....'
                ? (i === Math.min(beat, promptBeats.length - 1) && phase === 'reveal' ? <span key={i} className="mx-1 text-sky-300">{'.'.repeat(dots)}</span> : null)
                : <span key={i}>{chunk}</span>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {order.map((optionIndex, k) => {
              const visible = k < optionsShown || phase !== 'reveal';
              const gone = removed.includes(k);
              const isPicked = picked === k;
              const reveal = phase === 'result' || phase === 'collision';
              const tone = reveal && k === correct ? 'border-emerald-300 bg-emerald-400/20' : reveal && isPicked ? 'border-rose-400 bg-rose-500/20' : isPicked ? 'border-amber-300 bg-amber-300/20' : 'border-sky-200/25 bg-[#0b1f3a]/60';
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!visible || gone || busy}
                  onClick={() => { setPicked(k); setPhase('confirm'); }}
                  className={`flex min-h-10 items-center gap-2 border px-3 py-2 text-left text-[12px] transition-opacity ${tone} ${visible && !gone ? 'opacity-100' : 'opacity-0'}`}
                  style={{ clipPath: 'polygon(4% 0, 96% 0, 100% 50%, 96% 100%, 4% 100%, 0 50%)' }}
                >
                  <span className="font-mono text-amber-200">{LETTERS[k]}:</span> {q.options[optionIndex]}
                </button>
              );
            })}
          </div>

          <div className="min-h-8 text-center text-[12px] text-amber-100">
            {phase === 'confirm' && picked !== null && (
              <span>
                『{LETTERS[picked]}』 で、よろしいですか{'.'.repeat(dots)}{' '}
                <button type="button" onClick={() => setPhase('suspense')} className="ml-2 border border-amber-300/60 px-2 py-0.5">ファイナルアンサー</button>
                <button type="button" onClick={() => { setPicked(null); setPhase('answer'); }} className="ml-1 border border-white/15 px-2 py-0.5 text-slate-400">考え直す</button>
              </span>
            )}
            {phase === 'suspense' && <span className="tracking-[0.5em]">{'.... '.repeat(1 + (dots % 4))}</span>}
            {phase === 'result' && picked !== null && (picked === correct ? <span className="text-emerald-200">正解 · 計測イベント {q.glyph}（{q.reading}）</span> : <span className="text-rose-200">不正解 · 正解は {LETTERS[correct]}</span>)}
          </div>

          {/* Amenities: always show how each help was computed. */}
          <div className="rounded border border-white/10 p-2">
            <p className="mb-1 text-[9px] uppercase tracking-[0.2em] text-slate-400">amenity</p>
            <div className="flex flex-wrap gap-1">
              <button type="button" disabled={used.fifty || busy} onClick={() => { const r = fiftyFifty(q, lap); setRemoved(r.removed.map((oi) => oi)); setFiftyRule(r.rule); setUsed((u) => ({ ...u, fifty: true })); }} className="border border-white/15 px-2 py-1 disabled:opacity-40">50:50</button>
              <button type="button" disabled={used.live || busy} onClick={() => { setLiveResult(live22(q, lap, step)); setUsed((u) => ({ ...u, live: true })); }} className="border border-white/15 px-2 py-1 disabled:opacity-40">LIVE 22</button>
              <button type="button" disabled={used.phone || busy} onClick={() => {
                const result = telephone(q, lap, step, MENTE_MEMBERS.length);
                setPhone({ screen: 'ringing', result });
                setUsed((u) => ({ ...u, phone: true }));
                notify({ source: 'quiz', title: `Q${q.id} のテレフォン`, body: `${MENTE_MEMBERS[result.member].name}：……${LETTERS[result.answer]}、『${q.options[order[result.answer]]}』だと思う。確信度 ${result.confidence}%`, href: '/retro-grid?page=B#quiz-quantum' });
              }} className="border border-white/15 px-2 py-1 disabled:opacity-40">テレフォン（Mente）</button>
            </div>
            {fiftyRule && <p className="mt-1 text-[9px] text-slate-500">50:50 — {fiftyRule}</p>}
            {liveResult && (
              <div className="mt-2">
                <div className="grid grid-cols-11 gap-0.5">
                  {liveResult.votes.map((v, i) => <span key={i} title={`block #${i + 1} → ${LETTERS[v]}`} className="grid aspect-square place-items-center rounded-sm text-[8px]" style={{ background: ['#fb7185', '#fbbf24', '#34d399', '#a78bfa'][v] + '55' }}>{LETTERS[v]}</span>)}
                </div>
                <div className="mt-1 grid grid-cols-4 gap-1 text-[9px]">
                  {liveResult.tally.map((n, k) => <span key={k} className="font-mono">{LETTERS[k]} {Math.round((n / 22) * 100)}%</span>)}
                </div>
                <p className="mt-1 text-[9px] text-slate-500">LIVE 22 — {liveResult.rule}</p>
              </div>
            )}
          </div>
        </div>

        {/* Glass-tube knot */}
        <div>
          <GlassKnot events={answered} labels={QUIZ.slice(0, answered).map((item) => item.glyph)} shake={phase === 'collision' ? 1 : 0} className="w-full rounded border border-white/10" />
          <p className="mt-1 text-[9px] text-slate-500">ガラス管の結び目：管の断面リング（ミクロ層）を三つ葉結び目（メソ層）に沿って点群化。正解ごとに 1/22 区間が現れ、自由曲線のうねりが増す。</p>
        </div>
      </div>

      {phone && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4" onClick={() => setPhone(null)}>
          <div onClick={(event) => event.stopPropagation()} className="space-y-2">
            <MentePhone
              screen={phone.screen}
              onScreen={(screen) => setPhone((p) => (p ? { ...p, screen } : p))}
              openHref={`/mente?from=quiz&q=${q.id}`}
              incoming={{
                member: MENTE_MEMBERS[phone.result.member].id,
                at: 'いま',
                text: `……${LETTERS[phone.result.answer]}、『${q.options[order[phone.result.answer]]}』だと思う。確信度 ${phone.result.confidence}%`,
                caption: `クイズクオンタム No.19 · Q${q.id} のテレフォン`,
              }}
            />
            <p className="max-w-[270px] text-center text-[9px] text-slate-400">テレフォン — {phone.result.rule}</p>
            <button type="button" onClick={() => setPhone(null)} className="mx-auto block border border-white/20 px-3 py-1 text-[10px] text-slate-300">クイズに戻る</button>
          </div>
        </div>
      )}

      {phase === 'collision' && (
        <div className="pointer-events-none fixed inset-0 z-[120]" aria-hidden="true">
          <style>{`
            @keyframes qqTop { to { transform: translateY(38vh); } } @keyframes qqBottom { to { transform: translateY(-38vh); } }
            @keyframes qqLeft { to { transform: translateX(34vw); } } @keyframes qqRight { to { transform: translateX(-34vw); } }
          `}</style>
          <div className="absolute inset-x-0 top-0 h-[22vh]" style={{ background: REGIONS.header.tint, opacity: 0.85, animation: 'qqTop 1.2s cubic-bezier(.6,0,.9,.5) forwards' }} />
          <div className="absolute inset-x-0 bottom-0 h-[14vh]" style={{ background: REGIONS.bottom.tint, opacity: 0.85, animation: 'qqBottom 1.2s cubic-bezier(.6,0,.9,.5) forwards' }} />
          <div className="absolute bottom-0 left-0 top-0 w-[22vw]" style={{ background: REGIONS.side.tint, opacity: 0.8, animation: 'qqLeft 1.2s cubic-bezier(.6,0,.9,.5) forwards' }} />
          <div className="absolute bottom-0 right-0 top-0 w-[22vw]" style={{ background: REGIONS.popup.tint, opacity: 0.8, animation: 'qqRight 1.2s cubic-bezier(.6,0,.9,.5) forwards' }} />
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center font-mono text-2xl tracking-[0.6em] text-black">COLLISION</p>
        </div>
      )}
    </section>
  );
}
