// Save the feel of play: export the play records that live only in this browser, so an edition
// (a snapshot repository) can keep them next to its code.
//
// Allow-list only. Never exported: 'chartui-access-token' (a credential) and the Mente inbox
// (it may hold personal messages). Real e-mail addresses are never stored by retest, so they are
// not in any of these keys. The Ed25519 key for .q wishes lives in IndexedDB and cannot be
// exported at all (it was created non-extractable).

export const RECORD_KEYS: { key: string; what: string }[] = [
  { key: 'chartui-permanent-y-v1', what: 'パーマネント Y（予想・的中・レースの回数）' },
  { key: 'chartui-reading-order-vote-v1', what: '「どちらを先に読む？」のあなたの一票' },
  { key: 'chartui-blackout-v1', what: 'ブラックアウト版の準備（量子サイコロの面・アクセント・四分割の順）' },
  { key: 'chartui-q-last-v1', what: '最後の .q の名前（願いの鎖の先頭）' },
  { key: 'chartui-dna-thought-v1', what: 'DNA 解析装置の「いま考えていること」' },
  { key: 'chartui-mente-paper-planes-v1', what: '紙飛行機の記録（ニックネーム・距離・高さ）' },
  { key: 'chartui-library-login-v1', what: '図書館に入場した望遠鏡' },
  { key: 'chartui-whiteout-binder', what: 'ホワイトアウト版の 22 binder' },
  { key: 'chartui-knot-inventory-v1', what: '結び目の持ち物' },
  { key: 'chartui-quiz-quantum', what: 'クイズクオンタム' },
  { key: 'chartui-synthetic-index', what: '合成インデックス' },
  { key: 'chartui-edition-title-v1', what: 'ゲームのタイトルの書き換え（〜を探せ版）' },
  { key: 'chartui-cure-api-state', what: 'Cure-API の状態（ヘッダーの表示・シミュレーションの設定）' },
];
export const NEVER = ['chartui-access-token', 'chartui-mente-inbox'];

export type RecordFile = { format: 'chartui-records/1'; edition: string; exported: string; records: Record<string, unknown> };
export function collect(edition: string, storage: Pick<Storage, 'getItem'>): RecordFile {
  const records: Record<string, unknown> = {};
  for (const { key } of RECORD_KEYS) {
    const raw = storage.getItem(key); if (raw === null) continue;
    try { records[key] = JSON.parse(raw); } catch { records[key] = raw; }
  }
  return { format: 'chartui-records/1', edition, exported: new Date().toISOString(), records };
}
