'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SCREENS, STATUS_LABEL, TASKS, counts, type Status } from '@/lib/backlog';
import { NEVER, RECORD_KEYS, collect } from '@/lib/recordExport';

const COLOUR: Record<Status, string> = { done: '#86efac', doing: '#fde68a', todo: '#93c5fd', decide: '#f9a8d4' };
const ORDER: Status[] = ['decide', 'doing', 'todo', 'done'];

/** The to-do board: unfinished requests in columns by status, plus a map of every screen (meta view). */
export default function Backlog() {
  const [area, setArea] = useState<string | null>(null);
  const areas = [...new Set(TASKS.map((t) => t.area))];
  const shown = TASKS.filter((t) => !area || t.area === area); const c = counts(TASKS);
  return (
    <main className="min-h-screen bg-[#0b0d10] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-slate-400">LAB · やることボード</p>
            <h1 className="text-2xl font-semibold">まだ手を付けていない依頼のまとめ</h1>
            <p className="text-sm text-slate-300" data-testid="counts">済 {c.done} · 進行中 {c.doing} · まだ {c.todo} · 決めてほしい {c.decide}</p>
          </div>
          <nav className="font-mono text-xs"><Link href="/menu" className="border border-white/20 px-3 py-1">総合メニュー</Link></nav>
        </header>
        <div className="flex flex-wrap gap-1 font-mono text-xs">
          <button type="button" onClick={() => setArea(null)} className="rounded border px-2 py-1" style={{ borderColor: area ? '#ffffff33' : '#fff' }}>すべて</button>
          {areas.map((a) => <button key={a} type="button" onClick={() => setArea(a)} className="rounded border px-2 py-1" style={{ borderColor: area === a ? '#fff' : '#ffffff33' }}>{a}</button>)}
        </div>
        <div className="grid gap-3 md:grid-cols-4" data-testid="board">
          {ORDER.map((s) => (
            <section key={s} className="space-y-2 rounded border p-2" style={{ borderColor: `${COLOUR[s]}55` }}>
              <h2 className="font-mono text-xs" style={{ color: COLOUR[s] }}>{STATUS_LABEL[s]}（{shown.filter((t) => t.status === s).length}）</h2>
              {shown.filter((t) => t.status === s).map((t) => (
                <article key={t.id} className="rounded bg-white/[0.04] p-2 text-xs">
                  <p className="text-[10px] text-slate-400">{t.area} · {t.asked}</p>
                  <p>{t.route ? <Link href={t.route} className="underline decoration-white/30">{t.title}</Link> : t.title}</p>
                  {t.note && <p className="mt-1 text-slate-400">{t.note}</p>}
                </article>
              ))}
            </section>
          ))}
        </div>
        <section className="space-y-2 rounded border border-white/10 p-3 text-xs" aria-label="遊びの記録" data-testid="records">
          <h2 className="font-semibold">遊びの記録を書き出す（版に残すため）</h2>
          <p className="text-slate-400">このブラウザにだけある記録を JSON にして保存します。書き出すのは下の一覧のものだけで、{NEVER.join('・')} は書き出しません。公開のリポジトリに入れる前に、中身（紙飛行機のニックネームなど）を確かめてください。</p>
          <ul className="grid gap-0.5 sm:grid-cols-2">{RECORD_KEYS.map((r) => <li key={r.key}><span className="font-mono text-slate-500">{r.key}</span> — {r.what}</li>)}</ul>
          <button type="button" data-testid="export-records" onClick={() => {
            const file = collect('次の版', window.localStorage);
            const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
            const a = document.createElement('a'); a.href = url; a.download = `chartui-records-${file.exported.slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          }} className="rounded border border-amber-300/60 px-3 py-1 text-amber-200">記録を書き出す（{RECORD_KEYS.length} 種類まで）</button>
        </section>

        <section className="space-y-2" aria-label="画面の地図">
          <h2 className="font-semibold">画面の地図（メタ視点）</h2>
          <p className="text-xs text-slate-400">カーナビの切替スイッチや npm / pip の前に、画面のつながりを一望するための地図です。</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SCREENS.map((g) => (
              <div key={g.group} className="rounded border border-white/10 p-2 text-xs">
                <p className="mb-1 font-mono text-slate-400">{g.group}</p>
                <ul className="space-y-1">{g.routes.map(([href, name]) => <li key={href}><Link href={href} className="hover:underline">{name}</Link> <span className="font-mono text-[10px] text-slate-500">{href}</span></li>)}</ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
