# TSMonsterEngine

『A or B』のテキストパラメーターを表面化する Cure-API のエンジン。`runMonsterEngine()` が次の順で Kit を通す。

```
SensorySpiceKit  形（介入パターン）→ 感覚プロファイル（texture / intensity / pulseHz / spice）
      ↓
ChoiceForgeKit   spice → 『{A} or {B}』の文言（mild / medium / hot）。ページ A/B と Kit ID は固定
      ↓
GreenCardKit     地域ルール（点滅 ≤ 3 Hz、reduced motion、金融上の注意書き）＋ フェアプレー検査
```

| Kit | 役割 |
| --- | --- |
| `SensorySpiceKit` | 形状に充実を与え、感覚機能に直接作用する UI 体験を研究する。介入パターンと奇数回帰の場（tension / oddRatio）から強度と spice を決める |
| `GreenCardKit` | フェアプレーに徹したアニメーション描画を、各国の規制に合わせて調整する。全地域で点滅 3 回/秒以下（WCAG 2.3.1）。JP / EU / US / GLOBAL の注意書き。2 択の公平性検査（既定選択なし・文言の長さの偏り 2 倍以内・閉じられる・選び直せる） |
| `ChoiceForgeKit` | spice に応じて両側の文言を鋭く／柔らかくする |
| `SugorokuKit` | レトログリッド A/B の双六の盤面規則 |

適用箇所：

- `/cure-api` の placeholder → 2 択ポップアップ（文言・感覚表示・地域の注意書き・フェアプレー判定）
- `/retro-grid` のピクセルノイズの点滅（GreenCardKit で 3 Hz 以下に制限）と双六

注意書きは表示用のテンプレートで、法的助言ではありません。
