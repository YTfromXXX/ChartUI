const pptxgen = require('pptxgenjs');
const { applyTheme } = require('/root/.claude/skills/synced/6a270ddb-0177-465f-a336-758c8d3002b7_310c95b2-b3f1-4d7e-8939-f9b85db34f5b/pptx/scripts/apply_theme.js');

const THEME = {
  name: 'Mente Quantum Night', headFontFace: 'Meiryo', bodyFontFace: 'Meiryo',
  colors: { dk1: '1F1F1F', lt1: 'FFFFFF', dk2: '0A0A0A', lt2: 'F4F1EC', accent1: 'F29B30', accent2: '22B8C8', accent3: 'F5C542', accent4: 'A9C62A', accent5: 'C8001A', accent6: '6B6B6B', hlink: '22B8C8', folHlink: 'A9C62A' },
};
const H = THEME.colors;

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_16x9';
  pres.title = 'IBM 量子キャンペーン作戦会議'; pres.author = 'ChartUI'; pres.subject = 'ゲームマガジン';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;

  pres.defineSlideMaster({ title: 'DARK', background: { color: H.dk2 }, objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 1.5, w: 8.8, h: 1.5, fontSize: 34, bold: true, color: C.background1, valign: 'bottom', align: 'left', margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.6, y: 3.15, w: 8.8, h: 1.4, fontSize: 16, color: C.background2, valign: 'top', margin: 0 }, text: '' } },
  ] });
  pres.defineSlideMaster({ title: 'CONTENT', background: { color: H.lt1 }, slideNumber: { x: 9.2, y: 5.25, w: 0.5, h: 0.25, fontSize: 10, color: C.accent6 }, objects: [
    { text: { text: 'ゲームマガジン · IBM 量子キャンペーン作戦会議', options: { x: 0.6, y: 5.25, w: 6, h: 0.25, fontSize: 10, color: H.accent6, margin: 0 } } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.35, w: 8.8, h: 0.75, fontSize: 26, bold: true, color: C.text1, valign: 'middle', align: 'left', margin: 0 }, text: '' } },
  ] });

  const tb = (s, text, o) => s.addText(text, { isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: 'top', ...o });
  const card = (s, x, y, w, h, fill) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill } });
  const dot = (s, x, y, color, label) => { s.addShape(pres.shapes.OVAL, { x, y, w: 0.42, h: 0.42, fill: { color }, line: { color } }); tb(s, label, { x, y, w: 0.42, h: 0.42, align: 'center', valign: 'middle', bold: true, fontSize: 14, color: C.text1 }); };

  // 1 — title
  pres.addSection({ title: 'はじめに' });
  let s = pres.addSlide({ masterName: 'DARK', sectionTitle: 'はじめに' });
  s.addText('巨大データセンターに、スマホで手紙を出す', { placeholder: 'title' });
  s.addText('IBM 量子キャンペーン（2026-11-20〜12-17）の作戦会議。Gemini の解析をフィジカルプロンプトチェスの 5 手として読み、どれから指すかを決める。', { placeholder: 'body' });
  [H.accent1, H.accent2, H.accent3, H.accent4].forEach((c, i) => s.addShape(pres.shapes.OVAL, { x: 0.6 + i * 0.32, y: 0.6, w: 0.22, h: 0.22, fill: { color: c }, line: { color: c } }));
  s.addNotes('誌面の扉。四つの丸はアリミノの 4 色（オレンジ・シアン・黄金・黄緑）。');

  // 2 — the paper: what is confirmed
  pres.addSection({ title: '論文' });
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: '論文' });
  s.addText('理研の符号：30 個で 6 個を守る', { placeholder: 'title' });
  const stats = [['30', '物理量子ビット', H.accent2], ['6', '論理量子ビット', H.accent1], ['5', '符号距離', H.accent3], ['20%', '符号化率', H.accent4]];
  stats.forEach(([n, l, c], i) => { const x = 0.6 + i * 2.25; card(s, x, 1.35, 2.0, 1.55, H.lt2); s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: 1.55, w: 0.22, h: 0.22, fill: { color: c }, line: { color: c } }); tb(s, n, { x: x + 0.2, y: 1.85, w: 1.6, h: 0.6, fontSize: 36, bold: true }); tb(s, l, { x: x + 0.2, y: 2.45, w: 1.7, h: 0.35, fontSize: 14, color: C.accent6 }); });
  tb(s, [
    { text: '確かめたこと：', options: { bold: true, breakLine: true } },
    { text: '鹿俣尚志・後藤隼人（理研）による [[30, 6, 5]] シンプレクティック・ダブル符号の誤り耐性エンコーダ。arXiv:2509.15457（2025 年 9 月）。', options: { breakLine: true } },
    { text: 'まだ確かめていないこと：', options: { bold: true, breakLine: true } },
    { text: 'Science Advances 掲載（DOI 10.1126/sciadv.aec4142）、CNOT 108 → 67、物理ビット半分以下の数字。原文を開けていないため、Gemini の要約のまま。', options: {} },
  ], { x: 0.6, y: 3.15, w: 8.8, h: 1.9, fontSize: 14, paraSpaceAfter: 4 });
  s.addNotes('出典：検索で arXiv:2509.15457 と論文名・著者・[[30,6,5]]・20% を確認。DOI のページと arXiv 本文はこの作業環境のネットワークでは開けなかった。');

  // 3 — access: three roads
  pres.addSection({ title: '端末からのアクセス' });
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: '端末からのアクセス' });
  s.addText('IBM は巨大データセンター：道は三つ', { placeholder: 'title' });
  const flow = [['📱', '端末', '見る・決める'], ['🖥', '走らせる係', '鍵を持つ'], ['🏢', '量子機', '計算する'], ['📄', '結果', 'ページに載る']];
  flow.forEach(([i, a, b], k) => { const x = 0.6 + k * 2.3; card(s, x, 1.3, 1.95, 1.05, k === 2 ? H.dk2 : H.lt2); tb(s, `${i} ${a}`, { x: x + 0.15, y: 1.42, w: 1.7, h: 0.4, bold: true, color: k === 2 ? C.background1 : C.text1 }); tb(s, b, { x: x + 0.15, y: 1.85, w: 1.7, h: 0.35, color: k === 2 ? C.background2 : C.accent6 }); if (k < 3) s.addShape(pres.shapes.RIGHT_TRIANGLE, { x: x + 2.02, y: 1.7, w: 0.2, h: 0.25, rotate: 90, fill: { color: H.accent6 }, line: { color: H.accent6 } }); });
  const roads = [['A', H.accent1, 'オーナーの PC（おすすめ）', 'いまの計画どおり。鍵は手元だけ。スマホは結果を見る。'], ['B', H.accent2, 'タブレットのクラウドノート', 'ブラウザの Python ノートから送る。鍵はノートの秘密の欄に。'], ['C', H.accent3, 'GitHub Actions を手動で', 'スマホから押せて便利。鍵を GitHub に預けるので慎重に。']];
  roads.forEach(([l, c, h, b], k) => { const y = 2.6 + k * 0.85; dot(s, 0.6, y + 0.05, c, l); tb(s, h, { x: 1.2, y, w: 3.4, h: 0.35, bold: true }); tb(s, b, { x: 1.2, y: y + 0.36, w: 8.2, h: 0.4, color: C.accent6 }); });
  s.addNotes('どの道でも、鍵（API キー）はウェブサイトにもリポジトリにも置かない。サイトは結果の JSON を読むだけ。');

  // 4 — budget
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: '端末からのアクセス' });
  s.addText('使える時間は、28 日でおよそ 10 分', { placeholder: 'title' });
  card(s, 0.6, 1.3, 3.6, 3.6, H.dk2);
  tb(s, '10 分', { x: 0.9, y: 1.7, w: 3.0, h: 1.0, fontSize: 54, bold: true, color: C.background1 });
  tb(s, 'Open Plan の無料枠（28 日の移動窓）', { x: 0.9, y: 2.8, w: 3.0, h: 0.8, color: C.background2 });
  tb(s, '20 分使った研究者向けに、12 か月 180 分の申し込み制の特典もある（2026 年 3 月の告知）。', { x: 0.9, y: 3.6, w: 3.0, h: 1.1, fontSize: 12, color: C.background2 });
  s.addChart(pres.charts.BAR, [{ name: '見込みの量子機の時間（秒）', labels: ['布（11-20）', '髪（11-26）', '共鳴 Max-Cut', '符号化テスト', '予備'], values: [60, 90, 60, 120, 270] }], {
    x: 4.6, y: 1.3, w: 4.8, h: 3.6, barDir: 'bar', chartColors: [H.accent2], showValue: true, dataLabelPosition: 'outEnd', dataLabelColor: H.dk1, dataLabelFontFace: '+mn-lt', dataLabelFontSize: 11,
    catAxisLabelColor: H.dk1, catAxisLabelFontFace: '+mn-lt', catAxisLabelFontSize: 12, valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false,
    showTitle: true, title: '600 秒の配り方（案）', titleFontFace: '+mn-lt', titleFontSize: 13, titleColor: H.dk1,
  });
  s.addNotes('秒数は見積もりの案。実際は量子機の待ち行列や回路の深さで変わる。偽のチップでのリハーサルで先に確かめる。');

  // 5 — Gemini's five moves
  pres.addSection({ title: 'Gemini の 5 手' });
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Gemini の 5 手' });
  s.addText('Gemini の 5 手を、盤の上で読む', { placeholder: 'title' });
  const moves = [['1', '物理と論理', '半分採用', H.accent3, '物理の QAOA は回せる。符号化テストは回路を手に入れてから'], ['2', 'X・Z と根', '演出で採用', H.accent4, '物理の主張ではないと誌面に明記'], ['3', '枝刈り QAOA', '採用・要検証', H.accent2, '刈ると問題が変わる。最適が同じか総当たりで確認'], ['4', '閾値の絵', '保留', H.accent6, '閾値の数字は論文から。作った数字は使わない'], ['5', '書き出しと再生', '最初の一手', H.accent1, '11-20 に間に合い、鍵を外に出さない']];
  moves.forEach(([n, h, v, c, b], k) => { const x = 0.6 + k * 1.8; card(s, x, 1.3, 1.62, 3.65, H.lt2); dot(s, x + 0.12, 1.45, c, n); tb(s, h, { x: x + 0.12, y: 2.0, w: 1.4, h: 0.75, bold: true }); tb(s, v, { x: x + 0.12, y: 2.75, w: 1.4, h: 0.35, bold: true, fontSize: 14, color: k === 4 ? C.accent1 : C.text1 }); tb(s, b, { x: x + 0.12, y: 3.15, w: 1.4, h: 1.7, fontSize: 12, color: C.accent6 }); });
  s.addNotes('フィジカルプロンプトチェスの読み方：一手ずつ、事実・噂・感情のどれかを見分けてから指す。');

  // 6 — two cautions
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: 'Gemini の 5 手' });
  s.addText('指す前に、二つだけ注意', { placeholder: 'title' });
  const cautions = [[H.accent5, '似ているのは、出発点だけ', 'QAOA は物理ビットの |+⟩ から始まる。論文は 30 物理ビットで論理の |+⟩⊗6 を作る。論理ビットの上で QAOA を回すには、論理の RZZ ゲートが要り、今回の範囲を大きく超える。'], [H.accent2, '枝を刈ると、別の問題になる', '15 本の辺から 6〜8 本だけ残すと、最適の組分けが変わることがある。「10〜15% に上がる」は根拠のない見込み。刈った後も最適が同じかを、64 通りの総当たりで先に確かめる。']];
  cautions.forEach(([c, h, b], k) => { const x = 0.6 + k * 4.5; card(s, x, 1.3, 4.3, 3.6, H.lt2); s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: 1.55, w: 0.3, h: 0.3, fill: { color: c }, line: { color: c } }); tb(s, h, { x: x + 0.25, y: 2.0, w: 3.8, h: 0.5, bold: true, fontSize: 18 }); tb(s, b, { x: x + 0.25, y: 2.6, w: 3.8, h: 2.2 }); });

  // 7 — timeline
  pres.addSection({ title: '作戦' });
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: '作戦' });
  s.addText('28 日の手順', { placeholder: 'title' });
  const steps = [['11-15〜19', '準備', '書き出しスクリプト、偽のチップでリハーサル', H.accent6], ['11-20', '布', '実機 1 回（決定済み）', H.accent1], ['11-26', '髪の割り当て', '実機 1 回（決定済み）', H.accent1], ['12-03〜10', '共鳴 Max-Cut', '物理 6 ビット・1 層を 1 回（候補）', H.accent2], ['12-10', '符号化テスト', '論文の回路が手に入れば（候補）', H.accent3], ['12-17', 'まとめ', '3 つの結果を並べ、誌面へ', H.accent4]];
  s.addShape(pres.shapes.LINE, { x: 0.8, y: 2.05, w: 8.4, h: 0, line: { color: H.accent6, width: 1.5 } });
  steps.forEach(([d, h, b, c], k) => { const x = 0.6 + k * 1.5; s.addShape(pres.shapes.OVAL, { x: x + 0.1, y: 1.9, w: 0.3, h: 0.3, fill: { color: c }, line: { color: c } }); tb(s, d, { x, y: 1.4, w: 1.45, h: 0.35, fontSize: 12, bold: true, color: C.accent6 }); tb(s, h, { x, y: 2.4, w: 1.4, h: 0.6, bold: true }); tb(s, b, { x, y: 3.05, w: 1.4, h: 1.8, fontSize: 12, color: C.accent6 }); });

  // 8 — output for the magazine
  s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: '作戦' });
  s.addText('出力の方法：誌面とページに出すもの', { placeholder: 'title' });
  const outs = [['回路のファイル', 'OpenQASM 3 と Qiskit。重み 1 − 相関 を入れた 6 ビットの回路', H.accent2], ['量子機の記録', '64 通りの数と、そのときの誤り率を JSON に。鍵は入れない', H.accent1], ['ページの三つの切り替え', '手元のシミュレーション／実機の記録／論文の値（確かめられた分だけ）', H.accent3], ['誌面のスライド', '節目ごとにこのデッキを更新して掲載。出典の確かめ具合も載せる', H.accent4]];
  outs.forEach(([h, b, c], k) => { const x = 0.6 + (k % 2) * 4.5; const y = 1.3 + Math.floor(k / 2) * 1.85; card(s, x, y, 4.3, 1.65, H.lt2); s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.26, h: 0.26, fill: { color: c }, line: { color: c } }); tb(s, h, { x: x + 0.65, y: y + 0.2, w: 3.5, h: 0.4, bold: true, fontSize: 16 }); tb(s, b, { x: x + 0.25, y: y + 0.7, w: 3.85, h: 0.85 }); });
  s.addNotes('値段そのものは出さない（日々の変化の形だけ）。CoinGecko のデータを使うときは出典を表示。投資の助言ではない。');

  // 9 — decisions
  pres.addSection({ title: '決めること' });
  s = pres.addSlide({ masterName: 'DARK', sectionTitle: '決めること' });
  s.addText('次の一手：最初に指すのは 5 手目', { placeholder: 'title' });
  s.addText([
    { text: '1. 端末の道を A・B・C から選ぶ', options: { breakLine: true } },
    { text: '2. 共鳴 Max-Cut を 12-03 と 12-10 のどちらに置くか', options: { breakLine: true } },
    { text: '3. 論文の PDF か符号の行列を共有する（arxiv.org はこの作業環境から開けない）', options: { breakLine: true } },
    { text: '4. QASM 書き出しスクリプトを今日から作る', options: {} },
  ], { placeholder: 'body' });

  await pres.writeFile({ fileName: 'ibm-campaign-strategy.pptx' });
  await applyTheme('ibm-campaign-strategy.pptx', THEME);
  console.log('written');
})();
