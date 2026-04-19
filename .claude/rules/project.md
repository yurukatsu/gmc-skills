# Project architecture

## Components

- **CLI** (`cli/`, package name `gmc-skills`): published as bin, HTTP-only client.
  Commands: `login`, `init`, `publish`, `install`, `uninstall`, `list`, `search`,
  `info`, `unpublish`. Config lives at `~/.gmc-skills/config.json`.
- **Server** (`server/`, package name `gmc-skills-server`): Hono on Node 22.
  Entry point `src/index.ts`. Builds the storage backend, in-memory index, and
  download stats; mounts `buildApp` (`src/routes.ts`).
- **Monorepo of skills**: GitLab/GitHub repo whose default branch holds
  `skills/<owner>/<name>/SKILL.md`. Each published version is a git tag of the
  form `<owner>/<name>@<version>` (e.g. `gm2101111/my-skill@0.1.0`).

## Identifiers

- Owner: `gm` + 7 digits (GitLab account format) **or** any allowed string the
  user passes in. Validated by `OWNER_RE` in `server/src/skill.ts`.
- Name: `^[a-z0-9][a-z0-9-_]*$`.
- Version: strict semver `x.y.z`. New versions must be > current latest
  (`NonMonotonicVersionError`). Re-publishing the same version throws
  `SkillExistsError`.

## Storage backends

`createStorage()` in [server/src/index.ts](../../server/src/index.ts) picks one:

- **FilesystemStorage** (default): `skills/<owner>/<name>/<version>/...` directory
  layout. Single-process locks via `withLock`. Good for dev / single-node Docker.
- **GitStorage** (when `GMC_SKILLS_GIT_REPO` is set): clones into
  `GMC_SKILLS_STORAGE`, commits new versions, pushes branch + tag. Reads use
  `git ls-tree`/`git show` directly. 5 s read-sync TTL (`READ_SYNC_TTL_MS`).

## Publish modes (Git only)

- `direct` (default): commit straight to default branch.
- `pr`: clone into a worktree, commit there, push branch + tag, open a PR/MR via
  `createPullRequest()` in [server/src/gitHost.ts](../../server/src/gitHost.ts).
  Supports GitHub and GitLab (incl. self-hosted GitLab via IP).

## Index + stats

- **SkillIndex** (`server/src/skillIndex.ts`): `Map<"<owner>/<name>", SkillSummary>`
  with 5 s TTL refresh and `refreshOne()` after writes. Backs all list/search
  endpoints — never call `storage.list()` directly from a route.
- **DownloadStats** (`server/src/stats.ts`): per-version counters in memory,
  debounced (200 ms) atomic-rename JSON persistence to `.gmc-stats.json`.

## Env vars (essentials)

- `GMC_SKILLS_TOKEN` (required): bearer token for write endpoints.
- `GMC_SKILLS_STORAGE`: storage root. Defaults to `./registry-storage`.
- `GMC_SKILLS_GIT_REPO`: enables GitStorage when set.
- `GMC_SKILLS_GIT_BRANCH` / `_AUTHOR_NAME` / `_AUTHOR_EMAIL`.
- `GMC_SKILLS_PUBLISH_MODE`: `direct` | `pr`.
- `GMC_SKILLS_GIT_HOST`: `github` | `gitlab` (force when auto-detect can't tell,
  e.g. self-hosted GitLab on an IP).
- `GMC_SKILLS_HOST_TOKEN`: PAT for PR mode.
- `GMC_SKILLS_HOST_API_BASE`: override API base (self-hosted GitLab).
- `GMC_SKILLS_STATS_FILE`: stats JSON path. Defaults inside storage root.
- `PORT`: HTTP port. Defaults to 8787.

Full matrix with comments lives in [.env.example](../../.env.example).

## File-tree / file-viewer endpoints

- `GET /skills/:owner/:name/:version/files` — full tree (limits in
  `server/src/storage.ts`: `MAX_TREE_DEPTH=10`, `MAX_TREE_FILES=500`).
- `GET /skills/:owner/:name/:version/file?path=...` — single file. Route stats
  first via `storage.statFile()`, then decides:
  - extension in `BINARY_EXTS` → `{ binary: true, size, path }`
  - size > `MAX_FILE_BYTES` (1 MiB) → `{ oversized: true, size, maxSize, path }`
  - otherwise reads, runs null-byte check on first 2 KiB → text or binary marker
- `BINARY_EXTS` and `isBinaryByName()` live in
  [server/src/binaryExts.ts](../../server/src/binaryExts.ts).
