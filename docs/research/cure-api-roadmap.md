# Cure-API ロードマップ
## バーチャルマガジン / XV コミュニケーションツール

> 「すべてのノードが光ファイバーで繋がれた花の根のように、共鳴する」

---

## 概念図

```
[タブレット / Colab]  ──  cure resonance --mail addr
        │
        ▼
  cure_oracle.resonance.run()   ← 量子回路（QAOA p=1）
        │
        ▼
  cure_oracle.mail.deliver()    ← キャラクター声テンプレート
        │
  ┌─────┴──────┐
stdout  email  file   ← 配信経路（v0.3.0）
```

```
将来：
        │
  ┌─────┴──────────────────┐
 ML-DSA署名  Hybrid TLS  QKD鍵  ← セキュア層（v1.0+）
```

---

## フェーズとバージョン

| バージョン | 内容 | 状態 |
|-----------|------|------|
| **v0.2.0** | 量子共鳴 Max-Cut（QAOA p=1）、CLI `cure resonance`、ノートブック | ✅ 完了 |
| **v0.3.0** | `cure_oracle/mail.py`：stdout / SMTP / SendGrid / Resend、キャラクター声、SVG 花 | 🚧 今回 |
| **v0.4.0** | キャラクター NEWS 配信（スハル・リナリス の発信形式）、Python VM 確認モード | 📋 次回 |
| **v1.0.0** | ML-DSA 署名（結果 JSON に量子耐性署名を付与）、`cure verify-result` | 🔭 将来 |
| **v2.0.0** | Hybrid TLS エンドポイント（X25519 + ML-KEM-768）、cure-oracle API サーバー | 🔭 将来 |
| **v∞** | QKD 鍵共有（BB84 / E91）、物理光ファイバー区間対応 | 🔬 研究 |

---

## 配信経路（v0.3.0 実装済み）

```python
from cure_oracle import resonance, mail

result = resonance.run("local")

# Python VM（ノートブック）で確認
mail.deliver(result, to="stdout")

# メールで受け取る
mail.deliver(result, to="email:you@example.com")

# HTML レポートを保存
mail.deliver(result, to="file:report.html")
```

CLI:

```bash
cure resonance --mode local  --notify stdout
cure resonance --mode fake   --mail you@example.com
cure resonance --mode ibm    --mail you@example.com --confirm "RUN ON QPU"
```

---

## キャラクター声テンプレート

| モード | 発信者 | 色 | 質感 |
|--------|--------|-----|------|
| `local` | スハル（29-種） | シアン `#22b8c8` | 静か・詩的・理想の宇宙 |
| `fake`  | リナリス（92-種） | オレンジ `#f29b30` | 活発・雑音あり・練習の宇宙 |
| `ibm`   | スハルとリナリス | ゴールド `#f5c542` | 儀式的・実機・光の記録 |

花の SVG は `cure_oracle.mail._flower_svg(result)` で自動生成されます。
グループ 0 → シアン、グループ 1 → オレンジ、中心 → ゴールド。

---

## 認証情報の扱い（セキュリティ規則）

```
CURE_SMTP_HOST / CURE_SMTP_PORT / CURE_SMTP_USER / CURE_SMTP_PASSWORD
CURE_SENDGRID_API_KEY
CURE_RESEND_API_KEY
CURE_FROM_ADDRESS
```

- **環境変数のみ** — CLI 引数・設定ファイル・コードへの書き込みは禁止。
- Colab では `userdata.get("CURE_SMTP_PASSWORD")` で設定。
- 送信先アドレスはログ・ファイルに残しません。
- 資格情報の参照は送信後すぐに削除します（`del password`）。

---

## プロトコルスタック全体設計（将来ロードマップ）

> 出典：Cure-API 構想文書（2026-11-15）より。QKD 区間は物理光ファイバーが必要。

| レイヤー | 技術 | 役割 | 開発フェーズ |
|--------|------|------|------------|
| **L4: 署名層** | ML-DSA (CRYSTALS-Dilithium) / SLH-DSA | 結果 JSON への量子耐性署名、スマートコントラクト検証 | v1.0 |
| **L3: 暗号化層** | Hybrid TLS 1.3 (X25519 + ML-KEM + QKD 鍵) | RPC / P2P 通信路の暗号化、KDF で鍵を混合 | v2.0 |
| **L2: 匿名ルーティング** | Tor / PQC 拡張 | 送信元 IP 秘匿、検閲耐性 | v2.0 |
| **L1: 物理・鍵共有** | QKD (BB84 / E91) + ETSI QKD 014 API | 量子チャネルで共通鍵を生成、盗聴検知（QBER 監視） | 研究段階 |

### セッション確立シーケンス（v2.0 目標）

```
Step 1: QKD 鍵取得（量子チャネル経由 → K_QKD）
Step 2: ハイブリッド鍵カプセル化（X25519 + ML-KEM → K_ECDH, K_PQC）
Step 3: KDF 統合
         K_session = HKDF-SHA3-512(K_QKD ‖ K_PQC ‖ K_ECDH, Context)
Step 4: Tor 経由 RPC + ML-DSA トランザクション署名
```

### P2P 拡張（v2.0 目標）

- Noise Protocol Framework の PQC 化（ML-KEM をエフェメラル鍵交換に組み込み）
- Sybil / Eclipse 攻撃対策：QKD-Attestation + PQC PoS バリデータ署名
- .onion アドレスと ML-DSA 公開鍵ハッシュをオンチェーン登録

---

## ゲームとの対応（XV 空間の比喩）

| アーキテクチャ層 | ゲームの視覚表現 |
|----------------|----------------|
| L1 QKD 量子チャネル | 光ファイバーの花の根（`/root-bloom`） |
| L2 Tor 匿名ルーティング | 迷宮の根（障害物を避けて伸びる） |
| L3 Hybrid TLS | セッション鍵 = 共鳴周波数（スハルとリナリスの共鳴） |
| L4 ML-DSA 署名 | 金のアイコン（GOLDEN 色規則） |
| cure resonance 結果 | 花の色分け（グループ 0/1 = シアン / オレンジ） |

---

## 3 つのアプリタイプ（将来）

1. **プライバシー重視の連絡ツール** — Hybrid TLS + QKD 鍵で保護された cure-oracle メッセージング
2. **子ども・家族の安否確認アプリ** — キャラクター（スハル・リナリス）が届ける見守りメッセージ
3. **ゲーム複合型の優しい SNS** — XV 空間の量子実験をシェアする仕組み（`/mente/game/root-bloom` と連動）

---

## 研究上のボトルネック（文書より）

1. **鍵生成レートの不均衡** — QKD は数 kbps〜Mbps。大量 P2P データへの全適用は不可能。セッション開始の鍵シード生成のみに限定する設計が必要。
2. **パケット肥大化** — ML-DSA 署名 (2.4–4.6 KB) は ECDSA (64 B) の数十倍。Tor の 3 ホップでフラグメンテーションが増える。ヘッダ圧縮・ストリーム多重化が課題。
3. **トラステッド・ノード問題** — 長距離 QKD では途中ノードで古典復号が必要（量子中継器が実用化されるまで）。エンドツーエンド匿名性との両立が論点。

---

*cure-oracle v0.3.0 — 2026-11-15*
