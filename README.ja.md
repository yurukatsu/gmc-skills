# gmc-skills

[Anthropic Agent Skills](https://github.com/anthropics/skills) を社内で共有するためのレジストリと CLI。[skills.sh](https://skills.sh) や [vercel-labs/skills](https://github.com/vercel-labs/skills) をモデルにしています。

🌐 **Language**: [English](README.md) · 日本語

📚 **ユーザーガイド**: [English](docs/en/getting-started.md) · [日本語](docs/ja/getting-started.md)

## コンポーネント

- [cli/](cli/) — `gmc-skills` CLI (`npm install git+<host>/cli.git` でインストール可)
- [server/](server/) — HTTP レジストリサーバー (Node.js + Hono)
- [examples/sample-skill/](examples/sample-skill/) — publish スモークテスト用のサンプル SKILL

CLI は HTTP でサーバーと通信します。サーバーは SKILL をローカルのファイルシステム (開発用) または Git モノレポ (本番用) に保存します。

## クイックスタート (ローカル開発)

### 1. サーバーを起動

**Filesystem モード** (Git 不要、ローカル保存のみ):

```bash
cd server
npm install
GMC_SKILLS_TOKEN=dev-token npm run dev
# http://localhost:8787 で待ち受け
```

**Git モード** (SKILL を Git モノレポに保存、publish/delete のたびに commit):

```bash
cd server
npm install
GMC_SKILLS_TOKEN=dev-token \
GMC_SKILLS_GIT_REPO=https://<user>:<pat>@github.com/<org>/gmc-skills-registry.git \
GMC_SKILLS_GIT_BRANCH=main \
GMC_SKILLS_GIT_AUTHOR_NAME="gmc-skills-server" \
GMC_SKILLS_GIT_AUTHOR_EMAIL="gmc-skills@example.com" \
GMC_SKILLS_STORAGE=/var/lib/gmc-skills/workdir \
GMC_SKILLS_PUBLISH_MODE=direct \
npm run dev
```

**PR モード** (default branch に直接 commit せず、pull / merge request を作成 — GitHub と GitLab 両対応):

```bash
cd server
npm install

# GitHub (URL から host 自動検出)
GMC_SKILLS_TOKEN=dev-token \
GMC_SKILLS_GIT_REPO=https://x-access-token:<gh-pat>@github.com/<org>/gmc-skills-registry.git \
GMC_SKILLS_GIT_AUTHOR_NAME="gmc-skills-server" \
GMC_SKILLS_GIT_AUTHOR_EMAIL="gmc-skills@example.com" \
GMC_SKILLS_STORAGE=/var/lib/gmc-skills/workdir \
GMC_SKILLS_PUBLISH_MODE=pr \
npm run dev

# GitLab SaaS (URL から host 自動検出)
GMC_SKILLS_GIT_REPO=https://oauth2:<gitlab-pat>@gitlab.com/<group>/gmc-skills-registry.git \
GMC_SKILLS_PUBLISH_MODE=pr \
...

# 社内 GitLab (hostname は自動判定できないので host を明示)。
# ホスト名でも IP アドレスでも、HTTP でも HTTPS でも、ポート付きでも対応。
# URL の scheme + host (ポート込み) がそのまま API base に使われる。例:
# http://10.0.0.5:8443/g/s/repo.git → API base http://10.0.0.5:8443/api/v4
GMC_SKILLS_GIT_REPO=https://oauth2:<gitlab-pat>@gitlab.corp.example.com/<group>/<subgroup>/gmc-skills-registry.git \
GMC_SKILLS_GIT_HOST=gitlab \
GMC_SKILLS_PUBLISH_MODE=pr \
...

# IP アドレス指定の社内 GitLab
GMC_SKILLS_GIT_REPO=http://oauth2:<gitlab-pat>@10.0.0.5/<group>/<repo>.git \
GMC_SKILLS_GIT_HOST=gitlab \
GMC_SKILLS_PUBLISH_MODE=pr \
...
```

認証トークンの解決順:
1. `GMC_SKILLS_HOST_TOKEN` (新しい設定ではこちらを推奨)
2. `GMC_SKILLS_GIT_REPO` に埋め込まれたトークン (`https://user:TOKEN@host/...`)
3. `GMC_SKILLS_GITHUB_TOKEN` (旧名、後方互換で受け入れ)

PR モードでサーバーが行うこと:
1. 新 SKILL 内容を持つ `gmc-publish/<name>/<version>` ブランチを push
2. そのブランチ HEAD に `<owner>/<name>@<version>` tag を作成 (install-by-version はすぐ動く)
3. host の API 経由で default branch に対する PR (GitHub) または MR (GitLab) を作成
4. CLI の `publish` 出力に PR/MR URL を返す

default branch は誰か (または auto-merge) が request を merge するまで更新されません。`unpublish` は常に direct 動作。外部の web UI 上で merge した変更も 5 秒 TTL の read 側 `git fetch` で反映されます。

GitLab 固有の注意:
- ネストされたグループ (`group/subgroup/repo`) 対応。サーバーは URL エンコードされたフルパスを project ID として使います。
- ホスト名でも IP アドレスでも OK。社内サーバーなら HTTP も可 — API base は `GMC_SKILLS_GIT_REPO` の scheme とポートを継承します (例: `http://10.0.0.5:8443/...` → `http://10.0.0.5:8443/api/v4`)。
- MR 作成時に `remove_source_branch: true` を付与 — merge 時に GitLab が publish ブランチを自動削除します。
- PAT には `api` scope が必要 (MR 読み書き + ブランチ push)。
- 非標準構成 (path-prefix な GitLab、カスタム API ポート、リバースプロキシで書き換えがある等) の場合は `GMC_SKILLS_HOST_API_BASE` で API root を直接指定してください。例: `GMC_SKILLS_HOST_API_BASE=https://corp.example.com/gitlab/api/v4`。自動検出値を上書きします。

モノレポ側はあらかじめ存在し、target branch に少なくとも 1 つの commit (例: `README.md`) が必要です。サーバーは起動時に `GMC_SKILLS_STORAGE` に clone し、再起動時は fetch + `reset --hard` で remote に追従します。

**レイアウト (tag ベース、git モード):**
- SKILL は `<owner>/<name>` (例: `gm2101111/sample-skill`) で識別。複数ユーザーが同名の SKILL を持っていても衝突しない。
- `main` は各 SKILL の最新版のみを `skills/<owner>/<name>/` (name の下にバージョンサブディレクトリなし) に保持。
- publish された各バージョンは **git tag** `<owner>/<name>@<version>` で識別。
- `publish <owner>/<name>@<version>` → main の `skills/<owner>/<name>/` を上書き、commit、tag、両方 push。
- `delete <owner>/<name>@<version>` → remote tag を削除 (main は変更なし。ただし最後のバージョンだった場合は `--all` を使う必要がある)。
- `delete <owner>/<name> --all` → main から `skills/<owner>/<name>/` を削除し、`<owner>/<name>@*` tag も全て削除。
- 特定バージョンのダウンロードは `git archive <tag>:skills/<owner>/<name>/` を使用 — そのバージョンをディスクに展開する必要なし。
- **Monotonic publish のみ:** 新しいバージョンは現在の latest より大きくなければならない。back-port は 409 `SKILL_VERSION_NOT_MONOTONIC` で拒否。latest の単体 unpublish 不可 — 新バージョン publish か `--all` を使う。

### 2. CLI の設定と利用

```bash
cd cli
npm install
npm run build
npm link          # `gmc-skills` をグローバルから利用可能に

# レジストリ URL、認証トークン、identity、GitLab アカウントを保存。
# GitLab アカウントは SKILL.md に `owner:` が無いときのデフォルト owner。
gmc-skills login \
  --registry http://localhost:8787 \
  --token dev-token \
  --email you@example.com \
  --name "Your Name" \
  --gitlab-account gm2101111

# publish は SKILL の frontmatter から name + version (+ optional `owner:`) を読む。
# frontmatter に `owner` が無い場合は CLI config の gitlabAccount をデフォルトに使う。
# 同じバージョンを再 publish すると 409 → SKILL.md の version を上げる。
gmc-skills publish ../examples/sample-skill

# SKILL 識別子は常に <owner>/<name> 形式。
gmc-skills list                                      # 各 SKILL の latest 表示
gmc-skills info gm2101111/sample-skill               # latest + 全バージョン一覧
gmc-skills info gm2101111/sample-skill@0.1.0         # 特定バージョンのメタデータ

gmc-skills install gm2101111/sample-skill            # latest を ~/.claude/skills/sample-skill に install
gmc-skills install gm2101111/sample-skill@0.1.0      # 特定バージョン
gmc-skills install gm2101111/sample-skill --target opencode
gmc-skills install gm2101111/sample-skill --path ./custom-dir

gmc-skills unpublish gm2101111/sample-skill@0.1.0    # 1 バージョン削除
gmc-skills unpublish gm2101111/sample-skill --all    # 全バージョン削除
```

### Git ホストからインストール (本番相当)

```bash
npm install -g git+https://github.com/<org>/gmc-skills-cli.git
# または:
npm install -g git+http://internal-gitlab/<group>/gmc-skills-cli.git
```

## 開発

`cli/` と `server/` は独立した TypeScript パッケージで、同じ lint/format ツール構成を持ちます:

```bash
npm run lint          # ESLint (typescript-eslint strict-type-checked + stylistic-type-checked)
npm run lint:fix      # lint 違反を自動修正
npm run format        # Prettier write
npm run format:check  # Prettier check (CI 用)
npm run build         # tsc → dist/
npm run check         # lint + format:check + build (pre-commit ゲート)
```

merge 前に `npm run check` を各パッケージで実行する pre-push フックか CI ステップを追加してください。

## SKILL フォーマット

各 SKILL は `SKILL.md` を root に持つディレクトリです。frontmatter を使用:

```markdown
---
name: my-skill
owner: gm2101111              # optional。未指定時は CLI config の user.gitlabAccount が使われる
description: 検索に使う 1 行説明
version: 0.1.0
author: you@example.com
tags: [cli, productivity]
---

# My Skill

ここに使い方を書く...
```

[examples/sample-skill/SKILL.md](examples/sample-skill/SKILL.md) を参照してください。

## Install target

`gmc-skills install` は `--target` で次のコーディングエージェントに対応します:

| Target | デフォルトパス | 検証済み |
|---|---|---|
| `claude` (デフォルト) | `~/.claude/skills/` | yes |
| `opencode` | `~/.config/opencode/skills/` | placeholder — `--path` か config で上書き |
| `cline` | `~/.vscode/extensions/.cline/skills/` | placeholder |
| `codex` | `~/.codex/skills/` | placeholder |
| `gemini` | `~/.gemini/skills/` | placeholder |

`~/.gmc-skills/config.json` で任意のパスを上書き可能:

```json
{
  "registry": "http://localhost:8787",
  "token": "...",
  "defaultTarget": "claude",
  "targets": {
    "opencode": "/Users/you/opencode-skills"
  }
}
```
