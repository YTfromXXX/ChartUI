'use client';

import Link from 'next/link';
import { BOOKS, PLATEAUS } from '@/LAB/library/books';

export default function LibraryPage() {
  return (
    <main className="min-h-screen bg-[#f4f1ec] px-4 py-6 font-mono text-stone-900 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-stone-300 pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-stone-500">./LAB / ./library · 博物館の隣</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-wide">図書館 — ドゥルーズ＝ガタリ</h1>
          </div>
          <nav className="flex gap-3 text-xs">
            <Link href="/lab/colorcube" className="hover:underline">← 博物館</Link>
            <Link href="/menu" className="hover:underline">ホワイトアウト版</Link>
          </nav>
        </header>

        <section className="grid gap-4 sm:grid-cols-2" aria-label="Books">
          {BOOKS.map((book) => (
            <article key={book.id} className="flex gap-3 border border-stone-300 bg-white p-3">
              <div className="w-14 shrink-0 bg-gradient-to-b from-[#7a0f22] to-[#3b0710] p-1 text-[9px] text-white [writing-mode:vertical-rl]">{book.title} · {book.year}</div>
              <div className="space-y-2">
                <p className="text-sm font-semibold">{book.title} <span className="text-stone-500">{book.year}</span></p>
                <p className="text-[10px] italic text-stone-500">{book.original}</p>
                <ul className="space-y-1 text-[11px]">
                  {book.glosses.map((g) => (
                    <li key={g.concept}><span className="font-semibold">{g.concept}</span> — {g.gloss}{g.link && <> · <Link href={g.link} className="text-[#7a0f22] hover:underline">→</Link></>}</li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </section>

        <section aria-label="Plateaus" className="space-y-2">
          <h2 className="text-sm font-semibold">『千のプラトー』の 15 のプラトー ⇄ 15 のループ・マス</h2>
          <p className="text-[11px] text-stone-600">ハニカムの 7（銀河 6 ＋ 特異点 1）の外を回る 15 マスに、15 のプラトーを 1 つずつ置く。書名・章題は書誌情報、右列は ChartUI 側の読み替え。</p>
          <ol className="grid gap-1 sm:grid-cols-3">
            {PLATEAUS.map((p) => (
              <li key={p.no} className="border border-stone-300 bg-white p-2 text-[10px]">
                <p className="text-stone-500">{p.no} · {p.date}</p>
                <p className="font-semibold">{p.title}</p>
                <p className="text-[#7a0f22]">→ {p.chartui}</p>
              </li>
            ))}
          </ol>
        </section>
        <p className="text-[9px] text-stone-500">邦題・章題は一般的な日本語訳に基づく表記。本文の引用は含まない。</p>
      </div>
    </main>
  );
}
