# gmc-skills

Internal registry and CLI for [Anthropic Agent Skills](https://github.com/anthropics/skills), modeled after [skills.sh](https://skills.sh) and [vercel-labs/skills](https://github.com/vercel-labs/skills).

🌐 **Language**: English · [日本語](README.ja.md)

📚 **User guides**: [English](docs/en/getting-started.md) · [日本語](docs/ja/getting-started.md)

## Components

- [cli/](cli/) — `gmc-skills` CLI (installable via `npm install git+<host>/cli.git`)
- [server/](server/) — HTTP registry server (Node.js + Hono)
- [examples/sample-skill/](examples/sample-skill/) — example SKILL used for publish smoke test

The CLI talks to the server over HTTP. The server stores SKILL tarballs in a local directory (Phase 1) or a Git monorepo (Phase 2, planned).

## Quick start (local dev)

### 1. Start the server

**Filesystem mode** (Phase 1 — SKILLs stored locally, no Git):

```bash
cd server
npm install
GMC_SKILLS_TOKEN=dev-token npm run dev
# Listening on http://localhost:8787
```

**Git mode** (SKILLs stored in a Git monorepo, commits on every publish/delete):

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

**PR mode** (publish opens a pull/merge request instead of committing to the default branch directly — works on both GitHub and GitLab):

```bash
cd server
npm install

# GitHub example (host auto-detected from URL)
GMC_SKILLS_TOKEN=dev-token \
GMC_SKILLS_GIT_REPO=https://x-access-token:<gh-pat>@github.com/<org>/gmc-skills-registry.git \
GMC_SKILLS_GIT_AUTHOR_NAME="gmc-skills-server" \
GMC_SKILLS_GIT_AUTHOR_EMAIL="gmc-skills@example.com" \
GMC_SKILLS_STORAGE=/var/lib/gmc-skills/workdir \
GMC_SKILLS_PUBLISH_MODE=pr \
npm run dev

# GitLab SaaS example (host auto-detected from URL)
GMC_SKILLS_GIT_REPO=https://oauth2:<gitlab-pat>@gitlab.com/<group>/gmc-skills-registry.git \
GMC_SKILLS_PUBLISH_MODE=pr \
...

# Self-hosted GitLab (host NOT inferred from hostname — set it explicitly).
# Works for hostnames OR IP addresses, HTTP or HTTPS, with or without a port.
# The scheme + host (including port) are reused as the API base, e.g.
# http://10.0.0.5:8443/g/s/repo.git → API base http://10.0.0.5:8443/api/v4
GMC_SKILLS_GIT_REPO=https://oauth2:<gitlab-pat>@gitlab.corp.example.com/<group>/<subgroup>/gmc-skills-registry.git \
GMC_SKILLS_GIT_HOST=gitlab \
GMC_SKILLS_PUBLISH_MODE=pr \
...

# Self-hosted GitLab with IP address
GMC_SKILLS_GIT_REPO=http://oauth2:<gitlab-pat>@10.0.0.5/<group>/<repo>.git \
GMC_SKILLS_GIT_HOST=gitlab \
GMC_SKILLS_PUBLISH_MODE=pr \
...
```

Auth token precedence:
1. `GMC_SKILLS_HOST_TOKEN` (generic, preferred for new configs)
2. Token embedded in `GMC_SKILLS_GIT_REPO` (e.g. `https://user:TOKEN@host/...`)
3. `GMC_SKILLS_GITHUB_TOKEN` (legacy name, still accepted)

In PR mode the server:
1. Pushes a branch `gmc-publish/<name>/<version>` with the new skill content
2. Creates a tag `<owner>/<name>@<version>` on that branch head (install-by-version works right away)
3. Opens a PR (GitHub) or MR (GitLab) to the default branch via the host's API
4. Returns the PR/MR URL in the CLI's `publish` output

The default branch only updates when a human (or auto-merge) merges the request. `unpublish` is always direct. Reads are refreshed from origin on a 5-second TTL so merges done on the web UI show up shortly after.

GitLab notes:
- Nested groups are supported (`group/subgroup/repo`); the server uses the URL-encoded full path as the project ID.
- Hostnames and IP addresses are both supported. HTTP is OK for internal servers — the API base inherits the scheme and port from `GMC_SKILLS_GIT_REPO` (e.g. `http://10.0.0.5:8443/...` → `http://10.0.0.5:8443/api/v4`).
- `remove_source_branch: true` is set on MR creation — GitLab deletes the publish branch automatically on merge.
- PAT needs `api` scope (read/write MR + push to branches).
- For non-standard setups (path-prefix GitLab, custom API port, reverse-proxy rewrites) set `GMC_SKILLS_HOST_API_BASE` to the full API root, e.g. `GMC_SKILLS_HOST_API_BASE=https://corp.example.com/gitlab/api/v4`. This overrides the auto-derived value.

The monorepo must already exist and have at least one commit on the target branch (seed with a `README.md`). On startup the server clones into `GMC_SKILLS_STORAGE`, and on subsequent restarts it fetches + `reset --hard` to the remote.

**Layout (tag-based, git mode):**
- Each skill is identified by `<owner>/<name>` (e.g. `gm2101111/sample-skill`) so two users can reuse the same local name without collision.
- `main` always holds the latest version of every skill at `skills/<owner>/<name>/` (no version subdirectories under the name).
- Each published version is marked by a **git tag** named `<owner>/<name>@<version>`.
- `publish <owner>/<name>@<version>` → overwrites `skills/<owner>/<name>/` on main, commits, tags, pushes both.
- `delete <owner>/<name>@<version>` → deletes the remote tag (main is unchanged unless this was the last version, in which case you must use `--all` instead).
- `delete <owner>/<name> --all` → removes `skills/<owner>/<name>/` from main and deletes every `<owner>/<name>@*` tag.
- Download of a specific version uses `git archive <tag>:skills/<owner>/<name>/` — the version never needs to be materialized on disk.
- **Monotonic publishes only:** a new version must be greater than the current latest. Back-port publishes are rejected with 409 `SKILL_VERSION_NOT_MONOTONIC`. The latest version cannot be unpublished individually — publish a newer one first, or use `--all`.

### 2. Configure and use the CLI

```bash
cd cli
npm install
npm run build
npm link          # makes `gmc-skills` available globally for testing

# Save registry URL, auth token, identity, and GitLab account (the account is
# used as the default <owner> for publishes when SKILL.md doesn't specify one).
gmc-skills login \
  --registry http://localhost:8787 \
  --token dev-token \
  --email you@example.com \
  --name "Your Name" \
  --gitlab-account gm2101111

# Publish reads name + version (+ optional `owner:`) from SKILL.md's frontmatter.
# Owner falls back to the CLI config's gitlabAccount if not in frontmatter.
# Re-publishing the same version returns 409 — bump the version in SKILL.md.
gmc-skills publish ../examples/sample-skill

# Skills are identified by <owner>/<name> everywhere.
gmc-skills list                                     # latest version per skill
gmc-skills info gm2101111/sample-skill              # latest + full versions list
gmc-skills info gm2101111/sample-skill@0.1.0        # specific version's metadata

gmc-skills install gm2101111/sample-skill           # installs latest to ~/.claude/skills/sample-skill
gmc-skills install gm2101111/sample-skill@0.1.0     # installs a specific version
gmc-skills install gm2101111/sample-skill --target opencode
gmc-skills install gm2101111/sample-skill --path ./custom-dir

gmc-skills unpublish gm2101111/sample-skill@0.1.0   # remove one version
gmc-skills unpublish gm2101111/sample-skill --all   # remove every version
```

### Install from a Git host (production-style)

```bash
npm install -g git+https://github.com/<org>/gmc-skills-cli.git
# or:
npm install -g git+http://internal-gitlab/<group>/gmc-skills-cli.git
```

## Development

Both `cli/` and `server/` are independent TypeScript packages with identical lint/format tooling:

```bash
npm run lint          # ESLint (typescript-eslint strict-type-checked + stylistic-type-checked)
npm run lint:fix      # Auto-fix lint violations
npm run format        # Prettier write
npm run format:check  # Prettier check (used in CI)
npm run build         # tsc → dist/
npm run check         # lint + format:check + build (pre-commit gate)
```

Add a pre-push hook or CI step that runs `npm run check` in each package before merging.

## SKILL format

Each SKILL is a directory with `SKILL.md` at the root using frontmatter:

```markdown
---
name: my-skill
owner: gm2101111              # optional; falls back to CLI config's user.gitlabAccount
description: One-line description used for search
version: 0.1.0
author: you@example.com
tags: [cli, productivity]
---

# My Skill

Instructions here...
```

See [examples/sample-skill/SKILL.md](examples/sample-skill/SKILL.md).

## Install targets

`gmc-skills install` supports these coding agents via `--target`:

| Target | Default path | Verified |
|---|---|---|
| `claude` (default) | `~/.claude/skills/` | yes |
| `opencode` | `~/.config/opencode/skills/` | placeholder — override with `--path` or config |
| `cline` | `~/.vscode/extensions/.cline/skills/` | placeholder |
| `codex` | `~/.codex/skills/` | placeholder |
| `gemini` | `~/.gemini/skills/` | placeholder |

Override any path via `~/.gmc-skills/config.json`:

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
