// Physical prompt chess, game 1: "find the hotel stock", now in the chalk room.
// The six news items follow the game-1 script (docs/story/chess-games.md). All fictional.
import type { News } from '@/lib/chessGame3';

export const NEWS1: News[] = [
  { headline: 'マリーナ・ホテルズ、港の古いホテルの一軒の改装を発表', theme: 'ホテル', scene: { style: 'mannequin', frames: [
      { pose: '1 階ロビー。8 体が止まっている。イシドロは天秤を持ち上げたまま、アナは報告書を開いたまま、ペルペトゥアははさみを空中で止めたまま。', lines: [] },
      { pose: 'アナだけ、眼鏡が頭の上から鼻の上へ。', lines: [['アナ', '改装。……帳簿の土地は、まだ昔の値段のまま']] },
      { pose: 'ニエベス、ハンモックの上で首の角度だけが変わっている。', lines: [['ニエベス', '改装中は、住めないわね']] },
    ] },
    parts: [{ label: '誰が', text: 'マリーナ・ホテルズ', filter: '事実' }, { label: '何を', text: '古いホテルの改装', filter: '事実' }, { label: 'どれだけ', text: '帳簿の土地は、昔の値段のまま', filter: '事実' }, { label: 'どう感じる', text: '改装中は、住めない', filter: '感情' }],
    posts: [{ handle: '@marina_lobby', text: 'ロビーに改装のお知らせ。期間は半年', views: '6,100回', kind: '事実' }, { handle: '@harbor_rumor', text: '改装のあと、値上げするらしい', views: '2.8万回', kind: '噂' }, { handle: '@long_stayer', text: '常連の部屋、なくならないで', views: '1.3万回', kind: '感情' }],
    harmony: '同じ改装を、帳簿の土地で読む人と、住めなくなる部屋で読む人。' },
  { headline: 'ノーチェ・ステイ、長期滞在の客が去年より増えたと決算で説明', theme: 'ホテル', scene: { style: 'ad', frames: [
      { pose: '明るい 2 階。窓の外は朝の港。人物は普通に動き、話す。', lines: [['オスバルド', '住むように泊まる人が増えている。建物は、住まわれている時がいちばん強い'], ['ラモン', '運転してると、いろんな噂が聞こえる。カプリを買うって話も']] },
    ] },
    parts: [{ label: '何が', text: '長期滞在の客が増えた', filter: '事実' }, { label: 'どこで', text: '決算の説明', filter: '事実' }, { label: 'なぜ', text: '住むように泊まる人が増えたから、らしい', filter: '噂' }, { label: 'どう感じる', text: '旅の宿が、家になる', filter: '感情' }],
    posts: [{ handle: '@noche_resident', text: 'ここに三か月いる。もう家', views: '4.1万回', kind: '感情' }, { handle: '@ir_notes', text: '平均の宿泊日数、去年の 1.4 倍（決算の資料）', views: '3,500回', kind: '事実' }, { handle: '@driver_talk', text: '次はリゾートを買うって話、聞いた', views: '1.9万回', kind: '噂' }],
    harmony: '同じ決算を、宿泊日数で読む人と、家になった宿で読む人。' },
  { headline: 'カプリ・リゾーツ、台風で島のリゾートを一時休業', theme: 'ホテル', scene: { style: 'mannequin', frames: [
      { pose: 'イシドロ、天秤を下ろしたポーズに切り替わる。', lines: [['イシドロ', '休業は一時。でも稼働率の振れ幅が大きい会社は、こういう時に安く見える']] },
      { pose: 'チェロ、鍵束を胸に抱いたまま。', lines: [['チェロ', '島が濡れているときに、島を買う話はしない']] },
      { pose: '二体が、同じマスでぶつかった瞬間のポーズで止まっている。', lines: [['（字幕）', '…………']] },
      { pose: '次の絵。二体とも、もう元の場所に立っている。', lines: [] },
    ] },
    parts: [{ label: '何が', text: '一時休業', filter: '事実' }, { label: 'なぜ', text: '台風', filter: '事実' }, { label: 'これから', text: '稼働率の振れ幅が大きい会社は、こういう時に安く見える', filter: '噂' }, { label: 'どう感じる', text: '島が濡れているときに、島を買う話はしない', filter: '感情' }],
    posts: [{ handle: '@island_weather', text: '台風、島の上で止まってる', views: '9,800回', kind: '事実' }, { handle: '@bargain_hunter', text: '今が底って言ってる人がいる（知らんけど）', views: '3.6万回', kind: '噂' }, { handle: '@capri_staff', text: 'スタッフはみんな無事です', views: '5.5万回', kind: '感情' }],
    harmony: '同じ台風を、休業の日数で読む人と、無事を祈る人。どちらも、まだ買う話ではない。' },
  { headline: 'マリーナ・ホテルズの大株主の一つが、持ち株を手放したと届け出', theme: 'ホテル', scene: { style: 'ad', frames: [
      { pose: '2 階の長机。窓から港の古いホテルの庭が見える。', lines: [['アナ', '届け出。数字は、事実のフィルターを通った'], ['イシドロ', '公開の手紙を書こう。土地を、今の値打ちで見てほしい、と'], ['ペルペトゥア', '港の古いホテルの庭、手入れされていないのよ。庭を見れば、会社が分かる']] },
    ] },
    parts: [{ label: '誰が', text: '大株主の一つ', filter: '事実' }, { label: '何を', text: '持ち株を手放した（届け出）', filter: '事実' }, { label: 'なぜ', text: '庭の手入れを見れば分かる、という人がいる', filter: '噂' }, { label: 'どう感じる', text: '会社の顔が変わるかもしれない', filter: '感情' }],
    posts: [{ handle: '@filings_daily', text: '届け出、出てた。手放したのは三割', views: '4,700回', kind: '事実' }, { handle: '@garden_eye', text: '港の古いホテルの庭、草ぼうぼう', views: '1.2万回', kind: '噂' }, { handle: '@old_guest', text: '昔の支配人、いい人だった', views: '8,200回', kind: '感情' }],
    harmony: '同じ届け出を、手放した割合で読む人と、庭の草で読む人。' },
  { headline: 'ノーチェ・ステイ、空いている港の 19 階建てのビルを、長期滞在のホテルに建て替える案', theme: '港', scene: { style: 'switch', frames: [
      { style: 'mannequin', pose: 'マネキン。窓を向いた 11 脚目の椅子に、カメラが寄る。椅子が、ほんの少しだけ回る（このゲームで初めて、止まっていたものが動く）。', lines: [] },
      { style: 'ad', pose: 'ここから広告リアリズム形式。明るい窓の外に、19 階建ての暗いビル。', lines: [['オスバルド', '19 階建て。……あのビルは、アクティブギャングが欲しがっていたビルだ'], ['イシドロ', '欲しいのは、ビルそのものじゃない。ビルが、正しい値打ちで見られることだ']] },
    ] },
    parts: [{ label: '何を', text: '19 階建てのビルの建て替え案', filter: '事実' }, { label: 'どこで', text: '港の倉庫街', filter: '事実' }, { label: 'なぜ', text: 'アクティブギャングも同じビルを見ている、という噂', filter: '噂' }, { label: 'どう感じる', text: '空いたビルに、灯りがともる', filter: '感情' }],
    posts: [{ handle: '@tower19', text: '19 階、全部の窓が暗い。今のところ', views: '7,400回', kind: '事実' }, { handle: '@boardroom_whisper', text: '二つの会社が、同じビルを狙ってるらしい', views: '6.1万回', kind: '噂' }, { handle: '@night_walker', text: 'あのビルに灯りがついたら、港が変わる', views: '2.0万回', kind: '感情' }],
    harmony: '同じビルを、正しい値打ちで見てほしい人と、住める場所にしたい人。' },
  { headline: '二つの会社のポートフォリオに、それぞれホテルの銘柄が入った', theme: 'ホテル', scene: { style: 'switch', frames: [
      { style: 'ad', pose: '広告リアリズム形式。朝の港。', lines: [['ニエベス', '同じ港の、違うホテル'], ['アナ（眼鏡を頭から下ろして）', '同じ数字の、違う読み方']] },
      { style: 'mannequin', pose: '最後の絵（マネキン形式に戻る）。8 体が、ロビーの長机のまわりに並んで止まっている。11 脚目の椅子だけが、窓を向いている。', lines: [] },
    ] },
    parts: [{ label: '誰が', text: 'アクティブギャングとサンクチュアリ', filter: '事実' }, { label: '何を', text: 'マリーナ・ホテルズ／ノーチェ・ステイ', filter: '事実' }, { label: 'なぜ', text: '帳簿の土地の見直し／住むように泊まる客', filter: '噂' }, { label: 'どう感じる', text: '同じ港の、違うホテル', filter: '感情' }],
    posts: [{ handle: '@portfolio_watch', text: '同じ週に、二つの会社がホテルを。偶然？', views: '3.3万回', kind: '噂' }, { handle: '@ir_notes', text: 'どちらも届け出あり。理由は正反対', views: '5,100回', kind: '事実' }, { handle: '@harbor_kid', text: 'どっちのホテルも、窓から島が見える', views: '1.7万回', kind: '感情' }],
    harmony: '同じ数字の、違う読み方。' },
];
