# はじめに

> 🇬🇧 [English](../en/getting-started.md)

`gmc-skills` は [Anthropic Agent Skills](https://github.com/anthropics/skills) の社内向けレジストリと CLI です。各ユーザーが作成した SKILL を共有レジストリに `publish` し、任意のコーディングエージェント (Claude Code、opencode、cline、codex、Gemini CLI) に `install` できます。

## アーキテクチャ

```
┌───────────┐    HTTP     ┌──────────────────┐   Git push/PR   ┌────────────────────┐
│ gmc-skills│ ──────────▶ │ gmc-skills-server│ ──────────────▶ │ GitHub / GitLab    │
│   CLI     │ ◀─tarball── │  (Hono + Node)   │ ◀──── clone ──  │  monorepo          │
└───────────┘             └──────────────────┘                 └────────────────────┘
```

- **CLI** は HTTP のみ。Git 操作は一切行いません。
- **サーバー** が clone / commit / push / PR・MR 作成をすべて担当します。
- **monorepo** の default branch に `skills/<owner>/<name>/SKILL.md` が配置されます。SKILL の識別子は `<owner>/<name>` (GitLab アカウント名 + SKILL 名) なので、複数のユーザーが同じ SKILL 名を使っても衝突しません。各バージョンは git tag `<owner>/<name>@<version>` で識別されます。

## 前提

- Node.js 20 以上
- PATH に `git` (サーバーは per-version ダウンロードで `git archive` を直接呼び出します)
- PR モード利用時: GitHub PAT (`repo` scope) または GitLab PAT (`api` scope)

## クイックスタート (5 分、filesystem モード)

Git を使わず、ローカル 1 台で一通りの流れを動かす手順です。

### 1. サーバー起動

```bash
cd server
npm install
GMC_SKILLS_TOKEN=dev-token npm run dev
# http://localhost:8787 で待ち受け
```

### 2. CLI をグローバルに利用可能に

```bash
cd cli
npm install
npm run build
npm link   # `gmc-skills` が PATH 上で使えるようになる
```

### 3. ログイン → publish → install

```bash
gmc-skills login \
  --registry http://localhost:8787 \
  --token dev-token \
  --email you@example.com \
  --name "あなたの名前" \
  --gitlab-account gm2101111      # SKILL.md に owner: が無い場合のデフォルト owner

gmc-skills init my-first-skill --dir ~/tmp
# ~/tmp/my-first-skill/SKILL.md を好きに編集

gmc-skills publish ~/tmp/my-first-skill
gmc-skills list
gmc-skills info gm2101111/my-first-skill

gmc-skills install gm2101111/my-first-skill --target claude
# → ~/.claude/skills/my-first-skill/ に展開される
```

レジストリ内の SKILL は必ず `<owner>/<name>` (例: `gm2101111/my-first-skill`) で識別されます。`owner` はログイン時の `--gitlab-account` がデフォルトになります。`SKILL.md` の frontmatter に `owner: gm2101111` と明示すれば、誰が publish しても同じ namespace に入るよう固定できます。

## Web UI

サーバー起動後、ブラウザで `http://localhost:8787/` を開きます。Archive UI で以下が可能です:

- 全 SKILL 一覧 (番号付きエントリ)
- `/` キーで検索フォーカス
- owner / tag でフィルタ
- 名前順 / ダウンロード数順 / 更新日順 で並び替え (コントロール行のチップ)
- 詳細ページでバージョン履歴、バージョン別ダウンロード数、`SKILL.md` の README 本文を確認
- SKILL 内のファイルツリーを表示、ファイルをクリックするとソースをインライン表示
- tarball を直接ダウンロード (CLI の `install` と同じカウンターに加算)

右上で 日本語 / English 切替、auto / ライト / ダークテーマ切替。

## 次に読む

- [CLI リファレンス](cli.md) — 全コマンド、全オプション、設定ファイルのフォーマット
- [サーバーリファレンス](server.md) — 環境変数、storage モード (filesystem / git)、publish モード (direct / PR・MR)、UI の詳細
