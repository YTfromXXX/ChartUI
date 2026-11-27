'use client';

// Mente notification inbox, shared by every page and tab of the app.
// Senders: クオンタムクイズ (No.19), King&Queen, ヒューマンリソース, アニマルリソース and
// Mente's own colour requests. The delivery mode — parallel
// (split screen) or serial (one enlarged notice at a time, opening = screen transition) —
// is set on the Cure-API side.

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type MenteSource = 'quiz' | 'kingqueen' | 'human' | 'animal' | 'mente';
export type MenteDelivery = 'parallel' | 'serial';

export type MenteNotice = {
  id: string;
  source: MenteSource;
  title: string;
  body: string;
  /** Where "open" goes (the screen transition). */
  href: string;
  at: number;
  read: boolean;
};

export const SOURCE_LABEL: Record<MenteSource, string> = {
  quiz: 'クオンタムクイズからの通知',
  kingqueen: 'King&Queen からのイベント通知',
  human: 'ヒューマンリソース',
  animal: 'アニマルリソース',
  mente: 'Mente からの色彩の要求',
};

type InboxState = {
  notices: MenteNotice[];
  delivery: MenteDelivery;
  enabled: Record<MenteSource, boolean>;
  notify: (notice: Omit<MenteNotice, 'id' | 'at' | 'read'>) => void;
  markRead: (id: string) => void;
  markAllRead: (source?: MenteSource) => void;
  clear: () => void;
  setDelivery: (delivery: MenteDelivery) => void;
  setEnabled: (source: MenteSource, on: boolean) => void;
};

const STORE_KEY = 'chartui-mente-inbox';
const MAX_NOTICES = 40;

export const useMenteInbox = create<InboxState>()(
  persist(
    (set) => ({
      notices: [],
      delivery: 'parallel',
      enabled: { quiz: true, kingqueen: true, human: true, animal: true, mente: true },
      notify: (notice) => set((state) => (state.enabled[notice.source]
        ? { notices: [{ ...notice, id: `${notice.source}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: Date.now(), read: false }, ...state.notices].slice(0, MAX_NOTICES) }
        : state)),
      markRead: (id) => set((state) => ({ notices: state.notices.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
      markAllRead: (source) => set((state) => ({ notices: state.notices.map((n) => (!source || n.source === source ? { ...n, read: true } : n)) })),
      clear: () => set({ notices: [] }),
      setDelivery: (delivery) => set({ delivery }),
      setEnabled: (source, on) => set((state) => ({ enabled: { ...state.enabled, [source]: on } })),
    }),
    {
      name: STORE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Older saved state only knew two senders: keep their switches, default the rest to on.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<InboxState>;
        return { ...current, ...saved, enabled: { ...current.enabled, ...(saved.enabled ?? {}) } };
      },
    },
  ),
);

// Other tabs (e.g. the quiz on retro grid B, or King&Queen) write the same storage key:
// pull their notices in as they arrive.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORE_KEY) void useMenteInbox.persist.rehydrate();
  });
}

export const unreadOf = (notices: MenteNotice[], source?: MenteSource) => notices.filter((n) => !n.read && (!source || n.source === source));
