'use client';

import { useState } from 'react';
import MangaBanner, { type BannerState } from '@/components/quiz/MangaBanner';
import { D_WORDS, HOST, QUESTIONS } from '@/lib/quantumQuiz';

/** クオンタムクイズ: a host, a CSS manga notification banner, and quizzes on Satoshi (public record), トトシ (fiction) and cryptography. */
export default function QuantumQuiz() {
  const [k, setK] = useState(0);
  const [score, setScore] = useState(0); const [rides, setRides] = useState(0); const [decl, setDecl] = useState<string[]>([]);
  const [answered, setAnswered] = useState<'a' | 'b' | null>(null);
  const [dOpen, setDOpen] = useState(false); const [w1, setW1] = useState(D_WORDS.where[0]); const [w2, setW2] = useState(D_WORDS.ride[0]);
  const [banner, setBanner] = useState(true);
  const q = QUESTIONS[k]; const done = k >= QUESTIONS.length;
  const [state, setState] = useState<BannerState>({ phase: 'ask', text: `第 1 問！ ${QUESTIONS[0].topic}の問題。`, a: QUESTIONS[0].a, b: QUESTIONS[0].b });
  const ask = (n: number) => { if (n >= QUESTIONS.length) { setState({ phase: 'done', text: 'では——全部、測定しました！' }); return; } setState({ phase: 'ask', text: `第 ${n + 1} 問！ ${QUESTIONS[n].topic}の問題。`, a: QUESTIONS[n].a, b: QUESTIONS[n].b }); };
  const next = () => { const n = k + 1; setK(n); setAnswered(null); setDOpen(false); ask(n); setBanner(true); };
  const pick = (x: 'a' | 'b') => { if (answered) return; setAnswered(x); const ok = x === q.right; if (ok) setScore((s) => s + 1); setState({ phase: ok ? 'right' : 'wrong', text: ok ? 'では——測定！ 正解！' : `測定……${q.right} でした！` }); setBanner(true); };
  const ride = () => { setRides((r) => r + 1); setState({ phase: 'aviator', text: 'もう一度 aviator に！ この問題は、空の上に置いていきましょう。' }); setAnswered(q.right); setBanner(true); };
  const declare = () => { const line = `もう二度と地球に帰れないなら、${w1}に、もう${w2}に乗る。`; setDecl((d) => [...d, line]); setState({ phase: 'declare', text: `「${line}」……すばらしい宣言です。` }); setAnswered(q.right); setDOpen(false); setBanner(true); };

  return (
    <main className="mx-auto max-w-3xl space-y-4 bg-[#faf7f2] p-4 text-[#1f1f1f]">
      {banner && <MangaBanner s={state} onClose={() => setBanner(false)} />}

      <header className="space-y-1">
        <p className="text-xs text-stone-500">12 年目の塔の下で</p>
        <h1 className="text-xl font-bold">クオンタムクイズ — トトシとサトシと、SNS の暗号</h1>
        <p className="text-[11px] text-stone-500">サトシについては公開の記録だけ（どこで・いつ書いたか）。誰なのかは当てない。トトシ中元はゲームの中の人物。投資の助言ではない。</p>
      </header>

      <details className="border border-stone-300 bg-white p-3 text-xs" data-testid="host">
        <summary className="cursor-pointer font-semibold">司会者：{HOST.name}（{HOST.role}）のプロフィール</summary>
        <dl className="mt-2 grid grid-cols-[4rem_1fr] gap-x-2 gap-y-1">{HOST.profile.map(([k2, v]) => <div key={k2} className="contents"><dt className="text-stone-500">{k2}</dt><dd>{v}</dd></div>)}</dl>
        <p className="mt-2 font-semibold">かんたんな経歴</p>
        <ol className="list-inside list-decimal space-y-0.5">{HOST.career.map((c) => <li key={c}>{c}</li>)}</ol>
      </details>

      {!done ? (
        <section className="space-y-3 border-2 border-black bg-white p-3" data-testid="quiz">
          <p className="text-[11px] text-stone-500">第 {k + 1} 問 / {QUESTIONS.length}・{q.topic}・<span className="rounded-sm border px-1">{q.kind}</span>　正解 {score}・aviator {rides}・宣言 {decl.length}</p>
          <p className="text-sm font-semibold">{q.q}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(['a', 'b'] as const).map((x) => (
              <button key={x} type="button" data-testid={`ans-${x}`} onClick={() => pick(x)} disabled={!!answered} className="min-h-[52px] rounded-md border-2 border-black px-2 text-left text-sm disabled:opacity-80" style={{ background: answered ? (x === q.right ? '#e8f5e0' : answered === x ? '#fde8ea' : 'white') : 'white' }}>
                <span className="block text-[10px] text-stone-500">{x}. {x === 'a' ? 'SNS-iIIN' : 'SNS-K'}（"MENTE" 50:50）</span>{x === 'a' ? q.a : q.b}
              </button>))}
            <button type="button" data-testid="ans-c" onClick={ride} disabled={!!answered} className="min-h-[44px] rounded-md border-2 border-dashed border-stone-500 px-2 text-left text-sm">c. もう一度 aviator に乗る？</button>
            <button type="button" data-testid="ans-d" onClick={() => setDOpen((o) => !o)} disabled={!!answered} className="min-h-[44px] rounded-md border-2 border-dashed border-stone-500 px-2 text-left text-sm">d. もう二度と地球に帰れないなら〜に、もう〜に乗る。</button>
          </div>
          {dOpen && !answered && (
            <div className="flex flex-wrap items-center gap-1 rounded-sm bg-[#eef6fb] p-2 text-sm" data-testid="d-form">
              もう二度と地球に帰れないなら
              <select value={w1} onChange={(e) => setW1(e.target.value)} className="border border-stone-400 bg-white px-1">{D_WORDS.where.map((x) => <option key={x}>{x}</option>)}</select>に、もう
              <select value={w2} onChange={(e) => setW2(e.target.value)} className="border border-stone-400 bg-white px-1">{D_WORDS.ride.map((x) => <option key={x}>{x}</option>)}</select>に乗る。
              <button type="button" data-testid="d-go" onClick={declare} className="border-2 border-black bg-white px-2">宣言する</button>
            </div>)}
          {answered && <div className="space-y-2 text-sm" data-testid="why"><p><b>{q.right === 'a' ? 'a（SNS-iIIN）' : 'b（SNS-K）'}</b>：{q.why}</p>
            <div className="flex flex-wrap gap-2">{rides > 0 && <a href="/mente/aviator" className="underline">紙飛行機 aviator へ →</a>}<button type="button" data-testid="next" onClick={next} className="min-h-[44px] border-2 border-black bg-[#fff27a] px-4 font-semibold">{k + 1 < QUESTIONS.length ? '次の問題' : '結果へ'}</button></div></div>}
        </section>
      ) : (
        <section className="space-y-2 border-2 border-black bg-white p-3" data-testid="result">
          <p className="text-lg font-semibold">測定の結果：{score} / {QUESTIONS.length - rides - decl.length} 問 正解</p>
          <p className="text-sm">aviator に乗った回数 {rides}・宣言 {decl.length}</p>
          {decl.map((d) => <p key={d} className="text-sm">「{d}」</p>)}
          <button type="button" onClick={() => { setK(0); setScore(0); setRides(0); setDecl([]); setAnswered(null); ask(0); }} className="min-h-[44px] border-2 border-black bg-white px-4">もう一度</button>
        </section>
      )}
    </main>
  );
}
