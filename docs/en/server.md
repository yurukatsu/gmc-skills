# Server Reference

> 🇯🇵 [日本語版](../ja/server.md)

The server is a small Hono app. It exposes an HTTP API and persists SKILLs either to the local filesystem (Phase 1 / dev) or to a Git monorepo (production).

## Running

```bash
cd server
npm install
GMC_SKILLS_TOKEN=<shared-token> npm run dev
# OR after npm run build:
GMC_SKILLS_TOKEN=<shared-token> npm run start
```

Port defaults to `8787` (override via `PORT`).

## Environment variables

### Core (always applicable)

| Variable | Default | Meaning |
|---|---|---|
| `GMC_SKILLS_TOKEN` | — (required) | Shared Bearer token accepted on publish/unpublish requests. |
| `PORT` | `8787` | HTTP port. |
| `GMC_SKILLS_STORAGE` | `./registry-storage` | Working directory for storage. In git mode this is the clone. |
| `GMC_SKILLS_STATS_FILE` | `<GMC_SKILLS_STORAGE>/.gmc-stats.json` | Download-counter persistence file. Local-only (never committed to the Git registry). |

### Git mode (all optional — absence of `GMC_SKILLS_GIT_REPO` = filesystem mode)

| Variable | Default | Meaning |
|---|---|---|
| `GMC_SKILLS_GIT_REPO` | — | Git remote URL. Token can be embedded (`https://x-access-token:<TOKEN>@host/path.git`). Presence of this var switches to git mode. |
| `GMC_SKILLS_GIT_BRANCH` | `main` | Default branch to push to / track as latest. |
| `GMC_SKILLS_GIT_AUTHOR_NAME` | `gmc-skills-server` | Committer name. |
| `GMC_SKILLS_GIT_AUTHOR_EMAIL` | `gmc-skills@localhost` | Committer email. |
| `GMC_SKILLS_PUBLISH_MODE` | `direct` | `direct` = commit + tag + push to default branch. `pr` = open pull/merge request. |
| `GMC_SKILLS_GIT_HOST` | auto | Force host kind (`github` or `gitlab`). Required only when hostname is not `github.com`/`gitlab.com` (self-hosted, IP, etc). |
| `GMC_SKILLS_HOST_TOKEN` | URL-embedded | API token for host. Use when you don't want to put it in `GMC_SKILLS_GIT_REPO`. |
| `GMC_SKILLS_HOST_API_BASE` | auto | Override the API base URL. Needed for path-prefix GitLab, reverse proxies, non-standard ports. |
| `GMC_SKILLS_GITHUB_TOKEN` | — | Legacy alias for `GMC_SKILLS_HOST_TOKEN` (still accepted). |

## Storage modes

### Filesystem mode

Set no `GMC_SKILLS_GIT_REPO`. Skills live at:

```
<GMC_SKILLS_STORAGE>/skills/<owner>/<name>/<version>/SKILL.md
```

`<owner>` is the GitLab account name (e.g. `gm2101111`). Good for local dev. No Git, no auth beyond the shared token.

### Git mode (tag-based layout)

Set `GMC_SKILLS_GIT_REPO` to a Git URL. The server clones the repo to `GMC_SKILLS_STORAGE` on startup. Layout:

- **Default branch** holds the latest version of every skill at `skills/<owner>/<name>/SKILL.md` (no version subdirectories under the name).
- Each published version is a **git tag** `<owner>/<name>@<version>`.
- Per-version download uses `git archive <tag>:skills/<owner>/<name>/` — older versions never have to sit on disk.

**Constraints:**

- Publishes must be **monotonically increasing**: a new version must be greater than the current latest. Back-ports are rejected with `409 SKILL_VERSION_NOT_MONOTONIC`.
- The latest version cannot be removed by itself — publish a newer version first, or use `unpublish --all`.
- External pushes (e.g. PR merges via the web UI) propagate to read endpoints within 5 seconds (read-side `git fetch` has a 5 s TTL).

The remote must exist and have at least one commit on the target branch (seed with a `README.md`).

## Publish modes

### `direct` (default)

`publish` writes to `skills/<owner>/<name>/` on the default branch, commits, tags, and pushes in a single operation. The committer is the `GMC_SKILLS_GIT_AUTHOR_*` pair; the author is whoever the CLI identified via `X-User-Email` / `X-User-Name`.

### `pr` (GitHub + GitLab)

Instead of pushing to the default branch, the server:

1. Creates a worktree + branch `gmc-publish/<owner>/<name>/<version>` starting from the default branch.
2. Writes the skill content, commits with the user's author, tags `<owner>/<name>@<version>`, and pushes branch + tag.
3. Opens a pull request (GitHub) or merge request (GitLab) via the host API.
4. Returns the PR/MR URL in the HTTP response; the CLI prints it.

A human (or auto-merge) merges the PR to update the default branch. The tag exists immediately, so `install <owner>/<name>@<version>` works before the merge. `unpublish` is always direct (PR mode is not supported for deletions).

## Supported Git hosts

| Host | URL auto-detected | Notes |
|---|---|---|
| `github.com` | yes | Uses `https://api.github.com`. Only 2-level paths (`owner/repo`). |
| `gitlab.com` | yes | Uses `https://gitlab.com/api/v4`. Nested groups OK. |
| Self-hosted GitHub Enterprise | set `GMC_SKILLS_GIT_HOST=github` | API base becomes `<scheme>://<host>/api/v3`. |
| Self-hosted GitLab (hostname) | set `GMC_SKILLS_GIT_HOST=gitlab` | API base becomes `<scheme>://<host>/api/v4`. |
| Self-hosted GitLab (IP address) | set `GMC_SKILLS_GIT_HOST=gitlab` | Scheme + port + IP are preserved in API base. HTTP is supported. |
| Path-prefix / reverse-proxy / custom port | set `GMC_SKILLS_HOST_API_BASE` | Required when the API is not at `<scheme>://<host>/api/v4`. |

## Example deployments

### GitHub direct mode

```bash
GMC_SKILLS_TOKEN=<shared> \
GMC_SKILLS_GIT_REPO=https://x-access-token:<GH_PAT>@github.com/<org>/gmc-skills-registry.git \
GMC_SKILLS_STORAGE=/var/lib/gmc-skills/workdir \
npm run start
```

### GitHub PR mode

```bash
GMC_SKILLS_TOKEN=<shared> \
GMC_SKILLS_GIT_REPO=https://x-access-token:<GH_PAT>@github.com/<org>/gmc-skills-registry.git \
GMC_SKILLS_PUBLISH_MODE=pr \
GMC_SKILLS_STORAGE=/var/lib/gmc-skills/workdir \
npm run start
```

### Self-hosted GitLab (IP, HTTP)

```bash
GMC_SKILLS_TOKEN=<shared> \
GMC_SKILLS_GIT_REPO=http://oauth2:<GL_PAT>@10.0.0.5/<group>/<repo>.git \
GMC_SKILLS_GIT_HOST=gitlab \
GMC_SKILLS_PUBLISH_MODE=pr \
GMC_SKILLS_STORAGE=/var/lib/gmc-skills/workdir \
npm run start
```

### GitLab behind a reverse proxy

```bash
GMC_SKILLS_TOKEN=<shared> \
GMC_SKILLS_GIT_REPO=https://oauth2:<GL_PAT>@corp.example.com/gitlab/<group>/<repo>.git \
GMC_SKILLS_GIT_HOST=gitlab \
GMC_SKILLS_HOST_API_BASE=https://corp.example.com/gitlab/api/v4 \
GMC_SKILLS_PUBLISH_MODE=pr \
npm run start
```

## API endpoints

All endpoints return JSON.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | — | Liveness. |
| `GET` | `/skills` | — | Paginated list (latest per skill). Query: `?q=`, `?owner=`, `?tag=`, `?sort=name\|downloads\|updated` (default `name`), `?order=asc\|desc` (natural: `name=asc`, others `desc`), `?page=N` (default 1), `?per_page=M` (default 20, max 100; `?limit=` is a legacy alias). Response: `{ items, total, page, per_page, pages }`. |
| `GET` | `/skills/:owner/:name` | — | Latest metadata for the skill, with `versions[]`. |
| `GET` | `/skills/:owner/:name/:version` | — | Specific version metadata. |
| `GET` | `/skills/:owner/:name/:version/readme` | — | Raw markdown body of `SKILL.md` (text/markdown). |
| `GET` | `/skills/:owner/:name/:version/files` | — | JSON tree of the skill's files (`{ tree: FileNode[] }`). Cap: depth 10, 500 files. |
| `GET` | `/skills/:owner/:name/:version/file?path=<rel>` | — | File contents. `text/plain` for text, or JSON `{ binary: true, size }` for binaries. 1 MiB max. Path traversal rejected. |
| `GET` | `/skills/:owner/:name/:version/download` | — | tar.gz of that version. |
| `PUT` | `/skills/:owner/:name/:version` | Bearer | Publish. Body: gzip tarball. Headers: `X-User-Email`, `X-User-Name`. Returns the new `SkillVersion` (plus `prUrl` in PR mode). |
| `DELETE` | `/skills/:owner/:name/:version` | Bearer | Unpublish one version. |
| `DELETE` | `/skills/:owner/:name` | Bearer | Unpublish all versions. |

## Deploy with Docker Compose

A `Dockerfile` (`server/Dockerfile`) and a root-level `docker-compose.yml` are included.

```bash
cp .env.example .env    # edit GMC_SKILLS_TOKEN, GMC_SKILLS_GIT_REPO, etc.
docker compose up -d --build
docker compose logs -f gmc-skills-server
```

The image is a multi-stage build on `node:22-alpine`:

- Build stage runs `npm ci` + `tsc`, then prunes dev deps.
- Runtime stage adds `git` (for `simple-git` + `git archive`), `ca-certificates`, `tini` (PID 1), and a non-root `gmc` user.
- HEALTHCHECK hits `/health` every 30 s via a tiny inline Node script (no extra binary needed).

Persistence uses a single named volume `gmc-data` mounted at `/var/lib/gmc-skills` that holds:

- `workdir/` — the cloned registry monorepo
- `stats.json` — download counters

Override `GMC_SKILLS_HOST_PORT` in `.env` if 8787 is already taken on the host.

A commented-out `redis` service block is included in the compose file — uncomment it when migrating counters to the Redis backend (Phase 6+ / multi-instance).

## Web UI

The server exposes a read-only browsing UI at the root path:

- `GET /` — catalogue (all skills, search + filter)
- `GET /ui/:owner/:name` — skill detail with version history and download links
- `GET /assets/style.css` and `GET /assets/app.js` — styling / client script

The UI is public (no auth) — intended for internal browsing. All destructive actions still require the bearer token via the JSON API.

Language is auto-detected from `Accept-Language`; toggle explicitly with `?lang=en` or `?lang=ja`. Dark/light/auto themes cycle via the button in the top-right and persist in `localStorage`. Download links on the detail page fire the existing `/skills/:owner/:name/:version/download` endpoint, so UI clicks and CLI `install`s both increment the same counter.

Download counts are persisted to `GMC_SKILLS_STATS_FILE` (debounced writes). Delete the file to reset.

The server keeps an **in-memory skill index** (`SkillIndex`) that mirrors `storage.list()` output. Reads use this cache; the disk / git walk happens at most every 5 seconds (TTL) or immediately after writes. This keeps list/search fast even at thousands of entries. Rebuilt on startup. External git pushes still appear within the 5 s TTL.

Sort chips on the list page let users order by name (A→Z by default), total downloads, or last updated time. Click an already-active chip to flip the direction (asc ↔ desc); the arrow on the chip reflects the current order. Detail pages render the `SKILL.md` body as HTML (via `marked`) with a small sanitizer that strips `<script>`/`<style>`/`on*` handlers — internal content is trusted, but this is defence in depth.

## Troubleshooting

- **Startup error: `Git workdir … is not empty and not a git clone`** — the storage dir has unrelated files. Remove it or point `GMC_SKILLS_STORAGE` elsewhere.
- **`PR mode requires a GitHub or GitLab repo URL`** — hostname wasn't recognized. Set `GMC_SKILLS_GIT_HOST=github|gitlab`.
- **PR/MR creation succeeds but no skill shows up on `list`** — the default branch only updates after the PR/MR is merged. Wait ~5 s after merge; the read-side sync picks it up.
- **Stale tags after you pushed a deletion** — `fetch --prune-tags` runs on every sync, so this should self-heal. If it doesn't, re-create the workdir (stop server, `rm -rf` storage, restart).
