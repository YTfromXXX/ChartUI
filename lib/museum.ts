// The museum and its kiosk, the ELECTRON BOX. The host トンネル・ヨウスケ（:ミュウ）— ミュウ is μ, the muon,
// a particle that passes through matter — is shown as a cybernetic profile in two strains (29 種・92 種)
// and four stages (genesis, training, boyhood, youth/active). Each stage is a ~15-second projection.
// World idea (our own, inspired by stories of pilots who do not grow old): the host does not age; each
// season a new body of one strain takes over, and the stage projections are how memories are handed on.
// The museum keeps them; in the evening it becomes a place where adults meet and talk about who they are.
// Everything about the host is fiction. The XV senses table separates RESEARCH (what is known) from
// PREDICTION (the game's guess); nothing here is medical advice.
export type Strain = 29 | 92;
export type Stage = 'genesis' | 'training' | 'boyhood' | 'youth';
export const STAGES: { id: Stage; name: string }[] = [
  { id: 'genesis', name: '創世記' }, { id: 'training', name: '養成期' }, { id: 'boyhood', name: '少年期' }, { id: 'youth', name: '青年期（現役）' },
];
export const STRAINS: Record<Strain, { name: string; note: string; color: string }> = {
  29: { name: '29 種', note: '速い種。反応が早く、忘れるのも早い。司会の声が高い。', color: '#22b8c8' },
  92: { name: '92 種', note: '遅い種。同じ問題を何度も測り直す。司会の声が低い。', color: '#f29b30' },
};

export type Segment = { strain: Strain; stage: Stage; title: string; lines: string[]; tags: string[] };
export const SEGMENTS: Segment[] = [
  { strain: 29, stage: 'genesis', title: '壁の向こうで生まれる', tags: ['トンネル', '誕生', 'μ'], lines: ['港町の、厚い壁の向こう側。', '何も通らないはずの壁を、小さな粒が一つ通り抜けた。', 'それが、29 種のミュウの最初の一秒。', '名前より先に、確率を覚えた。', '「答えは、測るまで二つ」'] },
  { strain: 29, stage: 'training', title: '降水確率を読む', tags: ['ラジオ', '確率', '養成'], lines: ['ラジオ局の小さな部屋。', '毎朝、降水確率を読む練習。', '30% と言った日に限って、よく晴れた。', '確率は約束ではない、と教わった。', 'マイクの位置だけは、一度も間違えなかった。'] },
  { strain: 29, stage: 'boyhood', title: 'ルーペと落とし物', tags: ['ルーペ', '港', '探し物'], lines: ['港の桟橋で、虫めがねの友だちに出会う。', '二人で、落とし物を探した。', '見つけるのはいつもルーペで、', '持ち主に返すのはいつもミュウだった。', '眼鏡が、はじめて二枚に重なった日。'] },
  { strain: 29, stage: 'youth', title: '塔の下の司会者', tags: ['クイズ', '現役', 'SNS'], lines: ['12 年目の塔の下。', '右に SNS-iIIN、左に SNS-K。', '二つの声を、いつも 50:50 に並べる。', '「では——測定！」', '年はとらない。季節ごとに、同じ顔が交代するだけ。'] },
  { strain: 92, stage: 'genesis', title: 'ゆっくり生まれる', tags: ['トンネル', '誕生', 'μ'], lines: ['同じ壁、同じ粒。', 'ただし通り抜けるのに、九十二年ぶんの時間がかかった。', '92 種のミュウは、生まれたときから少し疲れていた。', 'それでも、壁の向こうの景色をよく覚えていた。', '「急がなくていい。測るまでは、二つあるから」'] },
  { strain: 92, stage: 'training', title: '測り直しの訓練', tags: ['誤り訂正', '量子計算機', '養成'], lines: ['量子計算機の見学会で、案内の練習。', '誤りを直す話が、どうしても長くなる。', '三回目で交代させられた。', 'それでも、直し方だけは全部覚えた。', '遅い種は、間違いを数えるのが上手い。'] },
  { strain: 92, stage: 'boyhood', title: '古い紙の前で', tags: ['ストイック', '記憶', '布'], lines: ['ストイックの部屋の、布をかけた紙。', '92 種のミュウは、布をめくらなかった。', '「見ないでいることも、測り方の一つ」', 'そう言って、紙の前に椅子を置いた。', '誰も座らない椅子だった。'] },
  { strain: 92, stage: 'youth', title: '夜の博物館の案内人', tags: ['博物館', '現役', '社交'], lines: ['夜の博物館。大人たちが、グラスを片手に歩く。', 'エレクトロンボックスの前で、92 種のミュウが待っている。', '「どの季節の自分を見に来ましたか」', '投影が終わると、みんな少しだけ自分の話をする。', 'ここでは、年齢も測るまで二つ。'] },
];

/** XV on the skin, linked to a brain interface: what research knows, and what the game predicts afterwards. */
export const SENSES: { sense: string; known: string; predict: string }[] = [
  { sense: '触覚の置き換え', known: '皮膚への振動や電気の刺激で「見る」練習をすると、映像の形が分かるようになる（触覚による感覚の置き換えの研究、1960 年代〜）。', predict: '外したあとも数分、皮膚の上に「形」が残る感じ。ミュウの言う「表皮の残像」。' },
  { sense: '体の広がり', known: '道具をよく使うと、脳の中の「体の届く範囲」が道具の先まで広がる。ゴムの手を自分の手のように感じる錯覚も知られている。', predict: 'XV の縁まで自分の皮膚のように感じる。外すと、少しだけ体が小さくなった気がする。' },
  { sense: 'ないはずの振動', known: '携帯電話が鳴っていないのに、震えたように感じる経験は、多くの人が報告している。', predict: '接続を切ったあと、決まった間隔で「ノック」が来る気がする。15 秒の投影の長さに似ている。' },
  { sense: '慣れ', known: '同じ刺激が続くと、感じ方は弱くなる（感覚の順応）。', predict: '長くつけていると、XV の感触は消え、情報だけが残る。外したときに、初めて重さに気づく。' },
  { sense: '時間の感じ方', known: '注意や緊張で、時間は長くも短くも感じる。', predict: '29 種の投影は短く、92 種の投影は長く感じる。どちらも本当は同じ 15 秒。' },
];

/** The host taken apart, layer by layer (fiction). */
export const LAYERS_OF_MU: { layer: string; texture: string }[] = [
  { layer: '表皮', texture: 'うすい真珠色。光が当たると、ごく細い網目が見える（XV の接点が 21 か所、黄金角に並ぶ）。触ると少し冷たい。' },
  { layer: '眼鏡', texture: '二枚のレンズが、わずかにずれて重なる。片方は水色、片方は桃色。測定の瞬間だけ、一枚に重なる。' },
  { layer: '声帯', texture: '29 種は高く乾いた声、92 種は低く湿った声。どちらも語尾が少しだけ揺れる（確率の揺れ）。' },
  { layer: '中層の回路', texture: '季節ごとの記憶を、15 秒ずつの文節にして受け渡す。文節は八つ（二つの種 × 四つの時期）。' },
  { layer: '核', texture: '年齢を決めない。測られたときだけ、29 か 92 のどちらかになる。' },
  { layer: '蝶ネクタイ', texture: '赤。見られて緊張すると、反対向きになる。解体しても、これだけは直らなかった。' },
];

/** Kiosk search: matches title, tags, lines, stage and strain names. */
export function search(q: string): Segment[] {
  const t = q.trim().normalize('NFKC'); if (!t) return SEGMENTS;
  return SEGMENTS.filter((s) => [s.title, ...s.tags, ...s.lines, STRAINS[s.strain].name, STAGES.find((x) => x.id === s.stage)!.name].some((x) => x.normalize('NFKC').includes(t)));
}
