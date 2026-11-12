'use client';

import { useState } from 'react';
import QuantumWish from '@/components/spin/QuantumWish';
import flowerFake from '@/quantum/results/flower-fake-fake_torino.json';
import flowerLocal from '@/quantum/results/flower-local-statevector.json';
import hairFake from '@/quantum/results/hair-fake-fake_torino.json';
import hairLocal from '@/quantum/results/hair-local-statevector.json';

type Result = { probabilities?: number[]; problem: string; mode: string; backend: string; when: string; qpu_seconds: number | null; shots: number; expect: number; p_opt: number; uniform_p_opt: number; exact_energy: number; browser_expect: number; tvd_vs_browser: number; top: { bits: number[]; p: number; energy: number }[] };
const BUNDLED = [hairLocal, hairFake, flowerLocal, flowerFake] as Result[];
const MODE: Record<string, string> = { local: '理想（雑音なし）', fake: 'リハーサル（実機に似せた雑音）', ibm: 'IBM の実機' };

/**
 * The IBM Quantum challenge: the same QAOA question as the browser, run as a Qiskit circuit —
 * ideal, on a noisy fake chip, and (on your own machine) on a real IBM QPU. Drop the result JSON
 * here to compare.
 */
export default function IbmChallenge({ problem }: { problem: 'flower' | 'hair' | 'factor' }) {
  const [mine, setMine] = useState<Result[]>([]);
  const [err, setErr] = useState('');
  const [hidden, setHidden] = useState(false);
  const sources = [...BUNDLED, ...mine].filter((r) => r.probabilities).map((r) => ({ id: `${r.problem}-${r.mode}-${r.backend}`, label: `${r.problem === 'hair' ? '髪' : '花'} · ${MODE[r.mode] ?? r.mode} · ${r.backend}`, probabilities: r.probabilities as number[] }));
  const rows = [...BUNDLED, ...mine].filter((r) => problem === 'factor' || r.problem === problem);
  const load = async (files: FileList | null) => {
    if (!files) return; const add: Result[] = [];
    for (const f of Array.from(files)) { try { const r = JSON.parse(await f.text()) as Result; if (!('p_opt' in r)) throw new Error(); add.push(r); } catch { setErr(`${f.name} は結果のファイルではありません`); } }
    setMine((m) => [...m, ...add]);
  };
  return (
    <section className="space-y-2 rounded-xl border border-violet-300/30 bg-violet-300/[0.04] p-3 text-xs" data-testid="ibm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">IBM Quantum チャレンジ（無料枠）</h2>
        {/* The hidden game: a meta view on the challenge itself — wish on the result you just measured. */}
        <button type="button" data-testid="hidden-door" onClick={() => setHidden((h) => !h)} title="?" className="font-mono text-[11px] text-violet-300/40 hover:text-violet-200">{'{:}'}</button>
      </div>
      {hidden && <QuantumWish sources={sources} />}
      {problem === 'factor' ? <p className="text-slate-400">因数分解のエネルギーは 4 次なので、このチャレンジでは扱いません（髪か花を選んでください）。</p> : (
        <>
          <p className="text-slate-300">見本のメッシュから作った、ブラウザと同じ問い（QAOA 1 層、γ・β も同じ）を Qiskit の回路にして、理想・雑音つきリハーサル・実機で比べます。回路の理想の確率は、ブラウザの計算と 10⁻¹⁰ の桁まで一致することを確かめてあります。{problem === 'hair' ? '髪は隣どうしの結合だけなので、IBM のチップの配線に素直に乗ります（2 量子ビットゲート 18 個）。本命です。' : '花は全部の組（45 組）の結合があり、配線の都合で 2 量子ビットゲートが約 180 個に増えます。雑音で崩れやすい、上級の挑戦です。'}</p>
          <table className="w-full font-mono" data-testid="ibm-table"><thead className="text-slate-400"><tr><th className="text-left">どこで</th><th className="text-right">⟨E⟩</th><th className="text-right">最適が出る確率</th><th className="text-right">でたらめなら</th><th className="text-right">ブラウザとの距離</th><th className="text-right">QPU 秒</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={i} className="border-t border-white/5" style={{ color: r.mode === 'ibm' ? '#c4b5fd' : undefined }}>
                <td>{MODE[r.mode] ?? r.mode} · {r.backend}</td><td className="text-right">{r.expect.toFixed(3)}</td>
                <td className="text-right">{(r.p_opt * 100).toFixed(2)}%</td><td className="text-right">{(r.uniform_p_opt * 100).toFixed(2)}%</td>
                <td className="text-right">{r.tvd_vs_browser.toFixed(3)}</td><td className="text-right">{r.qpu_seconds ?? '—'}</td>
              </tr>
            ))}</tbody></table>
          <p className="text-slate-500">⟨E⟩ は低いほど良い（ブラウザの理想 {rows[0]?.browser_expect.toFixed(3)}、本当の最適 {rows[0]?.exact_energy.toFixed(3)}）。距離は 0 ならブラウザの理想と同じ分布。4 000 回の測定では、理想でも 0.1 前後の揺れが出ます。</p>
          <details>
            <summary className="cursor-pointer text-violet-200">自分の IBM アカウントで実機に挑戦する手順</summary>
            <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-2 text-[11px] leading-5">{`pip install -r quantum/requirements.txt
# 一度だけ（キーはリポジトリに入れない）
python -c "from qiskit_ibm_runtime import QiskitRuntimeService as S; S.save_account(channel='ibm_quantum_platform', token='<API キー>', instance='<CRN>')"
python quantum/ibm_spin_challenge.py ${problem} --mode fake   # まず無料・オフラインのリハーサル
python quantum/ibm_spin_challenge.py ${problem} --mode ibm    # 実機（確認を聞いてから送信）`}</pre>
            <p className="mt-1 text-slate-400">1 回は 1 回路・4 000 ショット。10 量子ビット 1 層なら QPU 時間は数秒の見込みで、無料枠（私の理解では 28 日ごとに 10 分）の中に十分収まります。結果は quantum/results/ に保存されるので、そのファイルを下から読み込むと表に紫で並びます。</p>
          </details>
          <label className="inline-block cursor-pointer rounded-full border border-violet-300/50 px-3 py-1">結果の JSON を読み込む<input type="file" accept=".json" multiple className="hidden" onChange={(e) => void load(e.target.files)} /></label>
          {err && <span className="ml-2 text-amber-300">{err}</span>}
        </>
      )}
    </section>
  );
}
