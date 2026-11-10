// ./LAB/library — the library next to the colorcube museum.
// Two books co-written by Gilles Deleuze and Félix Guattari (the two volumes of
// "Capitalism and Schizophrenia"). Bibliographic data plus one-line glosses written for
// ChartUI in our own words; no text of the books is reproduced.

export type Book = { id: 'ao' | 'mp'; title: string; original: string; year: number; glosses: { concept: string; gloss: string; link?: string }[] };

export const BOOKS: readonly Book[] = [
  {
    id: 'ao',
    title: '『アンチ・オイディプス』',
    original: "L'Anti-Œdipe — Capitalisme et schizophrénie 1",
    year: 1972,
    glosses: [
      { concept: '欲望する機械', gloss: '欲望を「欠如」ではなく、つながって流れを生む生産として読む', link: '/cure-api' },
      { concept: '器官なき身体', gloss: '器官に固定される前の、強度だけが行き交う身体の面', link: '/menu#organs' },
      { concept: '分裂分析', gloss: '家族の三角形に回収せず、流れと切断の配置そのものを読む' },
    ],
  },
  {
    id: 'mp',
    title: '『千のプラトー』',
    original: 'Mille plateaux — Capitalisme et schizophrénie 2',
    year: 1980,
    glosses: [
      { concept: 'リゾーム', gloss: '根と幹の階層（ツリー）ではなく、どこからでも接続できる地下茎', link: '/retro-grid?page=A' },
      { concept: '脱領土化', gloss: '決められた場所からはみ出し、別の配置へ再接続される運動' },
      { concept: '平滑空間と条里空間', gloss: '方眼で区切られた空間と、区切りなく移動する空間の往復', link: '/lab/colorcube' },
    ],
  },
];

/** The 15 plateaus of A Thousand Plateaus, mapped onto the 15 loop cells around the 7-cell hive. */
export const PLATEAUS: readonly { no: number; date: string; title: string; chartui: string }[] = [
  { no: 1, date: '序', title: 'リゾーム', chartui: '22 バインダーを階層でなく接続で読む' },
  { no: 2, date: '1914', title: '狼はただ一匹か、数匹か', chartui: '群れの観測（愛知牧場）' },
  { no: 3, date: '前 10000', title: '道徳の地質学', chartui: '色彩の出現の地層' },
  { no: 4, date: '1923.11.20', title: '言語学の公準', chartui: '『A or B』の文言' },
  { no: 5, date: '前 587–後 70', title: 'いくつかの記号の体制', chartui: 'クイズクオンタムの記号学' },
  { no: 6, date: '1947.11.28', title: '器官なき身体をいかにつくるか', chartui: 'ホワイトアウト版の器官ヘッダー' },
  { no: 7, date: '零年', title: '顔貌性', chartui: '眼球ひとつのシルエット' },
  { no: 8, date: '1874', title: '三つの短編', chartui: '老婆のイベント' },
  { no: 9, date: '1933', title: 'ミクロ政治と切片性', chartui: 'ハニカムの 6' },
  { no: 10, date: '1730', title: '強度になること、動物になること、知覚しえぬものになること', chartui: '獣医師の観測' },
  { no: 11, date: '1837', title: 'リトルネロについて', chartui: '双六とループのリズム' },
  { no: 12, date: '1227', title: '遊牧論 — 戦争機械', chartui: 'Cure 移動体の自由曲線' },
  { no: 13, date: '前 7000', title: '捕獲装置', chartui: 'idlecrash の倍率' },
  { no: 14, date: '1440', title: '平滑と条里', chartui: '方眼紙と水の規則' },
  { no: 15, date: '結', title: '具体的規則と抽象機械', chartui: 'TSMonsterEngine' },
];
