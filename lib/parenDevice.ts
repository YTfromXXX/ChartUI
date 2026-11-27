// Cure-API [():()] device: the library and the museum are handed in, and the 22 kit items are
// read as {(source):(text)} — skeleton (19) and skin (3) apart.
//
// Skeleton: each museum plate gives a stability (lean, torque and form) and a fatigue (rust ×
// lean), tied to a plateau of A Thousand Plateaus. Skin: surface sensitivity (the fresher the
// steel, the more it feels) and texture (the drawing technique), tied to Anti-Oedipus's
// body without organs. With the GALAXY event, every torque is scaled by the day's galaxy
// twist (0.4–1.6: it can calm or wind the plates) and the skeleton is grouped by the arms.

import { MUSEUM, type PlateForm, type Room } from '@/LAB/colorcube/museum';
import { BOOKS, PLATEAUS } from '@/LAB/library/books';

const FORM_BASE: Record<PlateForm, number> = { slab: 0.9, arc: 1, torqued: 0.85, prop: 0.7, spiral: 0.95 };
const rad = (deg: number) => (deg * Math.PI) / 180;

export type ParenRow = { kitId: number; name: string; layer: 'skeleton' | 'skin'; lines: [string, string][]; metric: number; metricLabel: string };

export type ParenInputs = { library: boolean; museum: boolean; galaxy: { arms: number; twist: number } | null };

function skeletonRow(room: Room, inputs: ParenInputs): ParenRow {
  const twist = inputs.galaxy ? inputs.galaxy.twist : 1;
  const torque = room.torque * twist;
  const stability = Math.max(0, Math.cos(rad(room.lean)) * (1 - Math.min(1, Math.abs(torque) / 120)) * FORM_BASE[room.form]);
  const fatigue = Math.min(1, room.oxidation * (1 + Math.abs(room.lean) / 10));
  const plateau = PLATEAUS[(room.kit.id - 1) % PLATEAUS.length];
  const lines: [string, string][] = [];
  if (inputs.museum) lines.push(['博物館', `${room.form} · ねじれ ${torque.toFixed(0)}°${inputs.galaxy ? `（×${twist.toFixed(2)} GALAXY）` : ''} · 傾き ${room.lean}° · 錆 ${(room.oxidation * 100).toFixed(0)}%`]);
  if (inputs.library) lines.push(['図書館', `${plateau.no}. ${plateau.title} → ${plateau.chartui}`]);
  if (inputs.museum) lines.push(['Cure', `安定 ${stability.toFixed(2)} · 疲労 ${fatigue.toFixed(2)}`]);
  return { kitId: room.kit.id, name: room.kit.name, layer: 'skeleton', lines, metric: stability, metricLabel: '安定' };
}

function skinRow(room: Room, inputs: ParenInputs): ParenRow {
  const sensitivity = 1 - room.oxidation;
  const bwo = BOOKS[0].glosses.find((g) => g.concept === '器官なき身体');
  const lines: [string, string][] = [];
  if (inputs.museum) lines.push(['博物館', `${room.form} · 質感 ${room.techniques[0]} · 錆 ${(room.oxidation * 100).toFixed(0)}%`]);
  if (inputs.library && bwo) lines.push(['図書館', `${BOOKS[0].title}：${bwo.concept} — ${bwo.gloss}`]);
  if (inputs.museum) lines.push(['Cure', `感度 ${sensitivity.toFixed(2)}`]);
  return { kitId: room.kit.id, name: room.kit.name, layer: 'skin', lines, metric: sensitivity, metricLabel: '感度' };
}

export type ParenAnalysis = {
  skeleton: ParenRow[];
  skin: ParenRow[];
  arms: { arm: number; ids: number[]; mean: number }[];
  weakest: ParenRow | null;
  verdict: string;
};

export function analyse(inputs: ParenInputs): ParenAnalysis {
  const skeleton = MUSEUM.filter((r) => r.wing === '骨格棟').map((r) => skeletonRow(r, inputs));
  const skin = MUSEUM.filter((r) => r.wing === '内部棟').map((r) => skinRow(r, inputs));
  const ready = inputs.library && inputs.museum;
  const armsN = inputs.galaxy?.arms ?? 1;
  const arms = Array.from({ length: armsN }, (_, a) => {
    const rows = skeleton.filter((r) => (r.kitId - 1) % armsN === a);
    return { arm: a + 1, ids: rows.map((r) => r.kitId), mean: rows.reduce((s, r) => s + r.metric, 0) / Math.max(1, rows.length) };
  });
  const weakest = inputs.museum ? [...skeleton].sort((a, b) => a.metric - b.metric)[0] : null;
  const meanStab = skeleton.reduce((s, r) => s + r.metric, 0) / skeleton.length;
  const meanSens = skin.reduce((s, r) => s + r.metric, 0) / skin.length;
  const verdict = !ready
    ? `図書館と博物館の両方を渡すと解析が始まる（受領：図書館 ${inputs.library ? '済' : '未'} · 博物館 ${inputs.museum ? '済' : '未'}）`
    : `骨格 19 の平均安定 ${meanStab.toFixed(2)}、最も弱いのは #${weakest!.kitId} ${weakest!.name}（${weakest!.metric.toFixed(2)}）。表皮 3 の平均感度 ${meanSens.toFixed(2)}。${inputs.galaxy ? `GALAXY ${armsN} 腕のうち、いちばん安定した腕は ${[...arms].sort((a, b) => b.mean - a.mean)[0].arm} 本目。` : ''}`;
  return { skeleton, skin, arms, weakest, verdict };
}
