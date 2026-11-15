# IBM 量子キャンペーンの作戦（2026-11-15）

ゲームマガジン用のスライド：`docs/magazine/ibm-campaign-strategy.pptx`（作り方は `ibm-campaign-strategy.build.js`、pptxgenjs）。

## 論文について（確かめた範囲）
- 確かめた：鹿俣尚志・後藤隼人（理研）"Fault-tolerant quantum computing with a high-rate symplectic double code"、arXiv:2509.15457（2025 年 9 月）。[[30, 6, 5]]（30 物理・6 論理・距離 5）、符号化率 20%。
- 未確認：Science Advances 掲載（DOI 10.1126/sciadv.aec4142）、CNOT 108 → 67、物理ビット半分以下。作業環境から arxiv.org と DOI のページを開けなかったため、Gemini の要約のまま。論文の PDF か符号の安定化子（行列）と 67 CNOT の回路を手に入れてから、符号化テストを設計する。

## 端末からのアクセス（IBM ＝巨大データセンター）
- 端末（スマホ・タブレット）は見る・決める係。量子機に送るのは「走らせる係」で、鍵（API キー）はそこだけに置く。ウェブサイトとリポジトリには置かない。
- A オーナーの PC（おすすめ・いまの計画）／B タブレットのブラウザの Python ノート（鍵はノートの秘密の欄）／C GitHub Actions を手動で（スマホから押せるが、鍵を GitHub に預ける）。
- 無料枠：Open Plan は 28 日の移動窓で 10 分。600 秒の配り方の案はスライド 4。

## Gemini の 5 手の読み
1. 物理 6 vs 論理 6：半分採用。物理の QAOA は回せる。論理の |+⟩⊗6 の符号化テストは回路を手に入れてから。注意：似ているのは出発点だけで、論理ビットの上で QAOA を回すには論理の RZZ が要り、今回の範囲外。
2. X・Z と根の形：演出として採用（物理の主張ではないと明記）。
3. 枝刈り QAOA：採用・要検証。刈ると問題が変わることがあるので、64 通りの総当たりで最適が同じかを先に確かめる。「10〜15%」は根拠のない見込み。
4. 誤り率の閾値の絵：保留。閾値の数字は論文から取る。
5. QASM 書き出しと記録の再生：最初の一手。

## 決めること
1. 端末の道 A・B・C
2. 共鳴 Max-Cut を 12-03 と 12-10 のどちらに置くか
3. 論文の PDF か符号の行列の共有（または arxiv.org をこの作業環境のネットワークで許可）
4. QASM 書き出しスクリプトに着手する日

## 決まったこと（2026-11-15）：道 B ＝タブレットのブラウザの Python ノート

### 中身
- パッケージ：`cure-oracle` 0.2.0（`pip install "cure-oracle[quantum]"`）。新しいモジュール `cure_oracle.resonance`（6 コインの共鳴 Max-Cut、QAOA 1 層）。問題の JSON を同梱（`scripts/export-resonance-problem.mjs` で、ページと同じ合成データから作る）。
- wheel：`quantum/dist/cure_oracle-0.2.0-py3-none-any.whl`、SHA-256 `2e72d8272d06a125f1fbb67c341706c74d5ae7f363a50988d11c1ec9591e690d`（`quantum/dist/SHA256SUMS`）。
- ノート：`quantum/notebooks/resonance_tablet.ipynb`（5 段：指紋を確かめる → 版を固定して入れる → 手元と偽のチップ → 実機（二重の確認）→ 結果を保存）。
- 回路：`quantum/problems/resonance-maxcut.qasm`（OpenQASM 3）。CLI：`cure resonance --mode local|fake`、`cure resonance --export-qasm FILE`。

### 安全な実行の決まり
1. 鍵はノートに書かない。Colab の「シークレット」に `IBM_QUANTUM_TOKEN` と `IBM_QUANTUM_INSTANCE` を置き、このノートだけに許可。モジュールは鍵を表示も保存もしない（受け取って一度使うだけ）。
2. 入れる前に wheel の SHA-256 を照合。Qiskit の版は固定（qiskit 2.6.2、qiskit-ibm-runtime 0.52.1、qiskit-aer 0.18.2 — この作業環境で確かめた版）。
3. 実機は `RUN_ON_QPU = True` と `confirm="RUN ON QPU"` の両方が要る。送る前に回路の大きさを表示。ショットは 10,000 が上限、一回に一つの回路。
4. 結果の JSON に鍵・アカウントは入らない。終わったらランタイムを削除。ノートは共有しない。

### 確かめた結果（この作業環境）
- 手元（理想・状態ベクトル）：最適の組分け 7.4%（でたらめ 3.1%）。ブラウザの 6.8% と少し違うのは、Python は「最適が出る確率」を、ブラウザは「エネルギーの期待値」を目標に角度を選んでいるため。
- 偽のチップ（FakeTorino）：2 量子ビットゲート 46・深さ 121 で 6.7%。いちばん多く出た組分けは最適（BTC・ETH・SOL ／ XRP・ADA・DOGE）。
- 安全の決まり：確認の言葉なしの実機、上限を超えるショットは、どちらも止まった。
- wheel をきれいな環境に入れて `cure resonance` が動いた（Colab そのものでは、まだ試していない）。

### 実行の予定
| 日 | すること | 量子機の時間 |
|---|---|---|
| 11-16〜18 | タブレットで 1〜3 段（手元と偽のチップ）。実機には送らない | 0 |
| 11-19 | シークレットに鍵を保存。4 段は False のまま一度だけ動かす | 0 |
| 11-20・11-26 | 布と髪（決定済み、いまの台本で） | — |
| 12-03 か 12-10（決める） | 4 段を True にして共鳴 Max-Cut を一回（2,000 ショット） | 数秒〜数十秒の見込み |
| 12-17 | ページの「記録の再生」で手元・偽のチップ・実機を並べ、誌面へ | 0 |

### まだ決めていないこと
- 共鳴 Max-Cut の日（12-03 か 12-10）
- 理研の論文の PDF か符号の行列（符号化テストはそれから）
