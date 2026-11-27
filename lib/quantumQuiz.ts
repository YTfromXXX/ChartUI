// クオンタムクイズ — host, questions and the four-slot answer format.
// Every question shows two voices, always 50:50 (the "MENTE 50:50"): a. a post on SNS-iIIN, b. a post on SNS-K
// (both fictional networks). c. lets you skip by riding the aviator again; d. lets you answer with a declaration
// instead ("もう二度と地球に帰れないなら〜に、もう〜に乗る").
// Facts about Satoshi Nakamoto are public record only (where and when he wrote); nothing is guessed about who he is.
// トトシ中元 is fictional (a big dollar holder of this game). Nothing here teaches hiding messages or evading anyone.
export const HOST = {
  name: 'トンネル・ヨウスケ（:ミュウ）', role: 'クオンタムクイズの司会者',
  profile: [
    ['年齢', '測るまで二つ（29 種か 92 種）。年はとらず、季節ごとに同じ顔が交代する'],
    ['ミュウ', 'μ（ミュー粒子）。物質を通り抜ける粒。博物館のエレクトロンボックスで、四つの時期を投影できる'],
    ['出身', '港町の、壁の向こうの町（トンネル効果で通ってきた、と言い張っている）'],
    ['眼鏡', 'レンズが二枚ずれて重なった「重ね合わせ眼鏡」'],
    ['口癖', '「答えは、測るまで二つ」「では——測定！」'],
    ['好物', 'ふたを半分だけ開けた弁当'],
    ['弱点', '自分が見られると緊張して、蝶ネクタイが反対向きになる'],
  ] as [string, string][],
  career: [
    '港町のラジオで「降水確率」を読む係。確率の読み方は、ここで覚えた。',
    'ルーペ（仮）の古い友だち。二人で、港の落とし物を探していた。',
    '量子計算機の見学会の案内係。誤り訂正の話が長すぎて、三回目で交代になった。',
    '12 年目の塔の下で、クイズを始めた。SNS-iIIN と SNS-K の二つの声を、いつも 50:50 で並べる。',
  ],
};

export type Q = { q: string; a: string; b: string; right: 'a' | 'b'; why: string; kind: '事実' | 'ゲーム'; topic: 'サトシ' | 'トトシ' | '暗号' };
export const QUESTIONS: Q[] = [
  { topic: 'サトシ', kind: '事実', q: 'サトシ・ナカモトが、2008 年 10 月 31 日にビットコインの論文を最初に出したのは、どこ？', a: '暗号のメーリングリスト', b: '短い動画の SNS', right: 'a', why: '暗号を話し合うメーリングリストに、論文へのリンクを送った。SNS ではない。' },
  { topic: 'サトシ', kind: '事実', q: '最初のブロック（2009 年 1 月 3 日）に刻まれた見出しは、どの新聞？', a: 'The Times', b: 'SNS-K のトレンド欄', right: 'a', why: '「The Times 03/Jan/2009 Chancellor on brink of second bailout for banks」。' },
  { topic: 'サトシ', kind: '事実', q: 'サトシが話し合いの場として始めたのは？', a: '最新の SNS のアカウント', b: 'ビットコインのフォーラム（のちの BitcoinTalk）', right: 'b', why: '2009 年に、フォーラムを始めた。本人のものと確かめられた SNS のアカウントは、知られていない。' },
  { topic: 'サトシ', kind: '事実', q: '2011 年、サトシが開発者へのメールに書いたとされる言葉は？', a: '「ほかのことに移った」', b: '「量子計算機が来たら戻る」', right: 'a', why: '「I\'ve moved on to other things.」と伝えられている。b は作り話。' },
  { topic: 'トトシ', kind: 'ゲーム', q: 'トトシ中元は、予想の「指紋（ハッシュ）」だけを先に投稿し、あとで中身を見せた。これを何という？', a: 'なりすまし', b: 'コミットメント（先に指紋、あとで中身）', right: 'b', why: '先に指紋を出しておけば、あとで中身を書き換えていないことを、誰でも確かめられる。' },
  { topic: '暗号', kind: '事実', q: '文章を一文字だけ変えると、その指紋（SHA-256）は？', a: '一文字ぶんだけ変わる', b: 'まったく別の指紋になる', right: 'b', why: '雪崩のように、ほぼ全部のビットが変わる。だから改ざんがすぐ分かる。' },
  { topic: '暗号', kind: '事実', q: '投稿にデジタル署名をつけると、分かることは？', a: '秘密鍵の持ち主が書いたこと、書き換えられていないこと', b: '書いた人の本名と住所', right: 'a', why: '署名が示すのは「鍵」の持ち主。本名までは分からない。' },
  { topic: 'トトシ', kind: 'ゲーム', q: 'トトシは、鍵を半分ずつ SNS-iIIN と SNS-K に置いた（二つで一つの秘密）。開けるには？', a: '両方をそろえる', b: 'どちらか片方でいい', right: 'a', why: '秘密分散：決めた数の欠片が集まらないと、開かない。ここでは 2 つのうち 2 つ。' },
  { topic: '暗号', kind: '事実', q: '投稿の指紋をブロックチェーンに刻むと、証明できるのは？', a: 'その文章が正しいこと', b: 'その時刻には、もうその文章があったこと', right: 'b', why: 'タイムスタンプ。正しいかどうかは別の話。' },
  { topic: '暗号', kind: '事実', q: '大きな量子計算機ができたら、ビットコインで先に心配されるのは？', a: '署名（楕円曲線）', b: '指紋（SHA-256）', right: 'a', why: 'ショアのアルゴリズムは署名に効く。ハッシュへの効き目は平方根ぶん。' },
  { topic: 'トトシ', kind: 'ゲーム', q: 'トトシは毎朝、同じドルの山の写真を投稿する。何かが起きた日を見つけるには？', a: '写真の指紋を前の日と比べる', b: 'いいねの数を比べる', right: 'a', why: '中身が一画素でも変われば、指紋が変わる。いいねは噂のほう。' },
  { topic: 'サトシ', kind: '事実', q: 'サトシは誰なのか？', a: 'まだ分かっていない', b: 'SNS-K で本人が名乗った', right: 'a', why: '誰なのかは分かっていない。このゲームも、当てようとはしない。' },
];

export const D_WORDS = { where: ['雲のなか', '十二年の輪', '紙飛行機', '塔のてっぺん', '月の裏'], ride: ['フォン', 'aviator', '串のサイコロ', 'ルーペ', '最後の飛行機'] };
