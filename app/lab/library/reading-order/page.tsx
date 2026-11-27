'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BOOKS, VOICES, flips, interview, read, vote, type BookId } from '@/lib/readingOrder';

const ORDERS: [BookId, BookId][] = [['neuromancer', 'snowcrash'], ['snowcrash', 'neuromancer']];
const VOTE_KEY = 'chartui-reading-order-vote-v1';

/** Opinion after book 1 and after book 2, for one voice and one order. */
function Track({ order, voice }: { order: [BookId, BookId]; voice: (typeof VOICES)[number] }) {
  const r = read(voice, order); const y = (v: number) => 70 - v * 60;
  const pts = (b: BookId) => (b === order[0] ? [[20, y(r.after1)], [110, y(r.after2[b])]] : [[110, y(r.after2[b])]]);
  return (
    <svg viewBox="0 0 130 80" className="h-20 w-32">
      <line x1="10" x2="125" y1="70" y2="70" stroke="#ffffff22" />
      {(['neuromancer', 'snowcrash'] as BookId[]).map((b) => { const p = pts(b); return (
        <g key={b}>{p.length > 1 && <line x1={p[0][0]} y1={p[0][1]} x2={p[1][0]} y2={p[1][1]} stroke={BOOKS[b].profile.colour} strokeWidth="2" />}
          {p.map(([x, yy], i) => <circle key={i} cx={x} cy={yy} r="3.5" fill={BOOKS[b].profile.colour} />)}</g>
      ); })}
      <text x="20" y="79" fontSize="7" textAnchor="middle" fill="#94a3b8">1 冊目</text><text x="110" y="79" fontSize="7" textAnchor="middle" fill="#94a3b8">2 冊目</text>
    </svg>
  );
}

/**
 * "Which book first?" — Nancy, Grace and Roman (the three voices of the Roman space telescope)
 * vote, read in both orders, and say how their minds changed. Mente hosts the interview.
 */
export default function ReadingOrder() {
  const [order, setOrder] = useState(0);
  const [mine, setMine] = useState<BookId | null>(null);
  const [step, setStep] = useState(0);
  const lines = useMemo(() => interview(ORDERS[order]), [order]);
  useEffect(() => { try { setMine(window.localStorage.getItem(VOTE_KEY) as BookId | null); } catch { /* ignore */ } }, []);
  useEffect(() => { setStep(0); const id = window.setInterval(() => setStep((s) => s + 1), 1400); return () => window.clearInterval(id); }, [order]);
  const cast = (b: BookId) => { setMine(b); try { window.localStorage.setItem(VOTE_KEY, b); } catch { /* ignore */ } };
  const tally = (b: BookId) => VOICES.filter((v) => vote(v) === b).length + (mine === b ? 1 : 0);
  const shown = lines.slice(0, Math.min(lines.length, step + 1));
  const colour = (who: string) => VOICES.find((v) => v.ja === who)?.spaceColour ?? '#e9d5ff';

  return (
    <main className="min-h-screen bg-[#07060c] px-4 py-6 text-slate-100">
      <style>{`@keyframes dolly { 0% { transform: scale(1.18); letter-spacing: .02em } 100% { transform: scale(1); letter-spacing: .12em } }
        @keyframes rays { 0% { background-size: 30% 30% } 100% { background-size: 160% 160% } }
        @media (prefers-reduced-motion: reduce) { .dolly, .rays { animation: none !important } }`}</style>
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-slate-400">LAB · 図書館 · どちらを先に読む？</p>
            <h1 className="text-2xl font-semibold">ナンシー・グレース・ローマンの投票と、順番による心変わり</h1>
            <p className="max-w-3xl text-sm text-slate-300">ローマン宇宙望遠鏡の名前を 3 人の声に分けた、架空の登場人物です（望遠鏡の名の由来の天文学者ナンシー・グレース・ローマン博士ご本人ではありません）。『ニューロマンサー』（ギブスン、1984）と『スノウ・クラッシュ』（スティーヴンスン、1992）を両方の順番で読み、Mente が宇宙の色の言葉でインタビューします。順番で好きな本が入れ替わった人には、引きのズーム（ヒッチコック効果）がかかります。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/lab/library/entrance" className="border border-white/20 px-3 py-1">図書館の入口</Link><Link href="/lab/backlog" className="border border-white/20 px-3 py-1">やることボード</Link></nav>
        </header>

        <section className="flex flex-wrap items-center gap-3 rounded border border-white/10 p-3 text-sm" data-testid="vote">
          <span>あなたの一票（先に読むなら）：</span>
          {(['neuromancer', 'snowcrash'] as BookId[]).map((b) => (
            <button key={b} type="button" data-testid={`vote-${b}`} onClick={() => cast(b)} className="rounded border px-3 py-1" style={{ borderColor: BOOKS[b].profile.colour, background: mine === b ? `${BOOKS[b].profile.colour}33` : 'transparent' }}>
              『{BOOKS[b].ja}』 {tally(b)} 票
            </button>
          ))}
          <span className="text-xs text-slate-400">3 人の票＋あなた</span>
        </section>

        <div className="grid gap-3 sm:grid-cols-3">
          {VOICES.map((v) => { const f = flips(v); return (
            <div key={v.id} className="rounded border p-3 text-xs" style={{ borderColor: `${v.spaceColour}66` }} data-testid={`voice-${v.id}`}>
              <p className="text-base font-semibold" style={{ color: v.spaceColour }}>{v.ja}</p>
              <p className="text-slate-400">{v.band} · {v.primacy > 0 ? '最初の印象が残る' : '最後に読んだ本が勝つ'}</p>
              <div className="mt-2 flex gap-2">{ORDERS.map((o, i) => <div key={i}><p className="text-[10px] text-slate-500">{BOOKS[o[0]].ja.slice(0, 4)}…先</p><Track order={o} voice={v} /></div>)}</div>
              <p className="mt-1">{f.flip ? `順番で心変わり：${BOOKS[f.nFirst.prefers].ja} ↔ ${BOOKS[f.sFirst.prefers].ja}` : `どちらの順でも『${BOOKS[f.nFirst.prefers].ja}』`}</p>
            </div>
          ); })}
        </div>

        <div className="flex flex-wrap gap-2 font-mono text-xs">
          {ORDERS.map((o, i) => <button key={i} type="button" data-testid={`order-${i}`} onClick={() => setOrder(i)} className="rounded border px-3 py-1" style={{ borderColor: order === i ? '#e9d5ff' : '#ffffff33' }}>インタビュー：『{BOOKS[o[0]].ja}』→『{BOOKS[o[1]].ja}』</button>)}
          <button type="button" onClick={() => setStep(lines.length)} className="rounded border border-white/20 px-3 py-1">全部表示</button>
        </div>

        <ol className="space-y-2" data-testid="script">
          {shown.map((l, i) => (
            <li key={`${order}-${i}`} className={`relative overflow-hidden rounded border p-3 ${l.zoom ? 'rays' : ''}`}
              style={{ borderColor: `${colour(l.who)}55`, ...(l.zoom ? { backgroundImage: `repeating-conic-gradient(from 0deg at 50% 50%, ${colour(l.who)}14 0deg 4deg, transparent 4deg 12deg)`, backgroundPosition: 'center', backgroundRepeat: 'no-repeat', animation: 'rays 1.6s ease-out both' } : {}) }}>
              <span className="mr-2 font-mono text-xs" style={{ color: colour(l.who) }}>{l.who}</span>
              <span className={l.zoom ? 'dolly inline-block origin-left' : ''} style={l.zoom ? { animation: 'dolly 1.6s ease-out both' } : undefined}>{l.text}</span>
            </li>
          ))}
        </ol>
        <p className="text-xs text-slate-500">本文は引用していません。点数は好み（雰囲気・遊び・思想）と記憶のくせ（最初の印象か、最後の一冊か）から計算した遊びの数字です。</p>
      </div>
    </main>
  );
}
