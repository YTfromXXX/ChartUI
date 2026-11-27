'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  EDITIONS, basisGame, checkEdition, flicker, marketFrom, meltRate, palette, rng, smokeMesh, springCurve, stepSpring, tearFrom,
  type Edition, type Market, type Spring,
} from '@/lib/smokeCandle';

const CANDLES = 8; const RING = 1.55; const CYL_R = 0.42; const CYL_H = 2.2;

class Polyline extends THREE.Curve<THREE.Vector3> {
  constructor(private pts: THREE.Vector3[]) { super(); }
  getPoint(t: number, target = new THREE.Vector3()) {
    const f = Math.max(0, Math.min(1, t)) * (this.pts.length - 1); const i = Math.min(this.pts.length - 2, Math.floor(f));
    return target.copy(this.pts[i]).lerp(this.pts[i + 1], f - i);
  }
}

/**
 * Candle & smoke lab: the colour rules of the two editions on one scene. A metal cylinder stands in
 * the middle with a torn smoke sheet wound round it; eight candles around it are springs of wax
 * that soften and melt as fast as the market is busy (volume) and nervous (volatility). Each new
 * synthetic bar kicks the newest candle. Synthetic prices only.
 */
export default function CandleSmokeLab() {
  const mount = useRef<HTMLDivElement>(null);
  const [edition, setEdition] = useState<Edition>('golden');
  const [auto, setAuto] = useState(true);
  const [manual, setManual] = useState<Market>({ volume: 1, volatility: 1 });
  const [hud, setHud] = useState({ melt: 0, rate: 0, tear: 0, kept: 0, total: 0, volume: 1, volatility: 1, bars: 0 });
  const live = useRef({ auto, manual }); live.current = { auto, manual };
  const resetRef = useRef(() => {});
  const e = EDITIONS[edition];

  useEffect(() => {
    const el = mount.current; if (!el) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const W = el.clientWidth; const H = Math.round(Math.min(540, W * 0.6));
    const renderer = new THREE.WebGLRenderer({ antialias: true }); renderer.setPixelRatio(Math.min(2, window.devicePixelRatio)); renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.outputColorSpace = THREE.SRGBColorSpace; el.prepend(renderer.domElement);
    const scene = new THREE.Scene(); scene.background = new THREE.Color(e.background);
    const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    const camera = new THREE.PerspectiveCamera(38, W / H, 0.01, 100); camera.position.set(3.6, 2.6, 4.2);
    const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.target.set(0, 0.9, 0);
    scene.add(new THREE.AmbientLight('#ffffff', 0.25));

    const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshStandardMaterial({ color: e.background, metalness: 0.3, roughness: 0.6 })); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(CYL_R, CYL_R, CYL_H, 64), new THREE.MeshStandardMaterial({ color: e.metal, metalness: 1, roughness: 0.22 })); cyl.position.y = CYL_H / 2; scene.add(cyl);

    // Smoke sheet: 4-component vertex colours carry the per-vertex alpha.
    const smokeGeo = new THREE.BufferGeometry(); const smokeCol = new THREE.Color(e.smoke).lerp(new THREE.Color(e.text), 0.25);
    const smokeMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const smoke = new THREE.Mesh(smokeGeo, smokeMat); smoke.position.y = 0.15; scene.add(smoke);

    // Candles: wax coil + flame + a light, round the cylinder.
    const waxMats = e.wax.map((c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, transmission: 0.25, thickness: 0.3, sheen: 0.6 }));
    const candles = Array.from({ length: CANDLES }, (_, i) => {
      const a = (i / CANDLES) * Math.PI * 2; const g = new THREE.Group(); g.position.set(Math.cos(a) * RING, 0, Math.sin(a) * RING); scene.add(g);
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), waxMats[i % 3]); g.add(mesh);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshStandardMaterial({ color: e.wax[1], roughness: 0.3 })); pool.rotation.x = -Math.PI / 2; pool.position.y = 0.004; g.add(pool);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), new THREE.MeshBasicMaterial({ color: e.accent })); flame.scale.set(1, 1.8, 1); g.add(flame);
      const light = new THREE.PointLight(e.accent, 0.6, 2.2); g.add(light);
      return { g, mesh, pool, flame, light, spring: { melt: 0, x: 0, v: 0 } as Spring, seed: i * 1.7 };
    });
    // Price line: a ring through the flames, in the edition's price colour.
    const priceMat = new THREE.MeshBasicMaterial({ color: e.price }); const priceTube = new THREE.Mesh(new THREE.BufferGeometry(), priceMat); scene.add(priceTube);

    // Synthetic market.
    const r = rng(7); const closes = [100]; const vols = [1];
    const addBar = () => { const shock = r() < 0.12 ? 3 : 1; closes.push(closes[closes.length - 1] * Math.exp((r() - 0.5) * 0.012 * shock)); vols.push((0.5 + r()) * shock); if (closes.length > 60) { closes.shift(); vols.shift(); } };
    for (let i = 0; i < 30; i += 1) addBar();
    let bars = 0; let newest = 0; let barClock = 0; let meshClock = 0; let hudClock = 0; let t = 0; let last = performance.now(); let raf = 0;
    resetRef.current = () => { for (const c of candles) c.spring = { melt: 0, x: 0, v: 0 }; };

    const rebuild = (m: Market) => {
      const sm = smokeMesh(CYL_R * 1.04, CYL_H * 0.95, reduce ? t * 0.3 : t, tearFrom(m));
      const n = sm.alphas.length; const col = new Float32Array(n * 4);
      for (let k = 0; k < n; k += 1) { col[k * 4] = smokeCol.r; col[k * 4 + 1] = smokeCol.g; col[k * 4 + 2] = smokeCol.b; col[k * 4 + 3] = sm.alphas[k] * 0.75; }
      smokeGeo.setAttribute('position', new THREE.BufferAttribute(sm.positions, 3)); smokeGeo.setAttribute('color', new THREE.BufferAttribute(col, 4)); smokeGeo.setIndex(sm.indices);
      const tops: THREE.Vector3[] = [];
      for (const c of candles) {
        const sc = springCurve(c.spring, { n: 160 }); const curve = new Polyline(sc.pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
        c.mesh.geometry.dispose(); c.mesh.geometry = new THREE.TubeGeometry(curve, 160, 0.045 + 0.02 * c.spring.melt, 8, false);
        c.pool.scale.setScalar(sc.poolRadius); const tip = sc.pts[sc.pts.length - 1]; c.flame.position.set(tip[0], tip[1] + 0.1, tip[2]); c.light.position.copy(c.flame.position);
        tops.push(c.flame.position.clone().add(c.g.position).add(new THREE.Vector3(0, 0.14, 0)));
      }
      tops.push(tops[0].clone()); priceTube.geometry.dispose(); priceTube.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(tops, true), 120, 0.012, 6, true);
      return sm;
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, now - last) / 1000); last = Math.max(last, now); t += dt;
      const L = live.current; const m = L.auto ? marketFrom(closes, vols) : L.manual;
      barClock += dt;
      if (barClock > 1.2) { barClock = 0; addBar(); bars += 1; newest = (newest + 1) % CANDLES; candles[newest].spring = { ...candles[newest].spring, v: candles[newest].spring.v + 1.2 * Math.min(3, m.volume) }; }
      for (const c of candles) c.spring = stepSpring(c.spring, dt, m);
      for (const c of candles) { const f = flicker(t, c.seed) * (1 - 0.6 * c.spring.melt); c.flame.scale.set(f, 1.8 * f, f); c.light.intensity = 0.6 * f; c.flame.visible = c.spring.melt < 1; }
      meshClock += dt; let sm: ReturnType<typeof smokeMesh> | null = null;
      if (meshClock > 1 / 20) { meshClock = 0; sm = rebuild(m); }
      hudClock += dt;
      if (hudClock > 0.25 && sm) { hudClock = 0; const melt = candles.reduce((a, c) => a + c.spring.melt, 0) / CANDLES; setHud({ melt, rate: meltRate(m), tear: tearFrom(m), kept: sm.kept, total: sm.total, volume: m.volume, volatility: m.volatility, bars }); }
      controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(frame);
    };
    rebuild({ volume: 1, volatility: 1 }); raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); controls.dispose(); renderer.dispose(); pmrem.dispose(); renderer.domElement.remove(); };
  }, [edition]); // eslint-disable-line react-hooks/exhaustive-deps

  const checks = useMemo(() => checkEdition(edition), [edition]);
  const swatches = useMemo(() => palette(edition), [edition]);
  const [dragon, setDragon] = useState(false); const [gameSeed, setGameSeed] = useState(3);
  const game = useMemo(() => basisGame(32, rng(gameSeed), dragon), [gameSeed, dragon]);
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  return (
    <main className="min-h-screen px-4 py-6" style={{ background: e.background, color: e.text }}>
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs opacity-70">LAB · 蝋燭と煙</p>
            <h1 className="text-2xl font-semibold">{e.label} — {e.mood}</h1>
            <p className="max-w-2xl text-sm opacity-80">金属の円筒に破れた煙のメッシュが巻き付き、周りの蝋燭はバネになって溶けていきます。溶ける速さは出来高とボラティリティで決まります。価格はすべて合成データです。</p>
          </div>
          <nav className="flex gap-2 font-mono text-xs"><Link href="/lab/glass-knot" className="border px-3 py-1" style={{ borderColor: `${e.text}55` }}>ガラスの紐 LAB</Link><Link href="/lab/knot-ladder" className="border px-3 py-1" style={{ borderColor: `${e.text}55` }}>立方体のはしご</Link></nav>
        </header>

        <div className="flex flex-wrap gap-2 font-mono text-xs" role="group" aria-label="エディション">
          {(Object.keys(EDITIONS) as Edition[]).map((k) => (
            <button key={k} type="button" data-testid={`edition-${k}`} aria-pressed={edition === k} onClick={() => setEdition(k)} className="border px-3 py-1" style={{ borderColor: edition === k ? e.accent : `${e.text}44`, color: edition === k ? e.accent : e.text }}>{EDITIONS[k].label}（{EDITIONS[k].mood}）</button>
          ))}
          <button type="button" onClick={() => resetRef.current()} className="border px-3 py-1" style={{ borderColor: `${e.text}44` }}>新しい蝋燭</button>
          <label className="flex items-center gap-1 px-2"><input type="checkbox" checked={auto} onChange={(ev) => setAuto(ev.target.checked)} />合成データから</label>
          {!auto && (['volume', 'volatility'] as const).map((k) => (
            <label key={k} className="flex items-center gap-1 px-2">{k === 'volume' ? '出来高' : 'ボラティリティ'} ×{manual[k].toFixed(1)}
              <input type="range" min={0} max={3} step={0.1} value={manual[k]} onChange={(ev) => setManual({ ...manual, [k]: Number(ev.target.value) })} aria-label={k} /></label>
          ))}
        </div>

        <div ref={mount} className="relative w-full overflow-hidden border" style={{ borderColor: `${e.text}22` }} />

        <section data-testid="hud" className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
          <div>出来高 ×{hud.volume.toFixed(2)} / ボラ ×{hud.volatility.toFixed(2)}</div>
          <div data-testid="melt">溶けた量 {pct(hud.melt)}（{(hud.rate * 100).toFixed(2)}%/秒）</div>
          <div data-testid="smoke">煙の残り {hud.kept}/{hud.total}（破れのしきい値 {hud.tear.toFixed(2)}）</div>
          <div>足 {hud.bars} 本</div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-2 border p-3" style={{ borderColor: `${e.text}22` }}>
            <h2 className="font-semibold">色彩規則</h2>
            <p className="text-xs opacity-80">色相 = 基準 {e.baseHue}° + k × {e.stepDeg.toFixed(1)}°、彩度 = {e.s0} × {e.satRatio.toFixed(3)}^(k mod 3)、明度は暗・明を交互。</p>
            <div className="flex gap-1">{swatches.map((s) => <div key={s.k} title={`${s.hex} ${s.hue.toFixed(0)}°`} className="h-8 flex-1" style={{ background: s.hex }} />)}</div>
            <div className="flex gap-1 text-[10px]">{[['背景', e.background], ['煙', e.smoke], ['価格線', e.price], ['金属', e.metal], ['アクセント', e.accent], ...e.wax.map((w, i) => [`蝋 ${i + 1}`, w])].map(([n, c]) => <div key={n} className="flex-1"><div className="h-5 border" style={{ background: c, borderColor: `${e.text}33` }} />{n}</div>)}</div>
            <table data-testid="checks" className="w-full font-mono text-xs"><tbody>
              {checks.map((c) => <tr key={c.name}><td>{c.name}</td><td className="text-right">{c.value.toFixed(2)}</td><td className="text-right">≥ {c.min}</td><td className="text-right">{c.ok ? '✓' : '✗'}</td></tr>)}
            </tbody></table>
            <p className="text-xs opacity-70">炎のゆらぎは 2.5 Hz 以下・明るさ ±8% 以内（3 Hz を超える点滅はしない）。</p>
          </section>

          <section className="space-y-2 border p-3" style={{ borderColor: `${e.text}22` }}>
            <h2 className="font-semibold">二つの基底ゲーム（BB84 風・遊び）</h2>
            <p className="text-xs opacity-80">送り手は 1 ビットずつ黄金比か大和比の基底で煙に色を付け、受け手は基底を当てます。基底が一致した回だけ残します。龍が途中で読むと、残ったビットの約 4 分の 1 が食い違って気付けます。本物の暗号ではありません。</p>
            <div className="flex flex-wrap gap-[3px]" data-testid="rounds">
              {game.rounds.map((rd, i) => (
                <div key={i} title={`bit ${rd.bit} → ${rd.read}`} className="flex h-7 w-7 items-center justify-center font-mono text-[10px]"
                  style={{ background: EDITIONS[rd.sendBasis].wax[rd.sendBasis === 'golden' ? 2 : 1], color: '#111', opacity: rd.kept ? 1 : 0.25, outline: rd.kept && rd.read !== rd.bit ? `2px solid ${e.accent}` : 'none' }}>{rd.kept ? rd.read : '·'}</div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
              <label className="flex items-center gap-1"><input type="checkbox" data-testid="dragon" checked={dragon} onChange={(ev) => setDragon(ev.target.checked)} />龍が読む</label>
              <button type="button" className="border px-2 py-0.5" style={{ borderColor: `${e.text}44` }} onClick={() => setGameSeed((s) => s + 1)}>もう一度</button>
              <span data-testid="qber">残った {game.kept} ビット・食い違い {game.errors}（{pct(game.errorRate)}）</span>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
