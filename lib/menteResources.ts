// Resources that reach Mente as notifications.
//
// ヒューマンリソース: impulsive requests about hairstyles and finger shapes.
// アニマルリソース: information about flower icons — and, for walks and shared food with a cat
// (PowerPoint request B), the plants and foods that are dangerous to cats. These are general
// safety facts (e.g. the ASPCA's toxic-plant lists), not a diagnosis; decisions go to a vet.
// Mente からの色彩の要求: opens the 22 famicom side menu on the retro-grid loop.

export const HUMAN_REQUESTS: readonly { from: string; text: string }[] = [
  { from: '新しい学生服のリーダー', text: 'ボブをあと 2 cm 短く。いますぐ' },
  { from: 'デイトレーダー', text: '指先をもっと丸く。爪の R を 3 mm に' },
  { from: 'アイロボ', text: '前髪はまっすぐ、横だけ流して' },
  { from: 'King ＆ Queen', text: '人差し指と小指だけ立てた形（コルナ）を 3D で' },
  { from: '保険医', text: '編み込みを 22 本。1 本ずつ別の色で' },
  { from: 'セキュリティ担当', text: '親指の角度をあと 15° 外へ' },
  { from: '老婆（No.9）', text: '……白髪を一筋だけ残しておくれ' },
];

export const ANIMAL_RESOURCES: readonly { title: string; text: string }[] = [
  { title: 'ユリ（Lilium）', text: '猫に強い毒性。花びら・葉・花粉、花瓶の水でも急性腎障害のおそれ。アイコンだけにして、実物は猫のいる家に置かない' },
  { title: 'ワスレグサ／デイリリー（Hemerocallis）', text: 'ユリと同じく猫の腎臓に危険' },
  { title: 'スズラン（Convallaria）', text: '強心配糖体を含み、猫にも犬にも危険' },
  { title: 'ツツジ・アザレア', text: '嘔吐や心臓への影響が出ることがある' },
  { title: 'チューリップ', text: '毒性成分は球根に多い。掘り返しに注意' },
  { title: 'ヒマワリ', text: '猫への毒性は低いとされる。それでも大量に食べさせない' },
  { title: 'バラ', text: '毒性は低いとされるが、トゲと農薬に注意' },
  { title: '食べ物の共有：ネギ類', text: 'タマネギ・ネギ・ニンニクは猫の赤血球を壊す。少量でも分けない' },
  { title: '食べ物の共有：チョコレート', text: 'テオブロミンとカフェインが危険' },
  { title: 'MR の散歩', text: '外ではハーネスとリード。室内飼いの猫を無理に外へ出さない' },
];

export const VET_NOTE = '一般的な安全情報です。食べた・触れたときは、すぐ獣医師へ。';
