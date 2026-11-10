'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import KrugerBubble, { KRUGER_FAMILY, KRUGER_FONT } from '@/components/mente/KrugerBubble';
import { SOURCE_LABEL, unreadOf, useMenteInbox, type MenteNotice, type MenteSource } from '@/lib/menteInbox';

const SOURCES: MenteSource[] = ['quiz', 'kingqueen'];
const time = (at: number) => new Date(at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * Mente notification area. Parallel: one pane per sender, side by side (split screen).
 * Serial: unread notices one at a time, enlarged; "open" is a screen transition.
 */
export default function MenteNotificationArea() {
  const router = useRouter();
  const notices = useMenteInbox((s) => s.notices);
  const delivery = useMenteInbox((s) => s.delivery);
  const markRead = useMenteInbox((s) => s.markRead);
  const markAllRead = useMenteInbox((s) => s.markAllRead);
  const [dismissedAt, setDismissedAt] = useState(0);

  const open = (n: MenteNotice) => { markRead(n.id); router.push(n.href); };

  // Serial queue: oldest unread first, across both senders.
  const queue = useMemo(() => unreadOf(notices).sort((a, b) => a.at - b.at), [notices]);
  const head = queue[0];
  // "あとで" hides the queue until a newer notice arrives.
  const showSerial = delivery === 'serial' && Boolean(head) && queue.some((n) => n.at > dismissedAt);

  useEffect(() => {
    if (!showSerial) return undefined;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setDismissedAt(Date.now()); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showSerial]);

  return (
    <section aria-label="Mente notifications" className={`${KRUGER_FONT} space-y-2`}>
      <p className="inline-block bg-black px-2 py-1 text-xs font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>
        NOTIFICATIONS · {delivery === 'parallel' ? '並列（分割画面）' : '直列（拡大 → 画面遷移）'} · 未読 {queue.length}
        <span className="ml-2 font-normal not-italic text-white/60">設定は Cure-API 側</span>
      </p>

      {delivery === 'parallel' ? (
        <div className="grid gap-3 md:grid-cols-2">
          {SOURCES.map((source) => {
            const list = notices.filter((n) => n.source === source);
            return (
              <div key={source} className="min-h-[10rem] border-2 border-black bg-white/60 p-2" aria-label={SOURCE_LABEL[source]}>
                <div className="mb-2 flex items-center justify-between">
                  <span className="bg-black px-1.5 py-0.5 text-[11px] font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>{SOURCE_LABEL[source]}</span>
                  <button type="button" onClick={() => markAllRead(source)} className="text-[10px] underline">すべて既読（{unreadOf(notices, source).length}）</button>
                </div>
                {list.length === 0 ? <p className="text-[11px] text-slate-600">通知はまだありません</p> : (
                  <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {list.map((n) => (
                      <li key={n.id} className={n.read ? 'opacity-50' : ''}>
                        <KrugerBubble name={`${n.title}${n.read ? '' : ' · NEW'}`} at={time(n.at)} text={n.body} align="full" />
                        <div className="mt-0.5 flex justify-end gap-2 text-[10px]">
                          {!n.read && <button type="button" onClick={() => markRead(n.id)} className="underline">既読</button>}
                          <button type="button" onClick={() => open(n)} className="bg-black px-1.5 font-bold italic text-white">開く →</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[11px] text-slate-700">{queue.length ? `未読 ${queue.length} 件を 1 件ずつ拡大表示します。` : '未読の通知はありません。'}{head && !showSerial && <button type="button" onClick={() => setDismissedAt(0)} className="ml-2 underline">表示する</button>}</p>
      )}

      {showSerial && head && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#cfcfcf]/90 p-4" role="dialog" aria-modal="true" aria-label={`${SOURCE_LABEL[head.source]} 1 / ${queue.length}`}>
          <div className="w-full max-w-2xl space-y-3">
            <p className="inline-block bg-black px-2 py-1 text-sm font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>{SOURCE_LABEL[head.source]} · 1 / {queue.length}</p>
            <p className="bg-[#d6001c] px-4 py-3 text-3xl font-bold italic leading-tight text-white" style={{ fontFamily: KRUGER_FAMILY }}>{head.title}</p>
            <p className="bg-[#d6001c] px-4 py-2 text-lg font-bold italic leading-snug text-white" style={{ fontFamily: KRUGER_FAMILY }}>{head.body}</p>
            <div className="flex flex-wrap gap-2 text-sm">
              <button type="button" onClick={() => open(head)} className="bg-black px-3 py-1.5 font-bold italic text-white">開く（画面遷移）→</button>
              <button type="button" onClick={() => markRead(head.id)} className="border-2 border-black px-3 py-1.5 font-bold">{queue.length > 1 ? '既読にして次へ' : '既読'}</button>
              <button type="button" onClick={() => setDismissedAt(Date.now())} className="px-3 py-1.5 underline">あとで</button>
            </div>
            <p className="text-[11px] text-slate-700">{time(head.at)} 受信</p>
          </div>
        </div>
      )}
    </section>
  );
}
