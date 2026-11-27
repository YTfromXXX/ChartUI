# .meshmeta v2 仕様（案）

最終更新：2026-11-12。参照実装：`meshmeta_v2.py`（Python）と `lib/meshMetaV2.ts`（TypeScript）。両者は `tests/fixtures/meshmeta_v2_tetra.json` をバイト単位で再現する（`python -m pytest`、`npm run test:meshmeta`）。

## 前提

- **STL**：入力はバイナリでも ASCII でもよいが、出力と全ポインターは**バイナリ STL**を指す（バイト位置が意味を持つのはバイナリだけ）。ヘッダー 80 バイト＋三角形の数 4 バイトのあと、三角形 1 個 ＝ 50 バイトの記録が並ぶ。三角形 i の記録は `84 + 50·i` から。
- **−0.0 は書かない**：浮動小数点の −0.0 は +0.0 にそろえてから書く（言語によって符号がずれ、同じメッシュでも 1 バイト違う STL になるのを v2 の作業中に見つけて直した）。
- **数値は整数だけ**：JSON の中の数は整数（±2⁵³−1 以内）。小数は文字列にする（例：`"quality": "0.987"`）。浮動小数点の書き方の差で署名が割れるのを防ぐ。

## フィールド

```json
{
  "version": "2.0",
  "emoji": { "⏸️": "start", "▶️": "length" },
  "stl_sha256": "…",
  "triangles": 10,
  "merkle": { "hash": "keccak256", "leaf": "keccak256(keccak256(uint256 index ++ record50))", "node": "sorted-pair", "root": "0x…" },
  "pointers": [
    { "part": "MeshPart_01", "rank": "No.1", "label": "A", "quality": "1.000",
      "index": 8, "start": 484, "length": 50, "vertices": [496, 36],
      "data": "[⏸️ (バイト): \"0x01F0\", ▶️ (バイト): \"36\"]",
      "proof": ["0x…", "0x…"] }
  ],
  "signatures": [ { "alg": "Ed25519", "signer": "<公開鍵 hex>", "sig": "<署名 hex>" } ]
}
```

- `start` / `length`：三角形の記録全体（50 バイト）。Merkle の葉と同じ範囲。
- `vertices`：v1 と同じ、頂点だけの範囲（36 バイト）。`data` は v1 の絵文字の書式そのまま（互換のため）。
- `proof`：その三角形が `merkle.root` の木に、その位置で含まれることの証明。

## ハッシュと Merkle 木

- ハッシュは **Keccak-256**（イーサリアムのもの。NIST の SHA3-256 とはパディングが違うので別物）。
- 葉：`keccak256(keccak256(uint256(index) ‖ record50))`。位置（index）を葉に入れるので、証明は「どの三角形が、どの位置にあるか」まで示す。二重ハッシュは、内部の節点を葉と偽る攻撃を防ぐため（OpenZeppelin の推奨と同じ）。
- 節点：`keccak256(min(a, b) ‖ max(a, b))`（ソートしたペア）。段の最後に余った 1 個は、そのまま上の段へ。
- この形なら OpenZeppelin の `MerkleProof.verify(proof, root, leaf)` がそのまま使える（Solidity 側の葉は下の通り）。まだチェーン上では試していない。

```solidity
// 参考（未テスト）：葉を作って OpenZeppelin で検証する
bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encodePacked(uint256(index), record)))); // record: 50 bytes
bool ok = MerkleProof.verify(proof, root, leaf);
```

## 正規化（署名するバイト列）

1. すべての文字列とキーを **NFC** にそろえる。
2. **RFC 8785（JCS）**で書く：キーは **UTF-16 のコード単位の順**に並べ（😀 は私用領域の U+E000 より前に来る）、空白なし、文字列のエスケープは最小限。
3. 署名の対象は、`signatures` を除いたオブジェクトの JCS のバイト列。

この実装の JCS は、独立したライブラリ `rfc8785`（Python）と同じ結果になることを確かめた（テスト用のデータは絵文字・結合文字・サロゲートペア・私用領域を含む）。

**絵文字の注意**：NFC は U+FE0F（絵文字として表示する印）を足しも消しもしない。`⏸`（U+23F8 だけ）と `⏸️`（U+23F8 U+FE0F）は NFC のあとも別の文字列。だから v2 は絵文字の表（`emoji`）で**正確な形**を決め、そのまま比べる。

## 署名

- `signatures` は配列。今は `Ed25519` を検証する。
- 予約した名前（まだ検証しない。検証できない署名は「不明」として扱い、合否に数えない）：
  - `EIP-712`：ウォレット（secp256k1）での署名。型付きデータは `MeshMeta { bytes32 merkleRoot; bytes32 metaHash; }` を予定（`metaHash` ＝ 正規化したバイト列の keccak256）。
  - `ML-DSA-44` などの耐量子署名。大きい（数 KB）ので、チェーンには載せずファイル側に置く。
- 合格の条件：STL の SHA-256、Merkle 根、全ポインターの証明が正しく、検証できた署名が 1 つ以上あり、失敗した署名がないこと。信頼する公開鍵を渡すと、それ以外の署名者は失敗として扱う。

## 今後（v2 のあと）

1. テストネットの小さなコントラクト：Merkle 根の登録と、三角形 1 個の証明の検証だけ（本番には出さない）。
2. ブラウザのウォレットで EIP-712 署名を足す。
3. 天球版（HEALPix の番号を葉にする）と ASDF / FITS への対応。
