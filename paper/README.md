# 論文の下書き（arXiv 初投稿用）

題：**Telling Stylized Avatars Apart at a Glance: Contour Height Maps and Silhouette Overlap for Hairstyle Design in Shared XR**

中身は `/lab/face-contour` の研究（顔を高さの地図にして等高線で個性を足す／シルエットの重なり IoU で見分けやすさを測る）。物語やゲームの話は入れていない（arXiv は研究の文章だけを受け付けるため）。人物の名前は髪型で呼ぶ（Ponytail・Bob・Buns・Cloud）。ブランド名や作品名は使わない。

## ファイル

| ファイル | 中身 |
|---|---|
| `main.tex` | 本文（英語、約 4 ページ） |
| `refs.bib` | 参考文献 5 件 |
| `figures/*.pdf`（と `.svg`） | 図 4 枚 |
| `data/results.json`・`data/table-*.tex` | 数値と表 |

図・表・数値は全部 `node scripts/paper-figures.mjs` で作り直せる（ラボのページと同じコード `lib/faceContour.ts` から計算する）。

## 提出の前にすること（オーナーの作業）

1. **著者名**：`main.tex` の `AUTHOR NAME` を本名（または arXiv に登録する名前）と所属に替える。arXiv の著者名は公開される。メールアドレスは本文に書かなくてよい。
2. **参考文献を確かめる**：`refs.bib` の Mann et al.（arXiv:2212.07960）は、この作業環境から arXiv に接続できなかったため、著者の全員と題をまだ確かめていない。ページを開いて書き写す。ほかの 4 件（Jaccard 1912、Lorensen & Cline 1987、Lorenz 1943、Glocker et al. 2009）もできれば確かめる。
3. **組版**：この環境には TeX がないので、まだ PDF にしていない。Overleaf に `paper/` の中身をそのまま上げて、pdflatex でコンパイルして見た目を確かめる。
4. **arXiv のアカウント**：作って、初めての分野ではエンドースメント（推薦）が必要になることがある。分野の候補：主分野 `cs.GR`（グラフィックス）、副分野 `cs.HC`（ヒューマンコンピュータインタラクション）。
5. **提出の形**：TeX のソース（`main.tex`・`refs.bib`・`figures/*.pdf`・`data/*.tex`）を zip か tar にまとめて上げる。BibTeX を使うので、Overleaf で作った `main.bbl` も一緒に入れる。
6. **ライセンス**：提出のときに選ぶ（例：CC BY 4.0）。
7. 規則や手順は変わることがあるので、提出の前に arXiv の案内（Submission と Endorsement のページ）を読む。

## 正直に書いてあること（限界）

- 顔の高さは描き方のための模型で、解剖学ではない。
- 見分けやすさの目安 0.75 は、デザインのための経験則で、人で確かめた値ではない。
- 正面からのシルエットだけ。次は 22 の角度で平均する（最後の面の 22 アングルと同じ考え）。
