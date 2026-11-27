'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { makeCharacter } from '@/lib/babyCast';
import { GOLDEN, MU } from '@/lib/colorRules';

// The feast. Keyword AB = a Tesla coil's two coils: A (primary) is スハル (29 種, fast, high), B (secondary) is
// リナリス (92 種, slow, low). A Tesla coil passes energy best when both are tuned to the same resonant frequency
// (f = 1 / 2π√LC); then its sparks are strongest. "Singing" Tesla coils switch their sparks on and off at a note's
// pitch and really play music. Here, when A and B meet, the coil sings the feast's song and BA 🐵 and PE 🫛 drum.
// Light: sparks only on the beat, at most 2 per second, small and fading (well under 3 flashes a second);
// with reduced motion or "光を弱める" the arcs become a steady glow. Not a guide to building anything: high voltage is dangerous.
const BG = '#0a0a0a'; const PANEL = '#161514'; const TEXT = '#f4f1ec'; const SUB = '#a8a29e'; const LINE = '#2a2826';
const DEFAULT_FOUR = [MU.strain29.hex, MU.strain92.hex, GOLDEN[0].hex, MU.bud.hex];
const MELODY = [392, 440, 494, 587, 494, 440, 392, 330, 392, 440, 494, 659, 587, 494, 440, 392]; // the feast's song (G major, our own)
const BPM = 120;

function Person({ name, left, right, coat, tag }: { name: string; left: string; right: string; coat: string; tag: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-[11px]">
      <div className="relative h-16 w-12" aria-hidden>
        <div className="absolute left-0 top-0 h-10 w-12 rounded-t-full" style={{ background: `linear-gradient(90deg, ${left} 50%, ${right} 50%)` }} />
        <div className="absolute left-2 top-3 h-8 w-8 rounded-full bg-[#ffe3c7]" /><div className="absolute left-[14px] top-[26px] h-1 w-1 rounded-full bg-black" /><div className="absolute left-[26px] top-[26px] h-1 w-1 rounded-full bg-black" />
        <div className="absolute left-1 top-11 h-5 w-10 rounded-t-md" style={{ background: coat }} />
      </div>
      <p className="font-semibold">{name}</p><p style={{ color: SUB }}>{tag}</p>
    </div>
  );
}

function arcPath(x0: number, y0: number, x1: number, y1: number, seed: number) {
  let s = seed; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const n = 9; let d = `M${x0} ${y0}`;
  for (let i = 1; i < n; i += 1) { const t = i / n; d += ` L${x0 + (x1 - x0) * t + (r() - 0.5) * 22} ${y0 + (y1 - y0) * t + (r() - 0.5) * 22}`; }
  return `${d} L${x1} ${y1}`;
}

export default function Feast() {
  const [four, setFour] = useState<string[]>(DEFAULT_FOUR);
  useEffect(() => { try { const c = JSON.parse(localStorage.getItem('mente-cast') ?? 'null'); if (c?.four?.length === 4) setFour(c.four); } catch { /* storage may be unavailable */ } }, []); // the four colours chosen on the baby-cast page
  const A = useMemo(() => makeCharacter(2911, four), [four]); const B = useMemo(() => makeCharacter(9203, four), [four]);
  const [fA, setFA] = useState(260); const [fB, setFB] = useState(140); // kHz
  const [guest, setGuest] = useState<'ariel' | 'luna'>('ariel');
  const [sound, setSound] = useState(false); const [soft, setSoft] = useState(false); const [reduced, setReduced] = useState(false);
  const [beat, setBeat] = useState(0); const [toasts, setToasts] = useState<string[]>([]);
  const ctx = useRef<AudioContext | null>(null); const beatRef = useRef(0);
  useEffect(() => { setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches); }, []);
  const res = Math.exp(-(((fA - fB) / 25) ** 2)); // how well A and B are tuned to each other
  const singing = res > 0.8;
  useEffect(() => {
    const t = window.setInterval(() => {
      beatRef.current += 1; setBeat(beatRef.current);
      if (singing && sound && ctx.current) {
        const ac = ctx.current; const o = ac.createOscillator(); const v = ac.createGain(); o.type = 'square';
        o.frequency.value = MELODY[beatRef.current % MELODY.length]; v.gain.setValueAtTime(0.0001, ac.currentTime); v.gain.exponentialRampToValueAtTime(0.06, ac.currentTime + 0.01); v.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.4);
        o.connect(v).connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.45);
      }
    }, 60000 / BPM);
    return () => window.clearInterval(t);
  }, [singing, sound]);
  const toggleSound = () => { if (!sound) { ctx.current ??= new AudioContext(); void ctx.current.resume(); } setSound((s) => !s); };
  const steady = reduced || soft;
  const arcs = useMemo(() => Array.from({ length: Math.round(res * 6) }, (_, i) => arcPath(200, 92, 200 + Math.cos(i * 1.1 + beat) * 150, 92 + Math.sin(i * 1.1 + beat) * 70 - 10, beat * 31 + i)), [res, beat]);
  const don = beat % 2 === 0;
  const guestName = guest === 'ariel' ? 'エーリアル' : 'Luna';
  const sceneA = res < 0.3 ? `${A.name}の音は高く、${B.name}の音は低い。コイルは黙っている。「まだ、合っていない」と${guestName}。` : res < 0.8 ? `二人の音が近づいてきた。コイルの先が、かすかに紫に光る。${guest === 'ariel' ? 'エーリアルの 22 の目が、同じ一点を見た。' : 'Luna が「あと少し」と、指で円を描いた。'}` : `共振。A と B が同じ速さで揺れた。コイルが歌いはじめる。`;
  const sceneB = singing ? `${guest === 'ariel' ? 'エーリアルは 22 の角度から火花を数え、ひとつも同じ形がないことを確かめた。' : 'Luna は飛行機の話をやめて、火花のリズムで手を叩いた。'} BA 🐵 は「ドン」、PE 🫛 は「ぱ」。宴は、コイルの歌に合わせて回りはじめた。` : 'コイルが歌うまで、BA と PE は皿を並べて待っている。';
  const TOASTS = [`${A.name}：「ぐるりと回ってから、ここに来た。乾杯」`, `${B.name}：「まっすぐ来た。だから、ゆっくり飲む」`, `${guestName}：「測るまで二つ。でも今夜は一つ」`, 'BA 🐵：「ドン！」', 'PE 🫛：「ぱ！」', `${A.name}と${B.name}：「A と B に」`];

  return (
    <main className="mx-auto max-w-4xl space-y-3 p-4" style={{ background: BG, color: TEXT }}>
      <style>{'@keyframes hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}'}</style>
      <header className="space-y-1">
        <p className="text-xs" style={{ color: SUB }}>MENTE · 宴 · キーワード AB（テスラコイル）</p>
        <h1 className="text-xl font-bold">共振の宴 — {A.name}と{B.name}、{guestName}、BA と PE</h1>
        <p className="text-sm" style={{ color: SUB }}>テスラコイルは、二つのコイル（A：一次、B：二次）を同じ共振の周波数に合わせると、いちばん強く火花を飛ばす。火花の出し方を音の高さで切り替えると、コイルが本当に音楽を奏でる（歌うテスラコイル）。A は{A.name}、B は{B.name}。二人の周波数を合わせてみる。</p>
      </header>

      <section className="relative overflow-hidden rounded-md border" style={{ borderColor: LINE, background: '#0d0c12' }} data-testid="stage">
        <svg viewBox="0 0 400 230" className="w-full" aria-label="テスラコイルと火花">
          <ellipse cx="200" cy="225" rx="190" ry="14" fill="#1c1a24" />
          <rect x="188" y="110" width="24" height="100" rx="4" fill="#3a2f1e" />
          {Array.from({ length: 22 }, (_, i) => <line key={i} x1="188" y1={112 + i * 4.4} x2="212" y2={112 + i * 4.4} stroke="#c8873a" strokeWidth="1.6" />)}
          <ellipse cx="200" cy="96" rx="34" ry="11" fill="none" stroke="#c9ced6" strokeWidth="8" />
          {steady ? res > 0.3 && <circle cx="200" cy="92" r={30 + res * 40} fill="url(#glow)" /> : arcs.map((d, i) => <path key={`${beat}-${i}`} d={d} fill="none" stroke={i % 2 ? '#c8b6ff' : '#9fe8ff'} strokeWidth={1.4} style={{ opacity: soft ? 0.4 : 0.9, transition: 'opacity 400ms' }} />)}
          <defs><radialGradient id="glow"><stop offset="0" stopColor="#b9a6ff" stopOpacity="0.5" /><stop offset="1" stopColor="#b9a6ff" stopOpacity="0" /></radialGradient></defs>
          <text x="200" y="20" textAnchor="middle" fontSize="11" fill={singing ? '#fff1b8' : SUB}>{singing ? '♪ コイルが歌っている' : `共振 ${Math.round(res * 100)}%`}</text>
        </svg>
        <div className="flex items-end justify-around px-2 pb-2">
          <Person name={A.name} left={A.left} right={A.right} coat={MU.strain29.hex} tag={`A・一次・${fA} kHz`} />
          <div className="flex flex-col items-center text-[11px]" data-testid="guest">
            <div className="text-3xl" aria-hidden>{guest === 'ariel' ? '👁' : '🌙'}</div>
            {guest === 'ariel' && <div className="flex gap-0.5" aria-hidden>{Array.from({ length: 22 }, (_, i) => <span key={i} className="h-1 w-1 rounded-full" style={{ background: singing && i === beat % 22 ? '#fff1b8' : '#555' }} />)}</div>}
            <p className="font-semibold">{guestName}</p>
          </div>
          <Person name={B.name} left={B.left} right={B.right} coat={MU.strain92.hex} tag={`B・二次・${fB} kHz`} />
        </div>
        <div className="flex justify-center gap-1 pb-3 text-2xl" data-testid="crowd" aria-label="BA と PE の群れ">
          {Array.from({ length: 10 }, (_, i) => <span key={i} style={{ display: 'inline-block', transform: singing && !reduced && ((i % 2 === 0) === don) ? 'translateY(-6px)' : 'none', transition: 'transform 120ms' }}>{i % 2 === 0 ? '🐵' : '🫛'}</span>)}
        </div>
        {singing && <p className="pb-2 text-center font-black tracking-widest" style={{ color: don ? '#22b8c8' : '#f29b30' }} data-testid="donpa">{don ? 'ドン' : 'ぱ'}</p>}
      </section>

      <section className="grid gap-3 rounded-md border p-3 text-xs sm:grid-cols-2" style={{ borderColor: LINE, background: PANEL }} data-testid="tuning">
        <label className="space-y-1"><span>A：{A.name}（一次コイル）の周波数 <b>{fA} kHz</b></span><input type="range" min={60} max={400} value={fA} onChange={(e) => setFA(Number(e.target.value))} className="w-full" data-testid="fA" /></label>
        <label className="space-y-1"><span>B：{B.name}（二次コイル）の周波数 <b>{fB} kHz</b></span><input type="range" min={60} max={400} value={fB} onChange={(e) => setFB(Number(e.target.value))} className="w-full" data-testid="fB" /></label>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
          {(['ariel', 'luna'] as const).map((g) => <button key={g} type="button" data-testid={`guest-${g}`} onClick={() => setGuest(g)} className="rounded-sm border px-2 py-1" style={{ borderColor: guest === g ? '#fff1b8' : LINE }}>{g === 'ariel' ? '👁 エーリアルを招く' : '🌙 Luna を招く'}</button>)}
          <button type="button" onClick={toggleSound} className="rounded-sm border px-2 py-1" style={{ borderColor: LINE }} data-testid="sound">{sound ? '🔊 音あり' : '🔈 音を出す'}</button>
          <label className="flex items-center gap-1"><input type="checkbox" checked={soft} onChange={(e) => setSoft(e.target.checked)} />光を弱める（火花を、静かな光に）</label>
        </div>
      </section>

      <section className="space-y-2 rounded-md border p-3 text-sm" style={{ borderColor: LINE, background: PANEL }} data-testid="script">
        <p><b className="mr-1 rounded-sm bg-[#22b8c8] px-1 text-xs text-black">A</b>{sceneA}</p>
        <p><b className="mr-1 rounded-sm bg-[#f29b30] px-1 text-xs text-black">B</b>{sceneB}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" data-testid="toast" disabled={!singing} onClick={() => setToasts((t) => [...t, TOASTS[t.length % TOASTS.length]])} className="rounded-sm border-2 px-3 py-1 text-xs font-semibold disabled:opacity-40" style={{ borderColor: '#fff1b8', color: '#fff1b8' }}>🥂 乾杯</button>
          {!singing && <span className="text-xs" style={{ color: SUB }}>乾杯は、コイルが歌いだしてから。</span>}
        </div>
        {toasts.length > 0 && <ol className="space-y-0.5 text-xs" data-testid="toasts">{toasts.map((t, i) => <li key={`${i}-${t}`}>{t}</li>)}</ol>}
      </section>

      <p className="text-[11px]" style={{ color: SUB }}>テスラコイルは 1891 年ごろにニコラ・テスラが考えた共振の変圧器。とても高い電圧で危ないので、ここではしくみの考え方だけを使う。火花は拍に合わせて 1 秒に 2 回まで、小さく、ゆっくり消える。</p>
    </main>
  );
}
