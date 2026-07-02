# AI認定調査アシスタント

音声録音・文字起こしテキストをAIが要介護認定調査票フォーマットに整形するWebアプリです。

---

## クイックスタート（3ステップ）

### 事前準備

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) をインストールして起動しておく
- [Anthropic](https://console.anthropic.com/) で API キーを取得しておく

### 手順

**① リポジトリをクローン**

```bash
git clone https://github.com/tomoyuki-11/ai-nintei-assistant.git
cd ai-nintei-assistant
```

**② 環境変数ファイルを作成**

```bash
cp .env.example .env
```

`.env` をテキストエディタで開き、`ANTHROPIC_API_KEY=` の行を自分のAPIキーに書き換えてください。

```
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxx  ← ここだけ変更
```

**③ Docker を起動**

```bash
docker compose up -d
```

初回はRustのビルドで **5〜10分** かかります。以下のコマンドで起動完了を確認できます。

```bash
docker compose logs backend
# → "Server running on http://0.0.0.0:8080" が表示されれば完了
```

---

## アクセス先

| 画面 | URL |
|---|---|
| **本体アプリ** | http://localhost:3000 |
| **管理ツール** | http://localhost:3000/adminTool |

---

## 初期セットアップ（初回のみ）

### 1. 施設を登録する

1. http://localhost:3000/adminTool にアクセス
2. `.env` の `SUPERADMIN_PASSWORD`（デフォルト: `superadmin1234`）でログイン
3. 「新規施設を作成」から施設名・プランを入力して作成
4. 作成完了画面に表示される **ライセンスキー** と **初期パスワード** をメモしておく

### 2. 本体アプリにログインする

1. http://localhost:3000 にアクセス
2. メモしたライセンスキーを入力
3. ログインID `admin`・パスワードは初期パスワードでログイン

> ログイン後、設定画面からパスワードを変更することを推奨します。

---

## Stripe 決済のローカルテスト（任意）

決済機能（プランアップグレード・クレジット購入）をローカルでテストする場合は Stripe CLI が必要です。

### 1. Stripe CLI をインストール

```bash
# Mac
brew install stripe/stripe-cli/stripe

# Windows（Scoop）
scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git
scoop install stripe
```

### 2. Stripe アカウントにログイン

```bash
stripe login
```

ブラウザが開くので、Stripe アカウントでログインします。

### 3. Webhook をローカルにフォワード

```bash
stripe listen --forward-to localhost:8080/api/webhook/stripe
```

実行すると以下のように `whsec_xxx...` が表示されます。

```
> Ready! You are using Stripe API Version [...]
> Your webhook signing secret is whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (^C to quit)
```

### 4. Webhook シークレットを `.env` に設定

表示された `whsec_xxx...` を `.env` の `STRIPE_WEBHOOK_SECRET=` に貼り付けて、Docker を再起動します。

```bash
# .env を編集後
docker compose up -d
```

### 5. テスト決済

Stripe のテストカード番号でそのまま決済できます。

| 項目 | 値 |
|---|---|
| カード番号 | `4242 4242 4242 4242` |
| 有効期限 | 任意の未来の日付（例: `12/30`） |
| CVC | 任意の3桁（例: `123`） |

> `stripe listen` は Docker とは別のターミナルで実行したまま（Ctrl+C で終了しないこと）。

---

## プラン種別

| プラン | 内容 |
|---|---|
| **トライアル** | 14日間・3回まで無料 |
| **スタンダード** | 月額2,980円・月8回（Stripe決済） |
| **従量課金** | 600円/回の前払いクレジット制（Stripe決済） |
| **開発者** | 制限なし |

---

## よく使うコマンド

```bash
# 停止
docker compose down

# 再起動
docker compose up -d

# ログ確認
docker compose logs -f backend

# データも含めて完全リセット（DBのデータも消えます）
docker compose down -v
```

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 15 / TypeScript / Tailwind CSS |
| バックエンド | Rust / Axum / sqlx |
| データベース | PostgreSQL 16 |
| AI | Anthropic Claude API |
| 決済 | Stripe |
| インフラ | Docker / Docker Compose |
