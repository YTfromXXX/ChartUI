// Sub-event "空の最後の輪" — a template for the 200 [ABCD] package with the finder assistant.
// It lives INSIDE the 200 beats: beats 184–200 (year 12, the 17 beats of "最後の塔").
// Flow derived from MENTE: every beat opens with a Mente-style "〜してみる？", and the finder assistant
// ルーペ（仮）(an original magnifying-glass helper) offers "一緒に〜を探してみよう".
// The trick: the TEXT never changes — only WHO sits WHERE. Four people, four places (機長席・右席・無線・窓).
// Each A/B/C/D puts one person into the beat's place (swapping with whoever was there), so the same
// sentences come out differently, and the final seating (plus one decision) picks one of six endings.
// Facts about flying are textbook-level (V1/VR/V2, gear up on a positive climb, a 3° glide path, …).
export type CastKey = 'luna' | 'boy' | 'girl' | 'stoic';
export type Seat = 'pilot' | 'copilot' | 'radio' | 'seeker';
export const CAST: Record<CastKey, { name: string; color: string }> = {
  luna: { name: 'Luna', color: '#22b8c8' }, boy: { name: 'アリミノボーイ', color: '#5ccbe0' },
  girl: { name: 'アリミノガール', color: '#f29b30' }, stoic: { name: 'ストイック', color: '#c5d93a' },
};
export const SEATS: Record<Seat, string> = { pilot: '機長席（操縦輪）', copilot: '右席（オートパイロット）', radio: '無線（管制）', seeker: '窓（ルーペと探す）' };
export const START: Record<Seat, CastKey> = { pilot: 'luna', copilot: 'boy', radio: 'stoic', seeker: 'girl' };
export const ORDER: CastKey[] = ['luna', 'boy', 'girl', 'stoic']; // A, B, C, D

export type Beat = {
  n: number; phase: string; mente: string; seat: Seat; text: string[];
  /** Label for A–D: "{name}" is the person placed into `seat`. */
  pick: string; lupe: string; fly?: boolean; decision?: boolean;
};

export const BEATS: Beat[] = [
  { n: 184, phase: '乗り込む', seat: 'pilot', mente: 'いったん Mente を閉じて、操縦席に座ってみる？', pick: '{name}が左に座る',
    text: ['塔のてっぺんに、飛行機が一機だけ止まっていた。', '{pilot}が左の席に座り、{copilot}が右に座る。{radio}はヘッドセットを首にかけ、{seeker}は窓に額をつけた。'], lupe: '窓の外、雲の端のあたり。' },
  { n: 185, phase: 'タキシング', seat: 'radio', mente: '管制に、出発の許可をもらってみる？', pick: '{name}が無線を持つ',
    text: ['滑走路までは、地上をゆっくり走る（タキシング）。', '{radio}が無線で許可をもらう。{pilot}はブレーキを少しずつ離した。'], lupe: '誘導路の黄色い線の先。' },
  { n: 186, phase: '離陸前の確認', seat: 'copilot', mente: '離陸の前に、指さしで確かめてみる？', pick: '{name}が読み上げる',
    text: ['フラップを少し出し、トリムを合わせる。', '{copilot}が三つの速さを読み上げる。V1（ここを過ぎたら止まらない）、VR（機首を上げる）、V2（安全に上がれる）。'], lupe: '読み上げの紙の、角のあたり。' },
  { n: 187, phase: '離陸', seat: 'pilot', mente: '推力を上げて、走ってみる？', pick: '{name}が推力を上げる',
    text: ['{pilot}がスラストレバーを前へ押す。', '「V1」と{copilot}。「ローテート」で、{pilot}は操縦輪をゆっくり引いた。'], lupe: '滑走路の端、速さの数字が変わる瞬間。' },
  { n: 188, phase: '上昇', seat: 'copilot', mente: '上がっているのを確かめて、車輪を上げてみる？', pick: '{name}が車輪を上げる',
    text: ['高度計がちゃんと上がっている（ポジティブ・クライム）。', '「ギア・アップ」。{copilot}がレバーを上げると、床の下で車輪がしまわれた。'], lupe: '翼の下の、小さな影。' },
  { n: 189, phase: 'オートパイロット', seat: 'copilot', mente: '機械に任せてみる？（オートパイロット）', pick: '{name}が MCP を合わせる', fly: true,
    text: ['{copilot}が遮光板の MCP で、速さ・方位・高度を合わせる。', '「オートパイロット、オン」。操縦輪から、{pilot}の手が少しだけ離れた。'], lupe: 'MCP の高度の窓。10,600 の、0 の中。' },
  { n: 190, phase: '巡航', seat: 'seeker', mente: 'ルーペと一緒に、窓の外で探してみる？', pick: '{name}が窓につく', fly: true,
    text: ['巡航の高さ。外は −50 °C より冷たく、遠くの飛行機が白い線を引いていた。', '{seeker}はルーペと一緒に、雲のあいだに光るものを探した。'], lupe: '飛行機雲の、いちばん新しいところ。' },
  { n: 191, phase: '古い紙', seat: 'radio', mente: '少し休んで、昔の話を聞いてみる？', pick: '{name}が話す',
    text: ['{radio}が、無線を切ったまま話しはじめた。', '「布をかけた紙のこと。あの線は、もう下を向いていない。上を向いてもいない。ただ、まっすぐだ」'], lupe: '話の中の「まっすぐ」の線。' },
  { n: 192, phase: '巻雲の中', seat: 'seeker', mente: '氷の粒をつまんでみる？', pick: '{name}が粒をつまむ', fly: true,
    text: ['巻雲の中に入ると、窓のすぐ外を氷の粒が流れた（ミクロ層）。', '{seeker}が一粒つまんで、串のサイコロの目にのせた。'], lupe: 'サイコロの、まだ染まっていない目。' },
  { n: 193, phase: 'リトルの輪', seat: 'pilot', mente: '十二年回っている輪のそばを、飛んでみる？', pick: '{name}が輪に近づける',
    text: ['下のほうで、リトルの飛行機が同じ輪を回っていた。「先生の決まりのせいで、あの飛行機は十二年も回ってる」', '{pilot}は、輪の外側を一度だけなぞった。'], lupe: '輪の、継ぎ目のあるところ。' },
  { n: 194, phase: '降下の始まり', seat: 'copilot', mente: '高度を下げはじめてみる？', pick: '{name}が降下を始める', fly: true,
    text: ['目的地まで、高さの三倍くらいの距離（三マイルで千フィート、と覚える）。', '{copilot}が高度の窓を下げる。昇降計の針が、静かに下を向いた。'], lupe: '昇降計の針の先。' },
  { n: 195, phase: '進入', seat: 'copilot', mente: '見えない坂に、乗ってみる？', pick: '{name}が進入の電波をとらえる',
    text: ['滑走路からは、見えない坂の電波が出ている（およそ 3° の降下の道）。', '{copilot}が二本の線（左右と上下）をとらえる。{radio}は着陸の許可をもらった。'], lupe: '二本の線が交わる点。' },
  { n: 196, phase: '車輪とフラップ', seat: 'pilot', mente: '車輪を下ろして、翼を大きくしてみる？', pick: '{name}が車輪を下ろす',
    text: ['「ギア・ダウン」。緑のランプが三つ点いた（それぞれの車輪が下りた印）。', 'フラップをいちばん大きく。{pilot}の手が、スラストレバーにもどる。'], lupe: '三つの緑の、真ん中。' },
  { n: 197, phase: '決める高さ', seat: 'pilot', mente: 'ここで決めてみる？', pick: '', decision: true,
    text: ['決める高さ。滑走路は見えている。', '{pilot}が、ほんの少しだけ{seeker}のほうを見た。'], lupe: '滑走路の、白い数字。' },
  { n: 198, phase: '接地', seat: 'pilot', mente: '最後まで、手を離さずにいてみる？', pick: '{name}が最後に引き起こす',
    text: ['地面のすぐ上で、機首をほんの少し上げる（フレア）。', '主車輪がつき、逆噴射とブレーキで速さが落ちていく。{radio}が小さく息をはいた。'], lupe: '窓に映る、自分たちの影。' },
  { n: 199, phase: '止まる', seat: 'radio', mente: 'ありがとう、と言ってみる？', pick: '{name}が最後の無線をする',
    text: ['パーキングブレーキ。エンジンを止めると、塔はとても静かだった。', '{radio}が最後の無線を送る。「着きました。ありがとう」'], lupe: '静かになった計器の、最後の明かり。' },
  { n: 200, phase: '終わり', seat: 'seeker', mente: '', pick: '', text: [], lupe: '' },
];

export const DECISION = [
  { key: 'land', label: 'A. 着陸する', note: '' },
  { key: 'goaround', label: 'B. やり直す（ゴーアラウンド）', note: '推力を上げて、もう一度上がる。失敗ではなく、決まった手順。' },
  { key: 'autoland', label: 'C. 機械に降ろしてもらう（自動着陸）', note: '電波の坂に乗ったまま、機械が引き起こしまで行う。' },
  { key: 'loop', label: 'D. もう一周する（リトルの輪へ）', note: '' },
] as const;
export type Decision = (typeof DECISION)[number]['key'];

/** Fill a line with the current seating. */
export const fill = (s: string, at: Record<Seat, CastKey>) => s.replace(/\{(pilot|copilot|radio|seeker)\}/g, (_, k: Seat) => CAST[at[k]].name);
/** Put `who` into `seat`, swapping with whoever was there. */
export function place(at: Record<Seat, CastKey>, seat: Seat, who: CastKey): Record<Seat, CastKey> {
  const from = (Object.keys(at) as Seat[]).find((s) => at[s] === who)!; return { ...at, [from]: at[seat], [seat]: who };
}

/** Six endings: two from the decision, four from who flies — then the seeker adds a line. */
export function ending(at: Record<Seat, CastKey>, d: Decision, found: number) {
  const P = CAST[at.pilot].name; const S = CAST[at.seeker].name;
  const icon = found >= 12 ? `${S}のルーペの中で、黄金のアイコン（仮）が一度だけ窓に映った。欠片は ${found} 個。` : `${S}がルーペと見つけた欠片は ${found} 個。黄金のアイコン（仮）は、まだ窓の向こう。`;
  if (d === 'loop') return { id: 'E5', title: '十三年目の輪', text: [`${P}は着陸せず、リトルの輪の内側へ入った。輪は、二機ぶんになった。`, '終わらないことを、選んだ終わり。', icon] };
  if (d === 'goaround') return { id: 'E6', title: 'やり直しの空', text: [`「ゴーアラウンド」。${P}が推力を上げ、飛行機はもう一度上がった。`, '二回目の進入は、一回目よりずっと静かだった。やり直すことは、決まりの中にある。', icon] };
  const how = d === 'autoland' ? '機械が引き起こし、' : '';
  const byPilot: Record<CastKey, { id: string; title: string; line: string }> = {
    luna: { id: 'E1', title: 'フォンの帰還', line: `${how}Luna は、フォンでいつもするように、音を立てずに降ろした。` },
    boy: { id: 'E2', title: '数え直しの着陸', line: `${how}アリミノボーイは、接地のあと、計器を最初から数え直した。全部、合っていた。` },
    girl: { id: 'E3', title: '語り手が降ろした日', line: `${how}語り手のアリミノガールが、はじめて物語の外で手を動かした。` },
    stoic: { id: 'E4', title: '十二年目の着陸', line: `${how}ストイックは、布をかけた紙のことを、もう思い出さなかった。` },
  };
  const e = byPilot[at.pilot]; return { id: e.id, title: e.title, text: [e.line, icon] };
}

/** Where the hidden ✦ sits among 12 cloud cells for a beat (stable per beat). */
export const hiddenAt = (n: number) => (n * 7 + 3) % 12;
