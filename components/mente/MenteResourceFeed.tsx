'use client';

import { useEffect, useRef, useState } from 'react';
import PixelSprite from '@/components/fami/PixelSprite';
import { SPRITES } from '@/lib/famiSprites';
import { useMenteInbox } from '@/lib/menteInbox';
import { ANIMAL_RESOURCES, HUMAN_REQUESTS, VET_NOTE } from '@/lib/menteResources';

/** Sends ヒューマン／アニマル resources and Mente's colour request into the inbox. */
export default function MenteResourceFeed() {
  const notify = useMenteInbox((s) => s.notify);
  const [h, setH] = useState(0);
  const [a, setA] = useState(0);
  const [auto, setAuto] = useState(false);

  const sendHuman = () => {
    const r = HUMAN_REQUESTS[h % HUMAN_REQUESTS.length];
    notify({ source: 'human', title: `${r.from} · 衝動的な要求`, body: r.text, href: '/menu#organs' });
    setH((n) => n + 1);
  };
  const sendAnimal = () => {
    const r = ANIMAL_RESOURCES[a % ANIMAL_RESOURCES.length];
    notify({ source: 'animal', title: r.title, body: `${r.text}。${VET_NOTE}`, href: '/mente#animal' });
    setA((n) => n + 1);
  };
  const sendColour = () => notify({ source: 'mente', title: '次なる色彩の要求', body: '22 ファミコンのサイドメニューを、レトログリッド A/B のループに描画します', href: '/retro-grid?page=A&sidemenu=ask' });

  // Auto-receive alternates the two resources, so the split screen fills from both sides.
  const senders = useRef({ sendHuman, sendAnimal });
  senders.current = { sendHuman, sendAnimal };
  const flip = useRef(false);
  useEffect(() => {
    if (!auto) return undefined;
    const timer = window.setInterval(() => {
      const { sendHuman: human, sendAnimal: animal } = senders.current;
      (flip.current ? animal : human)();
      flip.current = !flip.current;
    }, 4000);
    return () => window.clearInterval(timer);
  }, [auto]);

  return (
    <section id="animal" aria-label="Mente resources" className="flex flex-wrap items-center gap-2 border-2 border-black bg-white/60 p-2 text-[11px]">
      <span className="bg-black px-2 py-0.5 font-bold italic text-white">リソースを受信</span>
      <button type="button" onClick={sendHuman} className="flex items-center gap-1 border-2 border-black px-2 py-0.5"><PixelSprite sprite={SPRITES.dancer} className="h-5 w-5" />ヒューマン（髪型・手指）</button>
      <button type="button" onClick={sendAnimal} className="flex items-center gap-1 border-2 border-black px-2 py-0.5"><PixelSprite sprite={SPRITES.flower} className="h-5 w-5" />アニマル（花・猫の安全）</button>
      <button type="button" onClick={sendColour} className="flex items-center gap-1 bg-[#d6001c] px-2 py-0.5 font-bold italic text-white"><PixelSprite sprite={SPRITES.eye} className="h-5 w-5" />色彩の要求 → レトログリッド</button>
      <label className="ml-auto flex items-center gap-1"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> 自動受信（4 秒ごと交互）</label>
    </section>
  );
}
