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
  { id: 'qpu-cloud', title: '本物の QPU（クラウド）での実行', area: '量子', status: 'decide', asked: '2026-11-12', note: 'どのサービスか・費用・鍵' },
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
  { group: '研究', routes: [['/lab/fourier', 'フーリエ'], ['/lab/spin', 'スピン'], ['/lab/mesh', 'メッシュ'], ['/lab/silicon', 'シリコン'], ['/retro-grid', 'レトログリッド'], ['/mente', 'Mente']] },
];

export const STATUS_LABEL: Record<Status, string> = { done: '済', doing: '進行中', todo: 'まだ', decide: '決めてほしい' };
export const counts = (ts: Task[]) => ({ done: ts.filter((t) => t.status === 'done').length, doing: ts.filter((t) => t.status === 'doing').length, todo: ts.filter((t) => t.status === 'todo').length, decide: ts.filter((t) => t.status === 'decide').length });
