# IBM Quantum challenge (free plan)

Ask a real IBM QPU the same question the spin lab (`/lab/spin`) asks in the browser: one layer of
QAOA for the **hair** problem (10 qubits, a chain of 9 couplings: 18 two-qubit gates on an IBM chip)
or, as a stretch, the **flower** problem (10 qubits, all 45 pairs: about 180 two-qubit gates).

```bash
pip install -r quantum/requirements.txt
npm run quantum:export                                  # only if lib/spinLab.ts changed
python quantum/ibm_spin_challenge.py hair --mode local  # ideal, offline
python quantum/ibm_spin_challenge.py hair --mode fake   # noisy rehearsal on a fake IBM chip, offline
python quantum/ibm_spin_challenge.py hair --mode ibm    # real QPU (asks before submitting)
```

Save your IBM account once on your own machine; never commit the key:

```bash
python -c "from qiskit_ibm_runtime import QiskitRuntimeService as S; S.save_account(channel='ibm_quantum_platform', token='<API key>', instance='<CRN>')"
```

- One circuit, 4 000 shots: a few seconds of QPU time, well inside the free plan (as I understand it,
  10 minutes every 28 days — check IBM's current terms). `--max-shots` guards against typos.
- Checked here: the circuit's ideal probabilities equal the browser's QAOA to within 1e-10.
- Results land in `quantum/results/`; load the JSON in the spin lab to compare it with the ideal and
  the rehearsal. Commit a real-QPU result if you want it shown for everyone.
- This environment cannot reach IBM's servers, so the real-QPU step runs on your machine.

## 「イーサリアムの黄金のアイコンを探せ」（仮）の台本 — `golden_icon_challenge.py`

ゲームの問いを IBM の無料枠で量子計算機に聞く。どちらも 1 回の実行で回路 1 つ、数秒の QPU 時間。

| 問い | 中身 | 量子ビット |
|---|---|---|
| `hair` | 島の考える機械フォン（仮）への問い：4 体（ポニーテール・ボブ・アリミノガール・アリミノボーイ）に、どの髪の主役を割り当てると、いちばん見分けやすいか。シルエットの重なり（IoU）の合計を小さくする QUBO、QAOA 1 層 | 16 |
| `cloth` | 9 年目の観測の切れ目：2 つの角度（.q と同じ整数のミリラジアン）で、布がどうなるかを測る。00 布はそのまま／01 端を折り返す／10 手が止まる／11 布を外す | 2 |

```bash
node scripts/export-golden-problem.mjs
```

```bash
python quantum/golden_icon_challenge.py hair --mode local
```

```bash
python quantum/golden_icon_challenge.py cloth --mode fake --angles 2094 1571
```

```bash
python quantum/golden_icon_challenge.py hair --mode ibm
```

試した結果（2026-11-13、この作業環境）：

- `hair`：いちばん見分けやすい割り当ては「ポニーテール＝雲、ボブ＝ボブ、アリミノガール＝ポニーテール、アリミノボーイ＝二つの輪」（重なりの合計 3.887）。いまの画面の割り当ては 3.916 で、ほぼ同じ。QAOA 1 層の理想の計算で、いちばんの答えが出る割合は 0.051%（でたらめに選ぶと 0.037%）。偽の IBM チップ（FakeTorino）の雑音ありでは平均のエネルギーが 12.5 → 20.5 に悪くなった（16 量子ビットの回路が深いため）。正直に：速さの得はなく、「ゲームの問いを量子計算機に聞ける」ことを見せるもの。
- `cloth`：理想 12.5 / 37.5 / 12.5 / 37.5%、偽のチップで 13.1 / 37.4 / 12.7 / 36.8%（理想からの距離 0.008）。
- 実機（`--mode ibm`）はオーナーの手元で、保存したアカウントで走らせる。鍵はリポジトリに入れない。

## IBM 量子キャンペーン（28 日間）

IBM の無料枠は、28 日ごとに使える QPU の時間に上限がある（いまの条件は IBM のサイトで確かめる）。28 日の計画（案）：

| 日 | すること | QPU |
|---|---|---|
| 1 | `cloth` を偽のチップでリハーサル → 実機で 1 回（1 000 shots） | 数秒 |
| 3 | 結果を物語の 9 年目（布）に反映。理想と実機の差を図にする | なし |
| 7 | `hair` をリハーサル → 実機で 1 回（4 000 shots） | 数秒 |
| 10 | 回路間戦争 10 章「赤いチームの正体」：実機の雑音と、ノイズの使いの攻めを比べる | なし |
| 14 | `cloth` をクレーターのサイコロの角度（`--angles`）で実機に 1 回 | 数秒 |
| 21 | `hair` をもう一度（同じ問い、別の日の実機）。日による違いを見る | 数秒 |
| 28 | まとめ：使った時間（`python quantum/campaign_status.py`）、結果の比較、論文 v2 の実験 2 へ | なし |

- 使った時間は `quantum/campaign_status.py` が、`quantum/results/` の実機の結果（mode が ibm）から数える。ローカルと偽のチップのリハーサルは数えない（無料）。
- 鍵（API キー）はリポジトリに入れない。実機はオーナーの手元で走らせる。
