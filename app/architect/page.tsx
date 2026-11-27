'use client';

import Link from 'next/link';
import ArchitectOrders from '@/components/architect/ArchitectOrders';

/** Stand-alone view of the order interior (the same section lives inside the Tarot Command Center). */
export default function ArchitectPage() {
  return (
    <main className="min-h-screen bg-[#090b0f] py-4 font-display text-stone-100">
      <div className="mx-auto max-w-7xl">
        <nav className="flex gap-3 px-5 text-xs text-stone-400 sm:px-8"><Link href="/" className="hover:text-white">Tarot Command Center</Link><Link href="/cure-api" className="hover:text-white">Cure-API</Link></nav>
        <ArchitectOrders />
      </div>
    </main>
  );
}
