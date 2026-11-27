import { NextResponse } from 'next/server';
import { MEMBER_RE, ROOM_RE, type EventKind, type Member, type RoomEvent, type Route } from '@/lib/matchRoom';

export const dynamic = 'force-dynamic';

// A tiny in-memory relay for two devices in one room. Nothing is written to disk; a room is
// deleted when both people leave or after 30 minutes without activity. No names, no IPs.
type Room = { members: Record<string, Member>; events: RoomEvent[]; seq: number; touched: number };
const store = globalThis as unknown as { __menteRooms?: Map<string, Room> };
const rooms: Map<string, Room> = (store.__menteRooms ??= new Map<string, Room>());

const IDLE_MS = 30 * 60 * 1000; const GONE_MS = 15000; const MAX_EVENTS = 500;
const KINDS: EventKind[] = ['question', 'peak', 'self'];

type Body = {
  room?: string; me?: string; nick?: string; after?: number; level?: number; route?: Route; accept?: boolean; leave?: boolean;
  events?: { kind?: string; text?: string; amp?: number }[];
};

function prune(now: number) {
  for (const [code, r] of rooms) if (now - r.touched > IDLE_MS) rooms.delete(code);
}

export async function POST(req: Request) {
  const now = Date.now(); prune(now);
  let body: Body;
  try { body = (await req.json()) as Body; } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const { room: code, me } = body;
  if (!code || !ROOM_RE.test(code) || !me || !MEMBER_RE.test(me)) return NextResponse.json({ error: 'bad room or member' }, { status: 400 });

  let room = rooms.get(code);
  if (body.leave) {
    if (room?.members[me]) {
      delete room.members[me];
      room.events.push({ seq: ++room.seq, at: now, from: me, kind: 'leave', text: '退出' });
      if (Object.keys(room.members).length === 0) rooms.delete(code);
    }
    return NextResponse.json({ left: true });
  }
  if (!room) { room = { members: {}, events: [], seq: 0, touched: now }; rooms.set(code, room); }
  room.touched = now;
  // Drop members that stopped polling, then admit at most two people.
  for (const [id, m] of Object.entries(room.members)) if (id !== me && now - m.seen > GONE_MS) delete room.members[id];
  if (!room.members[me] && Object.keys(room.members).length >= 2) return NextResponse.json({ error: 'room full' }, { status: 409 });

  const prev = room.members[me];
  const level = typeof body.level === 'number' && Number.isFinite(body.level) ? Math.max(0, Math.min(1, body.level)) : prev?.level ?? 0;
  const route: Route = body.route === 'wizard' || body.route === 'ticket' ? body.route : body.route === null ? null : prev?.route ?? null;
  room.members[me] = {
    id: me, nick: String(body.nick ?? prev?.nick ?? '').slice(0, 16), level, route,
    accept: typeof body.accept === 'boolean' ? body.accept : prev?.accept ?? false, seen: now, joined: prev?.joined ?? now,
  };
  for (const e of (body.events ?? []).slice(0, 10)) {
    if (!KINDS.includes(e.kind as EventKind)) continue;
    room.events.push({
      seq: ++room.seq, at: now, from: me, kind: e.kind as EventKind, text: String(e.text ?? '').slice(0, 120),
      ...(typeof e.amp === 'number' ? { amp: Math.max(0, Math.min(1, e.amp)) } : {}),
    });
  }
  if (room.events.length > MAX_EVENTS) room.events.splice(0, room.events.length - MAX_EVENTS);

  const after = Number(body.after ?? 0);
  return NextResponse.json({
    now, seq: room.seq,
    members: Object.values(room.members).sort((a, b) => a.joined - b.joined),
    events: room.events.filter((e) => e.seq > after),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
