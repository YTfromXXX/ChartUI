// "イーサリアムの黄金のアイコンを探せ"（仮）: the 12 years and the final stage.
// Four mini-games (years 3, 6, 9, 10) are placeholders; each leaves one number that changes the
// final stage, where Luna hacks the aviator and the player flies it to the honeycomb tower.
// The final stage is a landing, never a crash: the plane threads the tower's honeycomb rings and
// sets down on the top deck. Touching the tower bounces the plane back to try again.
// The last boss is the circling autopilot — the rule from Stoic's paper that Little set running.

export type Outcomes = { copy: number; chain: number; helpers: number; balance: number; unseen: number };
export const OUTCOME_RANGE: Record<keyof Outcomes, { min: number; max: number; label: string }> = {
  copy: { min: 0, max: 12, label: '1〜2 年目：正しく書き写した指紋の文字' },
  chain: { min: 0, max: 12, label: '3 年目：正しく並べた瓶の数' },
  helpers: { min: -10, max: 10, label: '6 年目：あなたが増やした数 − 画面が増やした数（浜に残った分）' },
  balance: { min: 0, max: 100, label: '9 年目：天秤のつり合い（%）' },
  unseen: { min: 0, max: 6, label: '10 年目：印だけで見分けた手紙の組' },
};
export const DEFAULT_OUTCOMES: Outcomes = { copy: 6, chain: 6, helpers: 0, balance: 50, unseen: 3 };

export type MiniGame = { id: string; name: string; who: string; how: string; leaves: keyof Outcomes; changes: string };
export type Year = { year: number; chapter: string; event: string; mini?: MiniGame; route?: string };

export const YEARS: Year[] = [
  { year: 1, chapter: '1 はじめに', event: '最初の手紙。日付と島の名前だけ。港で「アリミノボーイに聞く」', route: '/mente/game/year1' },
  { year: 2, chapter: '2 取引', event: '前の手紙の指紋を書き写すことを思いつく', route: '/mente/game/year1',
    mini: { id: 'copy-fingerprint', name: '指紋の書き写し', who: 'アリミノボーイ（本土の港）', how: '前の手紙の指紋（16 進の 4 文字）を、次の手紙に一文字ずつ書き写す。一文字ごとに、よく似た 4 つの候補から選ぶ（8 と B、0 と D など）', leaves: 'copy', changes: '最終面：高度計の正直さ。書き写し違いが多いと、高度計にストイックの暴落のチャートが重なり、落ちていないのに落ちているように見える' } },
  { year: 3, chapter: '3 タイムスタンプサーバー', event: '指紋の鎖ができる',
    mini: { id: 'bottle-order', name: '瓶の順番', who: 'ネフェリムと幼い Luna（島）', how: '浜に打ち上げられた 12 本の瓶を、底の指紋だけを手がかりに、古い順に並べ直す。時間は潮が満ちるまで', leaves: 'chain', changes: '最終面：Luna のハックの正確さ＝塔の輪の大きさ（正しく並べるほど輪が広い）' } },
  { year: 4, chapter: '4 プルーフ・オブ・ワーク', event: '手紙ごとに浜で石を積む' },
  { year: 5, chapter: '5 ネットワーク', event: '最初の瓶が本土に届く（アリミノガールの操作が始まる）' },
  { year: 6, chapter: '6 インセンティブ', event: 'サル達とリトルグリーンが瓶を拾って増える', route: '/mente/game/swarm',
    mini: { id: 'swarm', name: '瓶を拾う者たち（BA と PE）', who: 'アリミノガール（本土）', how: '一匹を押して増やすか、画面が増やすのに任せるか。浜にはどちらが増やした者が多く残るか', leaves: 'helpers', changes: '最終面：飛行機に乗り込む BA と PE の態度。あなたが増やした者が多ければ見張りを手伝い、画面が増やした者が多ければ機体を揺らす' } },
  { year: 7, chapter: '7 容量の回収', event: '古い手紙は指紋だけ残して埋める' },
  { year: 8, chapter: '8 簡易な支払い検証', event: 'Luna が鎖だけで本物を見分ける（アリミノガールの詳しい操作）' },
  { year: 9, chapter: '9 価値の結合と分割', event: '石を分けたり合わせたりして手紙に添える',
    mini: { id: 'balance', name: '天秤の石', who: 'Luna（島）', how: '大小の石を分けたり合わせたりして、天秤の左右をつり合わせる。手紙一通に添える石の重さを決める', leaves: 'balance', changes: '最終面：飛び立つときの機体の重さ。「自由」は飛ぶほど重くなるので、最初が軽いほど塔まで持つ' } },
  { year: 10, chapter: '10 プライバシー', event: '差出人を書かなくなる（鍵の印だけ）',
    mini: { id: 'key-marks', name: '鍵の印あわせ', who: 'アリミノガール（本土）', how: '差出人の名のない手紙を、鍵の印（16 進の記号）だけで同じ書き手ごとに組にする。めくって合わせる神経衰弱の形', leaves: 'unseen', changes: '最終面：自動操縦に気づかれずに近づける距離。組を多く作るほど、旋回の見張りの輪が少ない' } },
  { year: 11, chapter: '11 計算', event: 'リトルグリーンの偽の手紙を見破る（山場の操作）' },
  { year: 12, chapter: '12 結論', event: '最後の手紙。嵐。二冊目が船で届く。最後の塔（Luna の飛行機 × エーリアル達の 22 アングル）', route: '/mente/game/finale-lab' },
];

/** The final stage's settings, from the four outcomes. */
export function finale(o: Outcomes) {
  const ring = 0.6 + 0.4 * (o.chain / 12);                                // 0.6–1.0: width of the honeycomb rings
  const startWeight = 1.6 - 0.6 * (o.balance / 100);                     // 1.0–1.6: heavier start = less reach
  const reach = Math.max(0, Math.min(1, 1.9 - startWeight));             // share of the climb the plane can keep up
  const watchRings = Math.max(1, 4 - Math.floor(o.unseen / 2));          // 1–4 circling patrol loops of the autopilot
  const altimeter = o.copy / 12;                                          // 0–1: how honest the altimeter is
  const crew = o.helpers > 2 ? '見張りを手伝う' : o.helpers < -2 ? '機体を揺らす' : 'どちらでもない（眠っている）';
  return { ring, startWeight, reach, watchRings, crew, altimeter };
}

// ---------- Stoic's crash: a fictional chart revealed a little more each year ----------
// One night's chart (not any real asset), 48 points: calm, a first dip, the fall, a small rebound.
// Year y shows the first share of it; the whole night is seen only in year 12.
export const CRASH: number[] = Array.from({ length: 48 }, (_, i) => {
  const calm = 100 + 1.2 * Math.sin(i * 0.9) + 0.6 * Math.sin(i * 2.3);
  if (i < 14) return calm;
  if (i < 22) return calm - (i - 13) * 1.1;                     // the first dip (years 1–5)
  if (i < 38) return calm - 9 - (i - 21) ** 1.45;                // the fall (to about −65%)
  return calm - 9 - 16 ** 1.45 + (i - 37) * 1.5;           // a small rebound, far below the start
});
/** Points of the crash chart shown in year y (1–12). Slow at first, the fall arrives late. */
export const crashShown = (y: number) => Math.max(6, Math.round(48 * (y / 12) ** 1.3));
