"use client";

import { motion } from "framer-motion";
import { ArrowLeft, CircleDot, Radio, ScanSearch, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import TarotCard, { type TarotCardProps, type TriLayerStatus, type WuxingPhase } from "@/components/TarotCard";
import { useMarketStream } from "@/hooks/useMarketStream";
import { calculateResonance, demoPortfolio, getTransitionRoute, type TransitionRoute } from "@/lib/portfolio";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer, DepthOfField } from "@react-three/postprocessing";

type GalleryCard = TarotCardProps & { index: number; isLive: boolean };

const arcanaCards: Array<Pick<GalleryCard, "index" | "cardName" | "symbol">> = [
  { index: 0, cardName: "0_THE_FOOL", symbol: "DOGEUSD" },
  { index: 1, cardName: "1_THE_MAGICIAN", symbol: "BTCUSD" },
  { index: 2, cardName: "2_THE_HIGH_PRIESTESS", symbol: "EURUSD" },
  { index: 3, cardName: "3_THE_EMPRESS", symbol: "XAUUSD" },
  { index: 4, cardName: "4_THE_EMPEROR", symbol: "US500" },
  { index: 5, cardName: "5_THE_HIEROPHANT", symbol: "GBPUSD" },
  { index: 6, cardName: "6_THE_LOVERS", symbol: "ETHUSD" },
  { index: 7, cardName: "7_THE_CHARIOT", symbol: "NAS100" },
  { index: 8, cardName: "8_STRENGTH", symbol: "US30" },
  { index: 9, cardName: "9_THE_HERMIT", symbol: "USDJPY" },
  { index: 10, cardName: "10_WHEEL_OF_FORTUNE", symbol: "SOLUSD" },
  { index: 11, cardName: "11_JUSTICE", symbol: "AUDUSD" },
  { index: 12, cardName: "12_THE_HANGED_MAN", symbol: "XAGUSD" },
  { index: 13, cardName: "13_DEATH", symbol: "LTCUSD" },
  { index: 14, cardName: "14_TEMPERANCE", symbol: "USDCHF" },
  { index: 15, cardName: "15_THE_DEVIL", symbol: "XRPUSD" },
  { index: 16, cardName: "16_THE_TOWER", symbol: "BTCXAU" },
  { index: 17, cardName: "17_THE_STAR", symbol: "NZDUSD" },
  { index: 18, cardName: "18_THE_MOON", symbol: "USDCAD" },
  { index: 19, cardName: "19_THE_SUN", symbol: "DAX40" },
  { index: 20, cardName: "20_JUDGEMENT", symbol: "ADAUSD" },
  { index: 21, cardName: "21_THE_WORLD", symbol: "GER40" },
];

const phases: WuxingPhase[] = ["FIRE", "WATER", "WOOD", "EARTH", "METAL"];
const macroStates = ["DOWN_CONFIRMED", "UP_CONFIRMED", "NEUTRAL", "TRENDING"];
const mesoStates = ["KNOT_FORMED", "SCANNING", "KNOT", "SCANNING"];
const microStates = ["FILLING", "STABLE", "NOISE", "PRESSURE"];

function demoState(index: number): GalleryCard {
  return {
    ...arcanaCards[index],
    isLive: false,
    wuxing_phase: phases[index % phases.length],
    hexagramBinary: index.toString(2).padStart(6, "0"),
    tri_layer: {
      macro: macroStates[index % macroStates.length],
      meso: mesoStates[index % mesoStates.length],
      micro: microStates[index % microStates.length],
    },
  };
}

function PendingCard({ card }: { card: GalleryCard }) {
  return (
    <motion.article
      className="flex min-h-[390px] flex-col justify-between rounded-xl border border-dashed border-white/15 bg-white/[0.025] p-4 text-stone-600 backdrop-blur-xl"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.2 } }}
    >
      <div className="flex items-start justify-between border-b border-white/10 pb-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.28em]">Major arcana</p>
          <h2 className="mt-1 text-lg font-medium text-stone-500">{card.cardName}</h2>
        </div>
        <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[9px] tracking-[0.18em]">WAIT</span>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="h-32 w-20 rounded-[45%_45%_20%_20%] border border-white/10 bg-black/10 shadow-inner shadow-white/5" />
        <p className="font-mono text-[10px] uppercase tracking-[0.25em]">Awaiting signal</p>
      </div>
      <div className="border-t border-white/10 pt-3 font-mono text-xs tracking-[0.14em] text-stone-500">{card.symbol}</div>
    </motion.article>
  );
}

function phaseFrom(value: string | undefined, fallback: WuxingPhase): WuxingPhase {
  const normalized = value?.toUpperCase() as WuxingPhase | undefined;
  return normalized && phases.includes(normalized) ? normalized : fallback;
}

function GalleryTransition({ route }: { route: TransitionRoute }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const startedAt = useRef(performance.now());
  const count = 260;
  useFrame(() => {
    if (!meshRef.current) return;
    const progress = Math.min((performance.now() - startedAt.current) / 760, 1);
    const matrix = new THREE.Matrix4();
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399;
      const radius = 1.2 + (index % 17) * 0.24;
      const position = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, route === 'voxel' ? -progress * (index % 13 + 2) : progress * 1.4);
      matrix.makeTranslation(position.x, position.y, position.z).scale(new THREE.Vector3(0.08, 0.08, 0.08));
      meshRef.current.setMatrixAt(index, matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });
  return <Canvas camera={{ position: [0, 0, 7] }}><color attach="background" args={['#030712']} /><ambientLight intensity={1} /><instancedMesh ref={meshRef} args={[undefined, undefined, count]}><cylinderGeometry args={[0.08, 0.08, 0.08, 6]} /><meshBasicMaterial color={route === 'voxel' ? '#5eead4' : '#f0abfc'} transparent opacity={0.9} /></instancedMesh>{route === 'lens' && <EffectComposer><DepthOfField focusDistance={0.02} focalLength={0.16} bokehScale={12} /></EffectComposer>}</Canvas>;
}

const genesisHexagrams = Array.from({ length: 24 }, (_, index) => index);

function EmptyHexagram({ index }: { index: number }) {
  return (
    <motion.div
      className="relative aspect-square overflow-hidden border border-cyan-200/10 bg-[#02060b]/70"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.025, duration: 0.45 }}
    >
      <div className="absolute inset-[18%] flex flex-col justify-center gap-[7%] opacity-60">
        {Array.from({ length: 6 }, (_, line) => <span key={line} className="block h-px w-full bg-cyan-200/20" />)}
      </div>
      <span className="absolute left-2 top-2 font-mono text-[8px] text-cyan-100/20">{String(index + 1).padStart(2, "0")}</span>
    </motion.div>
  );
}

function GenesisExperience({ onSelect }: { onSelect: (symbol: string) => void }) {
  return (
    <section className="relative isolate overflow-hidden border border-cyan-200/15 bg-[#02060b]/85 px-4 py-5 shadow-[0_0_100px_rgba(34,211,238,0.08)] sm:px-8 sm:py-8" aria-labelledby="genesis-title">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(103,232,249,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(103,232,249,.08)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative mx-auto max-w-5xl">
        <div className="mb-6 flex items-end justify-between border-b border-cyan-200/10 pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-cyan-200/50">Genesis protocol / field 00</p>
            <h1 id="genesis-title" className="mt-2 text-2xl tracking-[-0.03em] text-cyan-50 sm:text-4xl">最初の銘柄（ジェネシス・ノード）を選択</h1>
          </div>
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.2em] text-stone-600 sm:block">No active knots</span>
        </div>

        <div className="relative grid grid-cols-4 gap-2 sm:grid-cols-6">
          {genesisHexagrams.map((index) => <EmptyHexagram key={index} index={index} />)}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-5">
            <div className="pointer-events-auto w-full max-w-md border border-cyan-200/20 bg-[#030912]/95 p-5 text-center shadow-[0_0_50px_rgba(34,211,238,0.1)] backdrop-blur sm:p-7">
              <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-amber-200/70">The field is waiting</p>
              <p className="mt-3 font-mono text-xs leading-6 text-stone-400">空の六爻グリッドに、最初の観測点を接続してください。</p>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {arcanaCards.slice(0, 6).map((card) => (
                  <button key={card.symbol} type="button" onClick={() => onSelect(card.symbol)} className="border border-cyan-200/25 bg-cyan-100/[0.04] px-3 py-3 text-left font-mono text-[10px] tracking-[0.14em] text-cyan-100 transition-colors hover:border-cyan-100/80 hover:bg-cyan-100/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">
                    <span className="block text-cyan-100/45">NODE {String(card.index).padStart(2, "0")}</span>
                    <span className="mt-1 block">{card.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className="mt-5 font-mono text-[9px] uppercase tracking-[0.24em] text-stone-600">Wireframe state / resonance: dormant / knots: 0</p>
      </div>
    </section>
  );
}

function GenesisTransition({ symbol, phase }: { symbol: string; phase: "focus" | "birth" }) {
  return (
    <div className={`fixed inset-0 z-50 overflow-hidden bg-[#010307] ${phase === "birth" ? "genesis-birth" : "genesis-focus"}`} aria-label={`Genesis node ${symbol} transition`}>
      <div className="absolute inset-0 genesis-lens" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="genesis-ring h-24 w-24 rounded-full border border-cyan-100/80" />
        {phase === "birth" && <div className="genesis-particles absolute h-2 w-2 rounded-full bg-amber-100 shadow-[0_0_30px_12px_rgba(253,224,71,0.8)]" />}
        <div className="absolute text-center font-mono">
          <p className="text-[10px] uppercase tracking-[0.4em] text-cyan-100/60">Genesis node forming</p>
          <p className="mt-3 text-2xl tracking-[0.18em] text-cyan-50">{symbol}</p>
        </div>
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const { marketDataMap, isConnected } = useMarketStream(process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/signals");
  const demoCards = useMemo(() => arcanaCards.map((_, index) => demoState(index)), []);
  const liveCards = useMemo(() => Object.values(marketDataMap).map((live, index): GalleryCard => ({
    index,
    isLive: true,
    cardName: live.major_arcana || arcanaCards.find((card) => card.symbol === live.symbol)?.cardName || "UNKNOWN_ARCANA",
    symbol: live.symbol,
    wuxing_phase: phaseFrom(live.wuxing_phase, "EARTH"),
    hexagramBinary: live.hexagram_binary,
    tri_layer: live.tri_layer,
  })), [marketDataMap]);
  const cards = useMemo(() => {
    const liveSymbols = new Set(liveCards.map((card) => card.symbol));
    const placeholders = demoCards.filter((card) => !liveSymbols.has(card.symbol));
    return [...liveCards, ...placeholders];
  }, [demoCards, liveCards]);

  const activeCount = useMemo(() => Object.values(marketDataMap).filter((card) => card.tri_layer.micro !== "STABLE").length, [marketDataMap]);
  const updatedSymbol = Object.keys(marketDataMap).at(-1) ?? null;
  const [transition, setTransition] = useState<{ symbol: string; route: TransitionRoute } | null>(null);
  const [genesisSymbol, setGenesisSymbol] = useState<string | null>(null);
  const [genesisPhase, setGenesisPhase] = useState<"focus" | "birth">("focus");
  const [hasGenesis, setHasGenesis] = useState<boolean | null>(null);

  useEffect(() => {
    setHasGenesis(Boolean(window.localStorage.getItem("charttestui-genesis-symbol")));
  }, []);

  function openSymbol(symbol: string) {
    setTransition(null);
    window.location.href = `/strategy/${encodeURIComponent(symbol)}`;
  }

  function selectGenesis(symbol: string) {
    window.localStorage.setItem("charttestui-genesis-symbol", symbol);
    setGenesisSymbol(symbol);
    window.setTimeout(() => setGenesisPhase("birth"), 620);
    window.setTimeout(() => { window.location.href = `/live/${encodeURIComponent(symbol)}?transition=lens`; }, 1450);
  }

  if (hasGenesis === null) return <main className="min-h-screen bg-[#030712]" />;

  if (!hasGenesis) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-gray-950 px-4 py-6 text-stone-100 sm:px-8 lg:px-12">
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(8,145,178,0.12),transparent_38%),linear-gradient(135deg,#030712_0%,#010307_55%,#07111c_100%)]" />
        <div className="relative mx-auto max-w-[1800px]">
          <header className="mb-8 flex items-center justify-between border-b border-white/10 pb-5">
            <Link href="/" className="font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500 hover:text-cyan-200">Command center</Link>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan-100/45">Observer field / initializing</p>
          </header>
          <GenesisExperience onSelect={selectGenesis} />
        </div>
        {genesisSymbol && <GenesisTransition symbol={genesisSymbol} phase={genesisPhase} />}
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-gray-950 px-4 py-6 text-stone-100 sm:px-8 lg:px-12">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(56,189,248,0.12),transparent_30%),radial-gradient(circle_at_82%_70%,rgba(168,85,247,0.1),transparent_28%),linear-gradient(135deg,#030712_0%,#111827_50%,#020617_100%)]" />
      <div className="pointer-events-none fixed inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:64px_64px]" />

      <div className="relative mx-auto max-w-[1800px]">
        <header className="mb-8 flex flex-col gap-6 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-5 flex items-center gap-5"><Link href="/" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500 transition-colors hover:text-stone-200"><ArrowLeft className="h-3 w-3" /> Command center</Link><Link href="/matrix" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500 hover:text-cyan-200">Matrix field</Link><Link href="/profile" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500 hover:text-cyan-200"><UserRound className="h-3 w-3" /> Profile</Link></div>
            <div className="flex items-center gap-3"><Sparkles className="h-5 w-5 text-amber-200" /><p className="font-mono text-[10px] uppercase tracking-[0.42em] text-stone-500">The arcana observatory</p></div>
            <h1 className="mt-3 text-4xl font-medium tracking-[-0.04em] text-stone-100 sm:text-6xl">THE TWENTY-TWO</h1>
            <p className="mt-3 max-w-xl font-mono text-xs leading-6 text-stone-500">A living gallery of market archetypes. Each card carries its environment, knot, and micro-pressure as an active field.</p>
          </div>
          <div className="flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.22em] text-stone-500">
            <span className="flex items-center gap-2"><CircleDot className={`h-3 w-3 ${isConnected ? "text-emerald-300" : "text-stone-600"}`} /> {isConnected ? "live transmission" : "demo constellation"}</span>
            <span className="flex items-center gap-2"><ScanSearch className="h-3 w-3 text-cyan-300" /> {activeCount}/22 active</span>
          </div>
        </header>

        <section aria-label="Major Arcana market gallery" className="grid grid-cols-2 items-start gap-3 sm:gap-5">
          {Object.values(cards).map((card, index) => (
            <motion.div
              className="relative z-0"
              key={card.symbol}
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.035, duration: 0.5 }}
              whileHover={{ scale: 1.045, zIndex: 30, transition: { duration: 0.2 } }}
            >
              <button type="button" onClick={() => openSymbol(card.symbol)} className="block w-full rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                {card.isLive ? <TarotCard {...card} /> : <PendingCard card={card} />}
              </button>
            </motion.div>
          ))}
        </section>

        <footer className="mt-8 flex items-center justify-between border-t border-white/10 pt-4 font-mono text-[9px] uppercase tracking-[0.24em] text-stone-600">
          <span className="flex items-center gap-2"><Radio className="h-3 w-3" /> {updatedSymbol ? `last signal / ${updatedSymbol}` : "awaiting field signal"}</span>
          <span>major arcana / 00—21</span>
        </footer>
      </div>
      {transition && <div className="fixed inset-0 z-50 bg-[#030712]" aria-label={`${transition.route} transition`}><GalleryTransition route={transition.route} /></div>}
    </main>
  );
}
