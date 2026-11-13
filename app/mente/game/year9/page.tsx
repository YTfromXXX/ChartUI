'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ARM, COLOUR_DIE, LAPS, roll, type Roll, type Side } from '@/lib/craterDice';

const W = 640; const H = 360; const CX = W / 2; const CY = H / 2; const CELL = 44;
const xOf = (side: Side, pos: number) => (side === 'luna' ? CX - CELL * (ARM - pos) : CX + CELL * (ARM - pos));
const yJit = (fp: string) => ((parseInt(fp.slice(0, 2), 16) / 255) - 0.5) * 30;

/** One die: a square that spins 360°–720° while rolling (no spin with reduced motion). */
function Die({ face, colour, spin, label }: { face: number; colour: string; spin: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-[10px] text-stone-600">
      <div className="grid h-12 w-12 place-items-center border-2 border-[#1f1f1f] bg-white text-lg font-semibold" style={{ transform: `rotate(${spin}deg)`, transition: spin ? 'transform 600ms cubic-bezier(.2,.8,.2,1)' : 'none', color: colour }} aria-label={label}>
        {face > 0 ? face : <span className="h-6 w-6" style={{ background: colour }} />}
      </div>
      <span>{label}</span>
    </div>
  );
}

/** A small Archimedean spiral of 7 turns: where the aviator is (which lap). */
function Spiral({ lap }: { lap: number }) {
  const pts: string[] = []; for (let t = 0; t <= 7 * Math.PI * 2; t += 0.15) { const r = 4 + t * 2.4; pts.push(`${(60 + r * Math.cos(t)).toFixed(1)},${(60 + r * Math.sin(t)).toFixed(1)}`); }
  const t = (lap + 0.5) * Math.PI * 2; const r = 4 + t * 2.4;
  return <svg viewBox="0 0 120 120" className="h-24 w-24" aria-label={`螺旋の ${lap + 1} 周目`}><polyline points={pts.join(' ')} fill="none" stroke="#d6d3d1" /><circle cx={60 + r * Math.cos(t)} cy={60 + r * Math.sin(t)} r={4} fill="#c8001a" /></svg>;
}

/** Year 9, playable: フォン（仮）を操縦する Luna and Stoic decide steps and colours with dice; craters lead across the cross. */
export default function Year9() {
  const [lap, setLap] = useState(0);
  const [pos, setPos] = useState<Record<Side, number>>({ luna: 0, stoic: 0 });
  const [rolls, setRolls] = useState<Roll[]>([]);
  const [last, setLast] = useState<Record<Side, Roll | null>>({ luna: null, stoic: null });
  const [spin, setSpin] = useState<Record<Side, number>>({ luna: 0, stoic: 0 });
  const [busy, setBusy] = useState(false);
  const [crossed, setCrossed] = useState(false);
  const [heard, setHeard] = useState<number[]>([]);
  const timers = useRef<number[]>([]);
  const posRef = useRef<Record<Side, number>>({ luna: 0, stoic: 0 });
  const counter = useRef(0);
  const reduce = useRef(false);
  useEffect(() => { reduce.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; return () => timers.current.forEach((t) => window.clearTimeout(t)); }, []);
  const done = heard.length === LAPS.length;

  const throwDice = () => {
    if (busy || crossed || done) return;
    setBusy(true);
    const go = (side: Side, delay: number) => timers.current.push(window.setTimeout(() => {
      // Roll outside any state updater (updaters may run twice); each crater gets its own number.
      const r = roll(side, lap, counter.current, posRef.current[side]); counter.current += 1;
      posRef.current = { ...posRef.current, [side]: r.at };
      setRolls((rs) => [...rs, r]); setLast((l) => ({ ...l, [side]: r })); setPos(posRef.current);
      setSpin((sp) => ({ ...sp, [side]: reduce.current ? 0 : sp[side] + 360 + Math.floor(Math.random() * 360) }));
    }, delay));
    go('luna', 0); go('stoic', 700);
    timers.current.push(window.setTimeout(() => setBusy(false), 1300));
  };
  useEffect(() => { if (pos.luna >= ARM && pos.stoic >= ARM && !crossed) { setCrossed(true); setHeard((h) => (h.includes(lap) ? h : [...h, lap])); } }, [pos, crossed, lap]);
  const nextSpiral = () => { setCrossed(false); setLap((l) => Math.min(LAPS.length - 1, l + 1)); posRef.current = { luna: 0, stoic: 0 }; setPos(posRef.current); };
  const restart = () => { setLap(0); posRef.current = { luna: 0, stoic: 0 }; setPos(posRef.current); setRolls([]); setLast({ luna: null, stoic: null }); setCrossed(false); setHeard([]); };

  const unique = new Set(rolls.map((r) => r.outline.map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' '))).size;
  const col = (r: Roll | null) => (r ? COLOUR_DIE[r.side][r.colour].hex : '#d6d3d1');

  return (
    <main className="min-h-screen bg-white px-4 py-4 font-mono text-[#1f1f1f]">
      <div className="mx-auto max-w-4xl space-y-3">
        <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600">
          <span>イーサリアムの黄金のアイコンを探せ（仮）· 9 年目 · フォン（仮）を操縦する Luna</span>
          <span className="flex gap-3"><button type="button" onClick={restart} className="underline">最初から</button><Link href="/mente/game/years" className="underline">12 年の進行</Link><Link href="/mente/game" className="underline">タイトルへ</Link></span>
        </p>
        <header className="border-b border-stone-200 pb-2">
          <h1 className="text-lg">クレーターのサイコロ — 十字を横切って、次の螺旋へ</h1>
          <p className="text-xs text-stone-600">aviator が一周するたびに、Luna（あなた）とストイック（画面）が、歩数のサイコロと色のサイコロを振ります。落ちたサイコロは地面にクレーターを残し、同じ形はひとつもありません。二人が十字の真ん中に着くと、無線にフォンの言葉が届き、次の螺旋へ進みます。</p>
        </header>

        <div className="flex flex-wrap items-start gap-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[640px] border border-stone-300 bg-[#f3efe6]" aria-label="地面の十字とクレーター" data-testid="ground">
            <rect x={CX - CELL * ARM - 22} y={CY - 22} width={CELL * ARM * 2 + 44} height={44} fill="#e7e0d0" />
            <rect x={CX - 22} y={14} width={44} height={H - 28} fill="#e7e0d0" />
            {Array.from({ length: ARM }, (_, k) => [<circle key={`w${k}`} cx={xOf('luna', k)} cy={CY} r={2} fill="#a8a29e" />, <circle key={`e${k}`} cx={xOf('stoic', k)} cy={CY} r={2} fill="#a8a29e" />])}
            {rolls.map((r, i) => {
              // Landings on the centre spread along the vertical arm of the cross (north for Luna, south for Stoic).
              const onCentre = r.at >= ARM; const far = 40 + (parseInt(r.fp.slice(2, 4), 16) / 255) * 110;
              const x = onCentre ? CX + yJit(r.fp) * 0.4 : xOf(r.side, r.at); const y = onCentre ? CY + (r.side === 'luna' ? -far : far) : CY + yJit(r.fp); const old = r.lap < lap;
              const d = `M${r.outline.map(([px, py]) => `${(x + px).toFixed(1)} ${(y + py).toFixed(1)}`).join('L')}Z`;
              const inner = `M${r.outline.map(([px, py]) => `${(x + px * 0.55).toFixed(1)} ${(y + py * 0.55 + 2).toFixed(1)}`).join('L')}Z`;
              return <g key={i} opacity={old ? 0.35 : 1} data-testid="crater"><path d={d} fill={COLOUR_DIE[r.side][r.colour].hex} fillOpacity={0.18} stroke={COLOUR_DIE[r.side][r.colour].hex} strokeWidth={1.4} /><path d={inner} fill="#00000014" /><title>{`${r.side === 'luna' ? 'Luna' : 'ストイック'} · ${r.lap + 1} 周目 · 指紋 ${r.fp}`}</title></g>;
            })}
            <rect x={CX - 10} y={CY - 10} width={20} height={20} fill="none" stroke="#1f1f1f" strokeWidth={1.5} transform={`rotate(45 ${CX} ${CY})`} />
            <circle cx={xOf('luna', pos.luna) - (pos.luna >= ARM ? 12 : 0)} cy={CY - 26} r={7} fill={col(last.luna)} stroke="#1f1f1f" data-testid="token-luna" />
            <rect x={xOf('stoic', pos.stoic) - 7 + (pos.stoic >= ARM ? 12 : 0)} y={CY - 33} width={14} height={14} fill={col(last.stoic)} stroke="#1f1f1f" data-testid="token-stoic" />
            <text x={14} y={22} fontSize={11} fill="#57534e">西：Luna（フォンの操縦席）</text>
            <text x={W - 14} y={22} fontSize={11} fill="#57534e" textAnchor="end">東：ストイック（無線の前）</text>
          </svg>
          <div className="space-y-2 text-xs">
            <Spiral lap={lap} />
            <p data-testid="lap">{lap + 1} / {LAPS.length} 周目</p>
            <p data-testid="craters">クレーター {rolls.length} · 同じ形 {rolls.length - unique}</p>
          </div>
        </div>

        <section className="flex flex-wrap items-end gap-6" aria-label="サイコロ" data-testid="dice">
          <div className="flex gap-2"><Die face={last.luna?.steps ?? 0} colour="#1f1f1f" spin={spin.luna} label="Luna の歩数" /><Die face={0} colour={col(last.luna)} spin={spin.luna} label={last.luna ? COLOUR_DIE.luna[last.luna.colour].name : 'Luna の色'} /></div>
          <div className="flex gap-2"><Die face={last.stoic?.steps ?? 0} colour="#1f1f1f" spin={spin.stoic} label="ストイックの歩数" /><Die face={0} colour={col(last.stoic)} spin={spin.stoic} label={last.stoic ? COLOUR_DIE.stoic[last.stoic.colour].name : 'ストイックの色'} /></div>
          {!crossed && !done && <button type="button" data-testid="throw" onClick={throwDice} disabled={busy} className="border border-[#1f1f1f] bg-[#1f1f1f] px-4 py-2 text-sm text-white disabled:opacity-50">サイコロを振る</button>}
        </section>

        {heard.length > 0 && (
          <section className="space-y-2" aria-live="polite" data-testid="radio">
            {heard.map((k) => (
              <div key={k} className="border-l-4 pl-3 text-sm" style={{ borderColor: k === LAPS.length - 1 ? '#d63384' : '#1f1f1f' }}>
                <p><span className="text-[11px] text-stone-500">{k + 1} 周目 · {k === LAPS.length - 1 ? 'Luna（そのままの声）' : 'フォン（無線）'}　</span>「{LAPS[k].fon}」</p>
                <p className="text-stone-600"><span className="text-[11px] text-stone-500">ストイック　</span>{LAPS[k].reply.startsWith('（') ? LAPS[k].reply : `「${LAPS[k].reply}」`}</p>
              </div>
            ))}
          </section>
        )}
        {crossed && !done && <button type="button" data-testid="next-spiral" onClick={nextSpiral} className="border border-[#1f1f1f] px-4 py-1 text-sm">十字を横切る → 次の螺旋へ</button>}
        {done && (
          <section className="space-y-2 border border-stone-200 bg-[#fafaf9] p-3 text-sm" data-testid="ending">
            <p><span className="text-[11px] text-stone-500">アリミノガール（語り）　</span>その夜、ストイックは布を外さなかった。けれど、布の端を、少しだけ折り返した。決めるのは自分だと、言われたからだった。</p>
            <p className="text-xs text-stone-600">地面には {rolls.length} 個のクレーターが残った。同じ形は {rolls.length - unique} 個。どのクレーターも、二人がその周に選んだ色で縁どられている。</p>
          </section>
        )}
        <footer className="border-t border-stone-200 pt-2 text-[11px] text-stone-600">
          架空の物語です。フォン（仮）は島の考える機械で、実在の人物を演じるものではありません。サイコロは遊びのためのもので、賭けではありません。
        </footer>
      </div>
    </main>
  );
}
