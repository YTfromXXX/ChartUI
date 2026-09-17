'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type SymbolTag = 'Crypto' | 'Forex' | 'Indices' | 'Commodity' | 'Meme' | 'L1/L2' | 'High Volatility' | 'Safe Haven' | 'FIRE' | 'WATER' | 'WOOD' | 'EARTH' | 'METAL';

export type SearchSymbol = {
  symbol: string;
  cardName: string;
  tags: SymbolTag[];
  index: number;
};

type SymbolOmniSearchProps = {
  symbols: SearchSymbol[];
  onSelect: (symbol: string) => void;
  onPreview: (symbol: string | null) => void;
};

const tagGroups: Array<{ label: string; tags: SymbolTag[] }> = [
  { label: 'Asset class', tags: ['Crypto', 'Forex', 'Indices', 'Commodity'] },
  { label: 'Theme', tags: ['Meme', 'L1/L2', 'High Volatility', 'Safe Haven'] },
  { label: 'Wuxing', tags: ['FIRE', 'WATER', 'WOOD', 'EARTH', 'METAL'] },
];

export default function SymbolOmniSearch({ symbols, onSelect, onPreview }: SymbolOmniSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<SymbolTag[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return symbols.filter((item) => {
      const matchesQuery = !normalizedQuery || `${item.symbol} ${item.cardName}`.toLowerCase().includes(normalizedQuery);
      const matchesTags = selectedTags.every((tag) => item.tags.includes(tag));
      return matchesQuery && matchesTags;
    }).slice(0, 18);
  }, [query, selectedTags, symbols]);

  useEffect(() => () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  }, []);

  function toggleTag(tag: SymbolTag) {
    setSelectedTags((current) => current.includes(tag) ? current.filter((value) => value !== tag) : [...current, tag]);
  }

  function startLongPress(symbol: string) {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => onPreview(symbol), 360);
  }

  function endLongPress() {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
    pressTimer.current = null;
  }

  return (
    <section className="relative z-40 mb-7 rounded-2xl border border-cyan-200/15 bg-[#06101a]/90 p-4 shadow-[0_0_45px_rgba(34,211,238,0.08)] backdrop-blur-xl" aria-label="Symbol omni search">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <label className="flex items-center gap-3 border border-cyan-200/20 bg-black/20 px-3 py-3 focus-within:border-cyan-100/70">
            <Search className="h-4 w-4 shrink-0 text-cyan-200" />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }} onFocus={() => setIsOpen(true)} placeholder="Search symbol, archetype, or theme" className="min-w-0 flex-1 bg-transparent font-mono text-xs text-stone-100 outline-none placeholder:text-stone-600" />
            {(query || selectedTags.length) > 0 && <button type="button" onClick={() => { setQuery(''); setSelectedTags([]); }} className="text-stone-500 hover:text-white" aria-label="Clear search"><X className="h-4 w-4" /></button>}
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            {tagGroups.flatMap((group) => group.tags).map((tag) => {
              const active = selectedTags.includes(tag);
              return <button key={tag} type="button" onClick={() => { toggleTag(tag); setIsOpen(true); }} className={`rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors ${active ? 'border-cyan-100 bg-cyan-100/15 text-cyan-50' : 'border-white/10 text-stone-500 hover:border-cyan-200/40 hover:text-cyan-100'}`}>{tag}</button>;
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-stone-500"><SlidersHorizontal className="h-3.5 w-3.5 text-amber-200" /> {results.length} matches</div>
      </div>

      {isOpen && (query || selectedTags.length > 0) && (
        <div className="absolute inset-x-4 top-full mt-2 max-h-72 overflow-y-auto rounded-xl border border-cyan-200/20 bg-[#07131f] p-2 shadow-2xl">
          {results.length === 0 && <p className="p-4 font-mono text-xs text-stone-500">No symbols match the current field.</p>}
          {results.map((item) => (
            <button key={item.symbol} type="button" onClick={() => onSelect(item.symbol)} onMouseEnter={() => onPreview(item.symbol)} onMouseLeave={() => onPreview(null)} onTouchStart={() => startLongPress(item.symbol)} onTouchEnd={endLongPress} className="flex w-full items-center justify-between gap-4 border-b border-white/5 px-3 py-3 text-left transition-colors last:border-0 hover:bg-cyan-100/[0.06]">
              <span><span className="block font-mono text-xs tracking-[0.14em] text-cyan-50">{item.symbol}</span><span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-stone-600">{item.cardName}</span></span>
              <span className="flex max-w-[55%] flex-wrap justify-end gap-1">{item.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded border border-white/10 px-1.5 py-0.5 font-mono text-[8px] text-stone-400">{tag}</span>)}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
