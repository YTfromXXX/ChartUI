// The art collective ARIMINOBOY/GIRL（仮）: beauty tools, the DNA helix and neutrinos imagined as measuring
// instruments. Each work pairs the idea (game) with a real instrument or fact it echoes. The collective's
// name is provisional (the same as a real hair-care brand; to be replaced before release).
export type Work = { id: string; title: string; en: string; by: 'BOY' | 'GIRL' | 'BOY+GIRL'; medium: string; measures: string; real: string; statement: string };

export const MANIFESTO = [
  '道具は、もともと何かを測っている。鋏は長さを、櫛は間隔を、鏡は距離を。',
  'わたしたちは、髪を整える道具で、目に見えないものを測る。',
  '測ることは、整えること。整えることは、測ること。',
];

export const WORKS: Work[] = [
  { id: 'scissors', title: '鋏のノギス', en: 'Scissors Caliper', by: 'GIRL', medium: '鋏、刻んだ目盛り', measures: '開いた刃のあいだの長さ', real: 'ノギス：本尺と副尺（バーニヤ）の目盛りのずれを読むと、0.05 mm まで測れる。', statement: '切る前に、測る。刃の内側に、もう一本の目盛りを刻んだ。ずれが一致したところが、答え。' },
  { id: 'comb', title: '櫛の分光器', en: 'Comb Spectrum', by: 'BOY', medium: '細い歯の櫛、光', measures: '光の色（波長）と、その細かさ', real: '回折格子：細かく等間隔に並んだ線は、光を色に分ける。さらに「光周波数コム」（櫛の歯のように並んだ光）は光の周波数をとても正確に測る道具で、2005 年のノーベル物理学賞。', statement: '歯の間隔が細かいほど、色はよく分かれる。髪をとかすたびに、虹が一本ずつ数えられる。' },
  { id: 'helix', title: '螺旋のものさし', en: 'Helix Ruler', by: 'BOY+GIRL', medium: '二本のリボン、はしごの段', measures: 'ひとまわり（一回転）ごとの長さ', real: 'DNA の二重らせん：およそ 10.5 塩基対でひとまわり、ひとまわりの長さは約 3.4 nm。', statement: '一段ずつ数えると、十段と少しで一周する。わたしたちの身長も、この目盛りで書かれている。' },
  { id: 'hair', title: '一本の髪の湿度計', en: 'Hair Hygrometer', by: 'GIRL', medium: '髪の毛一本、針、文字盤', measures: '空気の湿り気', real: '毛髪湿度計：髪は湿ると少し伸びる。18 世紀（ソシュール、1783 年）からある本物の計測器で、今も使われている。', statement: '雨の日に髪がまとまらないのは、髪が湿度を測っているから。文句ではなく、目盛りとして読む。' },
  { id: 'dryer', title: 'ドライヤーの風速計', en: 'Blow Anemometer', by: 'BOY', medium: '温かい風、細い線', measures: '風の速さ', real: '熱線風速計：温めた細い線が風で冷やされる度合いから、流れの速さを測る。', statement: '温かい風は、冷たいものに出会うと速さを白状する。' },
  { id: 'curler', title: 'カーラーの霧箱', en: 'Curl Cloud Chamber', by: 'GIRL', medium: 'カーラー、霧、磁石', measures: '粒子の電気と重さ', real: '霧箱（ウィルソン、1911 年頃）：飛んだ粒子の跡が霧の筋になる。磁石の中では軽い電子ほどきつく巻く。', statement: '巻きの強さで、何が通ったかが分かる。カールの直径は、通った粒子の名前。' },
  { id: 'net', title: 'ニュートリノのヘアネット', en: 'Neutrino Hairnet', by: 'BOY+GIRL', medium: '目の粗いネット、空っぽの額縁', measures: '通り抜けていくものの数', real: '太陽から来るニュートリノは、地上で 1 cm² あたり毎秒およそ 650 億個。ほとんど全部、体も地球も素通りする。つかまえるには 5 万トンの水が要る。', statement: '何も引っかからないネット。引っかからないことを、数える。' },
  { id: 'mirror', title: '手鏡の干渉計', en: 'Hand-mirror Interferometer', by: 'GIRL', medium: '二枚の手鏡、一本の光', measures: '長さのとても小さな変化', real: 'レーザー干渉計：二本の腕の長さのちがいを光の重なりで測る。2015 年、重力波で 4 km の腕が陽子よりずっと小さく伸び縮みしたのを測った（LIGO）。', statement: '合わせ鏡のあいだで、宇宙のほうが少しだけ揺れた。' },
  { id: 'foam', title: 'シャンプーの泡箱', en: 'Shampoo Bubble Chamber', by: 'BOY', medium: '泡、液体、光', measures: '粒子の通り道', real: '泡箱（グレーザー、1952 年。1960 年のノーベル物理学賞）：沸く寸前の液体の中で、粒子の通った跡に小さな泡が並ぶ。', statement: '泡立てるのは洗うためだけじゃない。泡の列は、見えない誰かの足あと。' },
];
