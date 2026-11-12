// Rough cost estimates for running the spin lab's circuits on real quantum cloud services.
//
// Prices are EXAMPLES gathered on 2026-11-12 from the providers' public pages (or search results
// quoting them) — they change often, differ by region and contract, and must be checked before any
// budget. Every value is editable on the page. D-Wave publishes no list price (quote only).
//
// How a QAOA experiment turns into money:
//   circuits = tuning evaluations (the classical optimiser asks for one circuit per guess of γ, β)
//            + final runs to read the answer
//   per-shot services (Amazon Braket): circuits × (task fee + shots × price per shot)
//   per-second services (IBM Quantum):  circuits × seconds per circuit × price per second
// The simulated tuning on the page reports how many evaluations it needed; on hardware you would
// use fewer, smarter evaluations (and pay for shots, which the simulation does not need).

export type Pricing =
  | { kind: 'shot'; id: string; name: string; perTask: number; perShot: number; note: string; source: string }
  | { kind: 'second'; id: string; name: string; perSecond: number; freeSecondsPerMonth: number; note: string; source: string }
  | { kind: 'quote'; id: string; name: string; note: string; source: string };

export const AS_OF = '2026-11-12';
export const PRICES: Pricing[] = [
  { kind: 'shot', id: 'braket-ionq-forte', name: 'Amazon Braket · IonQ Forte', perTask: 0.3, perShot: 0.08, note: 'イオントラップ。誤り抑制を使うと 1 タスク 2,500 ショット以上', source: 'https://aws.amazon.com/braket/pricing/' },
  { kind: 'shot', id: 'braket-iqm-garnet', name: 'Amazon Braket · IQM Garnet', perTask: 0.3, perShot: 0.00145, note: '超伝導', source: 'https://aws.amazon.com/braket/pricing/' },
  { kind: 'shot', id: 'braket-iqm-emerald', name: 'Amazon Braket · IQM Emerald', perTask: 0.3, perShot: 0.0016, note: '超伝導', source: 'https://aws.amazon.com/braket/pricing/' },
  { kind: 'shot', id: 'braket-rigetti-ankaa', name: 'Amazon Braket · Rigetti Ankaa', perTask: 0.3, perShot: 0.0009, note: '超伝導', source: 'https://aws.amazon.com/braket/pricing/' },
  { kind: 'second', id: 'ibm-payg', name: 'IBM Quantum · 従量課金（Pay-As-You-Go）', perSecond: 96 / 60, freeSecondsPerMonth: 0, note: '$96／分から（秒単位の課金）', source: 'https://www.ibm.com/quantum/pricing' },
  { kind: 'second', id: 'ibm-open', name: 'IBM Quantum · 無料（Open Plan）', perSecond: 0, freeSecondsPerMonth: 600, note: '月 10 分まで無料（期間の数え方は要確認）', source: 'https://www.ibm.com/quantum/pricing' },
  { kind: 'quote', id: 'dwave-leap', name: 'D-Wave Leap（量子アニーリング）', note: '公開の定価なし。見積もり・契約（問い合わせ）', source: 'https://www.dwavequantum.com/' },
  { kind: 'quote', id: 'azure', name: 'Azure Quantum（IonQ・Quantinuum など）', note: '提供会社ごとの料金。新規に無料クレジットあり（各社 $500 の案内）', source: 'https://learn.microsoft.com/azure/quantum/pricing' },
];

export type Plan = { circuits: number; shots: number; secondsPerCircuit: number };
export type Estimate = { id: string; name: string; usd: number | null; detail: string; source: string; over?: boolean };

export function estimate(p: Pricing, plan: Plan): Estimate {
  if (p.kind === 'shot') { const usd = plan.circuits * (p.perTask + plan.shots * p.perShot); return { id: p.id, name: p.name, usd, detail: `${plan.circuits} 回 × ($${p.perTask} + ${plan.shots} ショット × $${p.perShot})`, source: p.source }; }
  if (p.kind === 'second') {
    const sec = plan.circuits * plan.secondsPerCircuit; const billable = Math.max(0, sec - p.freeSecondsPerMonth);
    const over = p.perSecond === 0 && billable > 0; // a free plan cannot absorb the extra seconds
    return { id: p.id, name: p.name, usd: over ? null : billable * p.perSecond, over, detail: `${plan.circuits} 回 × ${plan.secondsPerCircuit} 秒 = ${sec.toFixed(0)} 秒${p.freeSecondsPerMonth ? `（無料 ${p.freeSecondsPerMonth} 秒まで${sec > p.freeSecondsPerMonth ? '、超えた分は別プランが必要' : ''}）` : ''}`, source: p.source };
  }
  return { id: p.id, name: p.name, usd: null, detail: p.note, source: p.source };
}

/** A sensible hardware plan for a tuning run: far fewer evaluations than the exhaustive simulation. */
export const planFor = (evals: number, shots = 1000, secondsPerCircuit = 4): Plan => ({ circuits: Math.min(evals, 200) + 10, shots, secondsPerCircuit });
export const yen = (usd: number, rate = 150) => Math.round(usd * rate);
