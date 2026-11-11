'use client';

import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { FLOOR, JOINTS, JOINT_LABEL, SEG, STEPS, constrain, midJoint, neckOf, type Joint, type Note, type P, type Pose } from '@/lib/famiDance';

export type DancerLook = { sym: string; tag: string; body: string; accent: string; skin: string };

const CELL = 3;
/** Rasterise a thick segment onto the Famicom pixel grid. */
function cells(a: P, b: P, half: number, out: Set<string>) {
  const len = Math.hypot(b.x - a.x, b.y - a.y); const n = Math.max(1, Math.ceil(len / 1.5));
  const nx = -(b.y - a.y) / (len || 1); const ny = (b.x - a.x) / (len || 1);
  for (let i = 0; i <= n; i += 1) {
    const t = i / n; const x = a.x + (b.x - a.x) * t; const y = a.y + (b.y - a.y) * t;
    for (let w = -half; w <= half; w += 1.5) out.add(`${Math.round((x + nx * w) / CELL)},${Math.round((y + ny * w) / CELL)}`);
  }
}
function disc(c: P, r: number, out: Set<string>) {
  for (let y = -r; y <= r; y += CELL) for (let x = -r; x <= r; x += CELL) if (x * x + y * y <= r * r) out.add(`${Math.round((c.x + x) / CELL)},${Math.round((c.y + y) / CELL)}`);
}
const rects = (s: Set<string>, fill: string, prefix: string) => [...s].map((k) => { const [x, y] = k.split(',').map(Number); return <rect key={`${prefix}${k}`} x={x * CELL - CELL / 2} y={y * CELL - CELL / 2} width={CELL} height={CELL} fill={fill} />; });

function Body({ pose, look, ghost = false }: { pose: Pose; look: DancerLook; ghost?: boolean }) {
  const neck = neckOf(pose);
  const lElbow = midJoint(neck, pose.lHand, SEG.ARM, -1); const rElbow = midJoint(neck, pose.rHand, SEG.ARM, 1);
  const lKnee = midJoint(pose.hip, pose.lFoot, SEG.LEG, 1); const rKnee = midJoint(pose.hip, pose.rFoot, SEG.LEG, -1);
  if (ghost) {
    const line = (a: P, b: P, k: string) => <line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#ffffff" strokeOpacity={0.25} strokeWidth={1} strokeDasharray="2 2" />;
    return <g>{[line(neck, pose.hip, 't'), line(neck, lElbow, 'a'), line(lElbow, pose.lHand, 'b'), line(neck, rElbow, 'c'), line(rElbow, pose.rHand, 'd'), line(pose.hip, lKnee, 'e'), line(lKnee, pose.lFoot, 'f'), line(pose.hip, rKnee, 'g'), line(rKnee, pose.rFoot, 'h')]}<circle cx={pose.head.x} cy={pose.head.y} r={9} fill="none" stroke="#ffffff40" strokeDasharray="2 2" /></g>;
  }
  const legs = new Set<string>(); cells(pose.hip, lKnee, 2.5, legs); cells(lKnee, pose.lFoot, 2, legs); cells(pose.hip, rKnee, 2.5, legs); cells(rKnee, pose.rFoot, 2, legs);
  const arms = new Set<string>(); cells(neck, lElbow, 2, arms); cells(lElbow, pose.lHand, 1.5, arms); cells(neck, rElbow, 2, arms); cells(rElbow, pose.rHand, 1.5, arms);
  const torso = new Set<string>(); cells(neck, pose.hip, 6, torso);
  const hands = new Set<string>(); disc(pose.lHand, 3, hands); disc(pose.rHand, 3, hands);
  const shoes = new Set<string>(); for (const f of [pose.lFoot, pose.rFoot]) cells({ x: f.x - 4, y: f.y - 1 }, { x: f.x + 5, y: f.y - 1 }, 2, shoes);
  const head = new Set<string>(); disc(pose.head, 9, head);
  const hair = new Set<string>(); for (const k of head) { const [, y] = k.split(',').map(Number); if (y * CELL < pose.head.y - 3) hair.add(k); }
  for (const k of hair) head.delete(k);
  const eyeY = Math.round((pose.head.y + 1) / CELL);
  return (
    <g shapeRendering="crispEdges">
      {rects(legs, '#1a4f9c', 'l')}{rects(shoes, '#000000', 's')}{rects(torso, look.body, 't')}{rects(arms, look.body, 'a')}{rects(hands, look.skin, 'h')}
      {rects(head, look.skin, 'f')}{rects(hair, look.accent, 'r')}
      <rect x={Math.round((pose.head.x - 4) / CELL) * CELL - 1.5} y={eyeY * CELL - 1.5} width={CELL} height={CELL} fill="#000" />
      <rect x={Math.round((pose.head.x + 4) / CELL) * CELL - 1.5} y={eyeY * CELL - 1.5} width={CELL} height={CELL} fill="#000" />
    </g>
  );
}

type Props = {
  look: DancerLook; base: Pose; shown: Pose; onPose: (p: Pose) => void;
  notes: Note[]; nowBeat: number; judge: { text: string; age: number } | null; dancing: boolean; laneLabel: string;
};

/**
 * One dancer on a stage seen at a slight angle. The body is drawn on a plane sheared toward the
 * viewer, standing on a checkered floor in perspective; the joint handles are dragged in that same
 * plane (pointer coordinates go through the group's inverse transform), so every drag lands on a
 * danceable pose.
 */
export default function DancerStage({ look, base, shown, onPose, notes, nowBeat, judge, dancing, laneLabel }: Props) {
  const plane = useRef<SVGGElement>(null);
  const [drag, setDrag] = useState<Joint | null>(null);
  const [focus, setFocus] = useState<Joint | null>(null);
  const toPlane = (e: PointerEvent) => {
    const g = plane.current; const m = g?.getScreenCTM(); if (!g || !m) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()); return { x: pt.x, y: pt.y };
  };
  const move = (j: Joint, p: P) => onPose(constrain({ ...base, [j]: p }));
  const onDown = (j: Joint) => (e: PointerEvent<SVGCircleElement>) => { e.preventDefault(); (e.target as Element).setPointerCapture(e.pointerId); setDrag(j); };
  const onMove = (e: PointerEvent<SVGCircleElement>) => { if (!drag) return; const p = toPlane(e); if (p) move(drag, p); };
  const onKey = (j: Joint) => (e: KeyboardEvent<SVGCircleElement>) => {
    const d: Record<string, P> = { ArrowLeft: { x: -3, y: 0 }, ArrowRight: { x: 3, y: 0 }, ArrowUp: { x: 0, y: -3 }, ArrowDown: { x: 0, y: 3 } };
    if (!d[e.key]) return; e.preventDefault(); e.stopPropagation(); move(j, { x: base[j].x + d[e.key].x, y: base[j].y + d[e.key].y });
  };
  const PX = 26; // lane pixels per beat
  return (
    <svg viewBox="0 0 250 200" className="w-full touch-none select-none" role="group" aria-label={`${look.sym} dancer`}>
      <defs>
        <pattern id={`chk-${look.sym}`} width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#1d1d2b" /><rect width="8" height="8" fill="#2b2b40" /><rect x="8" y="8" width="8" height="8" fill="#2b2b40" /></pattern>
      </defs>
      {/* Floor in perspective: the plane the dancer always stands on. */}
      <polygon points="8,196 182,196 160,158 30,158" fill={`url(#chk-${look.sym})`} stroke={look.accent} strokeOpacity={0.6} />
      <ellipse cx={20 + shown.hip.x * 0.94} cy={176} rx={26} ry={5} fill="#000" opacity={0.5} />
      <text x={6} y={14} fontSize={11} fontWeight="bold" fill={look.accent} fontFamily="monospace">{look.tag}</text>
      <g ref={plane} transform="matrix(0.94,-0.05,0,1,20,24)">
        {dancing && <Body pose={base} look={look} ghost />}
        <Body pose={shown} look={look} />
        <line x1={-4} x2={124} y1={FLOOR} y2={FLOOR} stroke="#ffffff22" />
        {JOINTS.map((j) => (
          <circle
            key={j} cx={base[j].x} cy={base[j].y} r={drag === j ? 8 : 6} tabIndex={0} role="slider" aria-label={`${look.sym} ${JOINT_LABEL[j]}`} aria-valuetext={`${base[j].x.toFixed(0)}, ${base[j].y.toFixed(0)}`}
            fill={drag === j || focus === j ? look.accent : '#ffffff'} fillOpacity={drag === j ? 0.9 : 0.35} stroke={look.accent} strokeWidth={1.5}
            style={{ cursor: drag === j ? 'grabbing' : 'grab' }} data-joint={j}
            onPointerDown={onDown(j)} onPointerMove={onMove} onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}
            onFocus={() => setFocus(j)} onBlur={() => setFocus(null)} onKeyDown={onKey(j)}
          />
        ))}
      </g>
      {/* Step lane: notes rise to the target line. */}
      <g transform="translate(186,0)">
        <rect x={0} y={0} width={62} height={200} fill="#0b0b14" stroke="#ffffff22" />
        <text x={31} y={10} textAnchor="middle" fontSize={7} fill="#9aa" fontFamily="monospace">{laneLabel}</text>
        {STEPS.map((s, i) => <text key={s} x={7 + i * 12} y={26} textAnchor="middle" fontSize={10} fill="#ffffff55">{s}</text>)}
        <line x1={0} x2={62} y1={30} y2={30} stroke={look.accent} strokeWidth={1.5} />
        {notes.filter((n) => n.at - nowBeat > -0.6 && n.at - nowBeat < 6.5).map((n) => {
          const y = 30 + (n.at - nowBeat) * PX; const i = STEPS.indexOf(n.step);
          return <text key={n.id} x={7 + i * 12} y={y + 4} textAnchor="middle" fontSize={11} fontWeight="bold" fill={n.judged === 'MISS' ? '#555' : n.judged ? look.accent : '#ffffff'} opacity={n.judged && n.judged !== 'MISS' ? 0.35 : 1}>{n.step}</text>;
        })}
        {judge && judge.age < 0.6 && <text x={31} y={60} textAnchor="middle" fontSize={9} fontWeight="bold" fontFamily="monospace" fill={judge.text === 'MISS' ? '#ff5577' : judge.text === 'PERFECT' ? '#ffd400' : '#7fc4ff'} opacity={1 - judge.age / 0.6}>{judge.text}</text>}
      </g>
    </svg>
  );
}
