'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import KrugerBubble from '@/components/mente/KrugerBubble';
import { MENTE_LOG, memberById, type MenteMessage } from '@/lib/menteChat';

export type PhoneScreen = 'ringing' | 'chat' | 'menu' | 'closing' | 'home';

type Props = {
  screen: PhoneScreen;
  onScreen: (screen: PhoneScreen) => void;
  /** Incoming telephone message appended after the community log. */
  incoming?: MenteMessage & { caption?: string };
  /** Where the notification's "open Mente" goes. */
  openHref?: string;
  /** How far the chat is scrolled back into history (remote control ▲▼), in messages. */
  scroll?: number;
};

const BEAT_MS = 650;

/** Smartphone running Mente: notification -> tap -> community chat revealed beat by beat. */
export default function MentePhone({ screen, onScreen, incoming, openHref = '/mente', scroll = 0 }: Props) {
  const messages = incoming ? [...MENTE_LOG.slice(-7), incoming] : [...MENTE_LOG];
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (screen !== 'chat') { setShown(0); return undefined; }
    const timer = window.setInterval(() => setShown((n) => (n >= messages.length ? n : n + 1)), BEAT_MS);
    return () => window.clearInterval(timer);
  }, [screen, messages.length]);

  // The window close carries weight: it sinks slowly, then the home screen returns.
  useEffect(() => {
    if (screen !== 'closing') return undefined;
    const timer = window.setTimeout(() => onScreen('home'), 1100);
    return () => window.clearTimeout(timer);
  }, [screen, onScreen]);

  const typing = screen === 'chat' && shown < messages.length;

  return (
    <div className="relative mx-auto h-[540px] w-[270px] rounded-[38px] border-[10px] border-black bg-black shadow-[0_24px_60px_rgba(0,0,0,.55)]" style={{ animation: screen === 'ringing' ? 'menteRing 1.2s ease-in-out infinite' : undefined }}>
      <style>{`
        @keyframes menteRing { 0%, 60%, 100% { transform: rotate(0); } 10%, 30%, 50% { transform: rotate(-3deg); } 20%, 40% { transform: rotate(3deg); } }
        @keyframes menteClose { from { transform: none; opacity: 1; } to { transform: translateY(110%) scale(.92); opacity: .2; } }
        @keyframes menteIn { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `}</style>
      <div className="absolute inset-0 overflow-hidden rounded-[28px] bg-[repeating-linear-gradient(180deg,#9a9a9a_0_64px,#d0d0d0_64px_150px)]">
        <div className="absolute left-1/2 top-1.5 h-5 w-24 -translate-x-1/2 rounded-full bg-black" />
        <p className="mt-9 px-4 font-serif text-3xl font-bold italic text-[#7a0f22]">Mente</p>

        {screen === 'ringing' && (
          <button type="button" onClick={() => onScreen('chat')} className="absolute inset-x-3 top-24 rounded-2xl bg-white/95 p-3 text-left shadow-xl" style={{ animation: 'menteIn .4s ease-out' }}>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#7a0f22]">Mente · テレフォン</span>
            <span className="mt-1 block text-[12px] text-black">{incoming?.caption ?? 'クイズクオンタムから着信'}</span>
            <span className="mt-1 block text-[10px] text-slate-500">タップして Mente を開く</span>
          </button>
        )}

        {screen === 'chat' && (
          <div className="absolute inset-x-0 bottom-8 top-20 flex flex-col justify-end overflow-hidden px-3">
            {/* Bottom-anchored like a messenger: the newest message stays in view; scroll > 0 looks back. */}
            <div className="space-y-2 transition-transform duration-300" style={{ transform: `translateY(${scroll * 60}px)` }}>
              {messages.slice(0, shown).map((m, i) => (
                <div key={i} style={{ animation: 'menteIn .35s ease-out' }}>
                  <KrugerBubble name={memberById(m.member).name} at={m.at} text={m.text} align={i === messages.length - 1 && incoming ? 'full' : i % 3 === 2 ? 'right' : 'left'} />
                </div>
              ))}
              {typing && <p className="bg-black px-2 py-1 text-[12px] font-bold italic tracking-[0.4em] text-white">....</p>}
            </div>
          </div>
        )}

        {(screen === 'menu' || screen === 'home') && (
          <div className="absolute inset-x-4 top-24 grid grid-cols-3 gap-3">
            {['Mente', 'Cure', 'Quiz 19', 'Retro A', 'Retro B', 'LAB'].map((app, i) => (
              <button key={app} type="button" onClick={() => app === 'Mente' && onScreen('chat')} className={`aspect-square rounded-xl text-[10px] font-semibold ${i === 0 ? 'bg-[#7a0f22] text-white' : 'bg-white/70 text-slate-700'}`}>{app}</button>
            ))}
            {screen === 'home' && <p className="col-span-3 text-center text-[10px] text-slate-600">window closed</p>}
          </div>
        )}

        {screen === 'closing' && (
          <div className="absolute inset-x-3 bottom-3 top-20 bg-[#d6001c]/90" style={{ animation: 'menteClose 1.1s cubic-bezier(.7,0,.9,.4) forwards' }} />
        )}

        {screen === 'chat' && (
          <Link href={openHref} className="absolute bottom-2 right-3 bg-black px-2 py-1 text-[10px] font-bold italic text-white">./Mente →</Link>
        )}
      </div>
    </div>
  );
}
