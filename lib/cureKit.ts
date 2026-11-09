// Cure semiotics parameter kit: 19 skeleton (Device fusion Kit) + 3 skin items = 22,
// one per retro-grid / spiral-grid / arcana-binder cell (kit id n <-> cell #n).
// It also holds the analysis of the four placeholder intervention patterns and the
// two-choice prompts that send the customer to retro-grid page A or B.

import type { PlaceholderState } from '@/lib/cureApiStore';

export type KitLayer = 'skeleton' | 'skin';

export type KitItem = { id: number; layer: KitLayer; name: string; role: string };

export const CURE_KIT: readonly KitItem[] = [
  { id: 1, layer: 'skeleton', name: '背骨', role: '22 バインダーの主軸・共通規格' },
  { id: 2, layer: 'skeleton', name: '心臓', role: 'Cure-API／長期予測と短期予測を規則正しく同期する拍動パルス' },
  { id: 3, layer: 'skeleton', name: '肝臓', role: '市場ノイズのろ過・Cure-API のバッファリング領域' },
  { id: 4, layer: 'skeleton', name: '消化器', role: '生データストリームの分解・量子化処理' },
  { id: 5, layer: 'skeleton', name: '性癖', role: '固有感覚とクロスモーダルを処理する片側プロセッサ' },
  { id: 6, layer: 'skeleton', name: '本', role: 'L・ロン・ハバードの教理マニュアル／リバタリアン的自律の原典' },
  { id: 7, layer: 'skeleton', name: '目', role: '視覚遮断トリガー／閉眼によるベクションの起動' },
  { id: 8, layer: 'skeleton', name: 'e-メーター', role: '環境ノイズのミュート・1/f ゆらぎパルスの受容' },
  { id: 9, layer: 'skeleton', name: '鼻', role: 'Cure-API「呼吸」サイクルの基準クロック入力' },
  { id: 10, layer: 'skeleton', name: '皮膚', role: 'API-B／目を閉じた際の VR 内ハプティクス知覚閾値' },
  { id: 11, layer: 'skeleton', name: '龍のうねり', role: 'Derived Pulse 1 / 0.25Hz のカオス波形モデル' },
  { id: 12, layer: 'skeleton', name: 'ジーニーのランプ', role: 'カオス度 Ω をサイン波へ収束させる調教エンベロープ' },
  { id: 13, layer: 'skeleton', name: 'エアコン', role: '金属型の迷宮をなるべく垂直並行に及んだ分割線で曲線を表現する装置' },
  { id: 14, layer: 'skeleton', name: 'オレンジの点', role: 'ヘッダーの受動的アニメーション／ゴーグルの向き提示ジャイロ' },
  { id: 15, layer: 'skeleton', name: '星座結線', role: 'Cure-API が検知した複数のズレ・歪みの高速ターゲット記号群' },
  { id: 16, layer: 'skeleton', name: 'カオス・トリガー', role: 'ハンドルの微弱操作による速射エイムロック' },
  { id: 17, layer: 'skeleton', name: '骨格維持の檻', role: 'カオスを中央に包摂する多面体フラクタル外殻' },
  { id: 18, layer: 'skeleton', name: '“コマンドライン”', role: 'カオス度 Ω を直感的にハック・監視する最下層デバイス' },
  { id: 19, layer: 'skeleton', name: 'WebGPU', role: '次世代超低遅延レンダラ／頂点シェーダー直結バッファバインド' },
  { id: 20, layer: 'skin', name: '化粧水', role: '皮膚感覚 API-B の導電率・感度を調整する液体マテリアルパラメータ' },
  { id: 21, layer: 'skin', name: '毛髪', role: 'アンテナ型の微細受動振動センサー／ベクションの気流知覚' },
  { id: 22, layer: 'skin', name: '砂時計', role: 'カスタマーの解像度を永久に同期・維持する ChartUI 完全体（両脇の管からマグネットで螺旋をループ）' },
];

export const kitItem = (id: number) => CURE_KIT[id - 1];

/** 22 cells − 7 selected (6 galaxies + 1 singularity) = 15 cells of the polyhedral loop that sustains the 6. */
export const LOOP_CELL_COUNT = 22 - 7;

export type Pattern = Exclude<PlaceholderState, 'idle'>;
export type RetroPage = 'A' | 'B';

export type ChoiceOption = { page: RetroPage; kitId: number; text: string };

export type PatternAnalysis = {
  pattern: Pattern;
  name: string;
  /** What the orbit does (lib/cureOrbit). */
  motion: string;
  /** What the customer feels while following it. */
  phenomenon: string;
  /** Kit items engaged by the phenomenon. */
  kit: number[];
  /** Placeholder text: the intuition / self-perception question the pattern raises. */
  prompt: string;
  /** 『{A} or {B}』: A = active / collision (hypothesis A), B = receptive / containment (hypothesis B). */
  choice: [ChoiceOption, ChoiceOption];
};

export const PATTERN_ANALYSIS: Record<Pattern, PatternAnalysis> = {
  '⚪︎': {
    pattern: '⚪︎',
    name: '円',
    motion: '縦横比 0.55 の閉じた楕円を一定曲率・一定周期で周回。倍音 0.14 の小さなゆらぎのみ。',
    phenomenon: '終わりのない一定拍。曲率が変わらないため予測が完全に当たり続け、注意が「周期そのもの」へ移る。拍動（心臓）と呼吸（鼻）のどちらを基準クロックにするかが揺れる。',
    kit: [2, 9, 1],
    prompt: 'この周期は、あなたの鼓動ですか？ それとも呼吸ですか？',
    choice: [
      { page: 'A', kitId: 2, text: '鼓動に合わせて打つ' },
      { page: 'B', kitId: 9, text: '呼吸に合わせて吸う' },
    ],
  },
  '◻︎': {
    pattern: '◻︎',
    name: '角型',
    motion: '超楕円（指数 0.3）。長い直線区間と鋭い角。角の手前で速度ベクトルが急転する。',
    phenomenon: '直線では垂直・平行の分割線（エアコン）に沿って耐え、角では一瞬だけ照準が固定される（カオス・トリガー）。檻の内側にいる安心と、角で撃ち抜く衝動が交互に来る。',
    kit: [13, 16, 17],
    prompt: '角が来たとき、あなたは撃ちますか？ それとも直線に留まりますか？',
    choice: [
      { page: 'A', kitId: 16, text: '角で撃ち抜く' },
      { page: 'B', kitId: 17, text: '檻の直線で耐える' },
    ],
  },
  '(expand)': {
    pattern: '(expand)',
    name: '拡張',
    motion: '半径が 55%→100% を約 18 秒周期で呼吸しながら最大範囲まで広がる。',
    phenomenon: '境界が自分から遠ざかる感覚。EX=0 の風船（0→1 に膨らみ飛ぶ）と同じ相。閉眼でベクションに委ねるか、皮膚の知覚閾値で境界を確かめるかに分かれる。',
    kit: [7, 10, 20, 9],
    prompt: '広がる境界を、目を閉じて追いますか？ 皮膚で確かめますか？',
    choice: [
      { page: 'A', kitId: 7, text: '目を閉じて飛ぶ' },
      { page: 'B', kitId: 10, text: '皮膚で境界に触れる' },
    ],
  },
  '(extend)': {
    pattern: '(extend)',
    name: '伸長',
    motion: '横方向は最大、縦は 0.7 倍。選択 6 マスの奇数回帰の引力を倍音 0.26（通常の約 2 倍）で重ねる自由曲線。',
    phenomenon: '水平にうねる大きな波。Ω（カオス度）が上がり、うねりに乗り続けるか、ランプの包絡でサイン波へ鎮めるかを迫られる。毛髪が気流（ベクション）を最も強く拾う相。',
    kit: [11, 12, 21, 18],
    prompt: 'このうねりに乗りますか？ それともランプで鎮めますか？',
    choice: [
      { page: 'A', kitId: 11, text: '龍のうねりに乗る' },
      { page: 'B', kitId: 12, text: 'ジーニーのランプで鎮める' },
    ],
  },
};

export const PATTERNS = Object.keys(PATTERN_ANALYSIS) as Pattern[];

/** Default placeholder question before a pattern is chosen. */
export const IDLE_PROMPT = '動くセルを捕まえて、いまの直感に近い形を選んでください';
