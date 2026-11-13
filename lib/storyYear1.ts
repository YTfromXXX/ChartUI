// Year 1 → 2 of "イーサリアムの黄金のアイコンを探せ"（仮）, as a small scene graph.
// Every step forward is a 2-choice or a 4-choice. The 4-choice is the "アリミノボーイに聞く" scene:
// he always answers "たぶん {~} のあいだ。正確には分からないが——", and ~ is the line the player
// picks (a/b/c/d). Each line opens a different piece of the background and is remembered as a flag
// that changes the final stage. Stoic's crash chart hangs on the wall and shows a little more each year.

export type Flag = 'ask-a' | 'ask-b' | 'ask-c' | 'ask-d' | 'peeked' | 'left-quietly' | 'saw-chart' | 'saw-port';
export type Choice = { label: string; to: string; set?: Flag };
export type Scene = {
  id: string; year: 1 | 2; speaker: string; text: string[];
  /** Background: where we are, and whether the crash chart is visible (and how much of it). */
  place: string; chart?: 'covered' | 'peek' | 'shown';
  choices: Choice[]; kind?: 'two' | 'four' | 'next' | 'game';
};

/** The four lines for "たぶん {~} のあいだ", and what each one opens. */
export const ASK_LINES: { key: 'a' | 'b' | 'c' | 'd'; between: string; follow: string[]; opens: string }[] = [
  { key: 'a', between: '満ち潮と、次の満ち潮', follow: ['「島までの距離じゃない。潮が二回満ちるあいだ、船は同じ場所に戻ってくる。」', '「だから、島は近いのか遠いのか、潮しか知らない。」'], opens: '海と潮（最後の面：横風の向きが分かる）' },
  { key: 'b', between: '父さんが眠れなくなった夜と、その次の朝', follow: ['「あの夜から、父さんは壁の紙を見なくなった。見ないように、布をかけた。」', '「何が描いてあるのかは、ぼくも知らない。下を向いた線だけ、見えたことがある。」'], opens: 'ストイックの暴落（最後の面：無線のストイックが落ち着いて話す）' },
  { key: 'c', between: '一通目の手紙と、二通目の手紙', follow: ['「一通目には日付と島の名前しかなかった。二通目には、一通目の指紋が書き写してあるはずなんだ。」', '「書き写すのは、たぶんぼくの仕事になる。」'], opens: '手紙の鎖（最後の面：Luna のハックが一手早い）' },
  { key: 'd', between: 'リトルの飛行機が島を一周するのと、もう一周するの', follow: ['「リトルの飛行機は、島の上をずっと同じ輪で回っている。誰も止め方を知らない。」', '「一周の長さだけは、毎回同じなんだ。」'], opens: 'リトルの aviator（最後の面：旋回の輪に入るすき間が広い）' },
];

export const SCENES: Scene[] = [
  { id: 'y1-open', year: 1, speaker: 'アリミノガール（語り）', place: '本土の港町・ストイックの部屋', chart: 'covered', kind: 'two',
    text: ['追放から一年。本土の港町。', 'ストイックの部屋の壁には、布をかけた一枚の紙が掛かっていた。まだ誰も、それを気にしていなかった。'],
    choices: [{ label: '壁の紙を見る', to: 'y1-chart', set: 'saw-chart' }, { label: '窓から港を見る', to: 'y1-port', set: 'saw-port' }] },
  { id: 'y1-chart', year: 1, speaker: 'ストイック', place: 'ストイックの部屋', chart: 'peek', kind: 'next',
    text: ['「見なくていい。ただの古い紙だ。」', '（アリミノガール）布の端から、細い線が少しだけ下を向いているのが見えた。ストイックはすぐに布を戻した。'],
    choices: [{ label: '港へ出る', to: 'y1-ask' }] },
  { id: 'y1-port', year: 1, speaker: 'アリミノガール（語り）', place: '港', kind: 'next',
    text: ['港では、アリミノボーイが手紙の束を数えていた。', '数えては最初からやり直し、また数えては最初からやり直していた。父親とよく似た癖だった。'],
    choices: [{ label: '声をかける', to: 'y1-ask' }] },
  { id: 'y1-ask', year: 1, speaker: 'アリミノボーイ', place: '港の桟橋', kind: 'four',
    text: ['「島は、ここからどのくらい？」と聞くと、アリミノボーイは少し考えてから答えた。'],
    choices: ASK_LINES.map((l) => ({ label: `${l.key}. ${l.between}`, to: `y1-heard-${l.key}`, set: `ask-${l.key}` as Flag })) },
  ...ASK_LINES.map((l): Scene => ({
    id: `y1-heard-${l.key}`, year: 1, speaker: 'アリミノボーイ', place: '港の桟橋', chart: l.key === 'b' ? 'peek' : undefined, kind: 'next',
    text: [`「たぶん ${l.between} のあいだ。正確には分からないが——」`, ...l.follow],
    choices: [{ label: '夜になる', to: 'y1-night' }],
  })),
  { id: 'y1-night', year: 1, speaker: 'アリミノガール（語り）', place: 'ストイックの部屋・夜', chart: 'covered', kind: 'two',
    text: ['その夜、ストイックは布のかかった紙の前で、小さな声で何かを数えていた。一、二、三……。', '数は、いつも同じところで止まった。'],
    choices: [{ label: '布をそっとめくる', to: 'y1-peek', set: 'peeked' }, { label: '何も言わずに部屋を出る', to: 'y2-open', set: 'left-quietly' }] },
  { id: 'y1-peek', year: 1, speaker: 'アリミノガール（語り）', place: 'ストイックの部屋・夜', chart: 'shown', kind: 'next',
    text: ['布の下には、ある一晩のチャートが描かれていた。はじめは穏やかで、途中から、線が下を向き始めていた。', '線はそこで途切れていた。続きは、まだ描かれていなかった。ストイックが数えるのをやめたところで、線も止まっていた。'],
    choices: [{ label: '布を戻す', to: 'y2-open' }] },
  { id: 'y2-open', year: 2, speaker: 'アリミノガール（語り）', place: '港', kind: 'next',
    text: ['二年目。二通目の手紙を書くことになった。', '二通目には、一通目の指紋を書き写す。書き写すのはアリミノボーイの仕事になった。揺れる桟橋の上で、一文字ずつ。'],
    choices: [{ label: '書き写す（ミニゲーム）', to: 'y2-game' }] },
  { id: 'y2-game', year: 2, speaker: 'ミニゲーム', place: '港の桟橋', kind: 'game', text: [], choices: [{ label: '書き終える', to: 'y2-end' }] },
  { id: 'y2-end', year: 2, speaker: 'アリミノガール（語り）', place: '港', kind: 'next',
    text: ['書き写した指紋は、瓶に入れて海に流された。', '書き違えた文字があったかどうかを確かめる人は、本土にはまだいなかった。'],
    choices: [{ label: '12 年の進行へ', to: 'years' }] },
];
export const sceneById = (id: string) => SCENES.find((s) => s.id === id);

/** What the flags change in the final stage (shown at the end of year 2 and on the years page). */
export function flagEffects(flags: Flag[]): string[] {
  const out: string[] = [];
  for (const l of ASK_LINES) if (flags.includes(`ask-${l.key}` as Flag)) out.push(l.opens);
  if (flags.includes('peeked')) out.push('布をめくった：最後の面で、高度計に重なる暴落のチャートを「古い紙だ」と見抜ける（ストイックの声で）');
  if (flags.includes('left-quietly')) out.push('部屋を出た：暴落のチャートは 12 年目まで布の下のまま。最後の面で初めて全部が見える');
  return out;
}

/** Hints for the nudge popup, per scene: "たぶん {between} のあいだ。正確には分からないが——{after}". */
export const NUDGE_HINTS: Record<string, { between: string; after: string }> = {
  'y1-open': { between: '壁の紙と、窓の港', after: 'どちらを見ても、ぼくには会える。' },
  'y1-ask': { between: 'a と d', after: 'どれを選んでも、物語は続く。ほかのは、また今度聞けばいい。' },
  'y1-night': { between: '布をめくるのと、部屋を出るの', after: '父さんは、どっちでも怒らない。たぶん。' },
  'y2-game': { between: '8 と B', after: '似ている字は、上の丸が閉じているかどうかを見るといい。' },
};
export const NUDGE_FALLBACK = { between: 'さっきの選択肢と、次の選択肢', after: 'ゆっくりでいい。' };
