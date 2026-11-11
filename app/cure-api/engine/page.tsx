'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Speedometer from '@/components/engine/Speedometer';
import { CARS, DESIGN_RULES, ENGINE_KEY, POSES_KEY, checkRules, readCar, readEngineInputs, type Car, type CarReading, type EngineFeed } from '@/lib/engineMenu';
import { PARAM_INFO } from '@/lib/famiDance';
import type { Pose } from '@/lib/famiDance';

function ForecastChart({ car, r }: { car: Car; r: CarReading }) {
  const W = 300; const H = 92; const n = r.fan.length - 1;
  const lo = Math.min(...r.fan.map((f) => f.p5)); const hi = Math.max(...r.fan.map((f) => f.p95));
  const x = (i: number) => 26 + (i / n) * (W - 34); const y = (v: number) => H - 14 - ((v - lo) / (hi - lo || 1)) * (H - 26);
  const band = `${r.fan.map((f, i) => `${x(i)},${y(f.p95)}`).join(' ')} ${r.fan.map((f, i) => `${x(i)},${y(f.p5)}`).reverse().join(' ')}`;
  const end = r.fan[n];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${car.name} forecast`}>
      {[0, 0.5, 1].map((k) => <line key={k} x1={26} x2={W - 8} y1={y(lo + (hi - lo) * k)} y2={y(lo + (hi - lo) * k)} stroke="#ffffff14" />)}
      <polygon points={band} fill={car.primary} opacity={0.3} />
      <polyline points={r.fan.map((f, i) => `${x(i)},${y(f.p50)}`).join(' ')} fill="none" stroke={car.accent} strokeWidth={2} />
      <circle cx={x(0)} cy={y(r.start)} r={3.5} fill="#ffffff" />
      <text x={2} y={y(hi) + 4} fontSize={8} fill="#ffffffaa">{hi.toFixed(car.digits)}</text>
      <text x={2} y={y(lo) + 2} fontSize={8} fill="#ffffffaa">{lo.toFixed(car.digits)}</text>
      <text x={W - 8} y={H - 2} fontSize={8} fill="#ffffffaa" textAnchor="end">32 拍後 中央 {end.p50.toFixed(car.digits)}（90% {end.p5.toFixed(car.digits)}〜{end.p95.toFixed(car.digits)}）</text>
    </svg>
  );
}

/**
 * Engine menu: four cars in four quadrants (A BTC, B USD, C XAU, D CPU) as future dashboard
 * instruments, fed by FamiDance's poses and matrix grid — the connector the Cure-API main menu
 * will plug into. Synthetic: the speed is how fast the synthetic forecast moves, not a price call.
 */
export default function EngineMenuPage() {
  const [inputs, setInputs] = useState<{ poses: Partial<Record<string, Pose>>; feed: EngineFeed | null }>({ poses: {}, feed: null });
  const [now, setNow] = useState(0);
  useEffect(() => {
    const load = () => { setInputs(readEngineInputs()); setNow(Date.now()); };
    load(); const id = window.setInterval(load, 2000);
    const onStorage = (e: StorageEvent) => { if (e.key === ENGINE_KEY || e.key === POSES_KEY) load(); };
    window.addEventListener('storage', onStorage);
    return () => { window.clearInterval(id); window.removeEventListener('storage', onStorage); };
  }, []);
  const feed = inputs.feed;
  const readings = CARS.map((c) => readCar(c, inputs.poses[c.sym] as Pose | undefined, feed));
  const age = feed && now ? Math.max(0, Math.round((now - feed.at) / 1000)) : null;
  const ready = !!feed && Object.values(feed.friction).some((v) => v !== null);
  const allRules = CARS.flatMap(checkRules);

  return (
    <main className="engine relative min-h-screen overflow-hidden bg-[#05040c] px-4 py-5 text-slate-100 sm:px-8">
      <style>{`
        .engine::before { content: ''; position: fixed; inset: 0; pointer-events: none;
          background: radial-gradient(circle at 15% 20%, #ff2bd622, transparent 40%), radial-gradient(circle at 85% 20%, #00e5ff22, transparent 40%),
                      radial-gradient(circle at 15% 85%, #ffcc0022, transparent 40%), radial-gradient(circle at 85% 85%, #3d7bff22, transparent 40%); }
        .quad { position: relative; border-radius: 14px; padding: 2px; background: linear-gradient(120deg, var(--p), var(--s), var(--a), var(--p)); background-size: 300% 300%; animation: flow 9s linear infinite; }
        .quad > div { border-radius: 12px; background: #07060f; }
        @keyframes flow { from { background-position: 0% 50%; } to { background-position: 300% 50%; } }
        @media (prefers-reduced-motion: reduce) { .quad { animation: none; } }
      `}</style>
      <div className="relative mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] tracking-[0.4em]"><span className="text-[#ff2bd6]">CURE-API</span> · <span className="text-[#00e5ff]">ENGINE</span> · <span className="text-[#ffcc00]">MENU</span> · <span className="text-[#3d7bff]">v0</span></p>
            <h1 className="font-mono text-2xl font-bold">エンジンメニュー · 4 台のダッシュボード</h1>
            <p className="text-xs text-slate-400">ファミダンスで解析した体の形（合成 API のパラメーター）と摩擦のマトリックスを、4 台の車の計器にする。Cure-API 総合メニューへ接続する前の準備。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/cure-api" className="border border-[#ff2bd6]/60 px-3 py-1 text-[#ff8ae8]">Cure-API</Link><Link href="/famidance" className="border border-[#00e5ff]/60 px-3 py-1 text-[#7ff3ff]">FamiDance</Link></nav>
        </header>

        <div className="relative">
          <div className="grid gap-4 md:grid-cols-2 md:gap-y-[170px]">
            {CARS.map((car, i) => {
              const r = readings[i]; const rules = checkRules(car);
              return (
                <section key={car.letter} aria-label={car.name} className="quad" style={{ ['--p' as string]: car.primary, ['--s' as string]: car.secondary, ['--a' as string]: car.accent }} data-testid={`car-${car.letter}`}>
                  <div className="space-y-1 p-3">
                    <div className="flex items-baseline justify-between">
                      <p className="font-mono text-lg font-bold" style={{ color: car.primary }}><span className="mr-2 text-3xl" style={{ color: car.accent }}>{car.letter}</span>{car.name}</p>
                      <p className="font-mono text-xs" style={{ color: car.accent }} data-testid={`gear-${car.letter}`}>ギア {r.gear} · {r.move >= 0 ? '+' : ''}{(r.move * 100).toFixed(2)}%</p>
                    </div>
                    <Speedometer car={car} reading={r} />
                    <ForecastChart car={car} r={r} />
                    <div className="grid grid-cols-5 gap-1 font-mono text-[9px]">
                      {PARAM_INFO.map((p) => { const v = r.params[p.key]; return (
                        <div key={p.key}><div className="truncate" style={{ color: car.secondary }}>{p.name}</div><div className="h-1 bg-white/10"><div className="h-1" style={{ width: `${Math.abs(v) * 100}%`, background: car.secondary }} /></div></div>
                      ); })}
                    </div>
                    <p className="font-mono text-[9px] text-slate-400">{rules.map((x) => `${x.ok ? '✓' : '✗'} ${x.rule} ${x.value}`).join(' ・ ')}</p>
                  </div>
                </section>
              );
            })}
          </div>

          {/* The hub where the four quadrants meet: the matrix grid comes in here. */}
          <section aria-label="Matrix hub" className="z-10 mx-auto mt-4 w-full max-w-[280px] rounded-2xl border-2 border-white/30 bg-[#05040c]/95 p-3 text-center font-mono text-[10px] shadow-[0_0_30px_#ffffff22] md:absolute md:left-1/2 md:top-1/2 md:mt-0 md:-translate-x-1/2 md:-translate-y-1/2" data-testid="hub">
            <p className="tracking-[0.3em] text-white">MATRIX GRID · 接続ポート</p>
            <p className={ready ? 'text-[#00ffa3]' : 'text-[#ffcc00]'} data-testid="hub-status">{ready ? `接続準備 OK · ${feed!.bone}・ポート ${feed!.port}・${age} 秒前` : '未計測：ファミダンスを開くと届く'}</p>
            <table className="mx-auto mt-1">
              <tbody>{CARS.map((a) => (
                <tr key={a.letter}><th className="pr-1" style={{ color: a.primary }}>{a.letter}</th>
                  {CARS.map((b) => { if (a === b) return <td key={b.letter} className="px-1 text-slate-600">·</td>; const k = [a.sym, b.sym].sort().join('|'); const v = feed?.friction[k];
                    return <td key={b.letter} className="px-1" style={{ color: v === null || v === undefined ? '#555' : `hsl(${190 + v * 130} 90% 65%)` }}>{v === null || v === undefined ? '…' : v.toFixed(2)}</td>; })}
                </tr>
              ))}</tbody>
            </table>
          </section>
        </div>

        <section aria-label="Design rules" className="rounded-xl border border-white/15 bg-black/50 p-3 font-mono text-xs">
          <p className="mb-1 tracking-[0.3em] text-[#ffe600]">DESIGN RULES · 極彩色の規則</p>
          <ol className="list-decimal space-y-0.5 pl-5 text-slate-300">{DESIGN_RULES.map((r) => <li key={r}>{r}</li>)}</ol>
          <p className="mt-1" data-testid="rules-summary">自動チェック：{allRules.filter((r) => r.ok).length} / {allRules.length} 合格</p>
          <p className="mt-1 text-slate-500">速度＝合成 API の予測（32 拍・240 本）の中央がどれだけ動くか。ギア D は上向き、R は下向き、N はほぼ動かない。回転数＝その車と他の 3 台の摩擦の平均。温度＝予測の幅。実際の値動きの予測ではない。</p>
        </section>
      </div>
    </main>
  );
}
