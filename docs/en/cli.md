# CLI Reference

> 🇯🇵 [日本語版](../ja/cli.md)

## Installation

The CLI is an npm package with a `gmc-skills` bin. Install it by either linking the local checkout or installing from a Git host.

### Local development (with `npm link`)

```bash
cd cli
npm install
npm run build
npm link
gmc-skills --version
```

### Install from a Git host (production style)

```bash
npm install -g git+https://github.com/<org>/gmc-skills-cli.git
# or:
npm install -g git+http://internal-gitlab/<group>/gmc-skills-cli.git
```

The `prepare` hook runs `tsc` automatically on install, so `gmc-skills` is ready immediately.

## Configuration

`gmc-skills login` writes a JSON config at `~/.gmc-skills/config.json` (mode `0600`). Environment variables (`GMC_SKILLS_REGISTRY`, `GMC_SKILLS_TOKEN`) always win over the file.

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

| Field | Meaning |
|---|---|
| `registry` | Server URL |
| `token` | Bearer token sent on publish/unpublish |
| `defaultTarget` | Default `--target` for install/uninstall |
| `targets` | Overrides for install paths per target |
| `user.email` / `user.name` | Identity sent as `X-User-Email` / `X-User-Name`; used as the git commit author for your publishes |
| `user.gitlabAccount` | Your GitLab account name; used as the default `owner` when `SKILL.md` doesn't specify one |

## Commands

All commands accept `--help`.

### `gmc-skills login`

Save configuration. Pass any subset of options.

```bash
gmc-skills login \
  --registry http://localhost:8787 \
  --token <shared-token> \
  --email you@example.com \
  --name "Your Name" \
  --gitlab-account gm2101111
```

`--gitlab-account` sets the default `owner` used when a SKILL's frontmatter doesn't include `owner:`. Accepts any alphanumeric name with `-`/`_` (e.g. `gm2101111`, `yurukatsu`).

### `gmc-skills init <name>`

Scaffold a new SKILL directory with a `SKILL.md` template.

```bash
gmc-skills init my-skill --dir ~/work
# ~/work/my-skill/SKILL.md is created
```

### `gmc-skills publish [path]`

Read `SKILL.md`, tar up the directory, upload. Name and version come from the frontmatter. The `owner` comes from the frontmatter's `owner:` if set, otherwise from your CLI config's `user.gitlabAccount`. If neither is set, the command errors out.

```bash
gmc-skills publish                              # publishes current dir
gmc-skills publish ../my-skill
gmc-skills publish ../my-skill --as 0.2.0       # override SKILL.md's version at publish time
gmc-skills publish ../my-skill -v 1.0.0         # short form
```

`-v, --as <version>` overrides the version string sent to the registry (and written into `SKILL.md` inside the tarball). The on-disk `SKILL.md` is **not** modified — useful for CI or one-off republishes without editing source. Must be valid semver.

If the server returns `409` the version already exists — bump the `version:` field and retry. Re-publishing an older version is also rejected (`SKILL_VERSION_NOT_MONOTONIC`) in git mode — new version must be greater than the current latest.

When the server is in PR mode (`GMC_SKILLS_PUBLISH_MODE=pr`), the command prints the PR/MR URL.

### `gmc-skills install <ref>`

Download and extract a skill. `<ref>` is `<owner>/<name>` (latest) or `<owner>/<name>@<version>`.

```bash
gmc-skills install gm2101111/my-skill                  # latest → ~/.claude/skills/my-skill
gmc-skills install gm2101111/my-skill@0.1.0            # specific version
gmc-skills install gm2101111/my-skill --target opencode
gmc-skills install gm2101111/my-skill --path ./custom  # arbitrary dir
gmc-skills install gm2101111/my-skill --local          # ./.claude/skills/... (project-local)
```

Local install directory is `<baseDir>/<name>/` (owner is not in the path). If two skills from different owners share a name and you want them both installed locally, use `--path` to disambiguate.

Supported targets: `claude`, `opencode`, `cline`, `codex`, `gemini`. Only `claude` has a fully-confirmed default path; override the rest via `targets` in the config file or `--path`.

### `gmc-skills uninstall <ref>`

Remove a locally installed skill. The owner and version parts of the ref are ignored (the local install path is `<baseDir>/<name>/`).

```bash
gmc-skills uninstall gm2101111/my-skill
gmc-skills uninstall gm2101111/my-skill --target opencode
```

### `gmc-skills list`

List published skills, paginated (default 50 per page).

```bash
gmc-skills list                      # first page (50 entries)
gmc-skills list --page 2             # next page
gmc-skills list --per-page 20        # custom page size (server max 100)
```

If the registry has more than one page, a footer shows the page summary + `--page N` hint.

```
gm2101111/my-skill   0.2.0   Short description (+1 older)  42 DL
gm2102222/utils      1.0.0   …                              12 DL

  page 1 / 5  (1–50 of 237)  — next: --page 2
```

> The JSON API (`GET /skills`) accepts `?page=N&per_page=M` (default `page=1, per_page=20`, max `per_page=100`), plus `?sort=name|downloads|updated` and `?order=asc|desc`. Defaults: `name=asc`, `downloads=desc`, `updated=desc`. Ties break alphabetically by `<owner>/<name>`. Response is wrapped: `{ items, total, page, per_page, pages }`.

### `gmc-skills search [query]` (alias: `find`)

Search the registry. Accepts a free-text query (matches owner / name / description / tag) and/or structured filters. At least one of `query`, `--owner`, or `--tag` must be provided — use `list` to dump everything.

```bash
gmc-skills search git                              # text search
gmc-skills find git                                # same (alias)
gmc-skills search --owner gm2101111                # all skills owned by gm2101111
gmc-skills search --tag cli                        # all skills tagged "cli"
gmc-skills search --owner gm2101111 --tag cli      # both filters AND
gmc-skills search git --owner gm2101111            # query + filter
gmc-skills search --tag cli --limit 20             # cap results
```

Options:

| Option | Meaning |
|---|---|
| `-o, --owner <account>` | Exact-match filter on owner |
| `-T, --tag <tag>` | Exact-match filter on a single tag |
| `-l, --limit <n>` | Return at most N results (positive integer) |

### `gmc-skills info <ref>`

Show metadata. With `<owner>/<name>`, shows the latest version plus the full versions list and total download count. With `<owner>/<name>@<version>`, shows that specific version and its download count.

### `gmc-skills unpublish <ref>`

Remove a version from the registry. `--all` removes every version.

```bash
gmc-skills unpublish gm2101111/my-skill@0.1.0     # remove one version
gmc-skills unpublish gm2101111/my-skill --all     # remove all
```

In git mode the **latest** version cannot be removed individually — publish a newer one first, or use `--all`.

## SKILL.md format

```markdown
---
name: my-skill              # lowercase, alphanumeric + -/_
owner: gm2101111            # optional; falls back to CLI config's user.gitlabAccount
description: One-liner used for search
version: 0.1.0              # semver
author: you@example.com     # optional
tags: [cli, productivity]   # optional
---

# my-skill

Put instructions here...
```

Only `name`, `description`, `version` are required. `owner` is resolved at publish time from the frontmatter (if present) or the CLI config's `user.gitlabAccount` (if configured).
