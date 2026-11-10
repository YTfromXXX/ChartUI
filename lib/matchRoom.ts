// Mente Match — a future matching app built on the shared needle, two devices, one room.
//
// Each person has their own (simulated) body signal on their own device. Questions, response
// peaks and self-reports travel through a tiny room relay (`app/api/mente-room`). From that
// shared event log both devices compute the same "convergence distance": when the two bodies
// react within a few seconds of each other, the distance shrinks; with time it relaxes back.
//
// The meta view shows exactly this: the distance is a simulation computed from timing
// coincidences, not compatibility, fate or truth. Nothing here is genetic; the ticket's
// "genome" is a playful crossover of the two people's question sequences.

export type Route = 'wizard' | 'ticket' | null;
export type EventKind = 'question' | 'peak' | 'self' | 'leave';
export type RoomEvent = { seq: number; at: number; from: string; kind: EventKind; text: string; amp?: number };
export type Member = { id: string; nick: string; level: number; route: Route; accept: boolean; seen: number; joined: number };
export type RoomSnapshot = { now: number; members: Member[]; events: RoomEvent[]; seq: number };

export const ROOM_RE = /^[A-Z0-9]{6}$/;
export const MEMBER_RE = /^[a-z0-9]{8,16}$/;
/** Two reactions closer than this (ms) count as a resonance. */
export const RESONANCE_MS = 4000;
/** Relaxation time constant (s): the distance drifts back toward 1 without new resonances. */
export const RELAX_S = 120;
/** Below this distance an invitation can be offered (and only if both chose the ticket route). */
export const TICKET_D = 0.4;
/** A self-report counts as a reaction of this strength. */
const SELF_AMP = 0.6;

export const QUESTIONS = ['最近うれしかったことは？', '今日いちばん疲れた瞬間は？', '子どものころ好きだった場所は？', '明日やってみたいことは？', 'いま気になっていることは？'];
/** The wizard's follow-up cards: one tap instead of typing, chosen from the last resonance. */
export const FOLLOW_UPS: Record<string, string[]> = {
  [QUESTIONS[0]]: ['それを誰に話したかった？', 'その瞬間、どんな音がしていた？'],
  [QUESTIONS[1]]: ['そのあと、どうやって回復した？', '疲れたときに行きたい場所は？'],
  [QUESTIONS[2]]: ['その場所の匂いを覚えている？', 'いまの部屋に似ているところは？'],
  [QUESTIONS[3]]: ['それを一緒にやるなら誰と？', 'やめておく理由があるとしたら？'],
  [QUESTIONS[4]]: ['それを最初に知ったのはいつ？', '気になるのは期待？それとも不安？'],
};
const GENERIC_FOLLOW_UPS = ['もう少し詳しく聞いてもいい？', 'いま、言葉にしにくい感じがある？'];

export function randomCode(n = 6) {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => A[b % A.length]).join('');
}
export function randomMemberId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => (b % 36).toString(36)).join('');
}

export type Resonance = { at: number; a: RoomEvent; b: RoomEvent; strength: number; cause: string };
export type Convergence = { d: number; resonances: Resonance[]; trail: { at: number; d: number }[] };

const relax = (d: number, dtMs: number) => 1 - (1 - d) * Math.exp(-Math.max(0, dtMs) / 1000 / RELAX_S);

/**
 * Replay the shared log: each reaction (peak or self-report) pairs with the other person's most
 * recent unpaired reaction within RESONANCE_MS. A pair shrinks the distance by up to 30 %,
 * weighted by the geometric mean of the two strengths. Both devices get the same result.
 */
export function convergence(events: RoomEvent[], nowMs: number): Convergence {
  const reacts = events.filter((e) => e.kind === 'peak' || e.kind === 'self').sort((x, y) => x.at - y.at);
  const questions = events.filter((e) => e.kind === 'question');
  let d = 1; let last = reacts[0]?.at ?? nowMs;
  const paired = new Set<number>(); const resonances: Resonance[] = []; const trail = [{ at: last, d }];
  for (const e of reacts) {
    d = relax(d, e.at - last); last = e.at;
    const amp = e.kind === 'self' ? SELF_AMP : e.amp ?? 0;
    const partner = [...reacts].reverse().find((o) => o.at <= e.at && o.seq !== e.seq && o.from !== e.from && !paired.has(o.seq) && e.at - o.at <= RESONANCE_MS);
    if (partner && !paired.has(e.seq)) {
      paired.add(partner.seq); paired.add(e.seq);
      const strength = Math.sqrt(amp * (partner.kind === 'self' ? SELF_AMP : partner.amp ?? 0));
      d *= 1 - 0.3 * strength;
      const cause = [...questions].reverse().find((q) => q.at <= partner.at)?.text ?? '（言葉の前）';
      resonances.push({ at: e.at, a: partner, b: e, strength, cause });
    }
    trail.push({ at: e.at, d });
  }
  d = relax(d, nowMs - last); trail.push({ at: nowMs, d });
  return { d, resonances, trail };
}

/** Next question cards for the wizard route, from the most recent resonance. */
export function wizardCards(c: Convergence): string[] {
  const last = c.resonances[c.resonances.length - 1];
  return last ? FOLLOW_UPS[last.cause] ?? GENERIC_FOLLOW_UPS : QUESTIONS.slice(0, 2);
}

const VENUES = [
  { name: 'LAB 美術館の色立方体の前', href: '/lab/colorcube' },
  { name: '図書館の千のプラトーの棚', href: '/lab/library' },
  { name: 'アトリエ C の螺旋階段', href: '/architect' },
  { name: 'ストア派の部屋', href: '/stoic-room' },
];
const BASES = 'ACGT';
const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h; };

export type Ticket = { genome: string; hue: number; venue: { name: string; href: string }; night: number; resonances: number; lines: string[] };

/**
 * The invitation: a crossover of the two people's question sequences, alternating one base at a
 * time — playful "gene editing" of a conversation, not of anyone's body. It names a kind of
 * place inside this app, never a real address.
 */
export function makeTicket(events: RoomEvent[], a: string, b: string, c: Convergence): Ticket {
  const seqOf = (id: string) => events.filter((e) => e.kind === 'question' && e.from === id).map((e) => BASES[hash(e.text) % 4]).join('') || 'A';
  const sa = seqOf(a); const sb = seqOf(b);
  let genome = '';
  for (let i = 0; genome.length < 12; i += 1) genome += i % 2 ? sb[(i >> 1) % sb.length] : sa[(i >> 1) % sa.length];
  const h = hash(genome);
  const venue = VENUES[h % VENUES.length];
  return {
    genome, hue: h % 360, venue, night: 1 + (h % 7), resonances: c.resonances.length,
    lines: c.resonances.slice(-3).map((r) => `「${r.cause}」で 2 人の針がほぼ同時に動いた（強さ ${(r.strength * 10).toFixed(0)}）`),
  };
}
