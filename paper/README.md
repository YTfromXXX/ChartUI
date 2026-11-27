# 論文の下書き（arXiv 初投稿用）

題：**Telling Stylized Avatars Apart at a Glance: Contour Height Maps and Silhouette Overlap for Hairstyle Design in Shared XR**

中身は `/lab/face-contour` の研究（顔を高さの地図にして等高線で個性を足す／シルエットの重なり IoU で見分けやすさを測る）。物語やゲームの話は入れていない（arXiv は研究の文章だけを受け付けるため）。人物の名前は髪型で呼ぶ（Ponytail・Bob・Buns・Cloud）。ブランド名や作品名は使わない。

## ファイル

| ファイル | 中身 |
|---|---|
| `main.tex` | 本文（英語、5 ページ） |
| `main.pdf` | 組版した見本 |
| `arxiv-submission.tar.gz` | arXiv に上げるまとめ |
| `refs.bib` | 参考文献 5 件 |
| `figures/*.pdf`（と `.svg`） | 図 4 枚 |
| `data/results.json`・`data/table-*.tex` | 数値と表 |

図・表・数値は全部 `node scripts/paper-figures.mjs` で作り直せる（ラボのページと同じコード `lib/faceContour.ts` から計算する）。

## できていること（2026-11-13）

- 著者名：**Y.T.**（所属：Independent researcher）。メールアドレスは本文に入れていない（arXiv のアカウントにだけ登録する）。
- 組版：pdflatex でコンパイル済み（5 ページ、エラーなし）。`main.pdf` が見本。
- 提出用のまとめ：`arxiv-submission.tar.gz`（`main.tex`・`main.bbl`・`refs.bib`・図 4 枚の PDF・表 3 つ）。空のフォルダに展開して、そのままコンパイルできることを確かめた。

## 提出の前に残っていること（オーナーの作業）

1. **Mann et al. の確認**：`refs.bib` の arXiv:2212.07960 は、作業環境から arXiv に接続できなかったため、著者の全員と題をまだ確かめていない。ページを開いて書き写し、`bibtex` → `pdflatex` を 2 回で作り直す（または Overleaf で）。直したら `.tar.gz` も作り直す。
2. **エンドースメント**：初めての分野では推薦が必要なことがある。分野の候補：主分野 `cs.GR`、副分野 `cs.HC`。
3. **著者名**：イニシャルだけ（Y.T.）の著者名は、モデレーターから確認を求められることがある。そのときは登録名と合わせる。
4. **ライセンス**：提出のときに選ぶ（例：CC BY 4.0）。
5. 手順は変わることがあるので、提出の前に arXiv の案内（Submission と Endorsement のページ）を読む。

作り直し方（図・表・PDF・まとめ）：

```bash
node scripts/paper-figures.mjs
```

```bash
cd paper && pdflatex main && bibtex main && pdflatex main && pdflatex main
```

```bash
cd paper && tar -czf arxiv-submission.tar.gz main.tex main.bbl refs.bib figures/*.pdf data/*.tex
```

## 正直に書いてあること（限界）

- 顔の高さは描き方のための模型で、解剖学ではない。
- 見分けやすさの目安 0.75 は、デザインのための経験則で、人で確かめた値ではない。
- 正面からのシルエットだけ。次は 22 の角度で平均する（最後の面の 22 アングルと同じ考え）。
