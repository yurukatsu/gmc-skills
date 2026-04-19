# 開発者向けガイド

> 🇬🇧 [English](../en/development.md)

`gmc-skills` のコードベースに手を入れる開発者と、社内環境にデプロイする運用担当者向けのドキュメントです。エンドユーザー向けの使い方は [getting-started.md](getting-started.md) を参照してください。

## 1. プロジェクト構成

```
gmc-skills/
├── server/              # Hono HTTP サーバー (Node 22)
│   ├── src/
│   │   ├── index.ts        # エントリポイント (env 解析・起動)
│   │   ├── routes.ts       # HTTP ルート定義 (Hono)
│   │   ├── storage.ts      # FilesystemStorage + 共通型・サニタイズ
│   │   ├── gitStorage.ts   # GitStorage (clone/commit/push/PR)
│   │   ├── gitHost.ts      # GitHub / GitLab API ラッパ
│   │   ├── skillIndex.ts   # 5s TTL のインメモリインデックス
│   │   ├── stats.ts        # ダウンロード数カウンタ + JSON 永続化
│   │   ├── binaryExts.ts   # バイナリ拡張子リスト
│   │   ├── auth.ts         # bearer 認証ミドルウェア
│   │   ├── skill.ts        # SKILL.md frontmatter パーサ
│   │   └── ui/             # SSR テンプレート + CSS/JS バンドル
│   ├── Dockerfile          # multi-stage on node:22-alpine
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   └── package.json
├── cli/                 # Commander ベースの CLI
│   └── src/commands/       # publish/install/list/info/login/...
├── docs/{en,ja}/        # ユーザー向け bilingual ドキュメント
├── examples/sample-skill/ # 動作確認用リファレンス SKILL
├── docker-compose.yml   # 単一インスタンス向け
├── .env.example         # 環境変数の早見表
└── CLAUDE.md            # AI エージェント向けガイド
```

## 2. 技術スタック

### サーバー (`server/`)

| カテゴリ | 採用 | バージョン | 理由 |
|---|---|---|---|
| ランタイム | Node.js | `>=22` | LTS、`fetch`/Web Streams 標準搭載 |
| 言語 | TypeScript | `^5.6` | strict + `strictTypeChecked` |
| HTTP | [Hono](https://hono.dev) | `^4.6` | 軽量・型安全・Web Standards ベース |
| Hono アダプタ | `@hono/node-server` | `^1.13` | Node 上で Hono を動かす |
| Git 操作 | [simple-git](https://github.com/steveukx/git-js) | `^3.27` | 高水準 API。バイナリ読み出しのみ生 `spawn('git show')` を使用 |
| Markdown | [marked](https://marked.js.org/) | `^14.1` | README 描画 (現在は UI から削除済みだが依存に残る) |
| アーカイブ | [tar](https://github.com/isaacs/node-tar) | `^7.4` | tarball の生成と展開 |
| YAML | [yaml](https://github.com/eemeli/yaml) | `^2.6` | SKILL.md frontmatter |
| バリデーション | [zod](https://zod.dev) | `^3.23` | API 入力検証 |
| dev ランナ | [tsx](https://github.com/privatenumber/tsx) | `^4.19` | `npm run dev` の watch 実行 |
| Lint | ESLint flat config + `typescript-eslint` | `^9` / `^8` | strict ルール |
| Format | Prettier | `^3.3` | デフォルト設定 |

外部 OS 依存: `git` (PATH 必須、`git archive` を spawn する)。Docker イメージには同梱済み。

### CLI (`cli/`)

| カテゴリ | 採用 | バージョン |
|---|---|---|
| ランタイム | Node.js | `>=22` |
| パーサ | Commander | `^12.1` |
| アーカイブ | tar | `^7.4` |
| YAML | yaml | `^2.6` |
| バリデーション | zod | `^3.23` |

CLI は HTTP のみで完結し、`git` は不要。

### コンテナ

- ベース: `node:22-alpine`
- multi-stage build: builder で `npm ci` → `npm run build` → `npm prune --omit=dev` → runtime に dist + node_modules のみコピー
- PID 1: `tini` (SIGTERM 伝搬)
- 非 root ユーザー `gmc`
- 永続ボリューム: `/var/lib/gmc-skills`
- HEALTHCHECK: `/health` を 30 秒間隔で叩く

### UI

- SSR (HTML 文字列を Hono が返す)。`server/src/ui/html.ts` の `html` タグ付きテンプレートで自動エスケープ
- CSS/JS は `assets.ts` に文字列として埋め込み (`/assets/style.css`, `/assets/app.js` で配信)
- フォント: Press Start 2P (タイトル系のみ)、System sans (本文)、Space Mono (コード)
- 起動毎に `ASSET_VERSION = Date.now()` を生成して `?v=` クエリでキャッシュバスト

## 3. 開発環境セットアップ

### 前提

- Node.js 22 以上
- `git` (CLI 使用時は不要、サーバー起動時に必要)
- macOS / Linux 推奨。Windows は WSL 2 で動作確認

### 初回セットアップ

```bash
git clone <this-repo>
cd gmc-skills

# サーバー
cd server && npm install
cd ..

# CLI
cd cli && npm install && npm run build && npm link
cd ..
```

### 開発時の起動

```bash
# サーバー (filesystem モード)
cd server
GMC_SKILLS_TOKEN=dev-token npm run dev   # tsx watch、ファイル変更で自動再起動

# CLI (別シェル)
gmc-skills --version
```

ブラウザで `http://localhost:8787/` を開くと Web UI が表示されます。

### コード変更の確認

| 変更箇所 | 確認方法 |
|---|---|
| `server/src/**/*.ts` | `tsx watch` が自動再起動。ブラウザを reload |
| `server/src/ui/assets.ts` (CSS/JS) | サーバー再起動後、ブラウザで **Cmd/Ctrl+Shift+R** |
| `cli/src/**/*.ts` | `cli/` で `npm run build` → 既存 `npm link` がそのまま反映 |
| Docker イメージ | `docker compose up -d --build` |

## 4. コード規約と CI ゲート

各パッケージに `npm run check` (lint + format + build) があります。**変更後はマージ前に必ず実行**してください。

```bash
cd server && npm run check
cd cli && npm run check
```

詳細は [.claude/rules/style.md](../../.claude/rules/style.md) を参照。

主な規約:

- TypeScript strict + `strictTypeChecked`
- ESM、import は `.js` 拡張子付き
- コメントは "なぜ" が非自明な場合のみ
- 入力サニタイズは境界 (`sanitizeOwner` / `sanitizeName` / `sanitizeVersion` / `sanitizeFilePath`) で必ず実施
- HTML SSR は必ず `html` tagged template 経由 (raw 文字列連結禁止)

## 5. ローカルでのスモーク

### 基本的な往復

```bash
# サーバー起動 (filesystem モード)
GMC_SKILLS_TOKEN=dev-token npm --prefix server run dev

# 別シェル
gmc-skills login --registry http://localhost:8787 --token dev-token \
  --email you@example.com --name "You" --gitlab-account gm2101111
gmc-skills publish examples/sample-skill
gmc-skills list
gmc-skills info gm2101111/sample-skill
gmc-skills install gm2101111/sample-skill --target claude
```

### Git モードの確認

```bash
mkdir -p /tmp/gmc-git-test/remote.git
git init --bare /tmp/gmc-git-test/remote.git

GMC_SKILLS_TOKEN=dev-token \
GMC_SKILLS_GIT_REPO=/tmp/gmc-git-test/remote.git \
GMC_SKILLS_GIT_AUTHOR_NAME=gmc-server \
GMC_SKILLS_GIT_AUTHOR_EMAIL=gmc@localhost \
GMC_SKILLS_STORAGE=/tmp/gmc-git-test/server-workdir \
npm --prefix server run dev
```

`git -C /tmp/gmc-git-test/remote.git log --oneline` で commit/tag を確認。

### PR モードの確認 (本物の GitHub)

`gh` CLI 認証済み + 自分のサンドボックス repo を用意:

```bash
GMC_SKILLS_PUBLISH_MODE=pr \
GMC_SKILLS_GIT_REPO=https://github.com/<you>/<sandbox>.git \
GMC_SKILLS_HOST_TOKEN=<gh PAT (repo scope)> \
GMC_SKILLS_TOKEN=dev-token \
npm --prefix server run dev
```

`publish` で PR が立ちます。close せず merge せず終わった場合はブランチ + tag を `gh` で削除してください (`refs/tags/<owner>/<name>@<version>` と `refs/heads/gmc-publish/<owner>/<name>/<version>`)。

## 6. 社内デプロイ手順

### 前提環境

- Docker Engine 24+ + docker compose v2
- 社内 GitLab に gmc-skills 用の専用 monorepo を作成 (例: `infra/gmc-skills-registry`)
  - default branch (通常 `main`) に最低 1 commit (空でも README でも可)
  - サービスアカウントに対して `Maintainer` 権限以上を付与 (`pr` モードでも push が必要)
- そのアカウント名義の **Personal Access Token** を発行
  - スコープ: `api` (PR/MR 作成) + `write_repository` (push)
  - 有効期限: 運用ポリシーに合わせる (90 日推奨、ローテーション運用)
- gmc-skills サーバー (本リポジトリ) を動かすホスト
  - 推奨: 社内 Linux サーバー or Kubernetes ノード
  - egress: GitLab サーバーへの HTTPS (or HTTP) 到達性
  - ingress: 社内ユーザーから 8787 (または前段プロキシの 80/443) へ到達性

### 1) `.env` の作成

`.env.example` をコピーして埋めます。

```bash
cp .env.example .env
$EDITOR .env
```

社内 GitLab (IP 指定) の最小設定例:

```dotenv
GMC_SKILLS_TOKEN=$(openssl rand -hex 24)             # 配布用ランダムトークン
GMC_SKILLS_GIT_REPO=http://oauth2:<PAT>@10.0.0.5/infra/gmc-skills-registry.git
GMC_SKILLS_GIT_HOST=gitlab                           # IP 指定では自動判別不可
GMC_SKILLS_PUBLISH_MODE=direct                       # レビューが必要なら `pr`
GMC_SKILLS_GIT_AUTHOR_NAME=gmc-skills-server
GMC_SKILLS_GIT_AUTHOR_EMAIL=gmc-skills@corp.example.com
GMC_SKILLS_HOST_PORT=8787                            # ホスト側ポート
```

PR モードを使う場合は `GMC_SKILLS_PUBLISH_MODE=pr` に加えて `GMC_SKILLS_HOST_TOKEN=<PAT>` も設定 (URL 埋め込みでも可)。社内 GitLab に独自 API パスがある (リバースプロキシ + パスプレフィックスなど) 場合は `GMC_SKILLS_HOST_API_BASE=https://gitlab.corp.example.com/gitlab/api/v4`。

`GMC_SKILLS_TOKEN` は CLI ユーザーに配布する共有トークンです。社内チャットで配るのではなく、社内 password manager や Vault に登録して取得させてください。

### 2) ビルドと起動

```bash
docker compose up -d --build
docker compose logs -f gmc-skills-server   # 起動ログ確認
```

起動成功時のログ:

```
gmc-skills-server listening on http://localhost:8787 (git storage, direct publish)
  workdir: /var/lib/gmc-skills/workdir
  stats:   /var/lib/gmc-skills/stats.json
  index:   <N> skills cached
  web UI:  http://localhost:8787/
```

外部からのヘルスチェック:

```bash
curl -sf http://<host>:8787/health
# {"ok":true}
```

### 3) リバースプロキシ + TLS

社内ポリシーで HTTPS 必須なら、Nginx / Caddy / Traefik 等を前段に置きます。Caddy 例:

```caddyfile
gmc-skills.corp.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

WebSocket は不要。レスポンスは Long polling もないので特殊な設定は不要です。`/assets/*` には `Cache-Control: public, max-age=10, must-revalidate` が付くため、プロキシ側で過剰なキャッシュを設定しないでください (UI 更新が伝わらなくなる)。

### 4) CLI 配布

社内ユーザーには 2 通りの導線があります:

1. **npm パッケージとして社内 npm レジストリに publish** — 各ユーザーは `npm install -g @corp/gmc-skills`
2. **本リポジトリを clone してもらう** — 各ユーザーは `cd cli && npm install && npm run build && npm link`

社内 npm レジストリがある場合は (1) を推奨。`cli/package.json` の `name` を `@corp/gmc-skills` に変更してから publish してください。

`gmc-skills login` でユーザーが入力するレジストリ URL とトークンは社内 wiki に明記しておくと迷いが減ります。

### 5) バックアップ

永続データは Docker ボリューム `gmc-data` に集約されています:

```
/var/lib/gmc-skills/workdir/      # GitStorage の clone (再生成可)
/var/lib/gmc-skills/stats.json    # ダウンロード数カウンタ (再生成不可)
```

`stats.json` のみ別バックアップ対象。`workdir` は GitLab 側に源泉があるので失っても再 clone で復旧できます。

```bash
docker run --rm -v gmc-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/gmc-stats-$(date +%F).tar.gz -C /data stats.json
```

### 6) アップグレード

```bash
git pull
docker compose up -d --build      # 古いコンテナを停止 → ビルド → 新コンテナ起動
docker image prune -f             # 古いイメージ掃除
```

ロールバックは前のコミットに戻して同じコマンド。`stats.json` 形式は今後も後方互換を維持する方針なのでデータ移行は基本不要 (フォーマットを変える際は別途マイグレーションスクリプトを用意します)。

### 7) 監視

- Healthcheck: Docker 内蔵 (`HEALTHCHECK`)。`docker ps` の STATUS 欄に `healthy`/`unhealthy` が出ます
- 外形監視 (Pingdom / Uptime Kuma 等): `GET /health` を 1 分間隔で叩く
- ログ: `docker compose logs` で stdout を取得。journald or Loki / ELK に流す場合はホスト側で設定

ログから把握できる主要イベント:

- 起動時: storage モード、cached skills 数、port
- 各書き込み (publish/unpublish): commit / tag / push / PR URL

### 8) インシデント対応

| 症状 | 一次対応 |
|---|---|
| `/health` が 5xx | `docker compose logs` で例外を確認。GitLab 接続不能なら egress を疑う |
| `publish` が `409 SKILL_VERSION_NOT_MONOTONIC` | クライアントが古いバージョンを上げようとしている。`gmc-skills info <skill>` で latest を確認 |
| `publish` が認証エラー (401/403) | `GMC_SKILLS_TOKEN` の不一致。サーバー側 `.env` を再確認 |
| GitLab に push できない | PAT の有効期限切れ or 権限不足。`GMC_SKILLS_HOST_TOKEN` をローテーション |
| ディスク逼迫 | `docker system prune` + `workdir` を削除して再 clone (`docker compose down -v` は `stats.json` も消えるので避ける) |

## 7. リファレンス

- [サーバーリファレンス (env vars 一覧)](server.md)
- [CLI リファレンス](cli.md)
- [.claude/rules/project.md](../../.claude/rules/project.md) — アーキテクチャ詳細
- [.claude/rules/gotchas.md](../../.claude/rules/gotchas.md) — 過去の落とし穴
