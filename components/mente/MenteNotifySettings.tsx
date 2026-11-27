'use client';

import Link from 'next/link';
import { SOURCE_LABEL, unreadOf, useMenteInbox, type MenteSource } from '@/lib/menteInbox';

/** Cure-API side: how Mente delivers notifications, and from whom. */
export default function MenteNotifySettings() {
  const delivery = useMenteInbox((s) => s.delivery);
  const setDelivery = useMenteInbox((s) => s.setDelivery);
  const enabled = useMenteInbox((s) => s.enabled);
  const setEnabled = useMenteInbox((s) => s.setEnabled);
  const notices = useMenteInbox((s) => s.notices);

  return (
    <div className="space-y-1.5 rounded border border-rose-300/30 p-2 text-[10px]" aria-label="Mente notification settings">
      <p className="flex items-center justify-between font-semibold text-rose-200">
        Mente 通知領域 <Link href="/mente" className="font-normal text-rose-300 hover:text-white">Mente → ({unreadOf(notices).length})</Link>
      </p>
      <div className="grid grid-cols-2 gap-1" role="radiogroup" aria-label="Delivery mode">
        {([['parallel', '並列（分割画面）'], ['serial', '直列（拡大 → 遷移）']] as const).map(([mode, label]) => (
          <button key={mode} type="button" role="radio" aria-checked={delivery === mode} onClick={() => setDelivery(mode)} className={`border px-1.5 py-1 ${delivery === mode ? 'border-rose-200/70 bg-rose-200/10 text-rose-50' : 'border-white/10 text-slate-400'}`}>{label}</button>
        ))}
      </div>
      {(Object.keys(SOURCE_LABEL) as MenteSource[]).map((source) => (
        <label key={source} className="flex items-center gap-1.5 text-slate-300">
          <input type="checkbox" checked={enabled[source]} onChange={(e) => setEnabled(source, e.target.checked)} className="accent-rose-300" />
          {SOURCE_LABEL[source]} <span className="ml-auto font-mono text-slate-500">{unreadOf(notices, source).length}</span>
        </label>
      ))}
    </div>
  );
}
