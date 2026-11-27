// Physical prompt chess, game 4: "the meme-coin field". Six plain news items about a fictional meme
// coin, built to show the usual patterns: overnight attention, unconfirmed rumours, a few holders with
// most of the coins, the makers selling at once, and attention fading. Educational; no real coin,
// person or exchange; nothing is recommended; attention is never treated as value.
import type { News } from '@/lib/chessGame3';

export const NEWS4: News[] = [
  { headline: 'くしゃみ猫コインが、一晩で話題になった', theme: 'ミーム',
    parts: [{ label: '何が', text: '新しいミームコイン', filter: '事実' }, { label: 'どれだけ', text: '投稿が一晩で十万件', filter: '事実' }, { label: 'なぜ', text: '猫のくしゃみの動画がかわいいから、らしい', filter: '噂' }, { label: 'どう感じる', text: '乗り遅れたくない', filter: '感情' }],
    posts: [{ handle: '@sneeze_cat_fan', text: 'くしゃみ一回ごとに笑う', views: '210万回', kind: '感情' }, { handle: '@chain_reader', text: '作られたのは昨日。持っている人はまだ少ない', views: '6,300回', kind: '事実' }, { handle: '@moon_rumor', text: '来週もっと上がるって', views: '48万回', kind: '噂' }],
    harmony: '同じ猫を、かわいさで見る人と、作られた日付で見る人。乗り遅れたくない気持ちは、事実のフィルターを通らない。' },
  { headline: '「大きな取引所に並ぶらしい」という噂が広がった', theme: 'ミーム',
    parts: [{ label: '何が', text: '取引所に並ぶという噂', filter: '噂' }, { label: '誰が', text: '出どころは分からない', filter: '噂' }, { label: '確かめたこと', text: '取引所の発表は、まだない', filter: '事実' }, { label: 'どう感じる', text: '本当だったら、と思ってしまう', filter: '感情' }],
    posts: [{ handle: '@listing_whisper', text: '内部の人が言ってた（らしい）', views: '72万回', kind: '噂' }, { handle: '@official_watch', text: '公式の発表は見当たらない', views: '9,100回', kind: '事実' }, { handle: '@hopeful_pe', text: 'ほんとだったら、たから', views: '15万回', kind: '感情' }],
    harmony: '噂の再生回数は七十二万回、公式の発表はゼロ。数字の大きさは、本当かどうかを教えてくれない。' },
  { headline: 'PE 群が、同じスタンプを一斉に投稿した', theme: 'ミーム',
    parts: [{ label: '誰が', text: 'PE 群', filter: '事実' }, { label: '何を', text: '同じスタンプを一斉に', filter: '事実' }, { label: 'なぜ', text: '注目を集めると上がる、と信じているから', filter: '噂' }, { label: 'どう感じる', text: 'お祭りみたいで楽しい', filter: '感情' }],
    posts: [{ handle: '@PE-05F0', text: 'ドン ぱ ドン ぱ', views: '33万回', kind: '感情' }, { handle: '@PE-4970', text: 'みんなで おすと あがる', views: '41万回', kind: '噂' }, { handle: '@quiet_counter', text: '同じスタンプの投稿、九割が同じ時刻', views: '4,800回', kind: '事実' }],
    harmony: 'お祭りの楽しさと、同じ時刻に九割という事実。どちらも本当で、どちらも値段ではない。' },
  { headline: '持っている人の上位十人が、全体の八割を持っていると分かった', theme: 'ミーム',
    parts: [{ label: '何が', text: '持ち分のかたより', filter: '事実' }, { label: 'どれだけ', text: '上位十人で八割', filter: '事実' }, { label: 'なぜ', text: '作った人たちが最初に多く持った、らしい', filter: '噂' }, { label: 'どう感じる', text: '自分は残りの二割の中にいる', filter: '感情' }],
    posts: [{ handle: '@chain_reader', text: '鎖を読めば、誰でも確かめられる。上位十の財布で八割', views: '1.2万回', kind: '事実' }, { handle: '@insider_guess', text: 'その十人、たぶん同じ人たち', views: '9.6万回', kind: '噂' }, { handle: '@small_holder', text: '二割を、たくさんの人で分けてる', views: '5.4万回', kind: '感情' }],
    harmony: '鎖は誰にでも読める。読む人が少ないだけ。' },
  { headline: '作った人たちの財布から、一度に大きく売られた', theme: 'ミーム',
    parts: [{ label: '何が', text: '一度に大きく売られた', filter: '事実' }, { label: '誰が', text: '作った人たちの財布', filter: '事実' }, { label: 'なぜ', text: '最初から売るつもりだった、という声', filter: '噂' }, { label: 'どう感じる', text: '置いていかれた', filter: '感情' }],
    posts: [{ handle: '@chain_reader', text: '作った人たちの財布が空になった。記録に残ってる', views: '8.8万回', kind: '事実' }, { handle: '@angry_pe', text: 'ずっと計画どおりだったんだ', views: '27万回', kind: '噂' }, { handle: '@sneeze_cat_fan', text: '猫はかわいいままなのに', views: '61万回', kind: '感情' }],
    harmony: '鎖は、売ったことを隠さない。でも、売る前に読んだ人は少なかった。' },
  { headline: '話題は三日で消えた', theme: 'ミーム',
    parts: [{ label: '何が', text: '投稿の数が百分の一に', filter: '事実' }, { label: 'いつ', text: '三日で', filter: '事実' }, { label: 'これから', text: '次の猫が出てくる、という予想', filter: '噂' }, { label: 'どう感じる', text: 'お祭りのあとの静けさ', filter: '感情' }],
    posts: [{ handle: '@quiet_counter', text: '投稿、一日に千件。三日前は十万件', views: '2,100回', kind: '事実' }, { handle: '@next_meme', text: '次はくしゃみ犬らしい', views: '19万回', kind: '噂' }, { handle: '@PE-05F0', text: '……', views: '3万回', kind: '感情' }],
    harmony: '注目は、来たときと同じ速さで去る。残ったのは、鎖に残った記録だけ。' },
];
