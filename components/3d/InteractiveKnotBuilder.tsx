'use client';

import { DragControls, Line, OrbitControls, Trail } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { AnimatePresence, motion } from 'framer-motion';
import { LockKeyhole, Sparkles, WandSparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import PackageTradePopup from './PackageTradePopup';

type GravityType = 'EXPANSIVE' | 'CONTRACTIVE' | 'BALANCED';
type StrategyProfile = 'THE_CHARIOT' | 'THE_HERMIT' | 'THE_HANGED_MAN' | 'TEMPERANCE';
type Ticket = {
  shape_type: string;
  symbols: string[];
  total_pnl: number;
  mana_consumed: number;
  gravity_type?: GravityType;
  persona_name?: string;
};
type Point = [number, number, number];

const fallbackTickets: Ticket[] = [
  { shape_type: 'Hexagram', symbols: ['US500', 'NAS100', 'EURUSD', 'USDJPY', 'XAUUSD', 'AAPL', 'SPY'], total_pnl: 148.2, mana_consumed: 160, gravity_type: 'CONTRACTIVE', persona_name: 'QUEEN_OF_WATER' },
  { shape_type: 'Triangle', symbols: ['BTCUSD', 'ETHUSD', 'SOLUSD'], total_pnl: 620.4, mana_consumed: 280, gravity_type: 'EXPANSIVE', persona_name: 'QUEEN_OF_FIRE' },
];

function idealPoints(count: number): Point[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = -Math.PI / 2 + index * (Math.PI * 2 / count);
    return [Math.cos(angle) * 2.2, Math.sin(angle) * 2.2, (index % 2) * 0.35 - 0.15];
  });
}

function TriangleBoundary() {
  const vertices: Point[] = [[0, 2.7, -0.8], [-2.65, -1.9, -0.8], [2.65, -1.9, -0.8], [0, 0.1, 2.3]];
  const edges = [[0, 1], [1, 2], [2, 0], [0, 3], [1, 3], [2, 3]];
  return <group rotation={[0.08, 0.15, 0]}>{edges.map(([from, to]) => <Line key={`${from}-${to}`} points={[vertices[from], vertices[to]]} color="#22d3ee" lineWidth={0.65} transparent opacity={0.28} />)}</group>;
}

function KnotField({
  points,
  gravityType,
  optimizing,
  selectedIndices,
  formedLines,
  strategy,
  elasticLimit,
  onDrag,
  onElasticDrop,
  onPhysics,
}: {
  points: Point[];
  gravityType: GravityType;
  optimizing: boolean;
  selectedIndices: number[];
  formedLines: number;
  strategy: StrategyProfile;
  elasticLimit: number;
  onDrag: (index: number, matrix: THREE.Matrix4) => void;
  onElasticDrop: (index: number) => void;
  onPhysics: (next: Point[]) => void;
}) {
  const previousTime = useRef(0);
  const strategyForce = strategy === 'THE_CHARIOT' ? 1.8 : strategy === 'THE_HERMIT' ? -0.45 : strategy === 'THE_HANGED_MAN' ? -1.2 : 0.35;
  const repulsion = (gravityType === 'EXPANSIVE' ? 1 : gravityType === 'CONTRACTIVE' ? -1 : 0.15) * strategyForce;
  const strategyColor = strategy === 'THE_CHARIOT' ? '#fb4934' : strategy === 'THE_HERMIT' ? '#a8b2bd' : strategy === 'THE_HANGED_MAN' ? '#a855f7' : '#f5d06f';
  const linePoints = points.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const knotLines = selectedIndices.slice(0, formedLines + 1).map((index, lineIndex, selected) => [
    linePoints[index], linePoints[selected[(lineIndex + 1) % selected.length]],
  ]);

  useFrame(({ clock }) => {
    const now = clock.getElapsedTime();
    if (!optimizing || now - previousTime.current < 0.07) return;
    previousTime.current = now;
    const next = points.map(([x, y, z], index) => {
      const center = new THREE.Vector3(x, y, z);
      const force = center.clone().multiplyScalar(repulsion * 0.055);
      points.forEach(([otherX, otherY, otherZ], otherIndex) => {
        if (index === otherIndex) return;
        const delta = center.clone().sub(new THREE.Vector3(otherX, otherY, otherZ));
        const distance = Math.max(delta.lengthSq(), 0.3);
        force.add(delta.normalize().multiplyScalar((repulsion * 0.018) / distance));
      });
      if (gravityType === 'CONTRACTIVE') force.add(center.clone().multiplyScalar(-0.045));
      return [x + force.x, y + force.y, z + force.z] as Point;
    });
    onPhysics(next);
  });

  return (
    <group>
      <ambientLight intensity={0.3} />
      <pointLight position={[0, 2, 4]} intensity={20} color="#52e5d0" />
      <pointLight position={[0, -2, -2]} intensity={14} color="#f5d06f" />
      <TriangleBoundary />
      {knotLines.map(([from, to], index) => <Line key={`knot-${index}`} points={[from, to]} color={strategyColor} lineWidth={strategy === 'THE_CHARIOT' ? 3.4 : 2} transparent opacity={0.95} />)}
      {points.map(([x, y, z], index) => {
        const selected = selectedIndices.includes(index);
        const dimmed = optimizing && !selected;
        const anchor = strategy === 'THE_HERMIT' && selected;
        return (
          <DragControls key={index} autoTransform={false} onDrag={(matrix: THREE.Matrix4) => onDrag(index, matrix)} onDragEnd={() => onElasticDrop(index)}>
            <Trail width={selected ? 0.85 : 0.35} length={selected ? 4.5 : 2} color={selected ? '#f5d06f' : '#28748a'} attenuation={(value) => value * value}>
              <mesh position={[x, y, z]} scale={anchor ? 1.7 : selected ? 1.18 : dimmed ? 0.7 : 1}>
                <sphereGeometry args={[0.18, 20, 20]} />
                <meshStandardMaterial color={anchor ? '#94a3b8' : selected ? strategyColor : '#67e8f9'} emissive={anchor ? '#64748b' : selected ? strategyColor : '#075985'} emissiveIntensity={dimmed ? 0.25 : anchor ? 1.4 : selected ? 4 : 2} transparent opacity={dimmed ? 0.22 : 1} metalness={0.65} roughness={0.18} />
              </mesh>
            </Trail>
          </DragControls>
        );
      })}
      {strategy === 'THE_HANGED_MAN' && <mesh position={[0, 0, 0]}><sphereGeometry args={[0.72, 32, 32]} /><meshBasicMaterial color="#050208" transparent opacity={0.84} /></mesh>}
      <OrbitControls enablePan={false} enableZoom={false} autoRotate={!optimizing} autoRotateSpeed={0.35} />
    </group>
  );
}

export default function InteractiveKnotBuilder({
  initialSymbols = [],
  apiUrl = 'http://localhost:8000',
  onPackageReady,
}: {
  initialSymbols?: string[];
  apiUrl?: string;
  onPackageReady?: (symbols: string[]) => void;
}) {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>(fallbackTickets);
  const [points, setPoints] = useState<Point[]>(idealPoints(7));
  const [symbols, setSymbols] = useState<string[]>(() => Array.from(new Set([...initialSymbols, ...fallbackTickets[0].symbols])).slice(0, 7));
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [formedLines, setFormedLines] = useState(0);
  const [optimizing, setOptimizing] = useState(false);
  const [locked, setLocked] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [strategy, setStrategy] = useState<StrategyProfile>('THE_HERMIT');
  const [limitPrice, setLimitPrice] = useState(100);
  const [orderStatus, setOrderStatus] = useState('Elastic limit armed');
  const [notice, setNotice] = useState('Drag a node to tune the constellation');

  useEffect(() => {
    let active = true;
    fetch(`${apiUrl}/api/settlement-tickets?limit=120`)
      .then((response) => response.ok ? response.json() as Promise<{ tickets: Ticket[] }> : Promise.reject(new Error('ticket history unavailable')))
      .then((payload) => { if (active && payload.tickets.length > 0) setTickets(payload.tickets); })
      .catch(() => setNotice('Local constellation cache / drag to explore'));
    return () => { active = false; };
  }, [apiUrl]);

  const gravityType = useMemo<GravityType>(() => {
    const counts = tickets.reduce<Record<string, number>>((result, ticket) => {
      const gravity = ticket.gravity_type ?? 'BALANCED';
      result[gravity] = (result[gravity] ?? 0) + 1;
      return result;
    }, {});
    return (Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] as GravityType) ?? 'BALANCED';
  }, [tickets]);
  const matchingTickets = useMemo(() => tickets.filter((ticket) => ticket.gravity_type === gravityType || !ticket.gravity_type), [gravityType, tickets]);
  const bestTicket = useMemo(() => [...matchingTickets].sort((left, right) => right.total_pnl - left.total_pnl)[0] ?? fallbackTickets[0], [matchingTickets]);
  const confidence = Math.min(99, Math.round(72 + Math.min(bestTicket.symbols.length, 7) * 3));
  const manaCost = Math.max(80, bestTicket.mana_consumed + 4 * 8);
  const optimizedSymbols = selectedIndices.map((index) => symbols[index]).filter(Boolean);
  const strategyConfig: Record<StrategyProfile, { label: string; description: string; limit: number }> = {
    THE_CHARIOT: { label: 'SLINGSHOT', description: '陰の圧縮を反発へ変換', limit: 3.6 },
    THE_HERMIT: { label: 'ANCHOR', description: '質量差を中立重心へ固定', limit: 2.45 },
    THE_HANGED_MAN: { label: 'TRAP', description: '出来高乖離の逆張り場', limit: 1.8 },
    TEMPERANCE: { label: 'ARBITRAGE', description: '逆相関スプレッドの平均回帰', limit: 2.8 },
  };
  const elasticLimit = strategyConfig[strategy].limit;
  const suggestedStrategy: StrategyProfile = gravityType === 'EXPANSIVE' ? 'THE_CHARIOT' : gravityType === 'CONTRACTIVE' ? 'THE_HANGED_MAN' : 'THE_HERMIT';

  function handleDrag(index: number, matrix: THREE.Matrix4) {
    const nextPosition = new THREE.Vector3();
    matrix.decompose(nextPosition, new THREE.Quaternion(), new THREE.Vector3());
    if (selectedIndices.includes(index) && nextPosition.length() > elasticLimit) nextPosition.setLength(elasticLimit);
    setPoints((current) => current.map((point, pointIndex) => pointIndex === index ? [nextPosition.x, nextPosition.y, nextPosition.z] : point));
    setLocked(false);
    setNotice(`${gravityType} field recalibrated / node ${String(index + 1).padStart(2, '0')}`);
  }

  function handleElasticDrop(index: number) {
    if (!selectedIndices.includes(index) || optimizedSymbols.length !== 4) return;
    const point = new THREE.Vector3(...points[index]);
    if (point.length() < elasticLimit * 0.94) return;
    setOrderStatus(`Limit reached / ${strategyConfig[strategy].label} package submitting`);
    fetch(`${apiUrl}/api/execute_limit_package`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ symbols: optimizedSymbols, limit_price: limitPrice, action: 'LONG', strategy, lot_size: 0.01 }),
    }).then((response) => {
      if (!response.ok) throw new Error('limit order rejected');
      setOrderStatus('Limit package accepted by MT5 guard');
    }).catch(() => setOrderStatus('Limit package unavailable / elastic lock remains armed'));
  }

  function optimizeConstellation() {
    const candidates = Array.from(new Set([...initialSymbols, ...bestTicket.symbols, ...symbols])).slice(0, 7);
    setSymbols(candidates);
    setPoints(idealPoints(candidates.length));
    const selected = candidates.map((symbol, index) => ({ index, score: (bestTicket.symbols.includes(symbol) ? 2 : 0) + (initialSymbols.includes(symbol) ? 1 : 0) })).sort((left, right) => right.score - left.score || left.index - right.index).slice(0, 4).map(({ index }) => index);
    setSelectedIndices(selected);
    setFormedLines(0);
    setOptimizing(true);
    setLocked(false);
    setNotice('Phase 1 / four high-resonance nodes selected');
    window.setTimeout(() => { setFormedLines(1); setNotice('Phase 2 / first binding line drawn'); }, 650);
    window.setTimeout(() => { setFormedLines(2); setNotice('Phase 2 / second binding line drawn'); }, 1050);
    window.setTimeout(() => { setFormedLines(3); setLocked(true); setOptimizing(false); setNotice('Four-node knot locked / package ready'); }, 1450);
  }

  function beginWarp() {
    onPackageReady?.(optimizedSymbols);
    setTransitioning(true);
    window.setTimeout(() => router.push('/matrix'), 980);
  }

  const packageSymbols = optimizedSymbols.length === 4 ? optimizedSymbols : symbols.slice(0, 4);
  return (
    <section className="relative mt-8 overflow-hidden border border-cyan-200/15 bg-[#020a10] shadow-[0_0_50px_rgba(34,211,238,.06)]">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6">
        <div><p className="font-mono text-[9px] uppercase tracking-[0.34em] text-cyan-300/70">Gravity constellation / persona assist</p><h2 className="mt-1 text-lg tracking-[0.1em]">INTERACTIVE KNOT BUILDER</h2></div>
        <p className="max-w-sm text-right font-mono text-[9px] uppercase tracking-[0.14em] text-stone-500">{notice}</p>
      </div>
      <div className="grid lg:grid-cols-[1.4fr_.8fr]">
        <div className="relative h-[430px] min-h-[360px] border-b border-white/10 lg:border-b-0 lg:border-r"><Canvas camera={{ position: [0, 0, 7.5], fov: 45 }} dpr={[1, 1.5]}><color attach="background" args={['#020a10']} /><fog attach="fog" args={['#020a10', 6, 16]} /><KnotField points={points} gravityType={gravityType} strategy={strategy} elasticLimit={elasticLimit} optimizing={optimizing} selectedIndices={selectedIndices} formedLines={formedLines} onDrag={handleDrag} onElasticDrop={handleElasticDrop} onPhysics={setPoints} /></Canvas><div className="pointer-events-none absolute bottom-4 left-4 font-mono text-[9px] uppercase tracking-[0.18em] text-stone-500">TETRAHEDRON FIELD / {symbols.length} candidates / {selectedIndices.length || 0} selected</div></div>
        <div className="flex flex-col justify-between p-5 sm:p-6">
          <div><div className="flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-[0.22em] text-amber-200/70">Persona gravity</span><WandSparkles className="h-4 w-4 text-amber-200" /></div><p className="mt-3 text-2xl tracking-[0.08em] text-cyan-50">{gravityType}</p><p className="font-mono text-[9px] uppercase tracking-[0.15em] text-stone-500">{bestTicket.persona_name ?? 'HISTORY FIELD'} / {confidence}% resonance</p><div className="mt-5 flex flex-wrap gap-1.5">{symbols.map((symbol, index) => <span key={symbol} className={`border px-2 py-1 font-mono text-[9px] ${selectedIndices.includes(index) ? 'border-amber-200/70 text-amber-100' : 'border-cyan-200/15 text-cyan-100/60'}`}>{symbol}</span>)}</div></div>
          <div className="mt-6"><p className="font-mono text-[9px] leading-5 text-stone-500">過去チケットの重力場を再現し、7候補から易経・利益共鳴の高い4銘柄を抽出します。</p><div className="mt-4 grid grid-cols-2 gap-1.5">{(Object.keys(strategyConfig) as StrategyProfile[]).map((profile) => <button key={profile} type="button" onClick={() => { setStrategy(profile); setNotice(`${strategyConfig[profile].label} field armed`); }} className={`border px-2 py-2 text-left font-mono text-[9px] uppercase tracking-[0.1em] ${strategy === profile ? 'border-amber-200/70 bg-amber-100/10 text-amber-100' : 'border-cyan-200/20 text-cyan-100/60'}`}>{strategyConfig[profile].label}{profile === suggestedStrategy && <span className="ml-1 text-cyan-300">/ assist</span>}<span className="mt-1 block normal-case tracking-normal text-stone-500">{strategyConfig[profile].description}</span></button>)}</div><div className="mt-3 flex items-center gap-2"><label className="font-mono text-[9px] uppercase text-stone-500" htmlFor="limit-price">Limit</label><input id="limit-price" type="number" min="0.0001" step="0.01" value={limitPrice} onChange={(event) => setLimitPrice(Number(event.target.value))} className="w-24 border border-cyan-200/20 bg-black/30 px-2 py-1 font-mono text-xs text-cyan-50" /><span className="font-mono text-[9px] text-stone-500">elastic {elasticLimit.toFixed(2)} / {orderStatus}</span></div><div className="mt-4 flex gap-2"><button type="button" onClick={optimizeConstellation} disabled={optimizing} className="inline-flex items-center gap-2 border border-cyan-200/35 bg-cyan-200/[0.06] px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-cyan-100 disabled:opacity-40"><Sparkles className="h-3 w-3" /> Optimize four</button>{locked && <span className="inline-flex items-center gap-2 border border-amber-100/45 bg-amber-100/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-100"><LockKeyhole className="h-3 w-3" /> Knot locked</span>}</div></div>
        </div>
      </div>
      <AnimatePresence>{locked && <PackageTradePopup shape="Tetrahedron / 4-node knot" symbols={packageSymbols} manaCost={manaCost} confidence={confidence} onApprove={beginWarp} onReturn={() => router.push('/matrix')} transitioning={transitioning} />}</AnimatePresence>
      {transitioning && <motion.div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden bg-[#dffcff]" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.95, 1] }} transition={{ duration: 0.95, times: [0, 0.72, 1] }}><motion.div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-cyan-900 shadow-[0_0_80px_30px_rgba(34,211,238,.8)]" animate={{ scale: [1, 18] }} transition={{ duration: 0.95, ease: 'easeIn' }} /><motion.div className="absolute inset-0 bg-[radial-gradient(circle,transparent_0,rgba(34,211,238,.28)_38%,#e7feff_80%)]" animate={{ scale: [0.4, 2.2] }} transition={{ duration: 0.95, ease: 'easeIn' }} /></motion.div>}
    </section>
  );
}
