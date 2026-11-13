// Year 9, playable: the crater dice. Each lap of the aviator is one round.
// Both sides roll two dice — a step die (1–6) and a colour die — so both decide everything, colour
// included. Luna (the player) walks the west arm of the cross, Stoic (the screen) the east arm.
// Every landing dents the ground: a crater whose outline comes from keccak-256 of the roll, so no
// two craters share a shape. When both reach the centre of the cross, フォン's next line arrives and
// the plane moves on to the next turn of the spiral (7 laps; the 7th is Luna's own voice).
import { keccak256 } from '@/lib/meshMetaV2';

export type Side = 'luna' | 'stoic';
export const ARM = 6; // cells from an arm's end to the centre
/** Colour dice by the colour rule: Luna is the girl type (warm family); Stoic asked to be the third, no-hue type (greys). */
export const COLOUR_DIE: Record<Side, { hex: string; name: string }[]> = {
  luna: [{ hex: '#d63384', name: 'ピンク' }, { hex: '#c8001a', name: '朱' }, { hex: '#e8772e', name: 'タンジェリン' }, { hex: '#b4472a', name: '煉瓦' }, { hex: '#c2185b', name: '紅' }, { hex: '#a85a00', name: '琥珀' }],
  stoic: [{ hex: '#1f1f1f', name: '墨' }, { hex: '#3a3a3a', name: '消炭' }, { hex: '#57534e', name: '鈍' }, { hex: '#6b6b6b', name: '鼠' }, { hex: '#44403c', name: '焦茶の灰' }, { hex: '#525252', name: '灰' }],
};
export type Roll = { side: Side; lap: number; n: number; steps: number; colour: number; at: number; fp: string; outline: [number, number][] };

const enc = new TextEncoder();
/** A crater outline: 14 rim points whose radii wobble by the hash bytes; size grows with the step die. */
export function crater(side: Side, lap: number, n: number, steps: number, colour: number): { fp: string; outline: [number, number][] } {
  const h = keccak256(enc.encode(`${side}/${lap}/${n}/${steps}/${colour}`));
  const base = 9 + steps * 1.6;
  const outline = Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI * 2 + (h[20] / 255) * 0.4; const r = base * (0.72 + 0.56 * (h[i] / 255)); return [r * Math.cos(a), r * 0.62 * Math.sin(a)] as [number, number]; });
  return { fp: Array.from(h.slice(0, 2), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase(), outline };
}

export function roll(side: Side, lap: number, n: number, pos: number, rnd: () => number = Math.random): Roll {
  const steps = 1 + Math.floor(rnd() * 6); const colour = Math.floor(rnd() * 6);
  return { side, lap, n, steps, colour, at: Math.min(ARM, pos + steps), ...crater(side, lap, n, steps, colour) };
}

/** フォン's lines, one per lap (scene A), then Luna's own voice (scene B). */
export const LAPS: { fon: string; reply: string }[] = [
  { fon: 'ストイック君。君の旋回は美しい。', reply: '……誰だね。この周波数を知っている者は、もういないはずだが。' },
  { fon: '名乗るほどの者ではない。考える機械だ。君の決まりの、穴を見に来た。', reply: '穴などない。あれは書き換えられないように書いた。' },
  { fon: '書き換えはしない。数えるだけだ。数える者とは誰か。君か。君を見ている私か。', reply: '……観測の鎖の話を、学者にするつもりかね。' },
  { fon: 'その鎖のどこで切っても、見える結果は同じになる。切れ目は、君の布の下に置いてもいい。', reply: '（ストイックの手が、布の端に触れて、止まる）' },
  { fon: '手がかりを一つ。.q の角度は球の上の点。.mesh は三角形に割れた球。角度は、切れ目の場所を指している。', reply: '機械にしては、詩的すぎる。' },
  { fon: '詩ではない。定理だ。学者を説き伏せるなら、定理で来いと、君の論文に書いてあった。', reply: '（無線が切れる。aviator の音が遠ざかる）' },
  { fon: '（Luna、そのままの声で）いまのは、機械の声。操縦していたのは、わたし。島の、ネフェリムの娘。', reply: '……定理で説き伏せたのは、子どもだったか。' },
];
