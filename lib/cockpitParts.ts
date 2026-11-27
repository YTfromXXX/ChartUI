// Parts collected from reference photos of airliner flight decks (a simulator and an annotated flight deck)
// and a spacecraft flight deck. We take only the IDEA of each part — no brand, no layout copied — and say
// how this game uses it: 'now' (in the cockpit page today), 'next' (for real 3D piloting), 'later'.
export type Part = { area: '頭上' | '遮光板' | '正面' | '中央台' | '床と座席'; name: string; does: string; use: 'now' | 'next' | 'later'; game?: string };

export const PARTS: Part[] = [
  { area: '頭上', name: '電気系統', does: '電池と発電機の切り替え', use: 'later', game: '「雲のなかに電池を作れ」の電池につなぐ' },
  { area: '頭上', name: '油圧系統', does: '舵を動かす力（油の圧力）', use: 'later' },
  { area: '頭上', name: '燃料', does: 'ポンプと、左右の釣り合い', use: 'next' },
  { area: '頭上', name: 'エンジン（始動）', does: 'エンジンをかける', use: 'later' },
  { area: '頭上', name: '空調・与圧', does: '客室の空気と気圧', use: 'later' },
  { area: '頭上', name: '防氷・窓の防氷', does: '翼と窓の氷を防ぐ', use: 'now', game: '窓の外の氷の粒（キラキラ）' },
  { area: '頭上', name: '慣性基準装置・航法', does: '自分の位置と向きを知る', use: 'now', game: '方位の表示' },
  { area: '頭上', name: 'ライト・ベルトサイン', does: '照明と、客室への合図', use: 'later' },
  { area: '遮光板', name: 'オートパイロット（MCP）', does: '速さ・方位・高度を決めて、機械に任せる', use: 'next' },
  { area: '遮光板', name: 'HUD（ヘッドアップディスプレイ）', does: '窓に重ねて、姿勢と速さを見せる', use: 'now', game: '串の水平線（IND-01 を空へ移した）' },
  { area: '正面', name: 'PFD（主計器）', does: '姿勢・速さ・高度・昇降率', use: 'now', game: '下部の操縦パラメーター' },
  { area: '正面', name: 'MFD（地図・システム）', does: '進む道と、機械の具合', use: 'next' },
  { area: '正面', name: 'スタンバイ計器', does: '主計器が止まったときの予備', use: 'now', game: 'IND-01 串の姿勢計' },
  { area: '正面', name: '着陸装置（車輪）', does: '車輪の上げ下げ', use: 'later' },
  { area: '正面', name: '操縦輪（ヨーク）', does: '左右に回すと傾き、押し引きで機首の上げ下げ', use: 'now', game: 'フィボナッチの操縦輪（PermanentY 案）' },
  { area: '中央台', name: 'スラストレバー', does: 'エンジンの力', use: 'now', game: '推力のレバー' },
  { area: '中央台', name: 'スピードブレーキ・フラップ', does: '減速と、低速での揚力', use: 'next' },
  { area: '中央台', name: 'トリム', does: '手を離しても姿勢を保つ微調整', use: 'next' },
  { area: '中央台', name: '燃料コントロール・消火', does: 'エンジンへの燃料を止める、火を消す', use: 'later' },
  { area: '中央台', name: '通信・音量・トランスポンダ', does: '管制との無線と、自分の識別', use: 'later', game: 'モールス TEXTBOX につなぐ' },
  { area: '床と座席', name: 'ラダーペダル・ラダートリム', does: '機首の左右（ヨー）', use: 'next' },
  { area: '床と座席', name: 'パーキングブレーキ', does: '止まっているときのブレーキ', use: 'later' },
  { area: '床と座席', name: '脱出の合図', does: '避難の命令', use: 'later' },
];
