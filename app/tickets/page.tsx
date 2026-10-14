'use client';

import { ArrowLeft, Clock3, ListOrdered, Send, TicketCheck } from 'lucide-react';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

type SettlementTicket = {
  ticket_id: string;
  timestamp: string;
  shape_type: string;
  symbols: string[];
  total_pnl: number;
  mana_consumed: number;
  persona_name: string;
  gravity_type: string;
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function TicketsPage() {
  const [tickets, setTickets] = useState<SettlementTicket[]>([]);
  const [symbols, setSymbols] = useState('BTCUSD, ETHUSD, SOLUSD, XAUUSD');
  const [limitPrice, setLimitPrice] = useState('');
  const [lotSize, setLotSize] = useState('0.01');
  const [action, setAction] = useState<'LONG' | 'SHORT'>('LONG');
  const [strategy, setStrategy] = useState('TEMPERANCE');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTickets = async () => {
    try {
      const response = await fetch(`${API_URL}/api/settlement-tickets`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Ticket history is unavailable.');
      const payload = await response.json() as { tickets?: SettlementTicket[] };
      setTickets(Array.isArray(payload.tickets) ? payload.tickets : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Ticket history is unavailable.');
    }
  };

  useEffect(() => { void loadTickets(); }, []);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const intent = searchParams.get('intent');
    const knots = searchParams.get('knots');
    if (intent === 'buy-stop') setAction('LONG');
    if (intent === 'sell-step') setAction('SHORT');
    if (intent && knots) setMessage(`${intent} intent loaded from knot set: ${knots}. Complete the reservation fields before submission.`);
  }, []);

  async function reserveLimitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedSymbols = symbols.split(',').map((symbol) => symbol.trim().toUpperCase()).filter(Boolean);
    const numericPrice = Number(limitPrice);
    const numericLot = Number(lotSize);
    if (normalizedSymbols.length < 4 || !Number.isFinite(numericPrice) || numericPrice <= 0 || !Number.isFinite(numericLot) || numericLot <= 0) {
      setMessage('Provide at least four unique symbols, a positive limit price, and a positive lot size.');
      return;
    }

    setIsSubmitting(true);
    setMessage('');
    try {
      const token = window.sessionStorage.getItem('chartui-access-token');
      if (!token) throw new Error('Authenticate before submitting a reservation.');
      const response = await fetch(`${API_URL}/api/execute_limit_package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ symbols: normalizedSymbols, limit_price: numericPrice, lot_size: numericLot, action, strategy }),
      });
      const payload = await response.json() as { detail?: string; status?: string };
      if (!response.ok) throw new Error(payload.detail ?? 'Limit reservation was rejected.');
      setMessage('Limit package submitted through the authenticated trade gateway.');
      await loadTickets();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Limit reservation failed.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="min-h-screen bg-[#02060d] px-4 py-6 text-stone-100 sm:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div><Link href="/knot-chart" className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/70 hover:text-cyan-100"><ArrowLeft className="h-3 w-3" /> Live projection</Link><h1 className="mt-4 text-3xl tracking-[0.08em] text-cyan-50">TICKET LEDGER</h1></div>
        <button type="button" onClick={() => void loadTickets()} className="border border-cyan-200/25 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-cyan-100 hover:bg-cyan-100/10">Refresh history</button>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="border border-cyan-200/15 bg-[#030813]/90 p-5" aria-labelledby="reservation-title">
          <div className="flex items-center gap-2"><TicketCheck className="h-4 w-4 text-amber-200" /><h2 id="reservation-title" className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-200">Limit reservation</h2></div>
          <p className="mt-3 font-mono text-[9px] leading-5 text-stone-500">Submission is sent only after this form is confirmed and requires an authenticated trade gateway session.</p>
          <form onSubmit={reserveLimitOrder} className="mt-5 space-y-4">
            <label className="block"><span className="font-mono text-[9px] uppercase tracking-[0.15em] text-stone-500">Symbols / four minimum</span><input value={symbols} onChange={(event) => setSymbols(event.target.value)} className="mt-1.5 w-full border border-white/15 bg-black/20 px-3 py-2 font-mono text-xs text-cyan-50 outline-none focus:border-cyan-200/50" /></label>
            <div className="grid grid-cols-2 gap-3"><label><span className="font-mono text-[9px] uppercase tracking-[0.15em] text-stone-500">Limit price</span><input inputMode="decimal" value={limitPrice} onChange={(event) => setLimitPrice(event.target.value)} placeholder="0.00" className="mt-1.5 w-full border border-white/15 bg-black/20 px-3 py-2 font-mono text-xs text-cyan-50 outline-none focus:border-cyan-200/50" /></label><label><span className="font-mono text-[9px] uppercase tracking-[0.15em] text-stone-500">Lot size</span><input inputMode="decimal" value={lotSize} onChange={(event) => setLotSize(event.target.value)} className="mt-1.5 w-full border border-white/15 bg-black/20 px-3 py-2 font-mono text-xs text-cyan-50 outline-none focus:border-cyan-200/50" /></label></div>
            <div className="grid grid-cols-2 gap-3"><label><span className="font-mono text-[9px] uppercase tracking-[0.15em] text-stone-500">Direction</span><select value={action} onChange={(event) => setAction(event.target.value as 'LONG' | 'SHORT')} className="mt-1.5 w-full border border-white/15 bg-[#08101b] px-3 py-2 font-mono text-xs text-cyan-50 outline-none"><option value="LONG">LONG</option><option value="SHORT">SHORT</option></select></label><label><span className="font-mono text-[9px] uppercase tracking-[0.15em] text-stone-500">Strategy</span><select value={strategy} onChange={(event) => setStrategy(event.target.value)} className="mt-1.5 w-full border border-white/15 bg-[#08101b] px-3 py-2 font-mono text-xs text-cyan-50 outline-none"><option>TEMPERANCE</option><option>THE_CHARIOT</option><option>THE_HERMIT</option><option>THE_HANGED_MAN</option></select></label></div>
            <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-between border border-amber-200/40 bg-amber-100/[0.08] px-3 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-amber-100 hover:bg-amber-100/[0.14] disabled:opacity-50"><span>{isSubmitting ? 'Submitting reservation' : 'Submit limit reservation'}</span><Send className="h-3.5 w-3.5" /></button>
          </form>
          {message && <p role="status" className="mt-4 border-l border-cyan-200/40 pl-3 font-mono text-[9px] leading-5 text-cyan-100/75">{message}</p>}
        </section>

        <section className="border border-white/10 bg-black/15 p-5" aria-labelledby="history-title">
          <div className="flex items-center gap-2"><ListOrdered className="h-4 w-4 text-violet-300" /><h2 id="history-title" className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-200">Settlement history</h2></div>
          <div className="mt-5 space-y-2">{tickets.length === 0 ? <p className="font-mono text-[10px] text-stone-600">No settlement tickets recorded.</p> : tickets.map((ticket) => <article key={ticket.ticket_id} className="border border-white/10 bg-white/[0.025] p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[10px] text-cyan-100">{ticket.persona_name}</p><p className="mt-1 font-mono text-[8px] uppercase tracking-[0.13em] text-stone-500">{ticket.shape_type} / {ticket.gravity_type}</p></div><span className="font-mono text-[9px] text-amber-100">{ticket.total_pnl.toFixed(2)}</span></div><p className="mt-2 font-mono text-[9px] text-stone-400">{ticket.symbols.join(' · ')}</p><p className="mt-2 flex items-center gap-1 font-mono text-[8px] text-stone-600"><Clock3 className="h-3 w-3" /> {new Date(ticket.timestamp).toLocaleString()}</p></article>)}</div>
        </section>
      </div>
    </div>
  </main>;
}
