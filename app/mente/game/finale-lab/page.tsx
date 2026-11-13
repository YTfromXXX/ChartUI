'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { MAGNETS, lunaHand, magnets, nearest, snap, struggling, type FlightLog } from '@/lib/fibPanel';

// Finale research: Luna flies the hacked aviator to the honeycomb tower and lands on its top deck,
// while the Ariels (22 cameras on a ring round the island) direct the player's view — the "meta
// device". Auto: the Ariels pick the angle from the plane's phase (far → behind, rings → side,
// deck → from above). Manual: the player picks any of the 22. Touching the tower pushes the plane
// back (no crash). A research prototype: simple 3D points projected onto SVG.

type V3 = [number, number, number];
const N = 22; const CAM_R = 3.4; const TARGET: V3 = [0, 0, 0.8];
const camAt = (k: number): { a: number; h: number } => ({ a: (k / N) * Math.PI * 2, h: [0.5, 1.4, 2.8][k % 3] });
const TOWER_R = 0.3; const DECK_Z = 1.2; const RING_R = 0.9; const RING_SIZE = 0.2; const ORBIT_R = 2.2;
const RINGS: V3[] = Array.from({ length: 6 }, (_, i) => [RING_R * Math.cos((i * Math.PI) / 3 + Math.PI / 6), RING_R * Math.sin((i * Math.PI) / 3 + Math.PI / 6), 1.0 + 0.08 * (i % 2)]);

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

function projector(a: number, h: number, W: number, H: number) {
  const C: V3 = [CAM_R * Math.cos(a), CAM_R * Math.sin(a), h];
  const f = norm(sub(TARGET, C)); const r = norm(cross(f, [0, 0, 1])); const u = cross(r, f);
  return (p: V3): [number, number] | null => { const d = sub(p, C); const z = dot(d, f); if (z < 0.1) return null; return [W / 2 + (W * 0.55 * dot(d, r)) / z, H / 2 - (W * 0.55 * dot(d, u)) / z]; };
}

type Plane = { x: number; y: number; z: number; hd: number };
type Phase = 'far' | 'rings' | 'deck' | 'landed';
const phaseOf = (p: Plane, landed: boolean): Phase => { if (landed) return 'landed'; const d = Math.hypot(p.x, p.y); return d > 1.6 ? 'far' : d > 0.5 ? 'rings' : 'deck'; };
const PHASE_TEXT: Record<Phase, string> = { far: '遠く：後ろから（機体と塔が一直線）', rings: '輪のあたり：横から（輪との距離が見える）', deck: '甲板の上：上から（降りる場所が見える）', landed: '着陸：上から' };

/** The Ariels' choice of camera for the plane's phase. */
function autoCam(p: Plane, ph: Phase): number {
  const at = Math.atan2(p.y, p.x); const near = (ang: number, tier?: number) => { let best = 0; let bd = 9; for (let k = 0; k < N; k += 1) { if (tier !== undefined && k % 3 !== tier) continue; const dd = Math.abs(Math.atan2(Math.sin(camAt(k).a - ang), Math.cos(camAt(k).a - ang))); if (dd < bd) { bd = dd; best = k; } } return best; };
  if (ph === 'far') return near(at, 1);
  if (ph === 'rings') return near(at + Math.PI / 2, 0);
  return near(at, 2);
}

export default function FinaleLab() {
  const W = 640; const H = 380;
  const [plane, setPlane] = useState<Plane>({ x: 2.7, y: 0.4, z: 1.6, hd: Math.PI });
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [manualCam, setManualCam] = useState(4);
  const [msg, setMsg] = useState('');
  const [passed, setPassed] = useState<number[]>([]);
  const [landed, setLanded] = useState(false);
  const [little, setLittle] = useState(0);
  const view = useRef({ a: camAt(4).a, h: camAt(4).h });
  const keys = useRef<Record<string, boolean>>({});
  const reduce = useRef(false);
  const [, force] = useState(0);
  // Fibonacci magnet panel: the player's puck, Luna's hand when she helps, and the signs of struggling.
  const puck = useRef<[number, number]>([0, 0]);
  const [assist, setAssist] = useState<string | null>(null);
  const luna = useRef<[number, number]>([0, 0]);
  const flight = useRef<FlightLog>({ touches: [], flips: [], lastProgress: performance.now() });
  const lastSign = useRef(0); const best = useRef(9); const quietUntil = useRef(0);
  const assistRef = useRef<string | null>(null); assistRef.current = assist;

  const phase = phaseOf(plane, landed);
  const cam = mode === 'auto' ? autoCam(plane, phase) : manualCam;

  useEffect(() => {
    reduce.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const down = (e: KeyboardEvent) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { keys.current[e.key] = true; e.preventDefault(); } };
    const up = (e: KeyboardEvent) => { keys.current[e.key] = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  useEffect(() => {
    let raf = 0; let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      setLittle((t) => t + dt * 0.5);
      if (!landed) setPlane((p) => {
        const k = keys.current; let { x, y, z, hd } = p;
        const keyTurn = k.ArrowLeft ? -1 : k.ArrowRight ? 1 : 0; const keyClimb = k.ArrowUp ? 1 : k.ArrowDown ? -1 : 0;
        let turn = keyTurn || puck.current[0]; let climb = keyClimb || puck.current[1];
        const sign = Math.sign(turn); if (sign && lastSign.current && sign !== lastSign.current) flight.current.flips.push(now); if (sign) lastSign.current = sign;
        luna.current = lunaHand(p, DECK_Z);
        if (assistRef.current) { turn = (turn + luna.current[0]) / 2; climb = (climb + luna.current[1]) / 2; }
        hd -= turn * 1.6 * dt; z += climb * 0.4 * dt;
        const v = Math.hypot(x, y) < 0.6 ? 0.18 : 0.35; x += Math.cos(hd) * v * dt; y += Math.sin(hd) * v * dt; z = Math.max(0.2, Math.min(2.6, z));
        const d = Math.hypot(x, y);
        if (d < best.current - 0.05) { best.current = d; flight.current.lastProgress = now; }
        if (d < TOWER_R + 0.05 && z < DECK_Z - 0.02) { const s2 = (TOWER_R + 0.4) / (d || 1); x *= s2; y *= s2; hd += Math.PI; flight.current.touches.push(now); setMsg('塔に触れた：押し戻された（もう一度）'); }
        if (d < 0.25 && z >= DECK_Z - 0.02 && z <= DECK_Z + 0.15) { setLanded(true); setMsg(assistRef.current ? 'Luna と一緒に着陸した。旋回が止まった。' : '着陸した。旋回が止まった。'); return { x, y, z: DECK_Z, hd }; }
        RINGS.forEach((rp, i) => { if (Math.hypot(x - rp[0], y - rp[1], z - rp[2]) < RING_SIZE) { flight.current.lastProgress = now; setPassed((ps) => (ps.includes(i) ? ps : [...ps, i])); } });
        return { x, y, z, hd };
      });
      if (!landed && !assistRef.current && now > quietUntil.current) { const why = struggling(flight.current, now); if (why) setAssist(why); }
      // Camera: glide toward the chosen Ariel (cut at once with reduced motion).
      const target = camAt(cam); const vw = view.current; const s = reduce.current ? 1 : Math.min(1, dt * 2.5);
      const da = Math.atan2(Math.sin(target.a - vw.a), Math.cos(target.a - vw.a)); vw.a += da * s; vw.h += (target.h - vw.h) * s;
      force((n) => (n + 1) % 1000);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [cam, landed]);

  const P = projector(view.current.a, view.current.h, W, H);
  const line = (pts: V3[], close = false) => { const q = pts.map(P); if (q.some((x) => !x)) return ''; return `M${q.map((x) => `${x![0].toFixed(1)} ${x![1].toFixed(1)}`).join('L')}${close ? 'Z' : ''}`; };
  const hex = (z: number, r: number) => Array.from({ length: 6 }, (_, i) => [r * Math.cos((i * Math.PI) / 3), r * Math.sin((i * Math.PI) / 3), z] as V3);
  const circle = (c: V3, r: number, vertical: boolean, ang = 0) => Array.from({ length: 24 }, (_, i) => { const t = (i / 24) * Math.PI * 2; return vertical ? [c[0] - Math.sin(ang) * r * Math.cos(t), c[1] + Math.cos(ang) * r * Math.cos(t), c[2] + r * Math.sin(t)] as V3 : [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t), c[2]] as V3; });
  const planePts: V3[] = [[plane.x + Math.cos(plane.hd) * 0.14, plane.y + Math.sin(plane.hd) * 0.14, plane.z], [plane.x + Math.cos(plane.hd + 2.5) * 0.1, plane.y + Math.sin(plane.hd + 2.5) * 0.1, plane.z], [plane.x + Math.cos(plane.hd - 2.5) * 0.1, plane.y + Math.sin(plane.hd - 2.5) * 0.1, plane.z]];
  const lt = little; const lp: V3 = [ORBIT_R * Math.cos(lt), ORBIT_R * Math.sin(lt), 1.7];
  const hold = (key: string, on: boolean) => { keys.current[key] = on; };
  const reset = () => { setPlane({ x: 2.7, y: 0.4, z: 1.6, hd: Math.PI }); setLanded(false); setPassed([]); setMsg(''); best.current = 9; flight.current.lastProgress = performance.now(); };
  const panelRef = useRef<SVGSVGElement>(null); const dragging = useRef(false);
  const toPanel = (e: React.PointerEvent): [number, number] => { const r = panelRef.current!.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * 2 - 1; const py = -(((e.clientY - r.top) / r.height) * 2 - 1); const l = Math.hypot(px, py); return l > 1 ? [px / l, py / l] : [px, py]; };

  return (
    <main className="min-h-screen bg-white px-4 py-4 font-mono text-[#1f1f1f]">
      <div className="mx-auto max-w-4xl space-y-3">
        <p className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-600">
          <span>研究：最後の面の操縦（Luna の飛行機 × エーリアル達の 22 アングル）</span>
          <span className="flex gap-3"><Link href="/mente/game/years" className="underline">12 年の進行</Link><Link href="/mente/game" className="underline">タイトルへ</Link></span>
        </p>
        <div className="border-2 border-[#1f1f1f] px-3 py-2 text-center text-sm tracking-wide" role="note" data-testid="banner-22">{'{22 のエーリアルを、タロットの切り札 22 枚に対応させるか。}'}</div>
        {assist && (
          <div className="flex flex-wrap items-center justify-between gap-2 border border-[#22b8c8] bg-white px-3 py-1.5 text-xs" role="status" data-testid="luna-assist">
            <span><span className="mr-2 bg-black px-1 text-[10px] font-bold italic text-white">Mente · そっと</span>Luna：「いっしょに飛ぼう。わたしの手も、パネルに置くね。」（{assist}）</span>
            <button type="button" onClick={() => { setAssist(null); quietUntil.current = performance.now() + 30_000; flight.current = { touches: [], flips: [], lastProgress: performance.now() }; }} className="border border-stone-400 px-2 py-0.5">ひとりで飛ぶ</button>
          </div>
        )}
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full border border-stone-300 bg-[#f7f9fb]" aria-label="エーリアルの見ている画面" data-testid="finale-view">
          <path d={line(circle([0, 0, 0], 2.9, false), true)} fill="none" stroke="#d6d3d1" />
          <path d={line(circle([0, 0, 1.7], ORBIT_R, false), true)} fill="none" stroke="#c8001a" strokeDasharray="4 4" strokeOpacity={0.5} />
          {hex(0, TOWER_R).map((p, i) => <path key={i} d={line([p, [p[0], p[1], DECK_Z]])} stroke="#1f1f1f" />)}
          <path d={line(hex(0, TOWER_R), true)} fill="none" stroke="#1f1f1f" />
          <path d={line(hex(DECK_Z, TOWER_R + 0.08), true)} fill="#fde68a" fillOpacity={0.6} stroke="#7a5c12" strokeWidth={1.5} />
          {RINGS.map((rp, i) => <path key={i} d={line(circle(rp, RING_SIZE, true, Math.atan2(rp[1], rp[0]) + Math.PI / 2), true)} fill="none" stroke={passed.includes(i) ? '#22b8c8' : '#7a5c12'} strokeWidth={1.5} />)}
          <path d={line(planePts, true)} fill="#1f1f1f" />
          <path d={line([[plane.x, plane.y, plane.z], [plane.x, plane.y, 0]])} stroke="#1f1f1f" strokeOpacity={0.2} strokeDasharray="2 3" />
          {P(lp) && <circle cx={P(lp)![0]} cy={P(lp)![1]} r={4} fill="#c8001a" />}
          <text x={10} y={18} fontSize={12} fill="#1f1f1f">エーリアル {cam + 1} / 22 · {mode === 'auto' ? `自動：${PHASE_TEXT[phase]}` : '手動'}</text>
          <text x={10} y={H - 10} fontSize={11} fill="#57534e">高さ {plane.z.toFixed(2)} · 塔まで {Math.hypot(plane.x, plane.y).toFixed(2)} · 輪 {passed.length}/6 · 赤い点：リトルの旋回</text>
        </svg>
        <p className="min-h-5 text-xs text-[#c8001a]" role="status" data-testid="finale-msg">{msg}</p>

        <div className="flex flex-wrap items-start gap-4 text-xs">
          <div className="space-y-1">
            <p className="font-semibold">あなたの操縦（矢印キー、または押し続ける）</p>
            <div className="grid w-40 grid-cols-3 gap-1">
              <span /><button type="button" onPointerDown={() => hold('ArrowUp', true)} onPointerUp={() => hold('ArrowUp', false)} onPointerLeave={() => hold('ArrowUp', false)} className="border border-black py-1">上昇</button><span />
              <button type="button" onPointerDown={() => hold('ArrowLeft', true)} onPointerUp={() => hold('ArrowLeft', false)} onPointerLeave={() => hold('ArrowLeft', false)} className="border border-black py-1">左</button>
              <button type="button" onClick={reset} className="border border-stone-400 py-1">戻る</button>
              <button type="button" onPointerDown={() => hold('ArrowRight', true)} onPointerUp={() => hold('ArrowRight', false)} onPointerLeave={() => hold('ArrowRight', false)} className="border border-black py-1">右</button>
              <span /><button type="button" onPointerDown={() => hold('ArrowDown', true)} onPointerUp={() => hold('ArrowDown', false)} onPointerLeave={() => hold('ArrowDown', false)} className="border border-black py-1">下降</button><span />
            </div>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">フィボナッチのマグネット操縦パネル</p>
            <svg ref={panelRef} viewBox="-1.15 -1.15 2.3 2.3" className="h-40 w-40 touch-none select-none" aria-label="操縦パネル（34 個の磁石）" data-testid="fib-panel"
              onPointerDown={(e) => { dragging.current = true; (e.target as Element).setPointerCapture?.(e.pointerId); puck.current = snap(...toPanel(e)); }}
              onPointerMove={(e) => { if (dragging.current) puck.current = snap(...toPanel(e)); }}
              onPointerUp={() => { dragging.current = false; puck.current = magnets[nearest(...puck.current)]; }}
              onDoubleClick={() => { puck.current = [0, 0]; }}>
              <circle r={1} fill="#fafaf9" stroke="#d6d3d1" strokeWidth={0.01} />
              <line x1={-1} x2={1} y1={0} y2={0} stroke="#e7e5e4" strokeWidth={0.01} /><line y1={-1} y2={1} x1={0} x2={0} stroke="#e7e5e4" strokeWidth={0.01} />
              {magnets.map(([mx, my], i) => <circle key={i} cx={mx} cy={-my} r={i === 0 ? 0.045 : 0.03} fill="white" stroke="#7a5c12" strokeWidth={0.012} />)}
              {assist && <circle cx={luna.current[0]} cy={-luna.current[1]} r={0.09} fill="none" stroke="#22b8c8" strokeWidth={0.03} data-testid="luna-hand" />}
              <circle cx={puck.current[0]} cy={-puck.current[1]} r={0.07} fill="#1f1f1f" />
              <text x={0} y={-1.05} fontSize={0.1} textAnchor="middle" fill="#57534e">上昇</text><text x={0} y={1.12} fontSize={0.1} textAnchor="middle" fill="#57534e">下降</text>
            </svg>
            <p className="text-[10px] text-stone-600">黒：あなたの手 · {assist ? '水色：Luna の手（二つの手の間を飛ぶ）' : `磁石 ${MAGNETS} 個（ひまわりの種の並び）`}。中心をダブルクリックで手を離す。</p>
          </div>
          <div className="space-y-1">
            <p className="font-semibold">メタ視点のデバイス（エーリアル達）</p>
            <div className="flex gap-1">{(['auto', 'manual'] as const).map((m) => <button key={m} type="button" data-testid={`cam-${m}`} onClick={() => setMode(m)} className="border px-2 py-0.5" style={{ borderColor: mode === m ? '#c8001a' : '#d6d3d1' }}>{m === 'auto' ? '自動（エーリアルが選ぶ）' : '手動（あなたが選ぶ）'}</button>)}</div>
            <svg viewBox="-60 -60 120 120" className="h-36 w-36" aria-label="22 のエーリアル" data-testid="cam-dial">
              <polygon points={hex(0, 9).map((p) => `${p[0]},${p[1]}`).join(' ')} fill="#fde68a" stroke="#7a5c12" />
              {Array.from({ length: N }, (_, k) => { const c = camAt(k); const rr = 32 + (k % 3) * 9; return <circle key={k} cx={rr * Math.cos(c.a)} cy={-rr * Math.sin(c.a)} r={k === cam ? 5 : 3} fill={k === cam ? '#c8001a' : 'white'} stroke="#1f1f1f" onClick={() => { setMode('manual'); setManualCam(k); }} style={{ cursor: 'pointer' }}><title>{`エーリアル ${k + 1}`}</title></circle>; })}
              <circle cx={plane.x * 14} cy={-plane.y * 14} r={2.5} fill="#1f1f1f" />
            </svg>
            <p className="text-[10px] text-stone-600">内側の輪：低い / 中：中ほど / 外側：高い（3 段 × 22）。点を押すと手動になる。</p>
          </div>
        </div>
        <p className="text-[11px] text-stone-600">研究用の試作です。塔にぶつかる演出はなく、触れると押し戻されます。3・6・9・10 年目の結果（輪の大きさ・重さ・見張り・BA と PE）はまだつないでいません。</p>
      </div>
    </main>
  );
}
