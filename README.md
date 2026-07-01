# AI認定調査アシスタント

音声録音・文字起こしテキストをAIが要介護認定調査票フォーマットに整形するWebアプリです。

---

## 必要な環境

- [Docker](https://www.docker.com/products/docker-desktop/) および Docker Compose
- Anthropic API キー（[取得はこちら](https://console.anthropic.com/)）

---

## セットアップ手順

### 1. リポジトリをクローン

```bash
git clone https://github.com/tomoyuki-11/ai-nintei-assistant.git
cd ai-nintei-assistant
```

### 2. 環境変数ファイルを作成

プロジェクトルートに `.env` ファイルを作成し、以下の内容を記載してください。

```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxx
JWT_SECRET=任意の長い文字列（例: mysecretkey1234567890）
SUPERADMIN_PASSWORD=管理ツールのパスワード（任意）
```

| 変数名 | 説明 |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic の API キー（必須） |
| `JWT_SECRET` | JWT トークン署名用の秘密鍵（任意の文字列） |
| `SUPERADMIN_PASSWORD` | 管理ツールのログインパスワード（省略時: `superadmin1234`） |

### 3. Docker を起動

```bash
docker compose up -d
```

初回起動時はDockerイメージのダウンロードとRustのビルドに **5〜10分程度** かかります。

ログを確認する場合:

```bash
docker compose logs -f
```

バックエンドに `listening on 0.0.0.0:8080` と表示されれば起動完了です。

---

## アクセス先URL

| 画面 | URL | 説明 |
|---|---|---|
| **本体アプリ** | http://localhost:3000 | 施設スタッフ向けメイン画面 |
| **管理ツール** | http://localhost:3000/adminTool | 施設・ライセンス管理画面 |

---

## 初期セットアップ（初回のみ）

### 管理ツールで施設を登録する

1. http://localhost:3000/adminTool にアクセス
2. `.env` で設定した `SUPERADMIN_PASSWORD` でログイン（省略時: `superadmin1234`）
3. 「新規施設を作成」から施設名・プラン・有効期限を入力して作成
4. 作成された施設のライセンスキーをコピー

### 本体アプリにログインする

1. http://localhost:3000 にアクセス（ライセンスキー入力画面が表示される）
2. コピーしたライセンスキーを入力
3. 管理ツールの施設詳細から作成したスタッフアカウントでログイン

> 初回は管理ツールの「スタッフ管理」からadminアカウントを作成してください。

---

## 停止・再起動

```bash
# 停止
docker compose down

# 再起動
docker compose up -d

# データも含めて完全リセット（DBも消えます）
docker compose down -v
```

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 15 (App Router) / TypeScript / Tailwind CSS |
| バックエンド | Rust / Axum / sqlx |
| データベース | PostgreSQL 16 |
| AI | Anthropic Claude API |
| インフラ | Docker / Docker Compose |
