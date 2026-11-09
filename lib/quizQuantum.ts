// 19. クイズクオンタム — a 22-step ABCD quiz on semiotics and the emergence of cuneiform
// signs. Each correct answer is a measurement event that grows the glass-tube knot.
// Questions are written from general knowledge of the cited Wikipedia articles
// ("Semiotics", "Cuneiform", and the linked articles); each carries its source so it can
// be checked. Amenities (help) are deterministic and always show how they were computed.

import { cipher } from '@/lib/retroBlocks';

export type QuizQuestion = {
  id: number;
  layer: 'semiotics' | 'cuneiform';
  prompt: string;
  /** options[0] is the correct answer; display order is shuffled per question. */
  options: [string, string, string, string];
  source: string;
  /** Sign shown at the knot event (cuneiform glyph or semiotic mark) and its reading. */
  glyph: string;
  reading: string;
};

export const QUIZ: readonly QuizQuestion[] = [
  { id: 1, layer: 'semiotics', prompt: '記号学（semiotics）の語源、ギリシャ語 sēmeion の意味は？', options: ['しるし・記号', '光', '結び目', '数'], source: 'Wikipedia: Semiotics', glyph: '◇', reading: 'sēmeion' },
  { id: 2, layer: 'cuneiform', prompt: '「楔形文字（cuneiform）」の由来、ラテン語 cuneus の意味は？', options: ['楔（くさび）', '粘土', '星', '王'], source: 'Wikipedia: Cuneiform', glyph: '𒁹', reading: 'DIŠ' },
  { id: 3, layer: 'cuneiform', prompt: '楔形文字が主に記された素材は？', options: ['粘土板', 'パピルス', '竹簡', '羊皮紙'], source: 'Wikipedia: Cuneiform', glyph: '𒆠', reading: 'KI' },
  { id: 4, layer: 'semiotics', prompt: 'ソシュールが記号を構成するとした二つの要素は？', options: ['シニフィアンとシニフィエ', 'イコンとインデックス', '統語と語用', '主題と題述'], source: 'Wikipedia: Ferdinand de Saussure', glyph: '⟷', reading: 'signifiant / signifié' },
  { id: 5, layer: 'cuneiform', prompt: '楔形文字を粘土に押し付けて記した筆記具は？', options: ['葦（アシ）の尖筆', '羽ペン', '毛筆', '鉄のたがね'], source: 'Wikipedia: Cuneiform', glyph: '𒌋', reading: 'U' },
  { id: 6, layer: 'semiotics', prompt: 'パースの分類で、煙が火を示すように因果・近接で対象を指す記号は？', options: ['インデックス', 'イコン', 'シンボル', 'シニフィエ'], source: 'Wikipedia: Charles Sanders Peirce', glyph: '☞', reading: 'index' },
  { id: 7, layer: 'cuneiform', prompt: '原楔形文字（proto-cuneiform）が最初に現れた都市として知られるのは？', options: ['ウルク', 'バビロン', 'ニネヴェ', 'テーベ'], source: 'Wikipedia: Proto-cuneiform', glyph: '𒂗', reading: 'EN' },
  { id: 8, layer: 'semiotics', prompt: 'パースの分類で、写真や地図のように類似によって意味する記号は？', options: ['イコン', 'インデックス', 'シンボル', '解釈項'], source: 'Wikipedia: Charles Sanders Peirce', glyph: '▣', reading: 'icon' },
  { id: 9, layer: 'cuneiform', prompt: '𒀭（AN / DINGIR）を神名の前に置くとき、何を示す？', options: ['神であることを示す限定詞', '複数形', '数字の 10', '否定'], source: 'Wikipedia: Cuneiform', glyph: '𒀭', reading: 'DINGIR' },
  { id: 10, layer: 'cuneiform', prompt: 'シュメール語の系統について一般に言われるのは？', options: ['系統不明の孤立した言語', 'セム語派', 'インド・ヨーロッパ語族', 'エジプト語の方言'], source: 'Wikipedia: Sumerian language', glyph: '𒅗', reading: 'KA（口・言葉）' },
  { id: 11, layer: 'semiotics', prompt: '信号の赤が「止まれ」を意味するような、慣習による記号はパースの分類で？', options: ['シンボル', 'イコン', 'インデックス', '表意文字'], source: 'Wikipedia: Charles Sanders Peirce', glyph: '●', reading: 'symbol' },
  { id: 12, layer: 'cuneiform', prompt: '楔形文字を取り入れて広く使ったセム系の言語は？', options: ['アッカド語', 'ラテン語', 'ギリシャ語', 'サンスクリット'], source: 'Wikipedia: Akkadian language', glyph: '𒈗', reading: 'LUGAL' },
  { id: 13, layer: 'semiotics', prompt: 'ロラン・バルトが日常の記号に潜む二次的な意味作用を論じた著作は？', options: ['『神話作用（Mythologies）』', '『純粋理性批判』', '『一般言語学講義』', '『薔薇の名前』'], source: 'Wikipedia: Mythologies (book)', glyph: '◎', reading: 'mythe' },
  { id: 14, layer: 'cuneiform', prompt: '発音の近い語の記号を借りて別の語を書く手法は？', options: ['判じ絵の原理（リーバス）', '限定詞', '合字', '母音交替'], source: 'Wikipedia: Rebus', glyph: '𒋛', reading: 'SI' },
  { id: 15, layer: 'semiotics', prompt: 'チャールズ・モリスは記号論を統語論・意味論と、もう一つに分けた。それは？', options: ['語用論', '音韻論', '形態論', '修辞学'], source: 'Wikipedia: Semiotics', glyph: '△', reading: 'pragmatics' },
  { id: 16, layer: 'cuneiform', prompt: '楔形文字の字形は時代とともに向きが変わった。一般に知られる変化は？', options: ['90 度、反時計回りに倒れた', '180 度、上下が反転した', '45 度だけ傾いた', '一度も変わらなかった'], source: 'Wikipedia: Cuneiform', glyph: '𒃻', reading: 'GAR' },
  { id: 17, layer: 'cuneiform', prompt: 'Unicode の楔形文字ブロックが始まるコードポイントは？', options: ['U+12000', 'U+1F600', 'U+0800', 'U+3040'], source: 'Wikipedia: Cuneiform (Unicode block)', glyph: '𒀀', reading: 'A' },
  { id: 18, layer: 'semiotics', prompt: 'ウンベルト・エーコの記号論の主著として知られるのは？', options: ['『記号論（A Theory of Semiotics）』', '『存在と時間』', '『野生の思考』', '『監獄の誕生』'], source: 'Wikipedia: Umberto Eco', glyph: '◈', reading: 'trattato' },
  { id: 19, layer: 'cuneiform', prompt: '𒆠（KI）が限定詞として語の後に置かれるとき示すのは？', options: ['地名', '人名', '木製品', '鳥'], source: 'Wikipedia: Cuneiform', glyph: '𒆠', reading: 'KI' },
  { id: 20, layer: 'cuneiform', prompt: 'ベヒストゥン碑文を写し取り、楔形文字の解読に大きく貢献した人物は？', options: ['ヘンリー・ローリンソン', 'シャンポリオン', 'マイケル・ヴェントリス', 'シュリーマン'], source: 'Wikipedia: Behistun Inscription', glyph: '𒁀', reading: 'BA' },
  { id: 21, layer: 'semiotics', prompt: 'イェルムスレウが記号の二つの面として区別したのは？', options: ['表現面と内容面', '実体と偶有', '共時態と通時態', '主題と題述'], source: 'Wikipedia: Louis Hjelmslev', glyph: '⊟', reading: 'expression / content' },
  { id: 22, layer: 'cuneiform', prompt: 'シュメールの数の体系の基数として知られるのは？', options: ['60（六十進法）', '10', '12', '20'], source: 'Wikipedia: Sexagesimal', glyph: '𒐕', reading: '60' },
];

export const CHECKPOINTS = [7, 15];
export const LETTERS = ['A', 'B', 'C', 'D'] as const;

/** Display order of the options (indices into question.options) and the correct letter index. */
export function arrange(q: QuizQuestion, lap: number) {
  const order = [0, 1, 2, 3].sort((a, b) => cipher(lap, q.id, a) - cipher(lap, q.id, b));
  return { order, correct: order.indexOf(0) };
}

/** Step to fall back to after a wrong answer (the last checkpoint reached). */
export const fallbackStep = (step: number) => CHECKPOINTS.filter((c) => c <= step).pop() ?? 0;

// —— amenities (help); each returns its result and the rule that produced it ——

/** 50:50 — two retro-grid blocks pick which wrong options are removed. */
export function fiftyFifty(q: QuizQuestion, lap: number) {
  const { correct } = arrange(q, lap);
  const wrong = [0, 1, 2, 3].filter((i) => i !== correct);
  const blockA = (cipher(lap, q.id, 501) % 22) + 1;
  const blockB = (cipher(lap, q.id, 502) % 22) + 1;
  const keep = wrong[cipher(lap, q.id, 503) % 3];
  const removed = wrong.filter((i) => i !== keep);
  return { removed, rule: `ブロック #${blockA} と #${blockB} の暗号ストリームが残す誤答を 1 つ選び、残り 2 つの誤答を消去` };
}

/** LIVE 22 — every retro-grid block votes; accuracy falls as the staircase rises. */
export function live22(q: QuizQuestion, lap: number, step: number) {
  const { correct } = arrange(q, lap);
  const p = Math.max(0.3, 0.86 - 0.025 * step);
  const votes = Array.from({ length: 22 }, (_, i) => {
    const h = cipher(lap * 97 + i, q.id, 600);
    return (h % 1000) / 1000 < p ? correct : (correct + 1 + ((h >>> 12) % 3)) % 4;
  });
  const tally = [0, 1, 2, 3].map((k) => votes.filter((v) => v === k).length);
  return { votes, tally, rule: `各ブロック #n は確率 p = 0.86 − 0.025 × 段（= ${p.toFixed(2)}）で正解に、それ以外は誤答のどれかに投票` };
}

/** Telephone — a Mente community member answers; reliability falls with the step. */
export function telephone(q: QuizQuestion, lap: number, step: number, members: number) {
  const { correct } = arrange(q, lap);
  const p = Math.max(0.35, 0.9 - 0.02 * step);
  const h = cipher(lap, q.id, 700);
  const right = (h % 1000) / 1000 < p;
  const answer = right ? correct : (correct + 1 + ((h >>> 10) % 3)) % 4;
  const confidence = Math.round((right ? 0.6 + 0.35 * ((h >>> 20) % 100) / 100 : 0.35 + 0.3 * ((h >>> 20) % 100) / 100) * 100);
  return { member: (h >>> 4) % members, answer, confidence, rule: `相手は確率 p = 0.9 − 0.02 × 段（= ${p.toFixed(2)}）で正解を答える` };
}
