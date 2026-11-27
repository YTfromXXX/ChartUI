'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { todayEvent } from '@/lib/architectOrders';
import { useCureAPIStore } from '@/lib/cureApiStore';

/** Hands the library or the museum to Cure-API's [():()] device. The museum carries ?event=GALAXY. */
export default function PassToParen({ what }: { what: 'library' | 'museum' }) {
  const router = useRouter();
  const pass = useCureAPIStore((s) => s.passToParen);
  const [galaxyEvent, setGalaxyEvent] = useState(false);
  useEffect(() => { setGalaxyEvent(new URLSearchParams(window.location.search).get('event') === 'GALAXY'); }, []);
  const g = todayEvent().galaxy;

  return (
    <div className="flex flex-wrap items-center gap-2 border border-stone-400 bg-white px-3 py-2 text-[11px]">
      {what === 'museum' && galaxyEvent && <span className="bg-black px-2 py-0.5 text-white">&quot;event&quot; === &quot;GALAXY&quot; · 今日の銀河 {g.arms} 腕 · ねじれ {g.twist.toFixed(2)}</span>}
      <span className="text-stone-600">{what === 'library' ? '図書館（2 冊・15 プラトー）' : '博物館（骨格棟 19・内部棟 3）'}を</span>
      <button
        type="button"
        onClick={() => { pass(what, what === 'museum' && galaxyEvent ? g : undefined); router.push('/cure-api#paren'); }}
        className="bg-[#7a0f22] px-3 py-1 font-semibold text-white"
      >
        Cure-API の [():()] 装置へ渡す →
      </button>
    </div>
  );
}
