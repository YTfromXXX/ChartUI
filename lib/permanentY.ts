// "Permanent Y": the test player is kept as one lasting identity across the sugoroku, the race and
// later the card game, so their choices can build a picture of how they read a portfolio.
// Stored only in this browser (localStorage); nothing is sent anywhere.

export type PlayerY = { id: 'Y'; createdAt: string; games: number; votes: number; hits: number; lastSeen: string };
const KEY = 'chartui-permanent-y-v1';

export function loadY(): PlayerY {
  const now = new Date().toISOString();
  try { const raw = window.localStorage.getItem(KEY); if (raw) return { ...(JSON.parse(raw) as PlayerY), lastSeen: now }; } catch { /* storage blocked */ }
  return { id: 'Y', createdAt: now, games: 0, votes: 0, hits: 0, lastSeen: now };
}
export function saveY(y: PlayerY) { try { window.localStorage.setItem(KEY, JSON.stringify(y)); } catch { /* ignore */ } }
export function bumpY(patch: Partial<Record<'games' | 'votes' | 'hits', number>>): PlayerY {
  const y = loadY(); const next = { ...y, games: y.games + (patch.games ?? 0), votes: y.votes + (patch.votes ?? 0), hits: y.hits + (patch.hits ?? 0) }; saveY(next); return next;
}
