'use client';

import { ArrowLeft, CircleDot, Coins, LockKeyhole, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import MarketGoBoard, { type MarketGoInteraction, type MarketNode } from '@/components/MarketGoBoard';
import TarotCard, { type TarotCardProps, type WuxingPhase } from '@/components/TarotCard';
import { useAffinityPortfolio, calculateAffinity } from '@/hooks/useAffinityRadar';
import { useMarketStream, type MarketData } from '@/hooks/useMarketStream';

const arcanaNames = [
  'The Fool', 'The Magician', 'The High Priestess', 'The Empress', 'The Emperor', 'The Hierophant',
  'The Lovers', 'The Chariot', 'Strength', 'The Hermit', 'Wheel of Fortune', 'Justice',
  'The Hanged Man', 'Death', 'Temperance', 'The Devil', 'The Tower', 'The Star',
  'The Moon', 'The Sun', 'Judgement', 'The World',
];

const fallbackSymbols = ['BTCUSD', 'ETHUSD', 'DOGEUSD', 'SOLUSD', 'XAUUSD', 'AAPL', 'US500', 'USDJPY', 'NAS100', 'EURUSD'];

type ArcanaSlot = TarotCardProps & { index: number; held: boolean };
type RecommendationMode = 'add' | 'lock' | 'take-profit';

function fallbackMarket(symbol: string, index: number): MarketData {
  const phase: WuxingPhase[] = ['FIRE', 'WATER', 'WOOD', 'EARTH', 'METAL'];
  return {
    symbol,
    major_arcana: String(index),
    wuxing_phase: phase[index % phase.length],
    hexagram_binary: (index % 64).toString(2).padStart(6, '0'),
    tri_layer: { macro: 'SCANNING', meso: index % 4 === 0 ? 'KNOT' : 'FIELD', micro: 'NOISE' },
    s15_volume: 0,
    s15_delta: 0,
    is_emperor_synchronized: false,
    oracle_branches: [],
  };
}

function cardFromMarket(symbol: string, index: number, market?: MarketData, held = false): ArcanaSlot {
  const source = market ?? fallbackMarket(symbol, index);
  return {
    index,
    symbol,
    cardName: `${String(index).padStart(2, '0')} / ${arcanaNames[index]}`,
    wuxing_phase: (source.wuxing_phase as WuxingPhase) ?? 'EARTH',
    tri_layer: source.tri_layer,
    hexagramBinary: source.hexagram_binary,
    held,
  };
}

function statusForNode(node: MarketNode): string {
  return node.market?.tri_layer.micro ?? `${node.kind} signal`;
}

export default function MatrixPage() {
  const { marketDataMap, isConnected } = useMarketStream(process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:8000/ws/signals');
  const markets = Object.values(marketDataMap);
  const portfolioSlots = useAffinityPortfolio((state) => state.slots);
  const [activeSlot, setActiveSlot] = useState(0);
  const [heldCards, setHeldCards] = useState<number[]>([0, 4, 7, 10, 14, 17, 21]);
  const [assignedSymbols, setAssignedSymbols] = useState<Record<number, string>>({});
  const [recommendation, setRecommendation] = useState<number[] | null>(null);
  const [recommendationMode, setRecommendationMode] = useState<RecommendationMode>('lock');
  const [hexagramLocked, setHexagramLocked] = useState(false);
  const [realizedCards, setRealizedCards] = useState<number[]>([]);
  const [notice, setNotice] = useState('Select a frame, then explore the field');
  const longPressTimer = useRef<number | null>(null);

  const marketBySymbol = useMemo(() => new Map(markets.map((market) => [market.symbol.toUpperCase(), market])), [markets]);
  const symbols = useMemo(() => {
    const liveSymbols = markets.map((market) => market.symbol.toUpperCase());
    return Array.from(new Set([...liveSymbols, ...fallbackSymbols])).slice(0, 22);
  }, [markets]);
  const cards = useMemo(() => Array.from({ length: 22 }, (_, index) => {
    const symbol = assignedSymbols[index] ?? symbols[index] ?? `ARCANA_${String(index + 1).padStart(2, '0')}`;
    return cardFromMarket(symbol, index, marketBySymbol.get(symbol), heldCards.includes(index));
  }), [assignedSymbols, heldCards, marketBySymbol, symbols]);
  const recommendedAdditions = useMemo(() => cards
    .filter((card) => !heldCards.includes(card.index) && !realizedCards.includes(card.index))
    .map((card) => ({ card, score: calculateAffinity(portfolioSlots, marketBySymbol.get(card.symbol))?.score ?? 0 }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3), [cards, heldCards, marketBySymbol, portfolioSlots, realizedCards]);

  function assignNode(node: MarketNode, interaction: MarketGoInteraction) {
    const index = activeSlot;
    setAssignedSymbols((current) => ({ ...current, [index]: node.symbol }));
    setNotice(`${node.symbol} mapped to ${String(index + 1).padStart(2, '0')} / ${arcanaNames[index]}`);
    setActiveSlot((current) => interaction === 'double-click' ? (current + 1) % 22 : current);
  }

  function suggestHexagram(nextHeld: number[], mode: RecommendationMode = 'take-profit') {
    const ranked = cards
      .map((card) => ({ index: card.index, score: calculateAffinity(portfolioSlots, marketBySymbol.get(card.symbol))?.score ?? 0 }))
      .sort((left, right) => right.score - left.score)
      .slice(0, 7)
      .map((item) => item.index);
    setRecommendationMode(mode);
    setRecommendation(ranked.length === 7 ? ranked : nextHeld.slice(0, 7));
  }

  function toggleHeld(index: number) {
    if (heldCards.includes(index)) {
      setHexagramLocked(false);
      setHeldCards((current) => current.filter((item) => item !== index));
      return;
    }
    const nextHeld = [...heldCards, index];
    setHeldCards(nextHeld);
    if (nextHeld.length === 7) {
      setRecommendationMode('lock');
      setRecommendation(null);
      setNotice('Seven-card hexagram formed / ready to lock');
    } else if (nextHeld.length > 7) {
      suggestHexagram(nextHeld);
      setNotice(`${nextHeld.length} cards held / profit-taking candidates available`);
    }
  }

  function handleCardPointerDown(index: number) {
    longPressTimer.current = window.setTimeout(() => toggleHeld(index), 520);
  }

  function clearCardLongPress() {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
  }

  function applyRecommendation() {
    if (!recommendation) return;
    setHeldCards(recommendation);
    if (recommendationMode === 'lock') setHexagramLocked(true);
    setRecommendation(null);
    setNotice(recommendationMode === 'take-profit' ? 'Surplus arcana realized / seven-card core restored' : 'Hexagram locked / seven strategic arcana held');
  }

  function realizeSurplus() {
    if (heldCards.length <= 7) return;
    const rankedHeld = heldCards
      .map((index) => ({ index, score: calculateAffinity(portfolioSlots, marketBySymbol.get(cards[index].symbol))?.score ?? 0 }))
      .sort((left, right) => left.score - right.score);
    const surplus = rankedHeld.slice(0, heldCards.length - 7).map((item) => item.index);
    setRealizedCards((current) => Array.from(new Set([...current, ...surplus])));
    setHeldCards((current) => current.filter((index) => !surplus.includes(index)));
    setHexagramLocked(true);
    setRecommendation(null);
    setNotice(`${surplus.length} surplus signal${surplus.length > 1 ? 's' : ''} realized / core protected`);
  }

  function lockCurrentHexagram() {
    if (heldCards.length !== 7) return;
    setHexagramLocked(true);
    setRecommendation(null);
    setNotice('Hexagram locked / take-profit guard active');
  }

  return (
    <main className="min-h-screen bg-[#010509] text-stone-100">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/gallery" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-stone-500 transition-colors hover:text-cyan-200"><ArrowLeft className="h-3 w-3" /> Arcana gallery</Link>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500"><CircleDot className={isConnected ? 'h-3 w-3 text-emerald-300' : 'h-3 w-3 text-stone-600'} /> {isConnected ? 'live field' : 'demo matrix'}</span>
      </header>
      <section className="px-3 sm:px-6">
        <div className="mb-3 flex items-end justify-between px-2 font-mono">
          <div><p className="text-[9px] uppercase tracking-[0.34em] text-cyan-300/60">Matrix / arcana field</p><h1 className="mt-1 text-xl tracking-[0.12em] text-stone-100 sm:text-2xl">GO BOARD EXPLORER</h1></div>
          <p className="max-w-[220px] text-right text-[9px] uppercase tracking-[0.16em] text-stone-500">{notice}</p>
        </div>
        <MarketGoBoard className="h-[58vh] min-h-[480px] w-full border border-cyan-200/10" markets={markets} onNodeInteract={assignNode} onNodeHover={(node) => setNotice(`Scanning around ${node.symbol} / ${statusForNode(node)}`)} />
      </section>
      <section className="px-3 pb-10 pt-8 sm:px-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3 px-2">
          <div><p className="font-mono text-[9px] uppercase tracking-[0.34em] text-amber-200/60">Major arcana positions</p><h2 className="mt-1 text-lg tracking-[0.1em]">22 CARD FRAMES / {heldCards.length} HELD</h2></div>
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-stone-500">Click: focus / double: remap / hold: equip</p>
        </div>
        <div className={`mb-5 border px-4 py-4 ${heldCards.length < 7 ? 'border-cyan-200/20 bg-cyan-200/[0.035]' : heldCards.length === 7 ? 'border-amber-200/35 bg-amber-200/[0.045]' : 'border-red-200/30 bg-red-200/[0.04]'}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              {heldCards.length < 7 ? <TrendingUp className="mt-0.5 h-4 w-4 text-cyan-200" /> : heldCards.length === 7 ? <LockKeyhole className="mt-0.5 h-4 w-4 text-amber-200" /> : <Coins className="mt-0.5 h-4 w-4 text-red-200" />}
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-stone-400">Hexagram effect / {heldCards.length < 7 ? 'forming' : heldCards.length === 7 ? 'complete' : 'overloaded'}</p>
                <p className="mt-1 text-sm tracking-[0.08em] text-stone-100">
                  {heldCards.length < 7 && `Add ${7 - heldCards.length} more signal${7 - heldCards.length > 1 ? 's' : ''} to complete the strategic knot.`}
                  {heldCards.length === 7 && (hexagramLocked ? 'Seven lines locked: gains are guarded while the knot stabilizes.' : 'Seven lines aligned: lock the hexagram to arm the take-profit guard.')}
                  {heldCards.length > 7 && `${heldCards.length - 7} surplus signal${heldCards.length - 7 > 1 ? 's' : ''} detected: realize excess energy or rebalance.`}
                </p>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-stone-500">{heldCards.length < 7 ? 'Recommendation increases resonance and closes elemental gaps.' : heldCards.length === 7 ? 'Knot chart: convergence / I Ching: six lines + one anchor.' : 'Knot chart: tension rising / I Ching: unstable changing lines.'}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              {heldCards.length === 7 && !hexagramLocked && <button type="button" onClick={lockCurrentHexagram} className="inline-flex items-center gap-2 border border-amber-100/45 bg-amber-100/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-100"><LockKeyhole className="h-3 w-3" /> Lock / protect</button>}
              {heldCards.length > 7 && <button type="button" onClick={realizeSurplus} className="inline-flex items-center gap-2 border border-red-100/40 bg-red-100/10 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-red-100"><Coins className="h-3 w-3" /> Realize surplus</button>}
            </div>
          </div>
          {heldCards.length < 7 && <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {recommendedAdditions.map(({ card, score }) => <button key={card.index} type="button" onClick={() => toggleHeld(card.index)} className="flex items-center justify-between border border-cyan-200/15 px-3 py-2 text-left transition-colors hover:border-cyan-200/50">
              <span><span className="block font-mono text-[9px] text-cyan-100">{card.symbol}</span><span className="block font-mono text-[8px] uppercase tracking-[0.12em] text-stone-500">{card.wuxing_phase} / {card.tri_layer.meso}</span></span><span className="font-mono text-[9px] text-amber-200">{Math.round(score * 100)}%</span>
            </button>)}
          </div>}
          {realizedCards.length > 0 && <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-red-200/60">Realized lines: {realizedCards.map((index) => arcanaNames[index]).join(' / ')}</p>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 2xl:grid-cols-8">
          {cards.map((card) => <button
            key={card.index}
            type="button"
            className={`relative text-left transition-transform ${activeSlot === card.index ? 'z-10 -translate-y-1' : ''}`}
            onClick={() => setActiveSlot(card.index)}
            onDoubleClick={() => toggleHeld(card.index)}
            onPointerDown={() => handleCardPointerDown(card.index)}
            onPointerUp={clearCardLongPress}
            onPointerLeave={clearCardLongPress}
          >
            <TarotCard {...card} />
            <span className={`absolute left-3 top-3 rounded-sm border px-2 py-1 font-mono text-[8px] uppercase tracking-[0.16em] ${card.held ? 'border-amber-200/60 bg-amber-200/15 text-amber-100' : 'border-white/15 bg-black/30 text-stone-500'}`}>{card.held ? 'held' : 'open'}</span>
          </button>)}
        </div>
      </section>
      {recommendation && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm">
        <div className="w-full max-w-md border border-amber-200/35 bg-[#071018] p-5 shadow-[0_0_50px_rgba(245,208,111,0.18)]">
          <p className="font-mono text-[9px] uppercase tracking-[0.32em] text-amber-200/65">Hexagram optimizer / {recommendationMode === 'take-profit' ? 'surplus detected' : 'seven-line pattern'}</p>
          <h2 className="mt-2 text-xl tracking-[0.08em]">{recommendationMode === 'take-profit' ? 'REALIZE THE EXCESS' : 'LOCK 7 STRATEGIC ARCANA'}</h2>
          <p className="mt-3 font-mono text-[10px] leading-5 text-stone-400">{recommendationMode === 'take-profit' ? 'The weakest resonance lines are marked for a profit-taking style rebalance. The seven-card core remains intact.' : 'The seventh line closes the knot. Locking this pattern arms a visual take-profit guard around the strongest resonance.'}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-[10px] text-amber-100">{recommendation.map((index) => <span key={index} className="border border-amber-200/20 px-2 py-2">{String(index + 1).padStart(2, '0')} / {arcanaNames[index]}</span>)}</div>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={applyRecommendation} className="border border-amber-100/50 bg-amber-100/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-100">Lock seven</button>
            <button type="button" onClick={() => setRecommendation(null)} className="border border-white/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-stone-400">Keep current</button>
          </div>
        </div>
      </div>}
    </main>
  );
}
