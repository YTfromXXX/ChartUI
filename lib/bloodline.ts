// Sub-mission "サトシとトトシ" (the bloodline): two columns read side by side.
//  • left, the VEIN: the cypherpunk lineage that ran into Bitcoin, the quantum test it faces, and on to
//    the game's sanctuary concept (a fiction of this game, not any real person's plan);
//  • right, TOTOSHI 中元: a fictional big long-term holder who keeps a pile of dollars (a "dollar longer"),
//    standing for the market's big money as a whole. He is an archetype, not a real person.
// Dated entries are public record (check before publishing outside the game). The 'fiction' entries
// are the game's own. No prices to act on; not investment advice.
import type { Filter } from '@/lib/chessGame3';

export type Vein = { year: number; title: string; body: string; kind: 'vein' | 'quantum' | 'fiction' };
export type Big = { year: number; title: string; body: string; kind: 'chart' | 'fiction' };

export const VEIN: Vein[] = [
  { year: 1976, kind: 'vein', title: '公開鍵', body: 'ディフィーとヘルマンが、会ったことのない二人が秘密を分け合う方法を発表した。1977 年に RSA。' },
  { year: 1982, kind: 'vein', title: 'チャウムのブラインド署名', body: '中身を見ずに署名する方法。匿名の電子のお金の種になった（1989 年に DigiCash）。' },
  { year: 1985, kind: 'vein', title: '楕円曲線の暗号', body: 'コブリッツとミラーが別々に提案。のちのビットコインの署名（secp256k1）の土台。' },
  { year: 1988, kind: 'vein', title: '暗号のアナーキストの宣言', body: 'ティム・メイが、暗号が社会の仕組みを変えると書いた。' },
  { year: 1991, kind: 'vein', title: 'PGP', body: 'フィル・ジマーマンが、誰でも使える暗号のメールを配った。' },
  { year: 1992, kind: 'vein', title: 'サイファーパンクのメーリングリスト', body: 'エリック・ヒューズ、ティム・メイ、ジョン・ギルモアらが始めた。1993 年の宣言：「プライバシーは、開かれた社会に必要だ」。発生の理由は、政府の暗号の規制（1993 年のクリッパーチップ）と、ネットで全部が見られることへの警戒。' },
  { year: 1994, kind: 'quantum', title: 'ショアのアルゴリズム', body: '大きな量子計算機があれば、公開鍵の暗号（RSA・楕円曲線）が解ける、と示された。1996 年にグローバー（ハッシュには平方根ぶんだけ）。' },
  { year: 1997, kind: 'vein', title: 'ハッシュキャッシュ', body: 'アダム・バックの「仕事の証明」。迷惑メールを高くするための計算。のちの採掘の心臓。' },
  { year: 1998, kind: 'vein', title: 'b-money と bit gold', body: 'ウェイ・ダイと、ニック・サボ。中央のいないお金の設計図。どちらも動くものにはならなかった。' },
  { year: 2004, kind: 'vein', title: 'RPOW', body: 'ハル・フィニーの、使い回せる仕事の証明。' },
  { year: 2008, kind: 'vein', title: 'ホワイトペーパー', body: '10 月 31 日。サトシ・ナカモトが、信頼する第三者のいらない電子の現金を書いた。上の血が、ここで一本になる。' },
  { year: 2009, kind: 'vein', title: '最初のブロック', body: '1 月 3 日。「The Times 03/Jan/2009 Chancellor on brink of second bailout for banks」の見出しが刻まれた。最初のコードは C++（シェルではない）。' },
  { year: 2013, kind: 'vein', title: 'Ethereum のホワイトペーパー', body: 'ヴィタリック・ブテリンが、鎖の上で動くプログラムを書いた。2015 年に稼働。' },
  { year: 2024, kind: 'quantum', title: '量子計算機に強い暗号の標準', body: 'NIST が ML-KEM・ML-DSA・SLH-DSA を出した。ビットコインへの移り方（BIP-360 など）は、まだ提案。' },
  { year: 2026, kind: 'fiction', title: 'サンクチュアリ構想（ゲームの中）', body: '暗号を交わしながらチャートを競う XR のサンクチュアリ。このゲームの構想で、実在の人物の計画ではない。' },
];

export const BIG: Big[] = [
  { year: 1987, kind: 'chart', title: 'ブラックマンデー', body: '10 月 19 日、ダウは一日で約 22.6% 下げた。トトシは、その週にドルを数えた。' },
  { year: 1995, kind: 'chart', title: '.com の上り坂', body: 'ナスダックは 5 年でおよそ 5 倍。トトシは「わからないものは持たない」と言い、ドルの山を崩さなかった（ゲームの中の台詞）。' },
  { year: 1999, kind: 'fiction', title: '取り残される大口', body: '上がる株を見送ったトトシの成績は、一年だけ「時代遅れ」と書かれた。' },
  { year: 2000, kind: 'chart', title: '頂点', body: 'ナスダックは 3 月 10 日に約 5,048 で頂点。2002 年 10 月までに、およそ 8 割下げた。' },
  { year: 2008, kind: 'chart', title: '救済の年', body: '9 月にリーマン・ブラザーズが破綻。大口の一部は、条件のついた資本を銀行や会社に出した。トトシのドルの山が、はじめて動く。' },
  { year: 2009, kind: 'chart', title: '底', body: 'S&P 500 は 3 月に底をつけた。同じ年の 1 月、最初のブロックが刻まれていた。' },
  { year: 2013, kind: 'fiction', title: 'ドルの山の前で', body: 'トトシは、新しい鎖のことを「わからないもの」の箱に入れた。箱は、年ごとに重くなる。' },
  { year: 2024, kind: 'chart', title: '13F の遅れ', body: '大口の持ち株の届け出は、四半期の終わりから 45 日以内。チャートが動いたあとに、データの上部が答え合わせをする。' },
];

/** The sub-mission: put each line through the right filter. All three right → card 7 opens. */
export const BLOOD_QUIZ: { text: string; filter: Filter }[] = [
  { text: 'ナスダックは 2000 年 3 月に頂点をつけ、2002 年 10 月までにおよそ 8 割下げた', filter: '事実' },
  { text: 'トトシが買ったらしいから、明日は上がる', filter: '噂' },
  { text: 'みんなが儲けているのに、自分だけ取り残される気がする', filter: '感情' },
];
