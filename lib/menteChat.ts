// 17. Mente — real-concept community chat that intervenes in Cure's body maintenance.
// Shared by the Quiz Quantum telephone notification and the /mente page.

export type MenteMember = { id: string; name: string; role: string };

export const MENTE_MEMBERS: readonly MenteMember[] = [
  { id: 'obaa', name: '老婆（No.9）', role: '柱の陰で本と虫眼鏡を手に読み解く' },
  { id: 'vet', name: 'アニマル獣医', role: '脳波と行動からチャートを慎重に観測' },
  { id: 'daytrader', name: 'デイトレーダー', role: '長い待機時間の板読み' },
  { id: 'secops', name: 'セキュリティ担当', role: 'ログを夜通し監視' },
  { id: 'nurse', name: '保険医', role: '学園の保健室・ボディメンテナンス' },
  { id: 'leader', name: '新しい学生服のリーダー', role: 'Dual 機能でマネージメント' },
  { id: 'irobo', name: 'アイロボ', role: '受動振動センサーの読み上げ' },
  { id: 'king', name: 'King ＆ Queen', role: '22 階段の最上段から見下ろす' },
];

export type MenteMessage = { member: string; at: string; text: string };

/** Past community log (oldest first). */
export const MENTE_LOG: readonly MenteMessage[] = [
  { member: 'vet', at: '昨日 21:02', text: '動物は急がない。チャートも同じ。待つ時間が観測の半分です' },
  { member: 'daytrader', at: '昨日 21:15', text: '板が動かない 40 分。肩と首が固まる。誰か休憩の合図を' },
  { member: 'nurse', at: '昨日 21:16', text: '保健室より：90 分ごとに立って、肩甲骨を 10 回まわして' },
  { member: 'secops', at: '昨日 22:40', text: 'ログ監視 6 時間目。目を閉じて 20 秒、それだけで違う' },
  { member: 'irobo', at: '昨日 22:41', text: '毛髪センサー：気流の変化なし。ベクションは静か' },
  { member: 'leader', at: '昨日 23:03', text: '軍服とセーラー服、どちらで出るか明日決めます' },
  { member: 'obaa', at: '昨日 23:30', text: '……楔は粘土に残る。急いだ跡も、ためらった跡も' },
  { member: 'king', at: '今日 00:12', text: '22 段目は遠い。だから一段ずつ数える' },
  { member: 'vet', at: '今日 06:48', text: '朝の脳波は穏やか。今日はハニカムの 6 から始めます' },
  { member: 'daytrader', at: '今日 07:05', text: '待機は退屈じゃない。データ市場はずっと進んでいる' },
  { member: 'nurse', at: '今日 07:06', text: '水を一杯。ボディメンテナンスはそこから' },
  { member: 'secops', at: '今日 07:30', text: 'クイズクオンタムからテレフォンが来たら、ここに回して' },
];

export const memberById = (id: string) => MENTE_MEMBERS.find((m) => m.id === id) ?? MENTE_MEMBERS[0];
