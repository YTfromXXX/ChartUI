'use client';

import { useState } from 'react';
import { CARDS, faction, measure, toSymbols, type Pick } from '@/lib/arcanaParams';

const GEO = '#2b3a67'; const SEM = '#8b0000';

/** Card 0 worked out: A and B read both ways. */
const READINGS: { sym: string; geo: string; sem: string }[] = [
  { sym: '.', geo: '点 — 部分を持たないもの（ユークリッド『原論』第 1 巻・定義 1）', sem: '短い合図。それだけでは意味がなく、決まり（コード）が意味を与える' },
  { sym: '-', geo: '線 — 幅のない長さ（定義 2）。点の 3 倍の長さ', sem: '長い合図。点との違い（差）だけが意味になる' },
  { sym: '=', geo: '二本の平行線 — どこまで伸ばしても交わらない', sem: '「同じ」の記号。続けると、音が伸びる' },
  { sym: '‖ ||', geo: '平行の印。図形の端（境界）', sem: '枠の終わり。楽譜の終止線と同じ働き' },
  { sym: '{}', geo: '境界に囲まれた図形（定義 13・14）。中は空', sem: '空の枠 — 意味のある沈黙' },
  { sym: '/', geo: '傾いた線 — 角をつくる', sem: '区切り。文字と文字のあいだ' },
  { sym: '*', geo: '一点から出る何本もの線（星形）', sem: '外からの一打。注のしるし' },
];

export default function Arcana() {
  const [picks, setPicks] = useState<Pick[]>(() => CARDS.map(() => null));
  const [measured, setMeasured] = useState<(0 | 1)[] | null>(null);
  const set = (k: number, v: Pick) => { setMeasured(null); setPicks((ps) => ps.map((p, i) => (i === k ? v : p))); };
  const open = picks.filter((p) => p === null).length;
  const bits = measured;
  const sym = bits ? toSymbols(bits) : '';
  const f = bits ? faction(bits) : null;
  const href = `/mente/game/textbox?A=${encodeURIComponent('-----./ ===')}&B=${encodeURIComponent(sym)}`;

  return (
    <main className="mx-auto max-w-3xl space-y-4 bg-[#faf7f2] p-4 text-[#1f1f1f]">
      <header className="space-y-1">
        <p className="text-xs text-stone-500">二択パラメーター（22 アルカナ的）</p>
        <h1 className="text-xl font-bold">クオンタムパンクの動向を探る</h1>
        <p className="text-sm">22 枚の札に、一つずつ二択がある。左は<span style={{ color: GEO }}>幾何（解読）</span>、右は<span style={{ color: SEM }}>記号学（解体）</span>。選ばない札は「重ね合わせ」のまま残り、最後に測ると決まる。22 の答えは、新しい自由な記号になる。</p>
        <p className="text-[11px] text-stone-500">クオンタムパンクは、このゲームの中の架空の人たち。占いや投資の助言ではない。</p>
      </header>

      <section className="space-y-1 border border-stone-400 bg-white p-3 text-xs" data-testid="readings">
        <p className="font-semibold">札 0 を解いてみる：A <code>-----./ ===</code>・B <code>../..{'{}{}'}./../../|| ‖‖ {'}'}./ * ////</code></p>
        <div className="grid grid-cols-[3rem_1fr_1fr] gap-x-2 gap-y-1">
          <span /><span className="font-semibold" style={{ color: GEO }}>幾何で解読</span><span className="font-semibold" style={{ color: SEM }}>記号学で解体</span>
          {READINGS.map((r) => <div key={r.sym} className="contents"><code className="font-mono">{r.sym}</code><span>{r.geo}</span><span>{r.sem}</span></div>)}
        </div>
        <p className="pt-1">→ 答え：<b>どちらも可能</b>。幾何で読むと、A は「線 5 本と点 1 つ、平行線 3 組」の図形、B は「点ばかりの星座」。記号学で読むと、A は「0（と E）」、B は「I I E I I E」。違いは、意味を図形の中に探すか、決まりの中に探すか。</p>
      </section>

      <ol className="grid gap-2 sm:grid-cols-2" data-testid="cards">
        {CARDS.map((c, k) => (
          <li key={c.no} className="space-y-1 border border-stone-300 bg-white p-2 text-xs" data-testid={`card-${c.no}`}>
            <p className="font-semibold"><span className="font-mono text-stone-500">{String(c.no).padStart(2, '0')}</span> {c.name}{picks[k] === null && <span className="ml-1 text-stone-400">（重ね合わせ）</span>}</p>
            <div className="flex gap-1">
              <button type="button" data-testid={`pick-${c.no}-0`} onClick={() => set(k, picks[k] === 0 ? null : 0)} className="flex-1 border px-1 py-0.5 text-left" style={{ borderColor: GEO, background: picks[k] === 0 ? '#eef1f8' : 'white', color: GEO }}>{c.left}</button>
              <button type="button" data-testid={`pick-${c.no}-1`} onClick={() => set(k, picks[k] === 1 ? null : 1)} className="flex-1 border px-1 py-0.5 text-left" style={{ borderColor: SEM, background: picks[k] === 1 ? '#fff1f2' : 'white', color: SEM }}>{c.right}</button>
            </div>
            <p className="text-[10px] text-stone-500">{c.note}</p>
          </li>))}
      </ol>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button type="button" data-testid="measure" onClick={() => setMeasured(measure(picks))} className="border-2 border-black bg-white px-4 py-1 font-semibold">測る（残り {open} 枚の重ね合わせを決める）</button>
      </div>

      {bits && f && (
        <section className="space-y-1 border-2 border-black bg-white p-3 text-xs shadow-[4px_4px_0_#0003]" data-testid="result">
          <p className="inline-block bg-black px-1.5 text-[10px] font-bold italic text-white">MENTE · 測定</p>
          <p className="font-mono">{bits.join('')}（幾何 {bits.filter((b) => b === 0).length}・記号 {bits.filter((b) => b === 1).length}{open ? `・測って決まった ${open}` : ''}）</p>
          <p className="text-sm font-semibold">{f.name}</p>
          <p>{f.text}</p>
          <p>自由になった記号：<code className="font-mono" data-testid="free-symbols">{sym}</code></p>
          <a href={href} className="inline-block border border-stone-500 px-2 py-0.5" data-testid="to-textbox">TEXTBOX の B に入れて、鳴らす →</a>
        </section>)}
    </main>
  );
}
