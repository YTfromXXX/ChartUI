// "Two-choice parameters" in the manner of the 22 major arcana (0–21), for the future quantum punks
// (a fictional faction of this game). Each card asks one either/or. Left = read by GEOMETRY (decode,
// Greek: point, line, figure, proof); right = read by SEMIOTICS (take apart: sign, signal, convention).
// The 22 answers make a 22-bit parameter; it becomes new free symbols for the TEXTBOX (left '-', right '.').
// Cards left unanswered stay "in superposition" until measured (a seeded draw, game only).
export type Card = { no: number; name: string; left: string; right: string; note: string };

export const CARDS: Card[] = [
  { no: 0, name: '旅立ちの問い', left: 'ギリシャ幾何学で解読可能？', right: '記号学で解体可能？', note: 'A と B を、図形として読むか、記号として読むか。' },
  { no: 1, name: '点', left: '点（.）は位置', right: '点（.）は合図', note: 'ユークリッド：点とは、部分を持たないもの。' },
  { no: 2, name: '線', left: '線（-）は長さ', right: '線（-）は時間', note: 'ユークリッド：線とは、幅のない長さ。モールスでは、点の 3 倍。' },
  { no: 3, name: '平行', left: '平行（=・‖）は交わらない', right: '平行（=・‖）は繰り返し（韻）', note: '第五公準。2000 年かけて、別の幾何学が生まれた。' },
  { no: 4, name: '枠', left: '枠（{}）は図形の境界', right: '枠（{}）は沈黙の記号', note: '境界とは、あるものの端。' },
  { no: 5, name: '確かめ方', left: '証明で確かめる', right: '合意で確かめる', note: '数学の証明と、鎖の仕事の証明（みんなの合意）。' },
  { no: 6, name: '鍵の材料', left: '鍵は数（素数・曲線）', right: '鍵は物（回路のばらつき）', note: '楕円曲線の鍵と、PUF の鍵。' },
  { no: 7, name: '秘密', left: '秘密は隠す', right: '秘密は分ける', note: 'シャミアの秘密分散：何人か集まれば開く。' },
  { no: 8, name: '署名', left: '署名は一人', right: '署名は何人か', note: 'マルチシグと、しきい値署名。' },
  { no: 9, name: '時間', left: '時間は刻む（ブロック）', right: '時間は流れる（波）', note: '約 10 分ごとのブロックと、音の波。' },
  { no: 10, name: '量子の役目', left: '量子は計算機', right: '量子は通信路', note: 'ショアの計算と、量子鍵配送（QKD）。' },
  { no: 11, name: '重ね合わせ', left: '重ね合わせは迷い', right: '重ね合わせは資源', note: '決まっていないことを、使える力にする。' },
  { no: 12, name: '測定', left: '測ると壊れる', right: '測ると決まる', note: '盗み聞きが跡を残す — 量子鍵配送の考え方。' },
  { no: 13, name: '名', left: 'コードを公開する', right: '名を隠す', note: 'オープンソースと、匿名の作者。' },
  { no: 14, name: '大口', left: '大口に合わせる', right: '大口から離れる', note: 'トトシ中元のドルの山（架空）。' },
  { no: 15, name: 'チャート', left: 'チャートは図形', right: 'チャートは物語', note: '線と角度で読むか、ニュースの部品で読むか。' },
  { no: 16, name: 'ノイズ', left: 'ノイズはバグ', right: 'ノイズは鍵', note: '漏れればサイドチャネル、手なずければ乱数。' },
  { no: 17, name: '声', left: '声は漏れ口', right: '声は合図', note: '音響の暗号解析：機械の音から鍵が漏れた例がある。' },
  { no: 18, name: 'サンクチュアリ', left: 'サンクチュアリは場所', right: 'サンクチュアリは約束（プロトコル）', note: 'ゲームの中の構想。' },
  { no: 19, name: 'XV', left: 'XV は見る側の装置', right: 'XV は見られる側の鏡', note: '身につける計算機と、見返す権利。' },
  { no: 20, name: 'A と B', left: 'A と B は二人', right: 'A と B は一人の右と左', note: '推敲する二人か、右脳と左脳か。' },
  { no: 21, name: '終わりと始まり', left: '解読して終わる', right: '解体して始まる', note: '22 枚目。次の螺旋へ。' },
];

export type Pick = 0 | 1 | null; // 0 = left (geometry), 1 = right (semiotics), null = superposition

/** Measure the cards still in superposition: a draw seeded by the answers already given. */
export function measure(picks: Pick[]): (0 | 1)[] {
  let h = 2166136261; for (const p of picks) { h ^= p === null ? 7 : p + 1; h = Math.imul(h, 16777619) >>> 0; }
  return picks.map((p, k) => { if (p !== null) return p; let t = (h + Math.imul(k + 1, 0x9e3779b9)) >>> 0; t = Math.imul(t ^ (t >>> 16), 0x85ebca6b) >>> 0; t = Math.imul(t ^ (t >>> 13), 0xc2b2ae35) >>> 0; return ((t ^ (t >>> 16)) >>> 31) as 0 | 1; });
}

/** The 22 bits as free symbols: left '-', right '.', a '/' after every four cards (0–3, 4–7, …). */
export const toSymbols = (bits: (0 | 1)[]) => bits.map((b, k) => (b ? '.' : '-') + ((k + 1) % 4 === 0 && k < bits.length - 1 ? '/' : '')).join('');

/** Which kind of quantum punk the parameter points to (a game reading). */
export function faction(bits: (0 | 1)[]) {
  const geo = bits.filter((b) => b === 0).length;
  if (geo >= 15) return { name: '幾何のクオンタムパンク', text: '点と線と証明で、鍵を作り直す。量子の時代にも、図形で読み解こうとする。' };
  if (geo <= 7) return { name: '記号のクオンタムパンク', text: '合図と約束と合意で、鍵を分け合う。ノイズも声も、意味として読み替える。' };
  return { name: '境目のクオンタムパンク', text: '図形と記号のあいだに立つ。解読した線を、解体して、もう一度つなぐ。' };
}
