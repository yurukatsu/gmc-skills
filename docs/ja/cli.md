# CLI リファレンス

> 🇬🇧 [English](../en/cli.md)

## インストール

CLI は `gmc-skills` という bin を持つ npm パッケージです。ローカルの checkout を link するか、Git ホストから直接インストールします。

### ローカル開発 (`npm link`)

```bash
cd cli
npm install
npm run build
npm link
gmc-skills --version
```

### Git ホストからインストール (本番相当)

```bash
npm install -g git+https://github.com/<org>/gmc-skills-cli.git
# または:
npm install -g git+http://internal-gitlab/<group>/gmc-skills-cli.git
```

`prepare` フックで `tsc` が自動実行されるので、インストール直後に `gmc-skills` が使えます。

## 設定

`gmc-skills login` は `~/.gmc-skills/config.json` (mode `0600`) を生成します。環境変数 (`GMC_SKILLS_REGISTRY`、`GMC_SKILLS_TOKEN`) が設定されている場合はファイルより優先されます。

```json
{
  "registry": "http://localhost:8787",
  "token": "...",
  "defaultTarget": "claude",
  "targets": {
    "opencode": "/Users/you/opencode-skills"
  },
  "user": {
    "email": "you@example.com",
    "name": "Your Name",
    "gitlabAccount": "gm2101111"
  }
}
```

| Field | 意味 |
|---|---|
| `registry` | サーバー URL |
| `token` | publish / unpublish で送る Bearer token |
| `defaultTarget` | install / uninstall のデフォルト `--target` |
| `targets` | エージェントごとのインストール先の上書き |
| `user.email` / `user.name` | `X-User-Email` / `X-User-Name` ヘッダとして送信され、publish 時の git commit author に使われる |
| `user.gitlabAccount` | あなたの GitLab アカウント名。SKILL.md に `owner:` が無いときのデフォルト owner |

## コマンド

全コマンドは `--help` に対応しています。

### `gmc-skills login`

設定を保存します。必要なオプションだけ指定すれば OK。

```bash
gmc-skills login \
  --registry http://localhost:8787 \
  --token <shared-token> \
  --email you@example.com \
  --name "Your Name" \
  --gitlab-account gm2101111
```

`--gitlab-account` は SKILL.md の frontmatter に `owner:` が無いときに使われるデフォルト owner です。英数字と `-`/`_` が使えます (例: `gm2101111`、`yurukatsu`)。

### `gmc-skills init <name>`

`SKILL.md` テンプレート付きの新しい SKILL ディレクトリを作ります。

```bash
gmc-skills init my-skill --dir ~/work
# ~/work/my-skill/SKILL.md が作成される
```

### `gmc-skills publish [path]`

`SKILL.md` を読み、ディレクトリを tar 化してアップロードします。名前とバージョンは frontmatter から取得します。`owner` は frontmatter の `owner:` (あれば) か、無ければ CLI config の `user.gitlabAccount` を使います。どちらも無い場合はエラー。

```bash
gmc-skills publish                              # カレントを publish
gmc-skills publish ../my-skill
gmc-skills publish ../my-skill --as 0.2.0       # publish 時に SKILL.md の version を上書き
gmc-skills publish ../my-skill -v 1.0.0         # 短縮形
```

`-v, --as <version>` はレジストリに送るバージョンを上書きし、tarball 内の `SKILL.md` にも反映されます。**ディスク上の `SKILL.md` は変更されません** — CI や一時的な再 publish に便利。semver 形式必須。

サーバーが `409` を返した場合はそのバージョンがすでに存在しているので、`version:` を上げてください。git モードでは、現在の最新より小さいバージョンの publish も `SKILL_VERSION_NOT_MONOTONIC` で拒否されます (**必ず単調増加**)。

サーバーが PR モード (`GMC_SKILLS_PUBLISH_MODE=pr`) で動いている場合、PR / MR の URL が表示されます。

### `gmc-skills install <ref>`

SKILL をダウンロードして展開します。`<ref>` は `<owner>/<name>` (latest) または `<owner>/<name>@<version>`。

```bash
gmc-skills install gm2101111/my-skill                  # latest → ~/.claude/skills/my-skill
gmc-skills install gm2101111/my-skill@0.1.0            # 特定バージョン
gmc-skills install gm2101111/my-skill --target opencode
gmc-skills install gm2101111/my-skill --path ./custom  # 任意のディレクトリ
gmc-skills install gm2101111/my-skill --local          # ./.claude/skills/... (プロジェクトローカル)
```

ローカルインストールパスは `<baseDir>/<name>/` (owner はパスに含まれません)。異なる owner で同名の SKILL を両方ローカルに入れたい場合は `--path` で分けてください。

対応 target: `claude`、`opencode`、`cline`、`codex`、`gemini`。確定しているデフォルトパスは `claude` のみで、それ以外は config の `targets` か `--path` で上書きしてください。

### `gmc-skills uninstall <ref>`

ローカルにインストール済みの SKILL を削除します。`<ref>` の owner とバージョン部分は無視されます (ローカルの install パスは `<baseDir>/<name>/`)。

```bash
gmc-skills uninstall gm2101111/my-skill
gmc-skills uninstall gm2101111/my-skill --target opencode
```

### `gmc-skills list`

publish 済みの SKILL 一覧 (各 skill の latest) をページ分割表示します (デフォルト 50 件/ページ)。

```bash
gmc-skills list                      # 1 ページ目 (50 件)
gmc-skills list --page 2             # 次のページ
gmc-skills list --per-page 20        # 1 ページあたりの件数 (サーバー最大 100)
```

複数ページある場合、末尾にページ概要と `--page N` ヒントを表示:

```
gm2101111/my-skill   0.2.0   Short description (+1 older)  42 DL
gm2102222/utils      1.0.0   …                              12 DL

  page 1 / 5  (1–50 of 237)  — next: --page 2
```

> JSON API (`GET /skills`) は `?page=N&per_page=M` (デフォルト `page=1, per_page=20`、最大 `per_page=100`) に加え、`?sort=name|downloads|updated` と `?order=asc|desc` も受け付けます。デフォルト: `name=asc`、`downloads=desc`、`updated=desc`。同値時は `<owner>/<name>` の辞書順でフォールバック。レスポンスは `{ items, total, page, per_page, pages }` の形式。

### `gmc-skills search [query]` (alias: `find`)

レジストリ検索。自由入力クエリ (owner / name / description / tag に部分一致) と構造化フィルタを併用できます。`query`、`--owner`、`--tag` のうち少なくとも 1 つは必須 — 全件一覧は `list` を使ってください。

```bash
gmc-skills search git                              # テキスト検索
gmc-skills find git                                # 同じ (alias)
gmc-skills search --owner gm2101111                # gm2101111 が owner の全 SKILL
gmc-skills search --tag cli                        # tag "cli" を持つ全 SKILL
gmc-skills search --owner gm2101111 --tag cli      # 両方満たす (AND)
gmc-skills search git --owner gm2101111            # クエリ + フィルタ
gmc-skills search --tag cli --limit 20             # 先頭 N 件
```

オプション:

| Option | 意味 |
|---|---|
| `-o, --owner <account>` | owner の完全一致フィルタ |
| `-T, --tag <tag>` | tag の完全一致フィルタ (1 つ) |
| `-l, --limit <n>` | 最大 N 件 (正の整数) |

### `gmc-skills info <ref>`

メタデータを表示します。`<owner>/<name>` で latest + 全バージョン一覧 + 合計ダウンロード数、`<owner>/<name>@<version>` で特定バージョンの詳細 + そのバージョンのダウンロード数。

### `gmc-skills unpublish <ref>`

レジストリからバージョンを削除します。`--all` で全バージョン削除。

```bash
gmc-skills unpublish gm2101111/my-skill@0.1.0     # 1 バージョンだけ削除
gmc-skills unpublish gm2101111/my-skill --all     # 全部削除
```

git モードでは **latest の単体削除は不可** — 新しいバージョンを publish するか、`--all` を使ってください。

## SKILL.md フォーマット

```markdown
---
name: my-skill              # lowercase、英数字 + -/_
owner: gm2101111            # optional。未指定時は CLI config の user.gitlabAccount が使われる
description: 検索に使う 1 行説明
version: 0.1.0              # semver
author: you@example.com     # optional
tags: [cli, productivity]   # optional
---

# my-skill

ここに使い方を書く...
```

必須は `name`、`description`、`version` のみ。`owner` は publish 時に frontmatter (あれば) または CLI config の `user.gitlabAccount` から解決されます。
