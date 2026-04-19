# サーバーリファレンス

> 🇬🇧 [English](../en/server.md)

サーバーは小さな Hono アプリです。HTTP API を提供し、SKILL をローカルのファイルシステム (Phase 1 / 開発用) または Git monorepo (本番) に保存します。

## 起動

```bash
cd server
npm install
GMC_SKILLS_TOKEN=<shared-token> npm run dev
# もしくは npm run build の後:
GMC_SKILLS_TOKEN=<shared-token> npm run start
```

ポートは `8787` がデフォルト (`PORT` で上書き可)。

## 環境変数

### コア (常に適用)

| 変数 | デフォルト | 意味 |
|---|---|---|
| `GMC_SKILLS_TOKEN` | — (必須) | publish / unpublish で検証する共通 Bearer token。 |
| `PORT` | `8787` | HTTP ポート。 |
| `GMC_SKILLS_STORAGE` | `./registry-storage` | storage の作業ディレクトリ。git モードでは clone 先。 |
| `GMC_SKILLS_STATS_FILE` | `<GMC_SKILLS_STORAGE>/.gmc-stats.json` | ダウンロードカウンターの永続化ファイル。ローカル専用 (Git レジストリには commit されない)。 |

### Git モード用 (全て optional — `GMC_SKILLS_GIT_REPO` が無ければ filesystem モード)

| 変数 | デフォルト | 意味 |
|---|---|---|
| `GMC_SKILLS_GIT_REPO` | — | Git remote URL。token を埋め込み可 (`https://x-access-token:<TOKEN>@host/path.git`)。これを設定すると git モードに切り替わる。 |
| `GMC_SKILLS_GIT_BRANCH` | `main` | push 先 / latest として追跡する default branch。 |
| `GMC_SKILLS_GIT_AUTHOR_NAME` | `gmc-skills-server` | Committer 名。 |
| `GMC_SKILLS_GIT_AUTHOR_EMAIL` | `gmc-skills@localhost` | Committer email。 |
| `GMC_SKILLS_PUBLISH_MODE` | `direct` | `direct` = default branch に直接 commit + tag + push。`pr` = PR / MR を作成。 |
| `GMC_SKILLS_GIT_HOST` | 自動 | host 種別を強制 (`github` / `gitlab`)。hostname が `github.com` / `gitlab.com` 以外 (self-hosted、IP など) のときに必須。 |
| `GMC_SKILLS_HOST_TOKEN` | URL 埋め込みを参照 | host API token。URL に入れたくない場合に使用。 |
| `GMC_SKILLS_HOST_API_BASE` | 自動 | API base URL を上書き。path-prefix GitLab、リバースプロキシ、非標準ポートで必要。 |
| `GMC_SKILLS_GITHUB_TOKEN` | — | `GMC_SKILLS_HOST_TOKEN` の旧名 (後方互換で受ける)。 |

## Storage モード

### Filesystem モード

`GMC_SKILLS_GIT_REPO` を設定しない。SKILL は以下に保存されます:

```
<GMC_SKILLS_STORAGE>/skills/<owner>/<name>/<version>/SKILL.md
```

`<owner>` は GitLab アカウント名 (例: `gm2101111`)。ローカル開発向け。Git も、共通 token 以外の認証もなし。

### Git モード (tag ベースレイアウト)

`GMC_SKILLS_GIT_REPO` に Git URL を設定すると有効。起動時にサーバーが `GMC_SKILLS_STORAGE` に clone します。レイアウト:

- **default branch** に各 SKILL の最新版が `skills/<owner>/<name>/SKILL.md` として置かれる (name の下にバージョンサブディレクトリなし)。
- 各 publish バージョンは **git tag** `<owner>/<name>@<version>`。
- per-version ダウンロードは `git archive <tag>:skills/<owner>/<name>/` を使用 — 過去バージョンをディスクに展開する必要なし。

**制約:**

- publish は **単調増加必須**。新しいバージョンは現在の latest より大きくなければならず、back-port は `409 SKILL_VERSION_NOT_MONOTONIC` で拒否される。
- latest バージョンは単体削除不可 — 新しいバージョンを publish するか `unpublish --all` を使う。
- 外部 push (Web UI での PR / MR merge など) は read エンドポイントに 5 秒以内に反映される (read 側の `git fetch` TTL が 5 秒)。

monorepo 側は最初から存在し、target branch に最低 1 commit (例: `README.md`) が必要です。

## Publish モード

### `direct` (デフォルト)

`publish` が default branch の `skills/<owner>/<name>/` に書き込み、commit、tag、push を一気に実行します。committer は `GMC_SKILLS_GIT_AUTHOR_*`、author は CLI が送った `X-User-Email` / `X-User-Name`。

### `pr` (GitHub + GitLab)

default branch に直接 push する代わりに:

1. default branch から `gmc-publish/<owner>/<name>/<version>` ブランチを worktree で切る。
2. SKILL を書き込み、ユーザーを author に commit → `<owner>/<name>@<version>` tag → branch + tag を push。
3. ホスト API 経由で PR (GitHub) または MR (GitLab) を作成。
4. PR / MR の URL を HTTP レスポンスに含めて返す (CLI が表示)。

default branch は PR / MR が merge されるまで更新されません。tag は作成済みなので、merge 前でも `install <owner>/<name>@<version>` は動きます。`unpublish` は常に direct (PR モード非対応)。

## 対応ホスト

| ホスト | 自動検出 | メモ |
|---|---|---|
| `github.com` | あり | API base = `https://api.github.com`。path は `owner/repo` の 2 階層のみ。 |
| `gitlab.com` | あり | API base = `https://gitlab.com/api/v4`。ネストグループ OK。 |
| GitHub Enterprise (self-hosted) | `GMC_SKILLS_GIT_HOST=github` を設定 | API base は `<scheme>://<host>/api/v3` に。 |
| GitLab (self-hosted、hostname) | `GMC_SKILLS_GIT_HOST=gitlab` を設定 | API base は `<scheme>://<host>/api/v4` に。 |
| GitLab (self-hosted、IP アドレス) | `GMC_SKILLS_GIT_HOST=gitlab` を設定 | scheme + port + IP がそのまま API base に使われる。HTTP 可。 |
| path-prefix / reverse proxy / 非標準ポート | `GMC_SKILLS_HOST_API_BASE` を設定 | API が `<scheme>://<host>/api/v4` にない場合に必要。 |

## デプロイ例

### GitHub direct モード

```bash
GMC_SKILLS_TOKEN=<shared> \
GMC_SKILLS_GIT_REPO=https://x-access-token:<GH_PAT>@github.com/<org>/gmc-skills-registry.git \
GMC_SKILLS_STORAGE=/var/lib/gmc-skills/workdir \
npm run start
```

### GitHub PR モード

```bash
GMC_SKILLS_TOKEN=<shared> \
GMC_SKILLS_GIT_REPO=https://x-access-token:<GH_PAT>@github.com/<org>/gmc-skills-registry.git \
GMC_SKILLS_PUBLISH_MODE=pr \
GMC_SKILLS_STORAGE=/var/lib/gmc-skills/workdir \
npm run start
```

### 社内 GitLab (IP、HTTP)

```bash
GMC_SKILLS_TOKEN=<shared> \
GMC_SKILLS_GIT_REPO=http://oauth2:<GL_PAT>@10.0.0.5/<group>/<repo>.git \
GMC_SKILLS_GIT_HOST=gitlab \
GMC_SKILLS_PUBLISH_MODE=pr \
GMC_SKILLS_STORAGE=/var/lib/gmc-skills/workdir \
npm run start
```

### リバースプロキシ配下の GitLab

```bash
GMC_SKILLS_TOKEN=<shared> \
GMC_SKILLS_GIT_REPO=https://oauth2:<GL_PAT>@corp.example.com/gitlab/<group>/<repo>.git \
GMC_SKILLS_GIT_HOST=gitlab \
GMC_SKILLS_HOST_API_BASE=https://corp.example.com/gitlab/api/v4 \
GMC_SKILLS_PUBLISH_MODE=pr \
npm run start
```

## API エンドポイント

レスポンスは全て JSON。

| Method | Path | Auth | 説明 |
|---|---|---|---|
| `GET` | `/health` | — | ヘルスチェック。 |
| `GET` | `/skills` | — | ページ分割一覧 (各 skill の latest)。クエリ: `?q=`、`?owner=`、`?tag=`、`?sort=name\|downloads\|updated` (デフォルト `name`)、`?order=asc\|desc` (natural: `name=asc`、他は `desc`)、`?page=N` (デフォルト 1)、`?per_page=M` (デフォルト 20、最大 100。`?limit=` は旧名エイリアス)。レスポンス: `{ items, total, page, per_page, pages }`。 |
| `GET` | `/skills/:owner/:name` | — | 最新版のメタデータ + `versions[]`。 |
| `GET` | `/skills/:owner/:name/:version` | — | 特定バージョンのメタデータ。 |
| `GET` | `/skills/:owner/:name/:version/readme` | — | `SKILL.md` の body 部分 (text/markdown)。 |
| `GET` | `/skills/:owner/:name/:version/files` | — | SKILL のファイルツリー JSON (`{ tree: FileNode[] }`)。上限: 深さ 10、500 ファイル。 |
| `GET` | `/skills/:owner/:name/:version/file?path=<rel>` | — | ファイル内容。テキストは `text/plain`、バイナリは JSON `{ binary: true, size }`。最大 1 MiB。path traversal は拒否。 |
| `GET` | `/skills/:owner/:name/:version/download` | — | そのバージョンの tar.gz。 |
| `PUT` | `/skills/:owner/:name/:version` | Bearer | publish。body: gzip tarball。ヘッダ: `X-User-Email`、`X-User-Name`。`SkillVersion` を返す (PR モードでは `prUrl` も含む)。 |
| `DELETE` | `/skills/:owner/:name/:version` | Bearer | 1 バージョン unpublish。 |
| `DELETE` | `/skills/:owner/:name` | Bearer | 全バージョン unpublish。 |

## Docker Compose でデプロイ

`server/Dockerfile` とルートの `docker-compose.yml` を同梱しています。

```bash
cp .env.example .env    # GMC_SKILLS_TOKEN、GMC_SKILLS_GIT_REPO 等を編集
docker compose up -d --build
docker compose logs -f gmc-skills-server
```

イメージは `node:22-alpine` のマルチステージビルド:

- Build ステージで `npm ci` + `tsc`、その後 dev 依存を prune
- Runtime ステージに `git` (simple-git + `git archive` 用)、`ca-certificates`、`tini` (PID 1)、非 root の `gmc` ユーザーを追加
- HEALTHCHECK は 30 秒おきに `/health` を叩く (内部の小さな Node スクリプト — 追加バイナリ不要)

永続化は単一の named volume `gmc-data` を `/var/lib/gmc-skills` にマウント:

- `workdir/` — clone されたレジストリモノレポ
- `stats.json` — ダウンロードカウンター

ホストで 8787 が埋まっている場合は `.env` の `GMC_SKILLS_HOST_PORT` を変更。

Compose ファイルにはコメントアウト済みの `redis` サービスブロックを含めてあります。カウンターを Redis バックエンドに移行するとき (Phase 6+ / マルチインスタンス) にアンコメントして使います。

## Web UI

サーバーは root パスに閲覧用 UI (read-only) を提供します:

- `GET /` — カタログ一覧 (全 SKILL、検索 + フィルタ)
- `GET /ui/:owner/:name` — SKILL 詳細 (バージョン履歴、ダウンロードリンク)
- `GET /assets/style.css` / `GET /assets/app.js` — スタイル / クライアントスクリプト

UI は認証なし (社内閲覧用)。JSON API 経由の書き込み操作は引き続き Bearer token が必要。

言語は `Accept-Language` で自動判定、`?lang=en` / `?lang=ja` で明示切替。ダーク / ライト / auto テーマは右上のボタンでサイクル、`localStorage` に保存。詳細ページのダウンロードリンクは既存の `/skills/:owner/:name/:version/download` を叩くので、**UI からのダウンロードと CLI `install` は同じカウンターに加算**されます。

ダウンロード数は `GMC_SKILLS_STATS_FILE` に debounce 書き込みで永続化。リセットしたい場合はファイルを削除。

サーバーは `storage.list()` の出力をミラーする **インメモリの SKILL インデックス** (`SkillIndex`) を持っています。読み取りはこのキャッシュ経由で、disk/git walk は最大でも 5 秒に 1 回 (TTL) または書き込み直後のみ。数千件の SKILL があっても list/search が高速に保てます。起動時に再構築。外部の git push も TTL 経過後には反映されます。

一覧ページの並び替えチップは 名前順 (A→Z、デフォルト) / ダウンロード数順 / 更新日順 を切り替えます。アクティブなチップをもう一度クリックすると方向を反転 (asc ↔ desc) — 現在の方向はチップ右側の矢印で表示されます。詳細ページは `SKILL.md` 本文を `marked` で HTML 化し、`<script>` / `<style>` / `on*` ハンドラを除去するサニタイザを通しています (社内コンテンツは信頼しますが defense in depth)。

## トラブルシューティング

- **起動時エラー `Git workdir … is not empty and not a git clone`** — storage dir に無関係のファイルがある。削除するか `GMC_SKILLS_STORAGE` を別のパスに変更。
- **`PR mode requires a GitHub or GitLab repo URL`** — hostname が認識されない。`GMC_SKILLS_GIT_HOST=github|gitlab` を設定。
- **PR / MR 作成は成功するのに `list` に出てこない** — default branch は PR / MR merge 後に初めて更新される。merge 後 5 秒ほどで read 同期が反映される。
- **push で削除した tag がローカルに残っている** — `fetch --prune-tags` が同期時に走るので通常は自動解消。解消しない場合はサーバー停止 → `rm -rf` で storage 削除 → 再起動。
