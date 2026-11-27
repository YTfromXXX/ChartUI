'use client';

import { useEffect, useRef } from 'react';
import { FOUR_IMAGES, readLines } from '@/lib/iching';
import { STATIONS, type GameState } from '@/lib/gaikotsu';
import { cipher } from '@/lib/retroBlocks';

// The four countries: the 22-station loop split into four arcs (6 + 5 + 6 + 5).
const COUNTRIES = [
  { image: FOUR_IMAGES[0], from: 0, to: 5 },
  { image: FOUR_IMAGES[1], from: 6, to: 10 },
  { image: FOUR_IMAGES[2], from: 11, to: 16 },
  { image: FOUR_IMAGES[3], from: 17, to: 21 },
];
const RETRACE = [0.236, 0.382, 0.5, 0.618, 0.786];

/** Candies falling from the meso layer: one per line cast; they keep trembling, waiting for the next command. */
function CandyRain({ yao, waiting }: { yao: (0 | 1)[]; waiting: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ yao, waiting, born: [] as number[] });
  live.current.yao = yao; live.current.waiting = waiting;
  while (live.current.born.length < yao.length) live.current.born.push(typeof performance === 'undefined' ? 0 : performance.now());

  useEffect(() => {
    const canvas = ref.current; const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return undefined;
    const W = 320; const H = 200; const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let raf = 0;
    const frame = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      const { yao: lines, waiting: wait, born } = live.current;
      const start = Math.max(0, lines.length - 48);
      const heights = new Array(12).fill(0);
      for (let i = start; i < lines.length; i += 1) {
        const col = cipher(7, i, 384) % 12;
        const restY = H - 10 - heights[col] * 14; heights[col] += 1;
        const fall = reduced ? 1 : Math.min(1, (now - born[i]) / 900);
        const y = -12 + (restY + 12) * (1 - (1 - fall) ** 3);
        const amp = (wait ? 1.6 : 0.5) * (reduced ? 0 : 1);
        const x = 14 + col * 25 + Math.sin(now / 45 + i * 1.7) * amp;
        const yy = y + Math.cos(now / 38 + i) * amp;
        const shade = lines[i] ? 245 : 120;
        ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
        ctx.beginPath(); ctx.moveTo(x - 6, yy); ctx.lineTo(x - 11, yy - 4); ctx.lineTo(x - 11, yy + 4); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 6, yy); ctx.lineTo(x + 11, yy - 4); ctx.lineTo(x + 11, yy + 4); ctx.fill();
        ctx.beginPath(); ctx.arc(x, yy, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = lines[i] ? '#000' : '#fff'; ctx.lineWidth = 1; ctx.beginPath();
        for (let k = 0; k < 18; k += 1) { const a = k * 0.6 + now / 600; const r = k / 3.2; ctx.lineTo(x + r * Math.cos(a), yy + r * Math.sin(a)); }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '10px monospace';
      ctx.fillText(wait ? 'メソ層 · 次のコマンドを待っている' : 'メソ層', 6, 12);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} width={320} height={200} className="w-full border-2 border-white" aria-label={`${yao.length} candies, white = yang, gray = yin`} role="img" />;
}

/** Split-screen pane: the default story for the packaged 髑髏電鉄, read live from the game. */
export default function DokuroStory({ game }: { game: GameState }) {
  const reading = readLines(game.yao);
  const waiting = game.current === 'you' && game.phase !== 'over';
  const series = game.history.map((h) => h.you);
  const lo = Math.min(...series); const hi = Math.max(...series);
  const span = Math.max(1, hi - lo);
  const up = series[series.length - 1] >= series[0];
  const projection = Math.round(up ? lo + 1.618 * span : hi - 1.618 * span);
  const px = (i: number) => 4 + (i / Math.max(1, series.length - 1)) * 292;
  const py = (v: number) => 96 - ((v - lo) / span) * 88;

  return (
    <aside aria-label="Default story" className="space-y-4 border-4 border-white p-3 text-[11px] leading-5">
      <header>
        <p className="text-[10px] uppercase tracking-[0.3em] text-white/60">package · default story</p>
        <p className="text-xl font-black tracking-[0.2em]">『髑髏電鉄』</p>
        <p className="font-bold">ダイナマイト四国 —— 陰陽の四面楚歌</p>
      </header>

      <div className="space-y-2">
        <p>はじめに一つの国があった。名を太極という。骨の線路が一本、国を一周していた。</p>
        <p>ある年、国は陰と陽に割れ（両儀）、さらに四つに割れた（四象）。老陽・少陰・少陽・老陰。四つの国はどれも、残る三つの国の歌に囲まれて眠る —— 四面楚歌。</p>
        <p>駅を買い、通行料を取り、悪魔を乗せて走るたび、サイコロは一本の爻を落とす。六本で一つの卦、六十四の卦で三百八十四の爻。線路は 384 の軸の上を回り続ける。</p>
        <p>線を守れなかった国は夭折する。その駅は灯を落とし、次の周回で別の名を得て戻ってくる。</p>
      </div>

      <section aria-label="Four countries">
        <p className="mb-1 font-bold">四つの国（四象）</p>
        <ul className="space-y-1">
          {COUNTRIES.map((c) => {
            const ids = STATIONS.filter((st) => st.id >= c.from && st.id <= c.to && st.kind === 'property').map((st) => st.id);
            const you = ids.filter((id) => game.owner[id] === 'you').length;
            const obaa = ids.filter((id) => game.owner[id] === 'obaa').length;
            const early = game.players.you.laps >= 2 && you + obaa === 0;
            return (
              <li key={c.image.key} className="border border-white/30 px-2 py-1">
                <span className="font-bold">{c.image.name}</span> <span className="text-white/60">駅 {c.from}–{c.to} · {c.image.note}</span>
                <br />哲学派 {you} · 貨幣派 {obaa} / 物件 {ids.length}{' '}
                {early ? <span className="bg-white px-1 text-black">夭折</span> : you > obaa ? '→ 哲学の国' : obaa > you ? '→ 貨幣の国' : '→ 拮抗'}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="384 axis">
        <p className="mb-1 font-bold">384 の軸（易の爻）</p>
        <div className="flex items-end gap-3">
          <div className="flex w-16 flex-col-reverse gap-1" aria-label="current hexagram">
            {Array.from({ length: 6 }, (_, i) => {
              const v = reading.lines[i];
              if (v === undefined) return <span key={i} className="h-1.5 border border-dashed border-white/30" />;
              return v ? <span key={i} className="h-1.5 bg-white" /> : <span key={i} className="flex h-1.5 gap-2"><span className="flex-1 bg-white/70" /><span className="flex-1 bg-white/70" /></span>;
            })}
          </div>
          <div>
            <p>爻 {game.yao.length} 本 · 軸の位置 {reading.axis} / 384（スパイラルキャンディ #{reading.axis}）</p>
            <p>下卦 {reading.lower ? `${reading.lower.glyph} ${reading.lower.name}（${reading.lower.image}）` : '—'} · 上卦 {reading.upper ? `${reading.upper.glyph} ${reading.upper.name}（${reading.upper.image}）` : '—'}{reading.binary !== undefined ? ` · 二進 ${reading.binary}` : ''}</p>
            <p className="text-white/80">{reading.latest ?? 'サイコロを振ると最初の爻（初爻）が落ちる'}</p>
          </div>
        </div>
      </section>

      <section aria-label="Fibonacci chart">
        <p className="mb-1 font-bold">チャート一本（哲学派の資産）とフィボナッチ</p>
        <svg viewBox="0 0 300 100" className="w-full border border-white/40">
          {RETRACE.map((r) => {
            const v = up ? hi - r * span : lo + r * span;
            return <g key={r}><line x1={0} x2={300} y1={py(v)} y2={py(v)} stroke="rgba(255,255,255,.25)" strokeDasharray="2 3" /><text x={298} y={py(v) - 1} textAnchor="end" fontSize={6} fill="rgba(255,255,255,.6)">{(r * 100).toFixed(1)}%</text></g>;
          })}
          <polyline points={series.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ')} fill="none" stroke="#fff" strokeWidth={1.4} />
        </svg>
        <p>高値 {hi} · 安値 {lo} · 予測距離（161.8%）→ {projection} 骨貨（{up ? '上' : '下'}方向）</p>
      </section>

      <section aria-label="Candy rain">
        <p className="mb-1 font-bold">メソ層から降り注ぐキャンディー（白＝陽・灰＝陰）</p>
        <CandyRain yao={game.yao} waiting={waiting} />
      </section>
    </aside>
  );
}
