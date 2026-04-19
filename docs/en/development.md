# Developer Guide

> 🇯🇵 [日本語版](../ja/development.md)

For developers hacking on the `gmc-skills` codebase and operators deploying it
inside an organisation. End-user docs live in [getting-started.md](getting-started.md).

## 1. Repository layout

```
gmc-skills/
├── server/              # Hono HTTP server (Node 22)
│   ├── src/
│   │   ├── index.ts        # Entry point (env parsing, bootstrap)
│   │   ├── routes.ts       # HTTP routes (Hono)
│   │   ├── storage.ts      # FilesystemStorage + shared types/sanitisers
│   │   ├── gitStorage.ts   # GitStorage (clone/commit/push/PR)
│   │   ├── gitHost.ts      # GitHub / GitLab API wrapper
│   │   ├── skillIndex.ts   # 5 s TTL in-memory index
│   │   ├── stats.ts        # Download counters + JSON persistence
│   │   ├── binaryExts.ts   # Binary extension list
│   │   ├── auth.ts         # Bearer-auth middleware
│   │   ├── skill.ts        # SKILL.md frontmatter parser
│   │   └── ui/             # SSR templates + CSS/JS bundles
│   ├── Dockerfile          # Multi-stage on node:22-alpine
│   ├── tsconfig.json
│   ├── eslint.config.mjs
│   └── package.json
├── cli/                 # Commander-based CLI
│   └── src/commands/       # publish/install/list/info/login/...
├── docs/{en,ja}/        # Bilingual user docs
├── examples/sample-skill/ # Reference SKILL for smoke tests
├── docker-compose.yml   # Single-instance deployment
├── .env.example         # Env-var matrix
└── CLAUDE.md            # AI agent guide
```

## 2. Tech stack

### Server (`server/`)

| Category | Choice | Version | Rationale |
|---|---|---|---|
| Runtime | Node.js | `>=22` | LTS, ships `fetch` and Web Streams |
| Language | TypeScript | `^5.6` | strict + `strictTypeChecked` |
| HTTP | [Hono](https://hono.dev) | `^4.6` | Lightweight, type-safe, Web Standards |
| Hono adapter | `@hono/node-server` | `^1.13` | Run Hono on Node |
| Git | [simple-git](https://github.com/steveukx/git-js) | `^3.27` | High-level API; raw `spawn('git show')` only for binary blob reads |
| Markdown | [marked](https://marked.js.org/) | `^14.1` | README rendering (kept as a dep though the UI no longer renders it) |
| Tarballs | [tar](https://github.com/isaacs/node-tar) | `^7.4` | Tarball create + extract |
| YAML | [yaml](https://github.com/eemeli/yaml) | `^2.6` | SKILL.md frontmatter |
| Validation | [zod](https://zod.dev) | `^3.23` | API input validation |
| Dev runner | [tsx](https://github.com/privatenumber/tsx) | `^4.19` | `npm run dev` watch mode |
| Lint | ESLint flat config + `typescript-eslint` | `^9` / `^8` | Strict ruleset |
| Format | Prettier | `^3.3` | Default config |

OS dep: `git` on PATH (`git archive` is shelled out). Bundled in the Docker image.

### CLI (`cli/`)

| Category | Choice | Version |
|---|---|---|
| Runtime | Node.js | `>=22` |
| Parser | Commander | `^12.1` |
| Tarballs | tar | `^7.4` |
| YAML | yaml | `^2.6` |
| Validation | zod | `^3.23` |

The CLI is HTTP-only; no `git` required.

### Container

- Base: `node:22-alpine`
- Multi-stage build: builder runs `npm ci` → `npm run build` → `npm prune --omit=dev`; runtime stage copies only `dist/` and `node_modules/`
- PID 1: `tini` (forwards SIGTERM)
- Non-root user `gmc`
- Volume: `/var/lib/gmc-skills`
- HEALTHCHECK: hits `/health` every 30 s

### UI

- SSR (Hono returns rendered HTML strings). `server/src/ui/html.ts` provides
  the `html` tagged template that auto-escapes interpolations.
- CSS/JS are embedded as strings in `assets.ts` and served as
  `/assets/style.css` and `/assets/app.js`.
- Fonts: Press Start 2P (titles only), system sans (body), Space Mono (code).
- `ASSET_VERSION = Date.now()` is regenerated per process start and appended as
  a `?v=` query string for cache invalidation.

## 3. Local setup

### Prerequisites

- Node.js 22+
- `git` (only required when running the server, not the CLI)
- macOS / Linux. Windows works under WSL 2.

### First-time install

```bash
git clone <this-repo>
cd gmc-skills

# Server
cd server && npm install
cd ..

# CLI
cd cli && npm install && npm run build && npm link
cd ..
```

### Day-to-day

```bash
# Server (filesystem mode)
cd server
GMC_SKILLS_TOKEN=dev-token npm run dev   # tsx watch — restarts on save

# CLI (separate shell)
gmc-skills --version
```

Browse to `http://localhost:8787/` for the web UI.

### How to verify changes

| Where you edited | How to verify |
|---|---|
| `server/src/**/*.ts` | `tsx watch` restarts; reload the browser |
| `server/src/ui/assets.ts` (CSS/JS) | After server restart, **Cmd/Ctrl+Shift+R** in the browser |
| `cli/src/**/*.ts` | `npm run build` in `cli/` — existing `npm link` picks it up |
| Docker image | `docker compose up -d --build` |

## 4. Code conventions and CI gate

Each package has `npm run check` (lint + format + build). **Run it before
declaring a task done**.

```bash
cd server && npm run check
cd cli && npm run check
```

Full conventions: [.claude/rules/style.md](../../.claude/rules/style.md).

Highlights:

- TypeScript strict + `strictTypeChecked`
- ESM, imports include the `.js` extension
- Comments only when the *why* is non-obvious
- Sanitise inputs at boundaries (`sanitizeOwner` / `sanitizeName` /
  `sanitizeVersion` / `sanitizeFilePath`)
- HTML SSR must go through the `html` tagged template — no raw string concat

## 5. Smoke testing

### Round-trip

```bash
# Server (filesystem mode)
GMC_SKILLS_TOKEN=dev-token npm --prefix server run dev

# Separate shell
gmc-skills login --registry http://localhost:8787 --token dev-token \
  --email you@example.com --name "You" --gitlab-account gm2101111
gmc-skills publish examples/sample-skill
gmc-skills list
gmc-skills info gm2101111/sample-skill
gmc-skills install gm2101111/sample-skill --target claude
```

### Git mode

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

Inspect with `git -C /tmp/gmc-git-test/remote.git log --oneline`.

### PR mode (real GitHub)

Requires authenticated `gh` CLI plus a sandbox repo:

```bash
GMC_SKILLS_PUBLISH_MODE=pr \
GMC_SKILLS_GIT_REPO=https://github.com/<you>/<sandbox>.git \
GMC_SKILLS_HOST_TOKEN=<gh PAT (repo scope)> \
GMC_SKILLS_TOKEN=dev-token \
npm --prefix server run dev
```

`publish` opens a PR. If you abandon it, clean up the branch and tag
(`refs/tags/<owner>/<name>@<version>`,
`refs/heads/gmc-publish/<owner>/<name>/<version>`) via `gh`.

## 6. Internal deployment

### Prerequisites

- Docker Engine 24+ with docker compose v2
- A dedicated monorepo on your in-house GitLab (e.g.
  `infra/gmc-skills-registry`)
  - At least one commit on the default branch (a README is fine)
  - Service account with `Maintainer` (or higher) — push is required even in
    `pr` mode
- A Personal Access Token for that account
  - Scopes: `api` (PR/MR creation) + `write_repository` (push)
  - Expiry per your security policy (90 days suggested with rotation)
- Host machine for the gmc-skills server
  - Recommended: Linux server or k8s node on the corp network
  - Egress: HTTPS (or HTTP) reachability to the GitLab server
  - Ingress: corp users can reach 8787 (or whatever the reverse proxy exposes)

### 1) Create `.env`

Start from `.env.example`:

```bash
cp .env.example .env
$EDITOR .env
```

Minimal example for an in-house GitLab on an internal IP:

```dotenv
GMC_SKILLS_TOKEN=$(openssl rand -hex 24)             # shared bearer token
GMC_SKILLS_GIT_REPO=http://oauth2:<PAT>@10.0.0.5/infra/gmc-skills-registry.git
GMC_SKILLS_GIT_HOST=gitlab                           # IP can't be auto-detected
GMC_SKILLS_PUBLISH_MODE=direct                       # or `pr` if reviews are required
GMC_SKILLS_GIT_AUTHOR_NAME=gmc-skills-server
GMC_SKILLS_GIT_AUTHOR_EMAIL=gmc-skills@corp.example.com
GMC_SKILLS_HOST_PORT=8787                            # host-side port
```

For `pr` mode also set `GMC_SKILLS_HOST_TOKEN=<PAT>` (or embed the PAT in the
URL). If your GitLab API lives behind a reverse-proxy path prefix, set
`GMC_SKILLS_HOST_API_BASE=https://gitlab.corp.example.com/gitlab/api/v4`.

`GMC_SKILLS_TOKEN` is the shared token CLI users must send. Distribute it via
your password manager / Vault, not via chat.

### 2) Build and start

```bash
docker compose up -d --build
docker compose logs -f gmc-skills-server
```

Successful boot log:

```
gmc-skills-server listening on http://localhost:8787 (git storage, direct publish)
  workdir: /var/lib/gmc-skills/workdir
  stats:   /var/lib/gmc-skills/stats.json
  index:   <N> skills cached
  web UI:  http://localhost:8787/
```

External health check:

```bash
curl -sf http://<host>:8787/health
# {"ok":true}
```

### 3) Reverse proxy + TLS

For corp HTTPS requirements, put Nginx / Caddy / Traefik in front. Caddy:

```caddyfile
gmc-skills.corp.example.com {
  reverse_proxy 127.0.0.1:8787
}
```

No WebSocket. No long polling. `/assets/*` is served with
`Cache-Control: public, max-age=10, must-revalidate` — don't add aggressive
proxy caching there or UI updates will not propagate.

### 4) Distributing the CLI

Two paths for internal users:

1. **Publish to the in-house npm registry** — `npm install -g @corp/gmc-skills`
2. **Have users clone and link** — `cd cli && npm install && npm run build && npm link`

Path (1) is recommended where an internal npm registry exists. Rename
`cli/package.json`'s `name` to `@corp/gmc-skills` before publishing.

Document the registry URL and bearer token (for `gmc-skills login`) on your
internal wiki so users don't have to ask.

### 5) Backups

Persistent state lives in the `gmc-data` Docker volume:

```
/var/lib/gmc-skills/workdir/      # GitStorage clone (regenerable)
/var/lib/gmc-skills/stats.json    # Download counters (NOT regenerable)
```

Only `stats.json` needs backing up — `workdir` can be re-cloned from GitLab.

```bash
docker run --rm -v gmc-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/gmc-stats-$(date +%F).tar.gz -C /data stats.json
```

### 6) Upgrades

```bash
git pull
docker compose up -d --build      # old container stops, builds, new starts
docker image prune -f             # remove dangling images
```

Rollback: check out the previous commit, run the same command.
`stats.json` will stay backwards-compatible going forward; if a format change
is ever required, a migration script will ship alongside.

### 7) Monitoring

- Healthcheck: built into the Dockerfile. `docker ps` shows
  `healthy`/`unhealthy` in STATUS.
- Synthetic monitoring (Pingdom / Uptime Kuma / etc.): `GET /health` every
  minute.
- Logs: `docker compose logs` reads stdout. Forward to journald / Loki / ELK
  at the host level if needed.

Notable log events:

- Boot: storage mode, cached skill count, port
- Writes (publish/unpublish): commit / tag / push / PR URL

### 8) Incident response

| Symptom | First response |
|---|---|
| `/health` returns 5xx | Read `docker compose logs`. If GitLab is unreachable, suspect egress. |
| `publish` returns 409 `SKILL_VERSION_NOT_MONOTONIC` | The client tried an older version. Run `gmc-skills info <skill>` to confirm latest. |
| `publish` returns 401/403 | `GMC_SKILLS_TOKEN` mismatch. Re-check the server `.env`. |
| Cannot push to GitLab | PAT expired or permission missing. Rotate `GMC_SKILLS_HOST_TOKEN`. |
| Disk pressure | `docker system prune`, then delete `workdir` and let the server re-clone. **Do not** use `docker compose down -v` — that drops `stats.json` too. |

## 7. References

- [Server reference (env vars)](server.md)
- [CLI reference](cli.md)
- [.claude/rules/project.md](../../.claude/rules/project.md) — architecture
- [.claude/rules/gotchas.md](../../.claude/rules/gotchas.md) — past traps
