'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import KrugerBubble, { KRUGER_FAMILY, KRUGER_FONT } from '@/components/mente/KrugerBubble';
import RealNeedle from '@/components/mente/RealNeedle';
import { EdaSim } from '@/lib/edaSim';
import {
  QUESTIONS, RELAX_S, RESONANCE_MS, ROOM_RE, TICKET_D, convergence, makeTicket, randomCode, randomMemberId, wizardCards,
  type Member, type RoomEvent, type Route, type Ticket,
} from '@/lib/matchRoom';
import { download } from '@/lib/menteExport';
import { NeedleSound } from '@/lib/sonify';

type Stage = 'lobby' | 'room' | 'left';
type Outgoing = { kind: 'question' | 'peak' | 'self'; text: string; amp?: number };
const POLL_MS = 200;
const ROUTE_LABEL: Record<'wizard' | 'ticket', string> = { wizard: '魔法使い（プリンス／プリンセス）', ticket: '夜会への招待状' };

/**
 * Mente Match (prototype of a future matching app). Two devices, one room, like a phone call.
 * Each person's own body signal stays on their own needle; both needles are visible to both.
 * Questions are one-tap cards, reactions arrive as tone, bell and vibration — faster than typing.
 * The meta view shows the machine behind it: the "distance" between the two devices is a
 * simulation computed from coincident reactions, and the page says so.
 */
export default function MenteMatchPage() {
  const [stage, setStage] = useState<Stage>('lobby');
  const [code, setCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [nick, setNick] = useState('');
  const [consent, setConsent] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [clock, setClock] = useState({ server: 0, local: 0 });
  const [rtt, setRtt] = useState(0);
  const [route, setRoute] = useState<Route>(null);
  const [accept, setAccept] = useState(false);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [meta, setMeta] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [muted, setMuted] = useState(false);
  const [haptic, setHaptic] = useState(true);
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  const [announce, setAnnounce] = useState('');

  const me = useRef('');
  const myLevel = useRef(0.25); const partnerLevel = useRef(0.25);
  const sim = useRef<EdaSim | null>(null); const sound = useRef<NeedleSound | null>(null);
  const t0 = useRef(0); const outbox = useRef<Outgoing[]>([]); const lastSeq = useRef(0);
  const live = useRef({ muted, haptic, route, accept, nick });
  live.current = { muted, haptic, route, accept, nick };
  const simT = () => (performance.now() - t0.current) / 1000;

  useEffect(() => {
    me.current = randomMemberId();
    const q = new URLSearchParams(window.location.search).get('room')?.toUpperCase() ?? '';
    if (ROOM_RE.test(q)) setJoinCode(q);
  }, []);

  const enter = (c: string) => {
    if (!ROOM_RE.test(c)) { setError('部屋番号は英数字 6 文字です'); return; }
    setError(''); setCode(c); setEvents([]); setMembers([]); setTicket(null); setAccept(false); setRoute(null); lastSeq.current = 0;
    sim.current = new EdaSim(Date.now() % 100000); t0.current = performance.now();
    sound.current = new NeedleSound(); sound.current.start();
    window.history.replaceState(null, '', `?room=${c}`);
    setStage('room');
  };

  const leave = useCallback(() => {
    if (!code) return;
    void fetch('/api/mente-room', { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: code, me: me.current, leave: true }) });
    sound.current?.stop(); sound.current = null;
    setStage((s) => (s === 'room' ? 'left' : s));
  }, [code]);

  useEffect(() => {
    if (stage !== 'room') return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') leave(); };
    const onUnload = () => leave();
    window.addEventListener('keydown', onKey); window.addEventListener('pagehide', onUnload);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pagehide', onUnload); };
  }, [stage, leave]);
  useEffect(() => () => sound.current?.stop(), []);

  // My own body: simulated signal → my needle; my peaks go to the room.
  useEffect(() => {
    if (stage !== 'room') return undefined;
    let raf = 0;
    const frame = () => {
      const t = simT(); const s = sim.current!;
      myLevel.current = s.level(t);
      sound.current?.update(partnerLevel.current, live.current.muted); // the earphone carries the other person
      for (const p of s.takePeaks(t)) outbox.current.push({ kind: 'peak', text: p.cause, amp: p.amp });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  // The line between the two devices: send my state and new events, receive the room.
  useEffect(() => {
    if (stage !== 'room') return undefined;
    let busy = false; let stopped = false;
    const tick = async () => {
      if (busy || stopped) return; busy = true;
      const sending = outbox.current.splice(0);
      const sent = performance.now();
      try {
        const res = await fetch('/api/mente-room', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, cache: 'no-store',
          body: JSON.stringify({ room: code, me: me.current, nick: live.current.nick, after: lastSeq.current, level: myLevel.current, route: live.current.route, accept: live.current.accept, events: sending }),
        });
        if (res.status === 409) { setError('この部屋はもう 2 人います'); stopped = true; sound.current?.stop(); setStage('lobby'); return; }
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { now: number; seq: number; members: Member[]; events: RoomEvent[] };
        setRtt(Math.round(performance.now() - sent));
        setClock({ server: data.now, local: performance.now() });
        setMembers(data.members);
        partnerLevel.current = data.members.find((m) => m.id !== me.current)?.level ?? partnerLevel.current;
        const fresh = data.events.filter((e) => e.seq > lastSeq.current);
        if (fresh.length) {
          lastSeq.current = data.seq;
          setEvents((ev) => [...ev, ...fresh]);
          for (const e of fresh) {
            if (e.from === me.current) continue;
            if (e.kind === 'question') { sim.current?.stimulate(simT(), e.text); setAnnounce(`相手からの質問：${e.text}`); }
            if (e.kind === 'peak') {
              sound.current?.bell(e.amp ?? 0.5, live.current.muted);
              if (live.current.haptic && typeof navigator.vibrate === 'function') navigator.vibrate(Math.round(60 + (e.amp ?? 0.5) * 240));
              setAnnounce(`相手の針が動きました。強さ ${Math.round((e.amp ?? 0) * 10)}（10 段階）。`);
            }
            if (e.kind === 'self') setAnnounce('相手が「何か感じた」と伝えました。');
            if (e.kind === 'leave') setAnnounce('相手が退出しました。');
          }
        }
      } catch {
        outbox.current.unshift(...sending); // retry on the next tick
      } finally { busy = false; }
    };
    const id = window.setInterval(() => { void tick(); }, POLL_MS);
    void tick();
    return () => { stopped = true; window.clearInterval(id); };
  }, [stage, code]);

  const ask = (q: string) => {
    if (!q.trim() || !sim.current) return;
    sim.current.stimulate(simT(), q); // asking moves the asker's body too
    outbox.current.push({ kind: 'question', text: q.trim() }); setCustom('');
  };
  const selfReport = () => outbox.current.push({ kind: 'self', text: '何か感じた' });

  // Shared geometry, computed the same way on both devices from the shared log.
  const serverNow = clock.server + (performance.now() - clock.local);
  const conv = useMemo(() => convergence(events, serverNow), [events, serverNow]);
  const mine = members.find((m) => m.id === me.current); const partner = members.find((m) => m.id !== me.current);
  const partnerName = partner?.nick || 'あいて';
  const bothTicket = mine?.route === 'ticket' && partner?.route === 'ticket';
  const canOffer = bothTicket && conv.d < TICKET_D;
  useEffect(() => {
    if (!ticket && mine?.accept && partner?.accept && bothTicket && members.length === 2) {
      setTicket(makeTicket(events, members[0].id, members[1].id, conv));
      setAnnounce('2 人とも受け取りました。夜会への招待状が届きました。');
    }
  }, [ticket, mine?.accept, partner?.accept, bothTicket, members, events, conv]);
  // Changing one's mind withdraws an acceptance.
  useEffect(() => { if (route !== 'ticket') setAccept(false); }, [route]);

  const lastLeave = [...events].reverse().find((e) => e.kind === 'leave' && e.from !== me.current);
  const partnerGone = !partner && events.some((e) => e.from !== me.current);

  const save = () => download('mente-match.json', JSON.stringify({
    simulated: true, room: code, note: '距離は反応の時刻の重なりから計算したシミュレーション。相性や運命を示さない。',
    distance: conv.d, resonances: conv.resonances.map((r) => ({ at: r.at, cause: r.cause, strength: r.strength })), ticket,
    events: events.map((e) => ({ ...e, from: e.from === me.current ? 'me' : 'partner' })),
  }, null, 2), 'application/json');

  // Meta view geometry.
  const W = 600; const H = 230;
  const gap = 40 + conv.d * 220;
  const ax = W / 2 - gap / 2; const bx = W / 2 + gap / 2;
  const span = RELAX_S * 1000;
  const tx = (at: number) => 20 + (W - 40) * (1 - (serverNow - at) / span);
  const ty = (d: number) => H - 12 - d * 70;
  const trail = conv.trail.filter((p) => serverNow - p.at < span).map((p) => `${tx(p.at).toFixed(1)},${ty(p.d).toFixed(1)}`).join(' ');

  const btn = 'border-2 border-black bg-white px-2 py-0.5 text-xs';
  const red = 'bg-[#d6001c] px-4 py-1 font-bold italic text-white disabled:opacity-40';

  return (
    <main className={`${KRUGER_FONT} min-h-screen bg-[repeating-linear-gradient(180deg,#9a9a9a_0_80px,#d0d0d0_80px_190px)] px-4 py-5 text-[#1f1f1f] sm:px-8`}>
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-serif text-4xl font-bold italic text-[#7a0f22]">Mente</p>
            <p className="inline-block bg-black px-2 py-1 text-sm font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>Mente Match · 2 台の端末で針を共有（未来のマッチング試作）</p>
          </div>
          <nav className="flex gap-2 text-sm"><Link href="/mente" className="border-2 border-black bg-white/70 px-3 py-1">Mente</Link><Link href="/mente/needle" className="border-2 border-black bg-white/70 px-3 py-1">針の共有（1 台）</Link></nav>
        </header>
        <p aria-live="polite" className="sr-only" data-testid="announce">{announce}</p>

        {stage === 'lobby' && (
          <section aria-label="Lobby" className="space-y-3 border-4 border-black bg-white/70 p-4">
            <KrugerBubble name="Mente Match" text="文字を打つかわりに、質問カードを 1 タップ。返事は言葉と一緒に、相手の針・音の高さ・振動で数秒以内に届く。2 人の反応が重なるたびに、2 台の端末の「距離」が縮んでいく。その距離が何でできているかは、メタ視点でいつでも見られる。" align="full" />
            <label className="flex flex-wrap items-center gap-2 text-sm">呼び名（任意・本名は不要）<input aria-label="Nickname" value={nick} maxLength={16} onChange={(e) => setNick(e.target.value)} className="border-2 border-black bg-white px-2 py-0.5" /></label>
            <label className="flex items-start gap-2 font-bold"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" /> 自分の反応の強さ（シミュレーション）を相手と共有することに同意する。針は真偽や相性を示さない。いつでも退出できる（Esc）。</label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={!consent} onClick={() => enter(randomCode())} className={red} style={{ fontFamily: KRUGER_FAMILY }}>部屋をつくる</button>
              <span className="text-sm">または</span>
              <input aria-label="Room code" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="部屋番号（6 文字）" maxLength={6} className="w-36 border-2 border-black bg-white px-2 py-0.5 font-mono" />
              <button type="button" disabled={!consent} onClick={() => enter(joinCode)} className="border-2 border-black bg-white px-3 py-1 font-bold disabled:opacity-40">部屋に入る</button>
            </div>
            {error && <p role="alert" className="font-bold text-[#d6001c]">{error}</p>}
            <p className="text-xs text-slate-700">部屋の記録はサーバーのメモリにだけ置かれ、2 人とも退出するか 30 分たつと消える。名前・位置・連絡先は送らない。実際に会う約束は、アプリの外で、公共の場所で。</p>
          </section>
        )}

        {stage === 'room' && (
          <>
            <section aria-label="Line" className="flex flex-wrap items-center gap-3 border-4 border-black bg-white/70 p-2 text-sm">
              <span className="bg-black px-2 py-0.5 font-mono font-bold text-white" data-testid="room-code">部屋 {code}</span>
              <span>{partner ? `${partnerName} とつながっています` : partnerGone ? '相手が退出しました' : '相手を待っています（この部屋番号かリンクを送る）'}</span>
              <label className="flex items-center gap-1"><input type="checkbox" checked={!muted} onChange={(e) => setMuted(!e.target.checked)} /> 耳（相手の針の音）</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={haptic} onChange={(e) => setHaptic(e.target.checked)} /> 振動</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={blackout} onChange={(e) => setBlackout(e.target.checked)} /> ブラックアウト</label>
              <label className="flex items-center gap-1 font-bold"><input type="checkbox" checked={meta} onChange={(e) => setMeta(e.target.checked)} /> メタ視点</label>
              <button type="button" onClick={leave} className="ml-auto bg-[#d6001c] px-3 py-0.5 font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>退出（Esc）</button>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 border-4 border-black bg-white/70 p-3" aria-label="My needle">
                <p className="inline-block bg-black px-2 py-0.5 text-sm font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>あなた{nick ? `（${nick}）` : ''} · 相手にも見えている</p>
                <RealNeedle levelRef={myLevel} blackout={blackout} label="あなたの反応" />
                <div className="flex flex-wrap gap-1">{(route === 'wizard' ? wizardCards(conv) : QUESTIONS).map((q) => <button key={q} type="button" onClick={() => ask(q)} className={btn}>{route === 'wizard' ? '✦ ' : ''}{q}</button>)}</div>
                <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); ask(custom); }}>
                  <input aria-label="Question" value={custom} maxLength={120} onChange={(e) => setCustom(e.target.value)} placeholder="自分の言葉で質問する" className="min-w-0 flex-1 border-2 border-black bg-white px-2 py-0.5 text-sm" />
                  <button type="submit" className="border-2 border-black px-2 py-0.5 font-bold">送る</button>
                </form>
                <button type="button" onClick={selfReport} className="border-2 border-black px-3 py-1 text-sm font-bold">何か感じた（自己申告）</button>
              </div>
              <div className="space-y-2 border-4 border-black bg-white/70 p-3" aria-label="Partner needle">
                <p className="inline-block bg-black px-2 py-0.5 text-sm font-bold italic text-white" style={{ fontFamily: KRUGER_FAMILY }}>{partnerName} · あなたにも見えている</p>
                <RealNeedle levelRef={partnerLevel} blackout={blackout} label={partner ? `${partnerName}の反応` : '未接続'} />
                <div className="space-y-1" aria-label="Conversation">
                  {events.filter((e) => e.kind !== 'peak').slice(-5).map((e) => (
                    <KrugerBubble key={e.seq} name={e.from === me.current ? 'あなた' : partnerName} text={e.kind === 'question' ? e.text : e.kind === 'self' ? '（何か感じた）' : '（退出）'} align={e.from === me.current ? 'right' : 'left'} />
                  ))}
                </div>
              </div>
            </div>

            <section aria-label="Route" className="space-y-2 border-4 border-black bg-white/70 p-3 text-sm">
              <p className="font-bold">このチャットの行方を、それぞれが自分で選ぶ（相手にも見える・いつでも変えられる）</p>
              <div className="flex flex-wrap gap-2">
                {(['wizard', 'ticket'] as const).map((r) => (
                  <button key={r} type="button" aria-pressed={route === r} onClick={() => setRoute(route === r ? null : r)} className={`border-2 border-black px-3 py-1 font-bold ${route === r ? 'bg-black text-white' : 'bg-white'}`}>{ROUTE_LABEL[r]}</button>
                ))}
              </div>
              <p data-testid="routes">あなた：{route ? ROUTE_LABEL[route] : '未選択'} ／ {partnerName}：{partner?.route ? ROUTE_LABEL[partner.route] : '未選択'}</p>
              <p className="text-xs text-slate-700">魔法使い＝ゴールを決めず、次の質問カードを魔法のように差し出す。招待状＝2 人とも選び、距離が {TICKET_D} を下回ったときだけ、夜会への招待状を受け取れる（2 人とも押したときだけ届く）。</p>
              {canOffer && !ticket && (
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" aria-pressed={accept} onClick={() => setAccept((a) => !a)} className={red} style={{ fontFamily: KRUGER_FAMILY }}>{accept ? '受け取る（取り消す）' : '招待状を受け取る'}</button>
                  <span>{partner?.accept ? `${partnerName}は受け取る準備ができています` : `${partnerName}はまだ`}</span>
                </div>
              )}
              {bothTicket && !canOffer && !ticket && <p>距離 {conv.d.toFixed(2)}：招待状まであと {(conv.d - TICKET_D).toFixed(2)}</p>}
            </section>

            {ticket && (
              <section aria-label="Ticket" className="border-4 border-black p-4 text-white" style={{ background: `linear-gradient(135deg, hsl(${ticket.hue} 70% 25%), #111 70%)` }}>
                <p className="text-xs tracking-[0.3em]">INVITATION · 第 {ticket.night} 夜の夜会</p>
                <p className="mt-1 text-2xl font-bold italic" style={{ fontFamily: KRUGER_FAMILY }}>夜会への招待状</p>
                <p className="mt-1 font-mono text-lg tracking-[0.4em]" data-testid="genome">{ticket.genome}</p>
                <p className="text-xs opacity-80">2 人の質問の並びを 1 文字ずつ交互に交叉させた「会話の遺伝子」（体の遺伝子ではない）</p>
                <p className="mt-2">運命のカーナビの行き先：<Link href={ticket.venue.href} className="underline">{ticket.venue.name}</Link>（このアプリの中の場所）</p>
                <ul className="mt-1 list-disc pl-5 text-sm">{ticket.lines.map((l) => <li key={l}>{l}</li>)}</ul>
                <p className="mt-2 text-xs opacity-80">これは約束ではない。現実に会うかどうかは、アプリの外で 2 人が決める。</p>
              </section>
            )}

            <section aria-label="Meta view" className={`border-4 border-black p-2 ${meta ? 'bg-black text-white' : 'bg-white/70'}`}>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Distance between devices ${conv.d.toFixed(2)}`}>
                <line x1={ax} y1={60} x2={bx} y2={60} stroke={meta ? '#fff' : '#000'} strokeDasharray="4 4" />
                {[{ x: ax, name: 'あなた', l: myLevel.current }, { x: bx, name: partnerName, l: partnerLevel.current }].map((p) => (
                  <g key={p.name}>
                    <rect x={p.x - 16} y={30} width={32} height={58} rx={5} fill={meta ? '#222' : '#fff'} stroke="#d6001c" strokeWidth={2} />
                    <rect x={p.x - 11} y={84 - p.l * 46} width={22} height={p.l * 46} fill="#d6001c" />
                    <text x={p.x} y={104} textAnchor="middle" fontSize={11} fill="currentColor">{p.name}</text>
                  </g>
                ))}
                <text x={W / 2} y={52} textAnchor="middle" fontSize={12} fontWeight="bold" fill="currentColor" data-testid="distance">d = {conv.d.toFixed(2)}</text>
                {meta && <text x={W / 2} y={20} textAnchor="middle" fontSize={10} fill="#bbb">通信の往復 {rtt} ms（実際の回線）／ 共鳴 {conv.resonances.length} 回（シミュレーション）</text>}
                <line x1={20} x2={W - 20} y1={ty(TICKET_D)} y2={ty(TICKET_D)} stroke="#d6001c" strokeDasharray="2 3" />
                <text x={22} y={ty(TICKET_D) - 3} textAnchor="start" fontSize={9} fill="#d6001c">招待状の線 {TICKET_D}</text>
                <polyline points={trail} fill="none" stroke={meta ? '#fff' : '#000'} strokeWidth={1.5} />
                {conv.resonances.filter((r) => serverNow - r.at < span).map((r) => <circle key={r.b.seq} cx={tx(r.at)} cy={ty(conv.trail.find((p) => p.at === r.at)?.d ?? conv.d)} r={3 + r.strength * 3} fill="#d6001c" />)}
              </svg>
              {meta && (
                <div className="space-y-1" data-testid="meta-reveal">
                  <KrugerBubble name="この距離の正体" text={`2 台のあいだの d は、2 人の反応（針のピークか自己申告）が ${RESONANCE_MS / 1000} 秒以内に重なるたびに最大 30 % 縮み、何もなければ ${RELAX_S} 秒の時定数で 1 に戻る、という式で両方の端末が同じように計算したシミュレーション。`} align="full" />
                  <KrugerBubble name="現実の幾何学" text={`実際の回線の距離は往復 ${rtt} ms。d はそれとは関係がない。縮んだように感じた距離は、言葉と反応のタイミングが重なった記録であって、相性・運命・真偽の判定ではない。`} align="full" />
                  <ul className="pl-1 text-xs text-slate-300">{conv.resonances.slice(-5).map((r) => <li key={r.b.seq}>共鳴：「{r.cause}」 強さ {(r.strength * 10).toFixed(0)} → d × {(1 - 0.3 * r.strength).toFixed(2)}</li>)}</ul>
                </div>
              )}
            </section>
          </>
        )}

        {stage === 'left' && (
          <section aria-label="Left" className="space-y-2 border-4 border-black bg-white/70 p-4">
            <KrugerBubble name="退出しました" text={`共鳴 ${conv.resonances.length} 回・最後の距離 d = ${conv.d.toFixed(2)}（シミュレーション）。${lastLeave ? '相手も退出済み。' : ''}部屋の記録はサーバーから消えていく。手元に残すかどうかはあなたが決める。`} align="full" />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={save} className={red} style={{ fontFamily: KRUGER_FAMILY }}>自分の記録を保存（JSON）</button>
              <button type="button" onClick={() => { setEvents([]); setTicket(null); }} className="border-2 border-black px-3 py-1">手元の記録を消す</button>
              <button type="button" onClick={() => { setConsent(false); setStage('lobby'); window.history.replaceState(null, '', window.location.pathname); }} className="border-2 border-black px-3 py-1">ロビーへ</button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
