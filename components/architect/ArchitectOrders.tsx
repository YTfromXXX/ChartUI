'use client';

import { useEffect, useMemo, useState } from 'react';
import { ORDERS, floorPlan, orderOf, todayEvent, type ArchitectParams, type OrderKey } from '@/lib/architectOrders';
import { useCureAPIStore } from '@/lib/cureApiStore';

const SLIDERS: { key: keyof ArchitectParams; label: string; min: number; max: number; step: number }[] = [
  { key: 'ratio', label: '比率（長辺 ÷ 短辺）', min: 1, max: 3.5, step: 0.001 },
  { key: 'symmetry', label: '対称の次数', min: 0, max: 8, step: 1 },
  { key: 'skylight', label: '天窓の高度（°）', min: 10, max: 90, step: 1 },
  { key: 'acoustic', label: '音響半径（m）', min: 1, max: 10, step: 0.1 },
  { key: 'curvature', label: '曲率（直角 → 曲面）', min: 0, max: 1, step: 0.01 },
];

/** 教団内部: the TODAY event, the four orders, and the manual points of the architect structure. */
export default function ArchitectOrders() {
  const today = useMemo(() => todayEvent(), []);
  const fired = useCureAPIStore((s) => s.architectFire);
  const [key, setKey] = useState<OrderKey>(today.order);
  const order = orderOf(key);
  const [params, setParams] = useState<ArchitectParams>(order.defaults);
  const [copied, setCopied] = useState('');

  // A fresh fire from the Cure strobe point jumps to today's order.
  useEffect(() => { if (fired && Date.now() - fired.at < 60_000) { setKey(today.order); setParams(orderOf(today.order).defaults); } }, [fired, today.order]);

  const plan = floorPlan(key, params);
  const scenes = [order.scene1(params), order.scene2(params)];
  const copy = async (text: string, id: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(id); window.setTimeout(() => setCopied(''), 1500); } catch { setCopied('copy-failed'); }
  };

  // GALAXY spiral over the plan centre, and the skylight's shadow ray.
  const arms = Array.from({ length: today.galaxy.arms }, (_, a) => {
    const pts: string[] = [];
    for (let i = 0; i <= 40; i += 1) { const t = i / 40; const ang = a * (Math.PI * 2 / today.galaxy.arms) + t * Math.PI * 2 * today.galaxy.twist; const r = 6 + t * 60; pts.push(`${(150 + Math.cos(ang) * r).toFixed(1)},${(100 + Math.sin(ang) * r * 0.66).toFixed(1)}`); }
    return pts.join(' ');
  });
  const ray = (90 - params.skylight) * (Math.PI / 180);

  return (
    <section aria-label="Order interior" className="space-y-4 border-t border-white/10 px-5 py-6 text-stone-200 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300">TAROT COMMAND CENTER · 教団内部 · アーキテクト構造</p>
          <p className="mt-1 text-sm">TODAY {today.date}（{today.day} 日目）→ GALAXY {today.galaxy.arms} 腕・ねじれ {today.galaxy.twist.toFixed(2)}（月齢 {today.galaxy.moonAge.toFixed(1)} 日）→ 教団 {today.order}</p>
          <p className="text-[11px] text-stone-400">{fired ? `Cure のストロボ点から発火：${new Date(fired.at).toLocaleTimeString('ja-JP')}` : 'Cure-API の SPIRAL EYE の原点（ストロボ点）を押すと TODAY イベントが発火する'}</p>
        </div>
        <div className="flex gap-1" role="tablist" aria-label="Orders">
          {ORDERS.map((o) => (
            <button key={o.key} type="button" role="tab" aria-selected={key === o.key} onClick={() => { setKey(o.key); setParams(o.defaults); }} className={`border px-3 py-1 text-xs ${key === o.key ? 'border-amber-300 bg-amber-300/10 text-amber-100' : 'border-white/15 text-stone-400'}`}>
              {o.key}{o.key === today.order ? ' · TODAY' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <p className="text-lg text-amber-100">{order.key}. {order.name}</p>
          <p className="mb-2 text-[11px] text-stone-400">{order.basis}</p>
          <svg viewBox="0 0 300 200" className="w-full border border-white/10 bg-[#0d0f14]" role="img" aria-label={`${order.name} floor plan`}>
            <path d={plan.outline} fill="#f4f1ec" fillOpacity={0.06} stroke="#f4f1ec" strokeWidth={1.4} />
            {arms.map((pts, i) => <polyline key={`g${i}`} points={pts} fill="none" stroke="#fbbf24" strokeOpacity={0.35} strokeWidth={0.8} />)}
            {plan.features.map((f, i) => {
              const path = <path d={f.d} fill="none" stroke={f.href ? '#7dd3fc' : f.label ? '#fde68a' : 'rgba(244,241,236,.18)'} strokeWidth={f.label ? 1.2 : 0.6} strokeDasharray={f.label ? undefined : '3 3'} />;
              // Staircases are links: climb them to the library or the museum.
              return f.href
                ? <a key={i} href={f.href} aria-label={f.label} className="cursor-pointer"><path d={f.d} fill="transparent" stroke="transparent" strokeWidth={10} />{path}</a>
                : <g key={i}>{path}</g>;
            })}
            {plan.features.filter((f) => f.label).map((f, i) => {
              const m = f.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [150, 100];
              // Labels on the right half hang to the left so they stay inside the frame.
              const right = m[0] > 200;
              return <text key={`t${i}`} x={right ? m[0] - 24 : m[0] + 4} y={m[1] - 4} fontSize={7} textAnchor={right ? 'end' : 'start'} fill={f.href ? '#7dd3fc' : '#fde68a'}>{f.label}</text>;
            })}
            <line x1={150} y1={100} x2={150 + Math.cos(ray) * 120} y2={100 + Math.sin(ray) * 80} stroke="#fff" strokeOpacity={0.55} strokeWidth={0.8} />
            <text x={6} y={194} fontSize={7} fill="rgba(244,241,236,.6)">比 {params.ratio.toFixed(3)} · 対称 {params.symmetry || '—'} · 天窓 {params.skylight}° · 音響 {params.acoustic.toFixed(1)} m · 曲率 {params.curvature.toFixed(2)}</text>
          </svg>
        </div>
        <div className="space-y-2 text-[11px]" aria-label="Manual points">
          <p className="font-semibold text-amber-200">マニュアルポイント</p>
          {SLIDERS.map((sl) => (
            <label key={sl.key} className="block">{sl.label} <span className="float-right font-mono">{params[sl.key]}</span>
              <input type="range" min={sl.min} max={sl.max} step={sl.step} value={params[sl.key]} onChange={(e) => setParams((p) => ({ ...p, [sl.key]: Number(e.target.value) }))} className="w-full accent-amber-300" />
            </label>
          ))}
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={() => setParams((p) => ({ ...p, ratio: 1.618 }))} className="border border-white/15 px-2 py-0.5">黄金比</button>
            <button type="button" onClick={() => setParams((p) => ({ ...p, ratio: 1.414 }))} className="border border-white/15 px-2 py-0.5">1:√2</button>
            <button type="button" onClick={() => setParams(order.defaults)} className="border border-white/15 px-2 py-0.5">既定に戻す</button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 text-[12px]">
        {([['1. 衣装', order.clothing], ['2. 部屋の構造', order.rooms], ['3. 家具', order.furniture]] as const).map(([title, items]) => (
          <div key={title} className="border border-white/10 p-3"><p className="mb-1 font-semibold text-amber-100">{title}</p><ul className="list-disc space-y-1 pl-4">{items.map((t) => <li key={t}>{t}</li>)}</ul></div>
        ))}
      </div>
      {order.notes.length > 0 && <ul className="space-y-0.5 text-[11px] text-stone-400">{order.notes.map((n) => <li key={n}>※ {n}</li>)}</ul>}

      <div className="grid gap-3 md:grid-cols-2" aria-label="Prompts">
        {scenes.map((text, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]"><span className="text-amber-200">シーン {i + 1}：{i === 0 ? '空間・家具・衣服の全体像' : '家具のクローズアップ'}</span>
              <button type="button" onClick={() => void copy(text, `s${i}`)} className="border border-white/20 px-2 py-0.5">{copied === `s${i}` ? 'コピーしました' : 'コピー'}</button>
            </div>
            <textarea readOnly value={text} rows={8} className="w-full resize-y border border-white/10 bg-black/40 p-2 font-mono text-[11px] text-stone-200" aria-label={`Scene ${i + 1} prompt`} />
          </div>
        ))}
      </div>
      <p className="text-[10px] text-stone-500">マニュアルポイントの値はプロンプトに書き込まれる。B〜D は造形言語・研究文化としての架空の教団で、実在の人物の肖像や名前、ロゴはプロンプトに入れない。</p>
    </section>
  );
}
