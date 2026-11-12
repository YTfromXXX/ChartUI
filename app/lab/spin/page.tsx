'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { readStl } from '@/lib/meshMeta';
import { anneal, annealBest, candidatesFrom, exact, factorProblem, flowerProblem, hairProblem, qaoa, qaoa1, sampleCandidates, toBits, tuneLayers, tuneQaoa, type Candidate, type Problem } from '@/lib/spinLab';
import { AS_OF, PRICES, estimate, planFor, yen } from '@/lib/quantumCost';
import { gcd, order, qftPeaks, shor, type ShorRun } from '@/lib/shorToy';

type Kind = 'flower' | 'hair' | 'factor';
const KINDS: { id: Kind; label: string }[] = [{ id: 'flower', label: '🌸 花' }, { id: 'hair', label: '💇 髪' }, { id: 'factor', label: '🔢 因数分解' }];
const FACTORS = [35, 143, 221, 323];
const SPIN = '#7dd3fc'; // one colour for ↑ and ↓: a flip turns the arrow, it never flashes a colour

function Spin({ up, label, onClick, highlight }: { up: boolean; label: string; onClick: () => void; highlight?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={`${label}：押すと反転`} className="flex w-14 flex-col items-center gap-1 rounded-lg border p-1 text-[10px]" style={{ borderColor: highlight ? '#fbbf24' : '#ffffff22' }} data-testid={`spin-${label}`} data-up={up ? '1' : '0'}>
      <svg viewBox="-20 -20 40 40" className="h-10 w-10">
        <circle r="17" fill="#0b1220" stroke="#ffffff33" />
        <g style={{ transform: `rotate(${up ? 0 : 180}deg)`, transition: 'transform 260ms ease' }}><line y1="11" y2="-9" stroke={SPIN} strokeWidth="3" /><path d="M-6 -4 L0 -13 L6 -4 Z" fill={SPIN} /></g>
      </svg>
      <span className="font-mono">{label}</span>
    </button>
  );
}

/**
 * Spin lab: questions about flowers, hair and numbers turned into spins and an energy, solved by
 * simulated annealing and a simulated one-layer QAOA. Classical simulation; no quantum hardware.
 */
export default function SpinLab() {
  const [kind, setKind] = useState<Kind>('flower');
  const [N, setN] = useState(143);
  const [cands, setCands] = useState<Candidate[]>(() => sampleCandidates(10));
  const [meshName, setMeshName] = useState('見本（球・円柱・ゆがんだ板）');
  const problem: Problem = useMemo(() => (kind === 'flower' ? flowerProblem(cands) : kind === 'hair' ? hairProblem(cands) : factorProblem(N)), [kind, cands, N]);
  const best = useMemo(() => exact(problem), [problem]);
  const [spins, setSpins] = useState<number[]>(() => Array(problem.n).fill(0));
  const [trace, setTrace] = useState<{ energy: number; T: number }[]>([]);
  const [running, setRunning] = useState(false);
  const [seed, setSeed] = useState(1);
  const [gb, setGb] = useState({ gamma: 1.2, beta: -0.4 });
  const [layers, setLayers] = useState(1);
  const [tuned, setTuned] = useState<{ gammas: number[]; betas: number[]; evals: number } | null>(null);
  const [tuning, setTuning] = useState(false);
  const [restart, setRestart] = useState<{ hits: number; runs: number } | null>(null);
  const [plan, setPlan] = useState({ circuits: 210, shots: 1000, secondsPerCircuit: 4, rate: 150 });
  const raf = useRef(0);

  useEffect(() => { setSpins(Array(problem.n).fill(0)); setTrace([]); setTuned(null); setRestart(null); }, [problem]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  const energy = problem.energy(spins);

  const flip = (i: number) => { if (running) return; setSpins((s) => s.map((x, k) => (k === i ? x ^ 1 : x))); };
  const runAnneal = () => {
    const res = anneal(problem, { steps: 800, seed }); setSeed((s) => s + 1); setRunning(true);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; const dur = reduce ? 1500 : 6000; const t0 = performance.now(); let shown = -1;
    const tick = (now: number) => {
      const k = Math.min(res.trace.length - 1, Math.floor(((now - t0) / dur) * res.trace.length));
      // Show at most 8 updates a second, so each arrow turns at a calm pace.
      const frame = Math.floor((now - t0) / 125);
      if (frame !== shown) { shown = frame; setSpins(res.trace[k].spins); setTrace(res.trace.slice(0, k + 1).filter((_, i) => i % 4 === 0).map((x) => ({ energy: x.energy, T: x.T }))); }
      if (k < res.trace.length - 1) raf.current = requestAnimationFrame(tick); else { setSpins(res.best.spins); setRunning(false); }
    };
    raf.current = requestAnimationFrame(tick);
  };

  const q = useMemo(() => (problem.n > 12 ? null : tuned ? qaoa(problem, tuned.gammas, tuned.betas) : qaoa1(problem, gb.gamma, gb.beta)), [problem, gb, tuned]);
  const runTune = () => {
    setTuning(true);
    window.setTimeout(() => { // let the label paint first; three layers take a couple of seconds
      if (layers === 1) { const t = tuneQaoa(problem, 12); setGb({ gamma: t.gamma, beta: t.beta }); setTuned(null); setPlan((pl) => ({ ...pl, circuits: planFor(24 * 25).circuits })); }
      else { const t = tuneLayers(problem, layers); setTuned(t); setPlan((pl) => ({ ...pl, circuits: planFor(t.evals).circuits })); }
      setTuning(false);
    }, 30);
  };
  const runRestarts = () => { const r = annealBest(problem, 10, { seed }); setSeed((x) => x + 1); setSpins(r.best.spins); setRestart({ hits: r.hits, runs: r.runs }); setTrace(r.trace.filter((_, i) => i % 4 === 0).map((x) => ({ energy: x.energy, T: x.T }))); };
  const top = useMemo(() => (q ? q.prob.map((p, k) => ({ p, k, e: q.E[k] })).sort((a, b) => b.p - a.p).slice(0, 10) : []), [q]);
  const pOpt = q ? q.prob.reduce((a, p, k) => a + (Math.abs(q.E[k] - best.energy) < 1e-9 ? p : 0), 0) : 0;
  const uniform = q ? q.E.filter((e) => Math.abs(e - best.energy) < 1e-9).length / q.E.length : 0;

  const onStl = async (f?: File) => { if (!f) return; try { const { vs, ts } = readStl(await f.arrayBuffer()); setCands(candidatesFrom(vs, ts, 10)); setMeshName(f.name); } catch { setMeshName('読めませんでした'); } };

  const eMin = Math.min(best.energy, ...trace.map((t) => t.energy)); const eMax = Math.max(eMin + 1e-6, ...trace.map((t) => t.energy));
  const path = trace.map((t, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, 199)) * 600} ${110 - ((t.energy - eMin) / (eMax - eMin)) * 100}`).join(' ');

  return (
    <main className="min-h-screen bg-[#060912] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs text-sky-300/80">LAB · スピン · .meshmeta × 量子計算の考え方</p>
            <h1 className="text-2xl font-semibold">花と髪の問いを、スピンで解く</h1>
            <p className="max-w-3xl text-sm text-slate-300">問いをスピン（↑↓）とエネルギーに書き直し、低いエネルギーを探します。量子コンピューター（QPU）が得意とする「膨大な組み合わせから最適解を探す」計算の形を、この普通のコンピューターでシミュレーションしています。速さの比較ではなく、問い方の体験です。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/lab/mesh" className="border border-white/20 px-3 py-1">メッシュ LAB</Link><Link href="/lab/library/entrance" className="border border-white/20 px-3 py-1">図書館の入口</Link></nav>
        </header>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {KINDS.map((k) => <button key={k.id} type="button" data-testid={`kind-${k.id}`} onClick={() => setKind(k.id)} className="rounded-full border px-3 py-1" style={{ borderColor: kind === k.id ? '#7dd3fc' : '#ffffff33' }}>{k.label}</button>)}
          {kind === 'factor' ? FACTORS.map((n) => <button key={n} type="button" onClick={() => setN(n)} className="rounded border px-2 py-0.5 font-mono" style={{ borderColor: N === n ? '#7dd3fc' : '#ffffff33' }}>{n}</button>)
            : <label className="cursor-pointer rounded-full border border-white/20 px-3 py-1">メッシュ：{meshName}（STL を選ぶ）<input type="file" accept=".stl" className="hidden" onChange={(e) => void onStl(e.target.files?.[0])} /></label>}
        </div>

        <section className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">{problem.title}</h2>
            <span className="font-mono text-xs text-slate-400">{problem.n} スピン · 組み合わせ {(1 << problem.n).toLocaleString()} 通り</span>
          </div>
          <p className="text-xs text-slate-400">{problem.note}</p>
          <div className="flex flex-wrap gap-1" data-testid="spins">{spins.map((s, i) => <Spin key={i} up={!!s} label={problem.labels[i]} onClick={() => flip(i)} highlight={!!best.spins[i] && kind !== 'hair'} />)}</div>
          <div className="flex flex-wrap items-center gap-3 font-mono text-sm">
            <span data-testid="energy">E = {energy.toFixed(3)}</span>
            <span className="text-slate-400">最適（全通り調べた答え）E = {best.energy.toFixed(3)}</span>
            <span data-testid="reading" className="text-sky-200">{problem.read(spins)}</span>
            {!running && trace.length > 1 && energy > best.energy + 1e-9 && <span className="text-xs text-amber-300">最適には届かなかった — もう一度冷やすと届くことがあります</span>}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button type="button" data-testid="anneal" onClick={runAnneal} disabled={running} className="rounded-full bg-sky-400 px-3 py-1 font-semibold text-black disabled:opacity-50">{running ? '冷やしています…' : 'アニーリング（焼きなまし）'}</button>
            <button type="button" data-testid="restarts" onClick={runRestarts} disabled={running} className="rounded-full border border-sky-300/60 px-3 py-1">10 回冷やして一番良いもの</button>
            <button type="button" onClick={() => setSpins(best.spins)} className="rounded-full border border-white/20 px-3 py-1">答えを見る</button>
            {restart && <span data-testid="restart-hits" className="font-mono text-sky-200">10 回中 {restart.hits} 回で最適に届いた</span>}
            <button type="button" onClick={() => setSpins(Array(problem.n).fill(0))} className="rounded-full border border-white/20 px-3 py-1">全部 ↓ に戻す</button>
            <span className="text-slate-500">スピンを押すと、その場で反転してエネルギーが変わります。</span>
          </div>
          {trace.length > 1 && (
            <svg viewBox="0 0 600 120" className="h-28 w-full" data-testid="trace" aria-label="エネルギーの推移">
              <line x1="0" x2="600" y1={110 - ((best.energy - eMin) / (eMax - eMin)) * 100} y2={110 - ((best.energy - eMin) / (eMax - eMin)) * 100} stroke="#fbbf2466" strokeDasharray="4 4" />
              <path d={path} fill="none" stroke="#7dd3fc" strokeWidth="1.5" />
              <text x="4" y="12" fontSize="10" fill="#94a3b8">エネルギー（温度が下がるにつれて、最適 ─ ─ に近づく）</text>
            </svg>
          )}
        </section>

        <section className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs" data-testid="qaoa">
          <h2 className="text-sm font-semibold">量子回路で問う：QAOA {layers} 層（状態ベクトルのシミュレーション）</h2>
          <div className="flex items-center gap-1 font-mono">層 p：{[1, 2, 3].map((l) => <button key={l} type="button" data-testid={`layers-${l}`} onClick={() => { setLayers(l); setTuned(null); }} className="rounded border px-2" style={{ borderColor: layers === l ? '#7dd3fc' : '#ffffff33' }}>{l}</button>)}<span className="text-slate-500">（層を重ねるほど表現力が上がり、調整の回数も増える）</span></div>
          {q ? (
            <>
              <p className="text-slate-400">全 {q.prob.length} 通りに同じ重みの重ね合わせから始め、位相 e^(−iγE) と混ぜ合わせ e^(−iβX) を 1 回ずつかけて、測ったときに各答えが出る確率を計算します。γ と β は、普通のコンピューターが外側から調整します（ハイブリッド）。</p>
              <div className="flex flex-wrap items-center gap-3 font-mono">
                <label>γ {gb.gamma.toFixed(2)} <input type="range" min={0} max={12.57} step={0.01} value={gb.gamma} disabled={layers > 1} onChange={(e) => { setTuned(null); setGb({ ...gb, gamma: Number(e.target.value) }); }} /></label>
                <label>β {gb.beta.toFixed(2)} <input type="range" min={-1.57} max={1.57} step={0.01} value={gb.beta} disabled={layers > 1} onChange={(e) => { setTuned(null); setGb({ ...gb, beta: Number(e.target.value) }); }} /></label>
                <button type="button" data-testid="tune" onClick={runTune} disabled={tuning} className="rounded-full border border-sky-300/60 px-3 py-1 disabled:opacity-50">{tuning ? '計算中…' : layers === 1 ? 'γ, β を探す' : `${layers} 層ぶんの γ, β を探す`}</button>
                {tuned && <span className="text-slate-400">γ = [{tuned.gammas.map((x) => x.toFixed(2)).join(', ')}] β = [{tuned.betas.map((x) => x.toFixed(2)).join(', ')}] · 評価 {tuned.evals} 回</span>}
                <span data-testid="popt">最適解が出る確率 {(pOpt * 100).toFixed(2)}%（でたらめなら {(uniform * 100).toFixed(2)}%）· ⟨E⟩ = {q.expect.toFixed(3)}</span>
              </div>
              <div className="space-y-0.5">
                {top.map((t) => { const s = toBits(t.k, problem.n); const isBest = Math.abs(t.e - best.energy) < 1e-9; return (
                  <button key={t.k} type="button" onClick={() => setSpins(s)} className="flex w-full items-center gap-2 text-left font-mono" title="押すとこの答えをスピンに置く">
                    <span className="w-24">{s.map((b) => (b ? '↑' : '↓')).join('')}</span>
                    <span className="h-3 rounded-sm" style={{ width: `${Math.max(1, t.p * 600)}px`, background: isBest ? '#fbbf24' : '#7dd3fc' }} />
                    <span>{(t.p * 100).toFixed(2)}%</span><span className="text-slate-400">E {t.e.toFixed(2)}{isBest ? ' ★最適' : ''}</span>
                  </button>
                ); })}
              </div>
              <p className="text-slate-500">1 層の QAOA は弱く、最適解の確率は少ししか上がらないことが多いです（層を増やすほど上がる）。これも本物の量子計算の正直な姿です。</p>
            </>
          ) : <p className="text-slate-400">スピンが 12 個を超えるので、状態ベクトルのシミュレーションは省略します。</p>}
        </section>

        <ShorPanel />

        <CostPanel plan={plan} setPlan={setPlan} />

        <section className="grid gap-3 text-xs md:grid-cols-2">
          <div className="rounded-xl border border-white/10 p-3">
            <h2 className="mb-1 font-semibold">VR ゲームでの役割分担（将来のハイブリッド）</h2>
            <p><span className="text-emerald-300">GPU</span>：VR の映像の描画、フレームレートの維持、コントローラーへの反応。</p>
            <p><span className="text-sky-300">QPU</span>（得意になりうる所）：大勢の NPC の行動の最適化、流体や光の複雑な物理シミュレーション、サーバー間の通信経路の最適化 — どれも「膨大な組み合わせから最適解を探す」形。</p>
            <p className="mt-1 text-slate-400">このページのように、問いをスピンとエネルギーに書き直す部分が、GPU の世界と QPU をつなぐ「翻訳」になります。</p>
          </div>
          <div className="rounded-xl border border-white/10 p-3 text-slate-300">
            <h2 className="mb-1 font-semibold text-slate-100">正直な注意</h2>
            <p>ここでの計算はすべて普通のコンピューターでのシミュレーションで、量子コンピューターは使っていません。10 スピン（1024 通り）なら全部調べたほうが速く、量子の利点が出るのはずっと大きな問題です。因数分解の例は、量子アニーリングの問い方の練習で、暗号を破る計算（ショアのアルゴリズム）とは別物です。</p>
          </div>
        </section>
      </div>
    </main>
  );
}

/** Shor in miniature: measure after the QFT, read the period by continued fractions, take gcds. */
function ShorPanel() {
  const [N, setN] = useState(21); const coprimes = useMemo(() => Array.from({ length: N - 2 }, (_, i) => i + 2).filter((a) => gcd(a, N) === 1), [N]);
  const [a, setA] = useState(2); const [log, setLog] = useState<ShorRun[]>([]);
  useEffect(() => { setA(coprimes[0]); setLog([]); }, [coprimes]);
  const peaks = useMemo(() => qftPeaks(a, N), [a, N]); const r = order(a, N);
  const maxP = Math.max(...peaks.prob);
  return (
    <section className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs" data-testid="shor">
      <h2 className="text-sm font-semibold">ショアのアルゴリズム（ミニチュア）：周期のリズムを取り出す</h2>
      <p className="text-slate-400">エネルギーを少しずつ下げるのではなく、a^x mod N が何回でくり返すか（周期 r）を、量子フーリエ変換で一気に取り出します。下の山は、測ったときに出る値の確率で、Q/r の倍数に立ちます。ここでは普通のコンピューターで正確に計算しています（小さな N だけ）。</p>
      <div className="flex flex-wrap items-center gap-2 font-mono">
        N：{[15, 21, 33, 35].map((n) => <button key={n} type="button" data-testid={`shor-N-${n}`} onClick={() => setN(n)} className="rounded border px-2" style={{ borderColor: N === n ? '#fbbf24' : '#ffffff33' }}>{n}</button>)}
        a：<select value={a} onChange={(e) => { setA(Number(e.target.value)); setLog([]); }} className="rounded bg-black/40 px-1">{coprimes.map((x) => <option key={x} value={x}>{x}</option>)}</select>
        <span className="text-slate-400">Q = 2^{peaks.q} = {peaks.Q} · 本当の周期 r = {r}</span>
        <button type="button" data-testid="shor-measure" onClick={() => setLog((l) => [shor(N, a, Math.random), ...l].slice(0, 6))} className="rounded-full bg-amber-300 px-3 py-0.5 font-semibold text-black">測る</button>
      </div>
      <svg viewBox={`0 0 ${peaks.Q} 100`} preserveAspectRatio="none" className="h-24 w-full rounded bg-black/30" aria-label="QFT のあとの確率">
        {peaks.prob.map((p, k) => (p > maxP * 0.02 ? <rect key={k} x={k} y={100 - (p / maxP) * 95} width={Math.max(1, peaks.Q / 400)} height={(p / maxP) * 95} fill="#fbbf24" /> : null))}
      </svg>
      <ol className="space-y-0.5 font-mono" data-testid="shor-log">{log.map((x, i) => <li key={i} className={x.factors ? 'text-emerald-300' : 'text-slate-400'}>{x.factors ? `${N} = ${x.factors[0]} × ${x.factors[1]} — ` : ''}{x.why}</li>)}</ol>
      <p className="text-slate-500">本物の暗号（2048 ビットの RSA）を破るには、誤り訂正された量子ビットが大量に要り、今のクラウドの量子コンピューターではできません。</p>
    </section>
  );
}

type Plan = { circuits: number; shots: number; secondsPerCircuit: number; rate: number };
/** What the experiment would cost on real services — example prices, all editable. */
function CostPanel({ plan, setPlan }: { plan: Plan; setPlan: (p: Plan) => void }) {
  const rows = PRICES.map((p) => estimate(p, plan));
  const field = (k: keyof Plan, label: string, step = 1) => (
    <label className="flex items-center gap-1">{label}<input type="number" min={0} step={step} value={plan[k]} data-testid={`plan-${k}`} onChange={(e) => setPlan({ ...plan, [k]: Number(e.target.value) })} className="w-20 rounded bg-black/40 px-1" /></label>
  );
  return (
    <section className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs" data-testid="cost">
      <h2 className="text-sm font-semibold">本物の量子コンピューターで同じ実験をしたら（概算）</h2>
      <p className="text-slate-400">回路の回数は、上で γ, β を探したときの評価回数から、実機向けに減らした目安（最大 200 回＋答えを読む 10 回）を自動で入れます。ショット数は 1 回の回路を何回測るか。料金は {AS_OF} に公開ページ（または検索結果）で確かめた例の値で、変わりやすいので予算にする前に必ず公式で確認してください。</p>
      <div className="flex flex-wrap items-center gap-3 font-mono">{field('circuits', '回路の回数')}{field('shots', 'ショット数', 100)}{field('secondsPerCircuit', '1 回の秒数（秒課金の会社）', 0.5)}{field('rate', '円／ドル')}</div>
      <table className="w-full font-mono"><tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-white/5" data-testid={`cost-${r.id}`}>
            <td className="py-0.5 pr-2">{r.name}</td>
            <td className="pr-2 text-right">{r.usd === null ? (r.over ? '無料枠を超える' : '見積もり') : `$${r.usd.toFixed(2)}`}</td>
            <td className="pr-2 text-right text-slate-400">{r.usd === null ? '' : `約 ${yen(r.usd, plan.rate).toLocaleString()} 円`}</td>
            <td className="text-slate-500"><a href={r.source} target="_blank" rel="noreferrer" className="underline decoration-white/20">{r.detail}</a></td>
          </tr>
        ))}
      </tbody></table>
      <p className="text-slate-500">シミュレーションはショットも料金も要りません。10 スピン程度なら、実機より手元の計算のほうが速く正確です。実機を使う意味が出るのは、もっと大きな問題か、実機の雑音を研究したいときです。</p>
    </section>
  );
}
