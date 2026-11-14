'use client';

// A cute three-panel manga notification banner made with CSS only:
//  • speed lines: repeating-conic-gradient; • halftone dots: radial-gradient tiles;
//  • a spiky "burst": clip-path polygon; • speech bubbles: a rounded box + a rotated square tail;
//  • the host: circles and clip-paths (head, overlapping "superposition" glasses, a bow tie, a microphone).
// It PREDICTS the next panel: before you answer it shows both futures; after, the one that happened.
// Motion is a gentle bob only, and none at all with reduced motion.
export type BannerState = { phase: 'ask' | 'right' | 'wrong' | 'aviator' | 'declare' | 'done'; text: string; a?: string; b?: string };

function Host({ tie }: { tie: boolean }) {
  return (
    <div className="relative h-20 w-16 motion-safe:animate-[bob_2.4s_ease-in-out_infinite]" aria-hidden>
      <div className="absolute left-2 top-1 h-12 w-12 rounded-full border-2 border-black bg-[#ffe3c7]" />
      <div className="absolute left-1 top-0 h-5 w-14 rounded-t-full border-2 border-b-0 border-black bg-[#2b3a67]" />
      <div className="absolute left-3 top-5 h-5 w-5 rounded-full border-2 border-black bg-[#9fe8ff88]" />
      <div className="absolute left-6 top-[22px] h-5 w-5 rounded-full border-2 border-black bg-[#ffb3e688]" />
      <div className="absolute left-[18px] top-[42px] h-1 w-4 rounded-full bg-black" />
      <div className="absolute left-3 top-[54px] h-4 w-10" style={{ clipPath: 'polygon(0 0, 45% 50%, 0 100%, 100% 100%, 55% 50%, 100% 0)', background: '#c8001a', transform: tie ? 'rotate(180deg)' : undefined }} />
      <div className="absolute left-[46px] top-10 h-6 w-2 rounded-sm bg-black" /><div className="absolute left-[44px] top-8 h-3 w-3 rounded-full bg-[#555]" />
    </div>
  );
}

const Bubble = ({ children, side = 'left' }: { children: React.ReactNode; side?: 'left' | 'right' }) => (
  <div className="relative rounded-2xl border-2 border-black bg-white px-2 py-1 text-[11px] leading-snug">
    {children}<span className="absolute -bottom-[7px] h-3 w-3 rotate-45 border-b-2 border-r-2 border-black bg-white" style={{ [side]: 14 }} />
  </div>
);

export default function MangaBanner({ s, onClose }: { s: BannerState; onClose?: () => void }) {
  const burst = s.phase === 'right' ? '正解！' : s.phase === 'wrong' ? 'ちがう!?' : s.phase === 'aviator' ? 'ブーン' : s.phase === 'declare' ? '宣言！' : s.phase === 'done' ? 'おしまい' : '測定…?';
  return (
    <div role="status" aria-live="polite" className="relative overflow-hidden rounded-md border-[3px] border-black bg-white shadow-[5px_5px_0_#000]" data-testid="manga-banner">
      <style>{'@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}'}</style>
      <div className="flex items-center justify-between border-b-[3px] border-black bg-[#fff27a] px-2 py-0.5 text-[10px] font-bold">
        <span>🔔 Notification・クオンタムクイズ</span>{onClose && <button type="button" onClick={onClose} className="px-1" aria-label="閉じる">✕</button>}
      </div>
      <div className="grid grid-cols-[1.4fr_0.6fr_1.2fr] gap-[3px] bg-black p-[3px] sm:grid-cols-[1.1fr_0.8fr_1.1fr]">
        {/* panel 1: the host speaks */}
        <div className="flex flex-col-reverse items-start gap-1 bg-white p-1.5 sm:flex-row sm:items-end" style={{ backgroundImage: 'radial-gradient(#0002 1px, transparent 1.4px)', backgroundSize: '6px 6px' }}>
          <Host tie={s.phase === 'wrong'} /><div className="w-full flex-1 sm:mb-8"><Bubble>{s.text}</Bubble></div>
        </div>
        {/* panel 2: speed lines + burst */}
        <div className="relative grid place-items-center overflow-hidden bg-white" style={{ backgroundImage: 'repeating-conic-gradient(from 0deg at 50% 50%, #000 0deg 2deg, transparent 2deg 9deg)' }}>
          <div className="absolute inset-[18%] rounded-full bg-white blur-[2px]" />
          <div className="relative grid h-14 w-14 place-items-center bg-[#c8001a] sm:h-16 sm:w-16 text-[9px] font-black sm:text-[11px] text-white" style={{ clipPath: 'polygon(50% 0,61% 30%,95% 20%,70% 45%,100% 60%,66% 64%,75% 98%,50% 72%,25% 98%,34% 64%,0 60%,30% 45%,5% 20%,39% 30%)' }} data-testid="burst">{burst}</div>
        </div>
        {/* panel 3: the prediction */}
        <div className="space-y-1 bg-[#eef6fb] p-1.5 text-[10px]" style={{ backgroundImage: 'radial-gradient(#2b3a6722 1.2px, transparent 1.6px)', backgroundSize: '7px 7px' }}>
          <p className="inline-block -rotate-2 border-2 border-black bg-white px-1 font-bold">次のコマ（予測）</p>
          {s.phase === 'ask' ? <>
            <Bubble side="right">a なら：{s.a}</Bubble><Bubble side="right">b なら：{s.b}</Bubble>
            <p className="text-stone-500">答えは、測るまで二つ。</p>
          </> : <Bubble side="right">{s.phase === 'right' ? '司会者の眼鏡が一枚に重なる。' : s.phase === 'wrong' ? '蝶ネクタイが反対向きに。もう一問！' : s.phase === 'aviator' ? '紙飛行機が、塔のまわりを一周してもどってくる。' : s.phase === 'declare' ? '司会者、マイクを置いて拍手。' : '観客席の SNS-iIIN と SNS-K が、同時に光る。'}</Bubble>}
        </div>
      </div>
    </div>
  );
}
