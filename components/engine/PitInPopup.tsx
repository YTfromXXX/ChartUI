'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CARS, readCar, readEngineInputs } from '@/lib/engineMenu';
import { SynthApi } from '@/lib/famiDance';
import { META_RELATIVE_ANALYSIS, createFieldSimulator } from '@/lib/fieldModels';
import { USD_AXIS_CHOICES, crossCheck, toUsdStrength, type FxPair } from '@/lib/fxOrientation';
import { SYNTHETIC_INDEX_DEFINITIONS } from '@/lib/marketCatalog';
import { LANE, PIT_SQUARE, SQUARES, at, corrFriction, cruisingRange, distanceToTrack, makeTrack, squareAt, squareSymbol, stadium, stepCpu, type CpuState } from '@/lib/pitIn';

/**
 * new-cpu-pit-in — the emergency event popup. The Cure-API B car (USD axis) drives the sugoroku
 * line exactly; a CPU car runs beside it on a parallel lane and pits when it could not finish
 * another lap. Around the B car a symbol sonar pings the USD-axis pair (EURUSD or JPYUSD, in place
 * of the former BTCUSD slot), the METACRASH index, the animal index and the CPU. The KING & QUEEN
 * keyhole's three reels must show the squares the B car passed. A self-test panel checks every
 * invariant live, including the FX orientation cross-check.
 */
const W = 620; const H = 300;
const CAR_B = CARS[1];
type Sym = 'FX' | 'META' | 'ANIMAL' | 'CPU';
const SYMS: Sym[] = ['FX', 'META', 'ANIMAL', 'CPU'];
const SYM_COLOR: Record<Sym, string> = { FX: '#00e5ff', META: '#ffcc00', ANIMAL: '#3dff8f', CPU: '#e040fb' };
const SYM_ANGLE: Record<Sym, number> = { FX: -Math.PI / 2, META: 0, ANIMAL: Math.PI / 2, CPU: Math.PI };

export default function PitInPopup({ onClose }: { onClose: () => void }) {
  const [pair, setPair] = useState<Exclude<FxPair, 'USDJPY'>>('EURUSD');
  const track = useMemo(() => makeTrack(stadium(W / 2, H / 2 - 6, 175, 92)), []);
  const sim = useRef({
    sB: 0, fuelB: 100, cpu: { s: 0, fuel: 100, pit: null, pits: 0 } as CpuState, last: 0, passed: [] as number[], reelSpin: 0, reelPos: 0, reels: [] as string[], reelMismatch: 0,
    series: { FX: [], META: [], ANIMAL: [], CPU: [], USDJPY: [] } as Record<Sym | 'USDJPY', number[]>, lastSample: 0,
    meta: createFieldSimulator('meta', 7), animal: createFieldSimulator('animal', 7), cpuApi: new SynthApi(77, 50),
    worstOnLine: 0, worstLane: 0, dry: false, pingAt: 0,
  });
  const [, setFrame] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    dialog.current?.querySelector<HTMLElement>('select, button')?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const inputs = readEngineInputs();
    const rB = readCar(CAR_B, inputs.poses.USD, inputs.feed); const rCpu = readCar(CARS[3], inputs.poses.CPU, inputs.feed);
    const S = sim.current; let raf = 0; S.last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - S.last) / 1000); S.last = now;
      // B car: pace from the engine's B reading, always exactly on the line.
      const ds = (reduce.current ? 30 : 46 + rB.speed * 1.5) * dt;
      const before = squareAt(track, S.sB); S.sB += ds; const after = squareAt(track, S.sB);
      if (after !== before) {
        // Every square crossed this frame (a fast frame may cross more than one).
        const steps = (after - before + SQUARES) % SQUARES;
        for (let k = 1; k <= steps; k += 1) S.passed = [...S.passed, (before + k) % SQUARES].slice(-3);
        // The reels run on their own strip counter; they must land on the same symbols.
        S.reelPos += steps; S.reels = [...S.reels, squareSymbol(S.reelPos)].slice(-3);
        if (S.reels[S.reels.length - 1] !== squareSymbol(after)) S.reelMismatch += 1;
        S.reelSpin = now; if (after === PIT_SQUARE) S.fuelB = 100;
      }
      S.fuelB = Math.max(0, S.fuelB - (cruisingRange(S.fuelB, rB.params.sigma).perSquare * ds) / (track.length / SQUARES));
      S.cpu = stepCpu(S.cpu, track, ds, rCpu.params.sigma, now);
      if (S.cpu.fuel <= 0) S.dry = true;
      // Live invariants.
      const gB = at(track, S.sB); S.worstOnLine = Math.max(S.worstOnLine, distanceToTrack(track, gB.p));
      if (!S.cpu.pit) { const gC = at(track, S.cpu.s); const lane = { x: gC.p.x + gC.n.x * LANE, y: gC.p.y + gC.n.y * LANE }; S.worstLane = Math.max(S.worstLane, Math.abs(distanceToTrack(track, lane) - LANE)); }
      // Sonar inputs: sample the synthetic fields every 250 ms.
      if (now - S.lastSample > 250) {
        S.lastSample = now; const t = Date.now();
        const m = S.meta(t); const a = S.animal(t);
        const assets = m.diagnostics?.metaRelativeAssets ?? [];
        const eur = assets.find((x) => x.symbol === 'EURUSD')?.normalizedIndex; const jpy = assets.find((x) => x.symbol === 'USDJPY')?.normalizedIndex;
        if (eur && jpy) {
          S.series.USDJPY.push(jpy);
          // The USD axis reads USD strength: EURUSD and JPYUSD both turn upside down (1 / price).
          const price = pair === 'EURUSD' ? eur : 1 / jpy; // JPYUSD = 1 / USDJPY
          S.series.FX.push(toUsdStrength(pair, [price])[0]);
        }
        S.series.META.push(m.tick.price); S.series.ANIMAL.push(a.tick.price);
        S.cpuApi.nextBeat(rCpu.params); S.series.CPU.push(S.cpuApi.price);
        for (const k of Object.keys(S.series) as (Sym | 'USDJPY')[]) if (S.series[k].length > 160) S.series[k].shift();
      }
      setFrame((f) => (f + 1) % 1e6);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey); };
  }, [track, onClose, pair]);

  const S = sim.current; const now = typeof performance === 'undefined' ? 0 : performance.now();
  const gB = at(track, S.sB); const gC = at(track, S.cpu.s);
  const cpuPos = S.cpu.pit ? { x: track.pts[0].x + 10, y: track.pts[0].y + 34 } : { x: gC.p.x + gC.n.x * LANE, y: gC.p.y + gC.n.y * LANE };
  const fr = (a: Sym, b: Sym) => corrFriction(S.series[a], S.series[b]);
  const rangeB = cruisingRange(S.fuelB, 0.5).squares; const rangeC = cruisingRange(S.cpu.fuel, 0.5).squares;
  const expectedReels = S.passed.map(squareSymbol);
  const spinning = !reduce.current && now - S.reelSpin < 350;
  const checks = useMemo(() => crossCheck([
    { name: 'fieldModels（METACRASH）', rows: META_RELATIVE_ANALYSIS.assets.map((x) => ({ symbol: x.symbol, dir: x.usdDirection })) },
    { name: 'marketCatalog（META 指数）', rows: SYNTHETIC_INDEX_DEFINITIONS.META_RELATIVE_BASKET.constituents.map((x) => ({ symbol: x.symbol, dir: x.currencyDirection })) },
  ], S.series.USDJPY.length > 3 ? S.series.USDJPY : [150, 150.5, 149.9]), [S.series.USDJPY.length > 3]); // eslint-disable-line react-hooks/exhaustive-deps
  const live = [
    { name: 'B 車は双六ラインの上', ok: S.worstOnLine < 1e-6, detail: `最大ずれ ${S.worstOnLine.toExponential(1)} px` },
    { name: 'CPU は並走レーン（幅 14）', ok: S.worstLane < 0.05, detail: `誤差 ${S.worstLane.toFixed(3)} px` },
    { name: 'リールが通ったマスと一致', ok: S.reelMismatch === 0 && S.reels.join() === expectedReels.slice(-S.reels.length).join(), detail: `リール ${S.reels.join(' ') || '—'} ／ マス ${expectedReels.join(' ') || '—'}` },
    { name: 'CPU は燃料切れにならない', ok: !S.dry, detail: `ピットイン ${S.cpu.pits} 回` },
  ];
  const allChecks = [...live, ...checks];
  const ping = reduce.current ? 0.6 : ((now / 1200) % 1);
  const sonarR = 70;

  return (
    <div className="fixed inset-0 z-[97] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm" onClick={onClose}>
      <div ref={dialog} role="dialog" aria-modal="true" aria-label="new-cpu-pit-in" onClick={(e) => e.stopPropagation()} data-testid="pit-popup"
        className="max-h-[94vh] w-full max-w-4xl space-y-2 overflow-y-auto rounded-2xl border-2 border-transparent bg-[#07060f] p-3 font-mono text-xs text-slate-100 shadow-[0_0_40px_#00e5ff44]"
        style={{ borderImage: 'linear-gradient(120deg,#ff2bd6,#00e5ff,#ffe600,#3dff8f) 1' }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="tracking-[0.3em] text-[#ff4d4d]">緊急イベント · KING &amp; QUEEN の鍵穴</p>
            <p className="text-base font-bold"><span style={{ color: CAR_B.primary }}>B 車</span>とドライブ · <span className="text-[#e040fb]">new-cpu-pit-in</span></p>
          </div>
          <label className="flex items-center gap-1">USD 軸の銘柄（旧 BTCUSD の枠）
            <select aria-label="USD axis pair" value={pair} onChange={(e) => { setPair(e.target.value as typeof pair); S.series.FX = []; }} className="border border-[#00e5ff]/60 bg-black px-1 text-[#7ff3ff]">
              {USD_AXIS_CHOICES.map((c) => <option key={c.pair} value={c.pair}>{c.label}</option>)}
            </select>
          </label>
          <button type="button" onClick={onClose} className="border border-white/30 px-2 py-0.5">閉じる（Esc）</button>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-[radial-gradient(ellipse_at_center,#0d1630,#05040c)]" role="img" aria-label="Sugoroku line">
          <polyline points={track.pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#ffffff22" strokeWidth={30} strokeLinejoin="round" />
          <polygon points={track.pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke={CAR_B.primary} strokeWidth={2} />
          {/* The pit lane leaves the loop at square 0. */}
          <path d={`M${track.pts[0].x - 30},${track.pts[0].y + 16} Q${track.pts[0].x},${track.pts[0].y + 40} ${track.pts[0].x + 40},${track.pts[0].y + 16}`} fill="none" stroke="#e040fb" strokeDasharray="4 3" />
          <text x={track.pts[0].x} y={track.pts[0].y + 52} textAnchor="middle" fontSize={9} fill="#e040fb">PIT</text>
          {Array.from({ length: SQUARES }, (_, i) => { const g = at(track, (i + 0.5) * (track.length / SQUARES)); const hit = squareAt(track, S.sB) === i; return (
            <g key={i}>
              <circle cx={g.p.x} cy={g.p.y} r={hit ? 9 : 7} fill={hit ? CAR_B.primary : '#0b0b1a'} stroke="#ffffff66" />
              <text x={g.p.x} y={g.p.y + 3} textAnchor="middle" fontSize={7} fill={hit ? '#000' : '#fff'}>{i}</text>
              <text x={g.p.x - g.n.x * 20} y={g.p.y - g.n.y * 20 + 3} textAnchor="middle" fontSize={9} fill="#ffe600">{squareSymbol(i)}</text>
            </g>
          ); })}
          {/* Sonar around the B car. */}
          <circle cx={gB.p.x} cy={gB.p.y} r={sonarR * ping} fill="none" stroke={CAR_B.primary} strokeOpacity={1 - ping} />
          {SYMS.map((k) => { const f = k === 'FX' ? 0 : fr('FX', k); if (f === null) return null; const r = 12 + f * sonarR; const lit = Math.abs(r - sonarR * ping) < 10;
            return <circle key={k} cx={gB.p.x + Math.cos(SYM_ANGLE[k]) * r} cy={gB.p.y + Math.sin(SYM_ANGLE[k]) * r} r={lit ? 5 : 3} fill={SYM_COLOR[k]} opacity={lit ? 1 : 0.6} />; })}
          {/* Cars. */}
          <g transform={`translate(${cpuPos.x},${cpuPos.y}) rotate(${(Math.atan2(gC.t.y, gC.t.x) * 180) / Math.PI})`} data-testid="cpu-car"><rect x={-9} y={-5} width={18} height={10} rx={3} fill="#e040fb" stroke="#fff" /><text y={3} textAnchor="middle" fontSize={6} fill="#000">CPU</text></g>
          <g transform={`translate(${gB.p.x},${gB.p.y}) rotate(${(Math.atan2(gB.t.y, gB.t.x) * 180) / Math.PI})`} data-testid="b-car"><rect x={-11} y={-6} width={22} height={12} rx={4} fill={CAR_B.primary} stroke="#fff" /><text y={3} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#000">B</text></g>
        </svg>

        <div className="grid gap-2 md:grid-cols-3">
          <section aria-label="Reels" className="rounded border border-[#ffe600]/50 p-2">
            <p className="text-[#ffe600]">KING &amp; QUEEN スロットリール</p>
            <div className="mt-1 flex justify-center gap-1" data-testid="reels">
              {[0, 1, 2].map((i) => <span key={i} className="grid h-12 w-12 place-items-center rounded border-2 border-[#ffe600] bg-black text-xl" style={{ filter: spinning ? 'blur(1.5px)' : undefined }}>{S.reels[i] ?? '·'}</span>)}
            </div>
            <p className="mt-1 text-center text-[10px] text-slate-400">B 車が通った直近 3 マスの絵柄で止まる</p>
          </section>
          <section aria-label="Cruising" className="space-y-1 rounded border border-[#00e5ff]/50 p-2" data-testid="cruising">
            <p className="text-[#00e5ff]">航続インジケーター</p>
            {[['B 車', S.fuelB, rangeB, CAR_B.primary], ['CPU', S.cpu.fuel, rangeC, '#e040fb']].map(([n, fuel, range, c]) => (
              <div key={n as string}><div className="flex justify-between"><span style={{ color: c as string }}>{n as string}</span><span>航続 {(range as number).toFixed(0)} マス{n === 'CPU' && S.cpu.pit ? ' · PIT 中' : ''}</span></div>
                <div className="h-2 bg-white/10"><div className="h-2" style={{ width: `${fuel as number}%`, background: `linear-gradient(90deg,#ff3b3b,#ffd400 30%,${c as string})` }} /></div></div>
            ))}
            <p className="text-[10px] text-slate-400">CPU はピット入口で「あと 1 周＋2 マス走れるか」を判断。B 車は 0 マスで補給される。</p>
          </section>
          <section aria-label="Matrix" className="rounded border border-[#3dff8f]/50 p-2">
            <p className="text-[#3dff8f]">マトリックス（METACRASH・アニマル指数）</p>
            <table className="mt-1 w-full text-center" data-testid="pit-matrix"><tbody>
              <tr><th />{SYMS.map((k) => <th key={k} style={{ color: SYM_COLOR[k] }}>{k === 'FX' ? pair : k}</th>)}</tr>
              {SYMS.map((r) => <tr key={r}><th style={{ color: SYM_COLOR[r] }}>{r === 'FX' ? pair : r}</th>{SYMS.map((c) => { const v = r === c ? null : fr(r, c); return <td key={c} style={{ color: v === null ? '#555' : `hsl(${190 + v * 130} 90% 65%)` }}>{r === c ? '—' : v === null ? '…' : v.toFixed(2)}</td>; })}</tr>)}
            </tbody></table>
            <p className="mt-1 text-[10px] text-slate-400">摩擦 ＝（1 − 対数リターンの相関）÷ 2。{pair} は USD の強さの向き（1 ÷ 価格）にそろえてから測る。</p>
          </section>
        </div>

        <section aria-label="Self test" className="rounded border border-white/20 p-2" data-testid="selftest">
          <p className="text-white">理テスト（毎フレーム検査）· {allChecks.filter((c) => c.ok).length} / {allChecks.length} 合格</p>
          <ul className="grid gap-x-3 md:grid-cols-2">{allChecks.map((c) => <li key={c.name} className={c.ok ? 'text-[#3dff8f]' : 'text-[#ff4d4d]'}>{c.ok ? '✓' : '✗'} {c.name} <span className="text-slate-500">{c.detail}</span></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
