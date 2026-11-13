// The package: 200 story beats over 12 years, with 12 mini-games (one per year).
// Beats advance by 2- or 4-choices. Years 1–2 are written (lib/storyYear1.ts); the rest are slots.
export type GameStatus = 'playable' | 'placeholder' | 'planned';
export type PackGame = { year: number; name: string; status: GameStatus; route?: string };

/** Beats per year: 14 + 16 + 17 × 10 = 200. */
export const BEATS_PER_YEAR = [14, 16, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17];
export const TOTAL_BEATS = BEATS_PER_YEAR.reduce((a, b) => a + b, 0);

export const GAMES: PackGame[] = [
  { year: 1, name: '手紙の束を数える（アリミノボーイの癖・最初の練習）', status: 'planned' },
  { year: 2, name: '指紋の書き写し', status: 'playable', route: '/mente/game/year1' },
  { year: 3, name: '瓶の順番', status: 'placeholder' },
  { year: 4, name: '浜に石を積む（手間が手紙の重さになる）', status: 'planned' },
  { year: 5, name: '最初の瓶を開ける（日付と島の名前を読む）', status: 'planned' },
  { year: 6, name: '瓶を拾う者たち（BA と PE）', status: 'playable', route: '/mente/game/swarm' },
  { year: 7, name: '指紋だけ残して埋める（覚えておく）', status: 'planned' },
  { year: 8, name: '鎖だけで見分ける', status: 'planned' },
  { year: 9, name: '天秤の石', status: 'placeholder' },
  { year: 10, name: '鍵の印あわせ', status: 'placeholder' },
  { year: 11, name: '偽の手紙を見破る', status: 'planned' },
  { year: 12, name: '最後の塔（Luna の飛行機とエーリアル達の 22 アングル）', status: 'placeholder', route: '/mente/game/finale-lab' },
];

/** Beat number (1–200) → year and the beat's place inside the year. */
export function beatAt(n: number): { year: number; inYear: number } {
  let left = n; for (let y = 0; y < 12; y += 1) { if (left <= BEATS_PER_YEAR[y]) return { year: y + 1, inYear: left }; left -= BEATS_PER_YEAR[y]; }
  return { year: 12, inYear: BEATS_PER_YEAR[11] };
}
