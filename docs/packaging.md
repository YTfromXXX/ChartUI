# cure-oracle / chartui — パッケージと METADOGG ORACLE の販売形態（設計案）

最終更新：2026-11-12。理想形は「`pip install` ひとつ、`npm install` ひとつ」で ChartUI の中心部分が使えること。そのうえに METADOGG ORACLE を、カーナビ型の端末（数百ドル）か、サブスクリプション（月に数十ドル）として売る。

## 1. 名前

| | 希望 | 実際 | 理由 |
|---|---|---|---|
| Python | `pip install cure` | `pip install cure-oracle`（コマンド名は `cure`） | PyPI の `cure` は別の作者のパッケージ（キーワード引数の名前を直すデコレーター）が使っている。2026-11-12 に確認 |
| npm | `npm install chartui` | `npm install chartui` | 2026-11-12 の時点では空いていた。公開するまでは取られる可能性がある |

- `cure-oracle` と `metadogg-oracle` も PyPI では空いていた。npm の `@metadogg/chartui` も空いていた。
- 公開前にやること：PyPI と npm にアカウントを作り、名前を先に確保する（空のプレースホルダー版を出すか、0.1.0 を出す）。ブランド名「METADOGG」を商標として守るなら、出願を検討する（特許庁の J-PlatPat で先に似た商標を調べる）。

## 2. 中身（いま動くもの）

### Python：`cure-oracle`

```bash
pip install "cure-oracle[sign]"
```

- `knot_crossings`：交点の数え方（立方体のはしごの結び目の確認に使う）。
- `mesh_meta`：メッシュの部品分け、三角形の A〜D、絵文字のバイト位置ポインター（`.meshmeta`）、Ed25519 の署名と検証。
- `cure_initial`：`cure-initial/1` の契約（FastAPI のルーター）。`[api]` を付けたときだけ FastAPI を入れる。
- コマンド：
  - `cure version`
  - `cure meshmeta in.stl out --key key.pem`（部品分けして署名）
  - `cure verify out.stl out.meshmeta --pub <公開鍵>`
- 設定はリポジトリ直下の `pyproject.toml`。リポジトリのモジュールをそのまま使うので、アプリとパッケージでコードは 1 つ。
- 確認済み：まっさらな venv に `pip install ".[sign]"` で入り、`cure meshmeta` → `cure verify` が OK になる。

### npm：`chartui`

```bash
npm install chartui
```

```js
import { knots, ladder, meshmeta, colour, glass, slots, fx } from 'chartui';
colour.checkEdition('golden');   // 色彩規則の確認
await meshmeta.verifyMeshmeta(stlBuffer, meta);   // Python で付けた署名を確かめる
```

- 依存なしの 7 つのモジュールだけを入れる：結び目の交点、立方体のはしご、`.meshmeta`、色彩規則（蝋燭と煙）、ガラスの紐、カードスロット、FX の向き。
- 作り方：`packages/chartui` で `npm run build`（`lib/` からコピーして ES モジュールにする）。`npm pack` した tgz を空のプロジェクトに入れて、読み込めることを確認済み。
- React の画面（LAB のページ）はまだ入れない。入れるなら次の段階で `chartui/react` として分ける。

## 3. METADOGG ORACLE の売り方（案）

| 形 | 値段の目安 | 中身 |
|---|---|---|
| オープンソース | 無料 | `cure-oracle` と `chartui`（MIT ライセンス）。誰でも使え、改造もできる |
| サブスクリプション | 月に数十ドル | 実データの接続（API は 2 つまでの組み合わせ）、ORACLE の画面（エンジンメニュー A〜D、立方体のはしご、ソナー）、署名付き `.meshmeta` の配信、複数の端末での同期 |
| カーナビ型の端末 | 数百ドル（1 年分のサブスクリプション込み） | 車載の画面に、エンジンメニューの速度計を中心にした ORACLE を表示する専用の端末 |

- MIT ライセンスなので、パッケージそのものではお金を取れない。価値は「データの接続」「ホスティング」「端末」「署名と配信」に置く。
- 支払いと会員の管理は、既存の決済サービスを使う（カード番号を自分で預からない）。

## 4. 売る前に必ず確かめること

これは法律の助言ではない。実際に売る前に、弁護士や専門家に確認すること。

- **投資の助言にあたるか**：日本で、FX や株などの売買のタイミングや予測を有料で提供すると、金融商品取引法の「投資助言・代理業」の登録が必要になることが多い。「ORACLE（予言）」という名前と、予測の表示は、まさにこの点に当たりやすい。暗号資産を金融商品取引法の対象に入れる見直しも進んでいるので、最新の状況を確かめる。海外で売るなら、その国の規制（米国の投資顧問の規制など）も確かめる。
  - 登録なしで売るなら、「教育・可視化・研究のための道具」にとどめ、売買の推奨はしない、と画面と規約にはっきり書く。
- **運転中の操作**：カーナビ型なら、走っている間に画面を見つめたり操作したりさせない設計にする（道路交通法）。走行中は表示を止めるか、音声だけにする。
- **端末の認証**：無線（Wi-Fi・Bluetooth・LTE）を使うなら技適、電源アダプターなら PSE など、売る国ごとの認証がいる。最初は、認証済みの市販品（車載タブレットなど）にアプリを入れる形が現実的。
- **データの利用条件**：価格データの提供元の規約で、再配布や商用での表示が許されているかを確かめる。

## 5. 次の手順

1. PyPI（`cure-oracle`）と npm（`chartui`）の名前を確保する。
2. GitHub Actions で、タグを打つと両方に公開されるようにする（PyPI は Trusted Publishing、npm は provenance 付き）。
3. 規制の確認（上の 4）が済むまでは、無料版と「研究用」の表示で出す。
4. カーナビ型は、市販の車載タブレットに ORACLE の画面を入れた試作機から始める。
