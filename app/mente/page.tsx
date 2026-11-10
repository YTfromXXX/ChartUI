'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import KrugerBubble from '@/components/mente/KrugerBubble';
import MentePhone, { type PhoneScreen } from '@/components/mente/MentePhone';
import MenteNotificationArea from '@/components/mente/MenteNotificationArea';
import { MENTE_LOG, MENTE_MEMBERS, memberById } from '@/lib/menteChat';

type RemoteKey = { key: string; label: string; action: (set: Actions) => void };
type Actions = { screen: (s: PhoneScreen) => void; scroll: (d: number) => void };

const REMOTE: RemoteKey[] = [
  { key: 'menu', label: '●', action: (a) => a.screen('menu') },
  { key: 'chat', label: '▶', action: (a) => a.screen('chat') },
  { key: 'up', label: '▲', action: (a) => a.scroll(1) },
  { key: 'down', label: '▼', action: (a) => a.scroll(-1) },
  { key: 'ring', label: '☎', action: (a) => a.screen('ringing') },
  { key: 'close', label: '✕', action: (a) => a.screen('closing') },
];

/** 17. Mente — real-concept chat that intervenes in Cure's body maintenance. */
export default function MentePage() {
  const [screen, setScreen] = useState<PhoneScreen>('chat');
  const [scroll, setScroll] = useState(0);
  const [pressed, setPressed] = useState<string | null>(null);
  const [fromQuiz, setFromQuiz] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('from') === 'quiz') setFromQuiz(params.get('q'));
  }, []);

  const press = (k: RemoteKey) => {
    setPressed(k.key);
    window.setTimeout(() => setPressed(null), 500);
    k.action({ screen: setScreen, scroll: (d) => setScroll((s) => Math.max(0, Math.min(8, s + d))) });
  };

  return (
    <main className="min-h-screen bg-[#cfcfcf] px-4 py-5 text-[#1f1f1f] sm:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-slate-700"><span className="mr-4 font-serif text-white [text-shadow:0_1px_2px_#0006]">Chart UI</span>Mente：レトログリッドページ A（Famiポート No.17）</p>
          <nav className="flex gap-3 text-xs">
            <Link href="/retro-grid?page=B" className="text-[#7a0f22] hover:underline">← クイズクオンタム（No.19）</Link>
            <Link href="/cure-api" className="hover:underline">Cure-API</Link>
          </nav>
        </header>
        <p className="font-serif text-6xl font-bold italic text-[#7a0f22]/80">Mente</p>
        {fromQuiz && (
          <p className="inline-block bg-black px-2 py-1 text-xs font-bold italic text-white">クイズクオンタム Q{fromQuiz} からのテレフォンを受信しました</p>
        )}

        <MenteNotificationArea />

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
          {/* Remote sensing: each button drives the phone. */}
          <section aria-label="Remote control" className="relative min-h-[460px]">
            <p className="absolute left-[46%] top-6 text-xl tracking-wide">&lt;—— リモートセンシング</p>
            <p className="absolute left-[46%] top-20 max-w-xs text-sm leading-6">{'{'}JavaScript アニメーションの限界を突破したスーパーリアリズムなリモートコントローラー拡張をお楽しみください{'}'}</p>
            <div className="absolute left-10 top-8 origin-top-left" style={{ transform: 'rotate(-32deg) translateY(120px)' }}>
              <div className="relative w-24 rounded-md bg-black px-3 pb-8 pt-5 shadow-[10px_14px_0_#0004]" style={{ height: 380 }}>
                <div className="mb-6 flex justify-center gap-2"><span className="h-8 w-2 bg-white" /><span className="h-8 w-2 bg-white" /></div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                  {REMOTE.map((k) => (
                    <button
                      key={k.key}
                      type="button"
                      aria-label={`remote ${k.key}`}
                      onClick={() => press(k)}
                      className="grid h-6 w-7 place-items-center bg-white text-[10px] text-black transition-transform active:scale-90"
                      style={{ transform: pressed === k.key ? 'scale(.85)' : undefined }}
                    >
                      {k.label}
                    </button>
                  ))}
                </div>
                <div className="absolute inset-x-0 bottom-5 flex justify-center gap-2"><span className="h-8 w-2 bg-white" /><span className="h-8 w-2 bg-white" /></div>
              </div>
            </div>
            {/* Sensing rays while a button is pressed. */}
            <svg viewBox="0 0 300 200" className="pointer-events-none absolute bottom-0 left-0 h-48 w-72" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <line key={i} x1={20 + i * 10} y1={190 - i * 6} x2={150 + i * 22} y2={70 - i * 8} stroke="#111" strokeWidth={1} opacity={pressed ? 0.9 : 0.25} />
              ))}
            </svg>
            <p className="absolute bottom-0 right-0 max-w-[16rem] border border-sky-400/60 bg-white/70 p-2 text-[11px] text-slate-600">
              リモコンの各ボタンに対応したリアル iPad を設置（スマホのメニュー画面、ウィンドウクローズの重みを体感）
            </p>
          </section>

          <MentePhone screen={screen} onScreen={setScreen} scroll={scroll} />
        </div>

        {/* Community log, laid out as red bars. */}
        <section aria-label="Community log" className="space-y-3 bg-[repeating-linear-gradient(180deg,#9a9a9a_0_80px,#d0d0d0_80px_190px)] p-4">
          <p className="inline-block bg-black px-2 py-1 text-xs font-bold italic text-white">COMMUNITY · {MENTE_MEMBERS.length} MEMBERS · PAST LOG</p>
          {MENTE_LOG.map((m, i) => (
            <div key={i} style={{ marginLeft: `${(i * 37) % 30}%`, maxWidth: i % 4 === 0 ? '90%' : '62%' }}>
              <KrugerBubble name={memberById(m.member).name} at={m.at} text={m.text} align={i % 4 === 0 ? 'full' : 'left'} />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
