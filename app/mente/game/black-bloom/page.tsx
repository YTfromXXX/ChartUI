'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ACCENTS, blackout, checks } from '@/lib/blackout';
import { contrailLikely, isaTemp, turnRate } from '@/lib/flightModel';
import { ELEMENTS } from '@/lib/shootingStar';
import { contrast } from '@/lib/smokeCandle';

// Mente on a black page: the cockpit experiment applied to a colour rule that makes flowers bloom.
// A small plane flies over a black field, seen from above. Bank with ← → (or drag): turn rate ω = g·tan(bank)/V.
// Where the standard atmosphere is colder than −40 °C (above ~8.5 km), it leaves a contrail; each contrail
// puff blooms into a flower after a moment. Petals follow Fibonacci numbers and sit on the golden angle.
// The colour rule decides the petal colours, and every colour is checked against the black page (≥ 3 : 1).
type RuleKey = 'arimino' | 'mu' | 'elements' | 'blackout';
const RULES: Record<RuleKey, { name: string; colors: string[]; note: string }> = {
  arimino: { name: 'アリミノの規則', colors: ['#f29b30', '#a9c62a', '#22b8c8', '#ece055'], note: '左に傾いて咲く花は機長席の色（オレンジ・黄緑）、右に傾くと副操縦士席の色（シアン・黄）。' },
  mu: { name: 'ミュウの規則', colors: ['#22b8c8', '#f29b30'], note: '咲くまで白いつぼみ。咲いた瞬間に 29 種（水色）か 92 種（橙）に決まる。' },
  elements: { name: '流れ星の元素の規則', colors: ELEMENTS.map((e) => e.color), note: '燃える元素の色（ナトリウム・マグネシウム・カルシウム・鉄・空気）。高く飛ぶほど、空気の赤が減る（ゲームの中の決まり）。' },
  blackout: { name: 'ブラックアウトの赤（量子のサイコロ）', colors: ACCENTS, note: '黒いページのために明るくした六つの赤。サイコロの目で一つが主役になる。' },
};
const FIB = [3, 5, 8, 13];
const GOLD = 2.39996; // golden angle (rad)
type Flower = { x: number; y: number; born: number; petals: number; color: string; size: number; spin: number };

export default function BlackBloom() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [rule, setRule] = useState<RuleKey>('arimino');
  const [alt, setAlt] = useState(10.6); // km
  const [face, setFace] = useState(1);
  const [stat, setStat] = useState({ bank: 0, rate: 0, flowers: 0 });
  const live = useRef({ rule, alt, face }); live.current = { rule, alt, face };
  const roles = blackout(face);
  const colorChecks = useMemo(() => (rule === 'blackout' ? [ACCENTS[face - 1]] : RULES[rule].colors).map((c) => ({ c, v: contrast(c, roles.bg) })), [rule, face, roles.bg]);
  useEffect(() => {
    const cv = ref.current; if (!cv) return undefined; const g = cv.getContext('2d')!; const W = cv.width; const H = cv.height;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const MPP = 50; const WARP = reduced ? 4 : 10; const V = 235; // metres per pixel, time warp, airspeed (m/s)
    const plane = { x: W / 2, y: H * 0.7, hdg: 0, bank: 0 }; let cmd = 0; let drag: number | null = null;
    const flowers: Flower[] = []; let raf = 0; let last = performance.now(); let puff = 0; let clock = 0; let tele = 0;
    const keys = new Set<string>();
    const kd = (e: KeyboardEvent) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); keys.add(e.key); } };
    const ku = (e: KeyboardEvent) => keys.delete(e.key);
    const pd = (e: PointerEvent) => { drag = e.clientX; cv.setPointerCapture(e.pointerId); };
    const pm = (e: PointerEvent) => { if (drag !== null) cmd = Math.max(-1, Math.min(1, (e.clientX - drag) / 120)); };
    const pu = () => { drag = null; cmd = 0; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); cv.addEventListener('pointerdown', pd); cv.addEventListener('pointermove', pm); cv.addEventListener('pointerup', pu); cv.addEventListener('pointercancel', pu);
    const pick = (bankSign: number, i: number) => {
      const r = live.current.rule; const cs = RULES[r].colors;
      if (r === 'arimino') return bankSign < 0 ? cs[i % 2] : cs[2 + (i % 2)];
      if (r === 'mu') return cs[Math.random() < 0.5 ? 0 : 1];
      if (r === 'blackout') return Math.random() < 0.6 ? ACCENTS[live.current.face - 1] : '#f4f1ec';
      const airShare = Math.max(0, 1 - live.current.alt / 12); // less air glow higher up (a game rule)
      return Math.random() < airShare * 0.4 ? cs[4] : cs[Math.floor(Math.random() * 4)];
    };
    const drawFlower = (f: Flower, now: number) => {
      const age = (now - f.born) / 1000; const grow = reduced ? 1 : Math.min(1, Math.max(0, (age - 0.8) / 1.2));
      if (age < 0.8 && !reduced) { g.fillStyle = '#ffffff55'; g.beginPath(); g.arc(f.x, f.y, 2.2, 0, Math.PI * 2); g.fill(); return; } // still a contrail puff
      const fade = Math.min(1, Math.max(0.25, 1 - (age - 40) / 30));
      const isBud = live.current.rule === 'mu' && grow < 1; const col = isBud ? '#f4f1ec' : f.color;
      g.save(); g.translate(f.x, f.y); g.rotate(f.spin); g.globalAlpha = fade;
      for (let k = 0; k < f.petals; k += 1) { g.save(); g.rotate(k * GOLD * (f.petals > 8 ? 1 : 0) + (k * Math.PI * 2) / f.petals * (f.petals > 8 ? 0 : 1)); g.fillStyle = col; g.beginPath(); g.ellipse(0, -f.size * grow * 0.55, f.size * grow * 0.22, f.size * grow * 0.5, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
      g.fillStyle = '#0a0a0a'; g.beginPath(); g.arc(0, 0, f.size * grow * 0.16, 0, Math.PI * 2); g.fill(); g.fillStyle = col; g.beginPath(); g.arc(0, 0, f.size * grow * 0.09, 0, Math.PI * 2); g.fill();
      g.restore(); g.globalAlpha = 1;
    };
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; clock += dt;
      const kc = (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0); const c = kc || cmd;
      plane.bank += ((c * 35 * Math.PI) / 180 - plane.bank) * Math.min(1, dt * 2);
      plane.hdg += turnRate(plane.bank, V) * dt * WARP;
      const step = (V * dt * WARP) / MPP; plane.x += Math.sin(plane.hdg) * step; plane.y -= Math.cos(plane.hdg) * step;
      if (plane.x < -10) plane.x += W + 20; if (plane.x > W + 10) plane.x -= W + 20; if (plane.y < -10) plane.y += H + 20; if (plane.y > H + 10) plane.y -= H + 20;
      const altM = live.current.alt * 1000;
      if (contrailLikely(altM)) { puff += dt; if (puff > 0.12) { puff = 0; const back = 10; flowers.push({ x: plane.x - Math.sin(plane.hdg) * back + (Math.random() - 0.5) * 6, y: plane.y + Math.cos(plane.hdg) * back + (Math.random() - 0.5) * 6, born: now, petals: FIB[Math.floor(Math.random() * FIB.length)], color: pick(Math.sign(plane.bank) || 1, flowers.length), size: 7 + Math.random() * 7, spin: Math.random() * Math.PI }); if (flowers.length > 700) flowers.shift(); } }
      g.fillStyle = '#0a0a0a'; g.fillRect(0, 0, W, H);
      for (const f of flowers) drawFlower(f, now);
      g.save(); g.translate(plane.x, plane.y); g.rotate(plane.hdg); g.scale(1 - Math.abs(Math.sin(plane.bank)) * 0.35, 1); // a top view: the wings look shorter when banked
      g.fillStyle = '#f4f1ec'; g.beginPath(); g.moveTo(0, -11); g.lineTo(3, 2); g.lineTo(13, 6); g.lineTo(13, 8); g.lineTo(3, 6); g.lineTo(2, 11); g.lineTo(5, 13); g.lineTo(-5, 13); g.lineTo(-2, 11); g.lineTo(-3, 6); g.lineTo(-13, 8); g.lineTo(-13, 6); g.lineTo(-3, 2); g.closePath(); g.fill(); g.restore();
      tele += dt; if (tele > 0.2) { tele = 0; setStat({ bank: (plane.bank * 180) / Math.PI, rate: (turnRate(plane.bank, V) * 180) / Math.PI, flowers: flowers.length }); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); cv.removeEventListener('pointerdown', pd); cv.removeEventListener('pointermove', pm); cv.removeEventListener('pointerup', pu); cv.removeEventListener('pointercancel', pu); };
  }, []);
  const temp = isaTemp(alt * 1000); const trail = contrailLikely(alt * 1000);
  return (
    <main className="mx-auto max-w-4xl space-y-3 p-4" style={{ background: roles.bg, color: roles.text }}>
      <header className="space-y-1">
        <p className="text-xs" style={{ color: roles.sub }}>MENTE · 黒い背景の色規則 · 操縦席の実験の応用</p>
        <h1 className="text-xl font-bold">黒い背景に、花を咲かせる</h1>
        <p className="text-sm" style={{ color: roles.sub }}>上から見た小さな飛行機。← → か、画面を左右にドラッグして傾ける（旋回率 ω = g·tan(傾き)/V）。外気温が −40 °C より低い高さでは飛行機雲が出て、その一粒ずつが少しあとに花になる。花びらはフィボナッチの数（3・5・8・13）、多い花は黄金角に並ぶ。時間は早送り。</p>
      </header>
      <canvas ref={ref} width={860} height={480} className="w-full touch-none rounded-md" style={{ outline: `1px solid ${roles.line}` }} data-testid="bloom" aria-label="黒い背景に咲く花と、飛行機の飛行機雲" />
      <div className="flex flex-wrap items-center gap-3 text-xs" data-testid="readout">
        <span>傾き {stat.bank.toFixed(0)}°</span><span>旋回 {stat.rate.toFixed(1)}°/秒</span>
        <label className="flex items-center gap-1">高度<input type="range" min={2} max={12} step={0.1} value={alt} onChange={(e) => setAlt(Number(e.target.value))} data-testid="alt" />{alt.toFixed(1)} km</label>
        <span>外気温 {temp.toFixed(0)} °C · {trail ? <b style={{ color: '#7fd36b' }}>飛行機雲が出る → 花が咲く</b> : <b style={{ color: roles.sub }}>飛行機雲が出ない（もっと高く）</b>}</span>
        <span>花 {stat.flowers}</span>
      </div>
      <div className="flex flex-wrap gap-1 text-xs">{(Object.keys(RULES) as RuleKey[]).map((k) => <button key={k} type="button" data-testid={`rule-${k}`} onClick={() => setRule(k)} className="rounded-sm border px-2 py-1" style={{ borderColor: rule === k ? roles.accent : roles.line, background: roles.panel }}>{RULES[k].name}</button>)}
        {rule === 'blackout' && <button type="button" data-testid="dice" onClick={() => setFace(1 + Math.floor(Math.random() * 6))} className="rounded-sm border px-2 py-1" style={{ borderColor: roles.accent, color: roles.accent, background: roles.panel }}>🎲 サイコロ（いま {face} の目）</button>}
      </div>
      <p className="text-xs" style={{ color: roles.sub }}>{RULES[rule].note}</p>
      <section className="grid gap-2 sm:grid-cols-2" data-testid="checks">
        <div className="space-y-1 rounded-sm border p-2 text-xs" style={{ borderColor: roles.line, background: roles.panel }}>
          <p className="font-semibold">花びらの色と黒の背景のコントラスト（3：1 以上で合格）</p>
          <div className="flex flex-wrap gap-2">{colorChecks.map(({ c, v }) => <span key={c} className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-full" style={{ background: c }} />{v.toFixed(1)}：1 {v >= 3 ? '✓' : '✗'}</span>)}</div>
        </div>
        <div className="space-y-1 rounded-sm border p-2 text-xs" style={{ borderColor: roles.line, background: roles.panel }}>
          <p className="font-semibold">ページの色の役割（ブラックアウトの決まり）</p>
          {checks(roles).map((k) => <p key={k.role}>{k.role}：{k.value.toFixed(1)}：1（{k.min} 以上）{k.ok ? '✓' : '✗'}</p>)}
        </div>
      </section>
    </main>
  );
}
