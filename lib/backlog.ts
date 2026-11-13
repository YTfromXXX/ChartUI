// The to-do board: every request that is not finished yet, where it came from, and what blocks it.
// Status: done (済) / doing (進行中) / todo (まだ) / decide (決めてほしい — waits for the owner).
// Update this list in the same commit that changes a task.

export type Status = 'done' | 'doing' | 'todo' | 'decide';
export type Task = { id: string; title: string; area: string; status: Status; asked: string; note?: string; route?: string };

export const TASKS: Task[] = [
  // Header / DNA analyser
  { id: 'dna-bubble', title: 'ヘッダーの「無限 DNA 解析装置」バブル（d8・₿ ループ・▶️⏸️）', area: 'ヘッダー', status: 'done', asked: '2026-11-12', note: 'ヘッダーの 🧬 から開く' },
  { id: 'portable-sonar', title: 'ポータブル（マトリックス）ソナー — RPG 拡張用', area: 'ヘッダー', status: 'doing', asked: '2026-11-12', note: 'DNA バブルの中に最初の形。RPG の持ち物にするのは次' },
  { id: 'baby-in-die', title: 'サイコロの中のクリスタルベイビー・22 角度の回転・心臓のシンボル', area: 'ヘッダー', status: 'done', asked: '2026-11-12' },
  // Crystal Baby battle
  { id: 'cb-vortex', title: 'クリスタルベイビー対決：7 点対 7 点のボルテックスチャートの背景', area: 'クリスタルベイビー', status: 'todo', asked: '2026-11-12', route: '/lab/crystal-baby' },
  { id: 'cb-polyhedra', title: '偶数面のランダムな多面体をコミカルに配置', area: 'クリスタルベイビー', status: 'todo', asked: '2026-11-12', route: '/lab/crystal-baby' },
  { id: 'cb-famicom', title: '笑顔のファミコン 4 台（必ずこちら向き）', area: 'クリスタルベイビー', status: 'todo', asked: '2026-11-12', route: '/lab/crystal-baby' },
  { id: 'cb-condor', title: 'アンデスコンドル（3 本爪）の横からのスーパードリーズーム', area: 'クリスタルベイビー', status: 'todo', asked: '2026-11-12', route: '/lab/crystal-baby' },
  // Prompt chess
  { id: 'chess-bg', title: 'チェスの背景：リアルな市街地のインテリア、蝋燭とナイトのインスタレーション', area: 'プロンプトチェス', status: 'decide', asked: '2026-11-12', note: '背景写真の雰囲気の説明を待つ', route: '/lab/prompt-chess' },
  { id: 'chess-princess', title: '「馬の奥にお姫様が見えた」アルカナイベント', area: 'プロンプトチェス', status: 'todo', asked: '2026-11-12', route: '/lab/prompt-chess' },
  { id: 'chess-tarot', title: 'タロット拡張の駒（アルカナと共存）のバックアップ機能', area: 'プロンプトチェス', status: 'todo', asked: '2026-11-12' },
  { id: 'chess-davinci', title: 'ダヴィンチルールの記念品（無限ループのアニメーション）', area: 'プロンプトチェス', status: 'todo', asked: '2026-11-12' },
  // Cure-API research
  { id: 'fourier', title: 'フーリエ級数の矩形波・ギブズ現象・ランチョスのシグマ', area: 'Cure-API', status: 'done', asked: '2026-11-12', route: '/lab/fourier' },
  { id: 'soundcloud', title: 'Mente 式の SoundCloud 接続（まず偽データで差し替え可能に）', area: 'Cure-API', status: 'decide', asked: '2026-11-12', note: 'npm / pip の前に、本物の API とカスタマイズ案を改めて提案いただく' },
  { id: 'stable-diffusion', title: '画像生成（Stable Diffusion）との連携', area: 'Cure-API', status: 'decide', asked: '2026-11-12', note: 'どのサービス・どの鍵を使うか' },
  { id: 'carnav-switch', title: 'カーナビのアニメーション切替スイッチ（通る車はアニマル形式）', area: 'カーナビ', status: 'decide', asked: '2026-11-12', note: 'npm / pip の前に画面遷移（メタ視点）を把握して UI を整える — 下の画面の地図から' },
  // Activist sugoroku
  { id: 'activist', title: 'アクティビスト双六（19 マスの骨格・3 つのフィルター・.sh コマンド・git push で同時に動く車の駒）', area: 'アクティビスト', status: 'doing', asked: '2026-11-12', route: '/lab/activist', note: '車の駒とタクシー風のチームロゴまで。チェス駒への拡張は次' },
  { id: 'activist-vr', title: 'VR / MR 前提のスポーツ社会での取引模様（ドラマシーン）', area: 'アクティビスト', status: 'todo', asked: '2026-11-12' },
  { id: 'oracle-race', title: 'METADOGG ORACLE-API のレース中継画面（配信用・背後からのスポーツカー・ゲーム機の枠をリブート）', area: 'ORACLE', status: 'done', asked: '2026-11-12', route: '/oracle-api/race' },
  { id: 'permanent-y', title: 'テストプレイヤーをパーマネント Y として記録', area: 'ORACLE', status: 'doing', asked: '2026-11-12', note: 'レースの予想と的中を記録。双六とカードゲームへも' },
  { id: 'mahjong-cards', title: '架空の 4 社が銘柄を競う麻雀のようなカードゲーム', area: 'ORACLE', status: 'todo', asked: '2026-11-12' },
  { id: 'news-quiz', title: 'ニュースの四択クイズ（NEWS 現象）＋ポートフォリオ区分の予測市場', area: 'ORACLE', status: 'todo', asked: '2026-11-12', note: 'レースの「次のラップのトップは？」が最初の形' },
  { id: 'money-romance', title: '予測市場で車がコミカルに動く・金銭的なラブ模様', area: 'ORACLE', status: 'decide', asked: '2026-11-12', note: 'データが足りないので次回以降（オーナー判断）' },
  { id: 'spin-lab', title: 'スピン LAB：.meshmeta から花・髪・因数分解の問いを作り、アニーリングと QAOA（1 層）で解く（古典シミュレーション）', area: '量子', status: 'done', asked: '2026-11-12', route: '/lab/spin' },
  { id: 'qpu-cloud', title: 'IBM Quantum 無料枠のチャレンジ（髪：10 量子ビット QAOA）', area: '量子', status: 'doing', asked: '2026-11-12', note: '回路・理想・雑音つきリハーサルまで済。実機の実行はオーナーの手元で（quantum/README.md）', route: '/lab/spin' },
  { id: 'q-file', title: '隠しゲーム：量子に願いをかける .q（22 区画ルーレット・2 球モード・リズム署名・emoji 20 進数・願いの鎖）', area: '量子', status: 'done', asked: '2026-11-12', route: '/lab/spin', note: 'IBM チャレンジ欄の {:} から。docs/q-file.md' },
  { id: 'diag-popup', title: 'CELL CONVERGENCE // DIAGNOSTIC をヘッダーの一番上にポップアップ（♥ DIAG）・retest で答えの遅れを計測', area: 'Cure-API', status: 'done', asked: '2026-11-12', route: '/cure-api' },
  { id: 'designer-gene', title: '肖像アイコンのデザイナーズベイビー用の遺伝子の型（7 座・A〜D）と、EX = 0 の誕生', area: 'Cure-API', status: 'done', asked: '2026-11-12', route: '/cure-api' },
  { id: 'promotion-qubits', title: '昇格を 2 量子ビットの測定に（00 Q・01 R・10 B・11 N）、答えが届くまで「昇格中」', area: 'プロンプトチェス', status: 'todo', asked: '2026-11-12' },
  { id: 'dual-slot', title: 'Dual・パチスロ（慎重に）：払い出しのないスロットを双六のサイコロに（ポート 3・8・15・20・21・22）', area: 'Fami ポート', status: 'done', asked: '2026-11-12', route: '/lab/dual-slot', note: '慎重に作る約束は docs/design-rules.md の 8 章' },
  { id: 'aviator', title: '8. aviator：ポップアップで Dual を初期化（リトル／ネフェリムと翼の幅、平均はいつも 3.5）', area: 'Fami ポート', status: 'done', asked: '2026-11-12', route: '/lab/dual-slot', note: '倍率・途中下車・墜落は入れない（クラッシュ型の賭けにしない）' },
  { id: 'mente-aviator', title: 'Mente：紙飛行機の aviator（倍率＝飛距離÷高さ、人が折った形の差の解析）', area: 'Mente', status: 'done', asked: '2026-11-12', route: '/mente/aviator', note: '実際に折って飛ばした記録を集めると、形の差の解析が本物になる' },
  { id: 'seat-gaze', title: '4 人・8 人卓の席の色と目線（複素平面の点に 表面積：質量 をゆっくり与える）・5:5 の Mac の Y', area: 'テトラアルカナ', status: 'done', asked: '2026-11-13', route: '/lab/seat-gaze', note: '8 人はノイマンルールでデッキ 2 つ（288 枚）' },
  { id: 'seat-gaze-tetra', title: '席と目線をテトラアルカナの本番の卓（手牌・河）につなぐ', area: 'テトラアルカナ', status: 'done', asked: '2026-11-13', route: '/architect/tetra' },
  { id: 'y-desk', title: 'ストイックルーム：Y の姿（5:5 の Mac の前で悩む青年・2 択のエラー表示 → つうしんぼ、NEXT）', area: 'ストイックルーム', status: 'done', asked: '2026-11-13', route: '/stoic-room' },
  { id: 'qdice', title: 'IBM チャレンジの NEXT：クオンタムダイスのイニシャルページ（ホワイトアウト ⇄ ブラックアウトの色規則、z-index 四分割）', area: '量子', status: 'done', asked: '2026-11-13', route: '/lab/spin' },
  { id: 'blackout-menu', title: 'ブラックアウト版の総合メニュー本体（保存した色と四分割を使う）', area: '総合メニュー', status: 'todo', asked: '2026-11-13' },
  { id: 'whiteout-small-text', title: 'ホワイトアウト版の小さな補助の文字（stone-400、9px）を読みやすくする', area: '総合メニュー', status: 'todo', asked: '2026-11-13', note: 'stone-400 は白に対して 2.5:1 で、規則の 4.5:1 に届かない' },
  { id: 'edition-repo', title: '〜〜版：新しいリポジトリにこれまでの記録を保存（コード・docs・遊びの記録・量子の結果）', area: '版', status: 'decide', asked: '2026-11-13', note: '空のリポジトリを GitHub で作るのはオーナー（手順は docs/editions.md）。版の名前も決める' },
  { id: 'edition-readme', title: '〜〜版の README：void 的な個性（ファミコン演出の怖さなど）をコンセプチャルなレイアウトで', area: '版', status: 'decide', asked: '2026-11-13', note: '次回ディスカッション' },
  { id: 'gender-colour', title: '型と色（男女の色規則）を決める：チャートの色は日本式のままか、型は 2 つか 3 つか', area: 'VR/MR', status: 'decide', asked: '2026-11-13', note: 'Mente のあとで確定。docs/design-rules.md 9 章にメモ' },
  { id: 'hair-flower-chart', title: '量子の結果とろうそく足 10 本を同じ「髪と花」で並べる画面', area: 'VR/MR', status: 'todo', asked: '2026-11-13', note: '型と色が決まってから' },
  { id: 'white-ab', title: 'ホワイトアウト版 AB（サトシを探せ版）v0.1：クローンしてすぐ遊べる 3 場面（OP・回想 LAB・デッキ）', area: '版', status: 'done', asked: '2026-11-13', note: 'editions/white-ab/' },
  { id: 'black-ab', title: 'ブラックアウト版 AB（PowerPoint B 版）：仮面のデザインを議論してから', area: '版', status: 'decide', asked: '2026-11-13' },
  { id: 'face-contour', title: '顔型の差分装置（基準の顔・3 体の差・等高線、輪郭→量感→鼻と眉→口とあご先→髪の生え際の順）', area: '版', status: 'done', asked: '2026-11-13', route: '/lab/face-contour' },
  { id: 'eth-launcher', title: 'イーサリアム（Ξ）を射出するアイコン：「自由」は飛ぶほど重く、射出した分だけ球体の割れ目が増える', area: '版', status: 'decide', asked: '2026-11-13', note: 'Mente 式のメモにとどめる（docs/mente/memo.md）。本当に必要になったら作る' },
  { id: 'bob-variants', title: 'ボブを押すと開く新しい 4 つの型（左右非対称・内巻き・切りそろえ・段）', area: '版', status: 'done', asked: '2026-11-13', route: '/lab/face-contour' },
  { id: 'accent-strip', title: '下部の 7 マスをポニーテールと定める（根元 1 → 毛先 7、3 体目＝ポニーテール（仮））', area: '版', status: 'done', asked: '2026-11-13', route: '/lab/face-contour' },
  { id: 'rough-outlines', title: 'ポニーテールの顔を基準に、3 体の大まかなデフォルトの輪郭（段階 1〜2）を研究する', area: '版', status: 'doing', asked: '2026-11-13', route: '/lab/face-contour' },
  { id: 'four-figures', title: '4 体（ポニーテール・ボブ・2 体目・1 体目）の顔を可愛く、髪の動く部分（前髪の比・サイドの左右・2 色）で個性をならべる', area: '版', status: 'done', asked: '2026-11-13', route: '/lab/face-contour' },
  { id: 'hair-four-resume', title: '髪型 3 体 → 4 体の続き（予習と復習は docs/mente/memo.md）：残り 3 体の小物棚・2 色と性別の色の規則・仮面・「アリミノ」の名前の確認', area: '版', status: 'todo', asked: '2026-11-13', route: '/lab/face-contour' },
  { id: 'mente-switch', title: 'Mente の 🔄（切り替え）：「いったん Mente での作業を切り替えてゲームをする？」YES / NO', area: 'Mente', status: 'done', asked: '2026-11-13', route: '/mente' },
  { id: 'find-vitalik-header', title: 'イベント：タイトルの名前をクリック → 吹き出し（placeholder「ヴィタリックを探せ」）→ 「〜を探せ版」に書き換え（header まで）', area: '版', status: 'done', asked: '2026-11-13', route: '/mente/game' },
  { id: 'dice-colour-rewind', title: 'アリミノガール・アリミノボーイの色だけをサイコロで：Mente 式の逆再生（◀◀ REW → ▶ PLAY、毎秒 3 回以下）', area: '版', status: 'done', asked: '2026-11-13', route: '/lab/face-contour' },
  { id: 'find-vitalik-story', title: '物語の下書き：タロットの伝承と、ヴィタリックにとってのサトシ（不在の書き手と後から来た読み手）— docs/story/find-vitalik.md', area: '版', status: 'decide', asked: '2026-11-13' },
  { id: 'swarm-event', title: '6〜7 年目のイベント：BA-xxxx・PE-xxxx がプレイヤー側と画面側の両方から増える（keccak の名前の鎖、値段なし）', area: '版', status: 'done', asked: '2026-11-13', route: '/mente/game/swarm' },
  { id: 'swarm-story', title: '階段を数えた者（アリミノボーイと眠る水夫たちは「だいたい」知る）と、NFT・ミームコインをストイックとサトシの書から見る — docs/story/swarm-and-tokens.md', area: '版', status: 'decide', asked: '2026-11-13' },
  { id: 'years-finale', title: '1〜12 年目の進行：3・6・9・10 年目のミニゲーム（仮置き）と、最後の塔（Luna が aviator をハックして着陸、ラスボスは旋回する自動操縦）', area: '版', status: 'doing', asked: '2026-11-13', route: '/mente/game/years' },
  { id: 'year1-story', title: '1〜2 年目：2 択・4 択の物語、「アリミノボーイに聞く」（たぶん {～} のあいだ）、ストイックの暴落のチャート、指紋の書き写し（高度計の正直さ）', area: '版', status: 'done', asked: '2026-11-13', route: '/mente/game/year1' },
  { id: 'package-200', title: 'パッケージ：物語 200 ＋ ミニゲーム 12（1 年に 1 つ）', area: '版', status: 'doing', asked: '2026-11-13' },
  { id: 'mente-nudge', title: '乱れたときだけ、Mente 式にそっと「アリミノボーイに聞く」（迷い・急ぎ・やり直し・つまずき）', area: '版', status: 'done', asked: '2026-11-13', route: '/mente/game/year1' },
  { id: 'finale-22', title: '最後の面の研究：Luna の飛行機 × エーリアル達の 22 アングル（メタ視点のデバイス、自動と手動）', area: '版', status: 'doing', asked: '2026-11-13', route: '/mente/game/finale-lab' },
  { id: 'year9-cloth', title: '9 年目：ストイックが自分から布を外すか（登場人物の問いで一緒に考える）', area: '版', status: 'decide', asked: '2026-11-13' },
  { id: 'find-vitalik-body', title: '「ヴィタリックを探せ」の本編（アリミノボーイ・アリミノガールの登場）— 姿は描かず、名前はタイトルの言葉だけ', area: '版', status: 'todo', asked: '2026-11-13', route: '/mente/game' },
  { id: 'hair-types', title: '髪型の型（縦の塔・翼・ボブ・編み込み）で 3 体のシルエットを見分けやすく（IoU で測る）', area: '版', status: 'done', asked: '2026-11-13', route: '/lab/face-contour' },
  // Library
  { id: 'library-entrance', title: '望遠鏡の入場・VR / MR ログイン・しおりのリレー', area: '図書館', status: 'done', asked: '2026-11-12', route: '/lab/library/entrance' },
  { id: 'reading-order', title: '「どちらを先に読む？」投票とインタビュー（ナンシー・グレース・ローマン）', area: '図書館', status: 'done', asked: '2026-11-12', route: '/lab/library/reading-order' },
  { id: 'taxonomy', title: '動植物の分類（何科・何目）のテキストを図書館に。骨格 (19) と (3) のフィルター、写真かアニメかの研究', area: '図書館', status: 'doing', asked: '2026-11-12', note: '骨格 (19) = 19 マス、(3) = 事実・噂・感情のフィルターとして、まずアクティビスト双六に入れた' },
  { id: 'fish-plants', title: '紐のまわりの魚と植物、キャンディーによる計測と描画', area: 'ガラスの紐', status: 'todo', asked: '2026-11-12', route: '/lab/glass-knot' },
  // Packages
  { id: 'reserve-names', title: 'PyPI（cure-oracle）と npm（chartui）の名前を確保', area: 'パッケージ', status: 'decide', asked: '2026-11-12', note: 'アカウントを作ってアップロードするのはオーナーの作業' },
  { id: 'new-knots', title: '新しい結び目（ヒッチ・蝶々むすび・もやい結びベンド・マルチプル・オーバーハンド）', area: '結び目', status: 'todo', asked: '2026-11-11', note: 'デザイン規則メモを固めてから' },
  { id: 'meshmeta-v2', title: '.meshmeta v2：JCS 正規化・署名の配列・三角形の Keccak Merkle 木と証明（Python / TS 一致）', area: '結び目', status: 'done', asked: '2026-11-12', note: 'docs/meshmeta-v2.md' },
  { id: 'meshmeta-chain', title: '.meshmeta v2 のテストネット検証コントラクトと EIP-712 署名', area: '結び目', status: 'decide', asked: '2026-11-12', note: 'ウォレットとテスト用の資金の準備が必要。docs/meshmeta-README.md の未完了タスクに記載' },
  { id: 'meshmeta-lab-v2', title: 'メッシュ LAB に v2 の検証結果（緑と赤）', area: '結び目', status: 'done', asked: '2026-11-12', route: '/lab/mesh' },
  { id: 'meshmeta-sky', title: '.meshmeta 天球版（HEALPix）と ASDF / FITS', area: '結び目', status: 'todo', asked: '2026-11-11' },
  { id: 'header-fx', title: 'ヘッダーの BTCUSD を EURUSD / JPYUSD に切り替えるか', area: 'ヘッダー', status: 'decide', asked: '2026-11-11' },
  { id: 'real-hw', title: 'VR / MR と GPU の速さを実機で確認', area: 'テスト', status: 'todo', asked: '2026-11-11', note: 'このテスト環境ではできない' },
];

/** The screen map for the meta view: every LAB and main page, grouped. */
export const SCREENS: { group: string; routes: [string, string][] }[] = [
  { group: '入口', routes: [['/', 'ログイン'], ['/menu', '総合メニュー'], ['/cure-api', 'Cure-API'], ['/cure-api/engine', 'エンジン']] },
  { group: '図書館', routes: [['/lab/library', '図書館'], ['/lab/library/entrance', '入口'], ['/lab/library/reading-order', 'どちらを先に読む？']] },
  { group: '対戦・ゲーム', routes: [['/lab/crystal-baby', 'クリスタルベイビー'], ['/lab/prompt-chess', 'プロンプトチェス'], ['/lab/activist', 'アクティビスト双六'], ['/oracle-api/race', 'ORACLE レース中継'], ['/lab/honeycomb-punish', 'ハニカムパニッシュ'], ['/famidance', 'ファミダンス'], ['/architect/tetra', 'テトラアルカナ'], ['/relay-flight', 'リレーすごろく']] },
  { group: '結び目・ガラス', routes: [['/lab/glass-knot', 'ガラスの紐'], ['/lab/knot-ladder', '立方体のはしご'], ['/lab/card-slots', 'カードスロット'], ['/lab/candle-smoke', '蝋燭と煙']] },
  { group: '研究', routes: [['/lab/fourier', 'フーリエ'], ['/lab/spin', 'スピン'], ['/lab/dual-slot', 'Dual・パチスロ'], ['/lab/mesh', 'メッシュ'], ['/lab/silicon', 'シリコン'], ['/retro-grid', 'レトログリッド'], ['/mente', 'Mente'], ['/mente/aviator', '紙飛行機 aviator'], ['/mente/game', '〜を探せ（イベント）'], ['/mente/game/swarm', '瓶を拾う者たち（BA・PE）'], ['/mente/game/year1', '1〜2 年目（港）'], ['/mente/game/years', '12 年の進行と最後の塔'], ['/mente/game/finale-lab', '最後の面の研究（22 アングル）']] },
];

export const STATUS_LABEL: Record<Status, string> = { done: '済', doing: '進行中', todo: 'まだ', decide: '決めてほしい' };
export const counts = (ts: Task[]) => ({ done: ts.filter((t) => t.status === 'done').length, doing: ts.filter((t) => t.status === 'doing').length, todo: ts.filter((t) => t.status === 'todo').length, decide: ts.filter((t) => t.status === 'decide').length });
