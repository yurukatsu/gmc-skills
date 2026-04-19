# Local workflows

## Quick start (filesystem mode, no Git)

```bash
# Server
cd server
npm install
GMC_SKILLS_TOKEN=dev-token npm run dev          # http://localhost:8787

# CLI (in a second shell)
cd cli
npm install
npm run build
npm link                                        # makes `gmc-skills` global

gmc-skills login --registry http://localhost:8787 --token dev-token \
  --email you@example.com --name "You" --gitlab-account gm2101111
gmc-skills publish examples/sample-skill
gmc-skills list
gmc-skills install gm2101111/sample-skill --target claude
```

## Smoke testing recipes

The reference SKILL is [examples/sample-skill/](../../examples/sample-skill/).
For multi-version tests, copy it to `/tmp/...` and bump
`SKILL.md`'s frontmatter `version` between publishes.

`gmc-skills publish <dir> --as 0.2.0` overrides the version in `SKILL.md`
without editing the file (`-v, --as`). Don't reuse `--version` — Commander
reserves that flag.

## Git mode (local repo)

```bash
mkdir -p /tmp/gmc-git-test/remote.git && \
  git init --bare /tmp/gmc-git-test/remote.git
cd server
GMC_SKILLS_TOKEN=dev-token \
GMC_SKILLS_GIT_REPO=/tmp/gmc-git-test/remote.git \
GMC_SKILLS_GIT_AUTHOR_NAME=gmc-server \
GMC_SKILLS_GIT_AUTHOR_EMAIL=gmc@localhost \
GMC_SKILLS_STORAGE=/tmp/gmc-git-test/server-workdir \
npm run dev
```

Inspect the result with `git -C /tmp/gmc-git-test/remote.git log --oneline`.

## PR mode (real GitHub)

Needs `gh` authenticated and a sandbox repo. Set:

- `GMC_SKILLS_PUBLISH_MODE=pr`
- `GMC_SKILLS_GIT_REPO=https://github.com/<you>/<sandbox>.git`
- `GMC_SKILLS_HOST_TOKEN=<gh PAT with repo scope>`

`publish` will push `gmc-publish/<owner>/<name>/<version>` and open a PR.
Always clean up the branch+tag if the PR is closed without merging.

## Self-hosted GitLab on an IP

Set `GMC_SKILLS_GIT_HOST=gitlab` because URL detection can't infer the host
from a bare IP. Optionally `GMC_SKILLS_HOST_API_BASE=http://<ip>/api/v4`.

## Docker

```bash
docker compose up -d --build
docker compose logs -f gmc-skills-server
```

The Dockerfile is multi-stage on `node:22-alpine`, runs `tini` as PID 1, drops
to non-root `gmc` user, and includes a `HEALTHCHECK`. Storage volume is
`gmc-data:/var/lib/gmc-skills`. Always rebuild (`--build`) after server changes
so that the in-image `STYLE_CSS`/`APP_JS` and `ASSET_VERSION` update.

## Verifying UI changes in Docker

1. `docker compose up -d --build`
2. Hard-refresh browser (`Cmd/Ctrl+Shift+R`) — soft refresh keeps stale assets.
3. DevTools Network tab: `/assets/style.css?v=<id>` and `/assets/app.js?v=<id>`
   should be 200 with a fresh `<id>` after each rebuild.

## Verifying API changes

```bash
curl -sf http://localhost:8787/health
curl -s "http://localhost:8787/skills?per_page=5" | jq
curl -s "http://localhost:8787/skills/<owner>/<name>/<ver>/files" | jq
curl -s "http://localhost:8787/skills/<owner>/<name>/<ver>/file?path=SKILL.md" -i
```

For destructive endpoints add `-H "Authorization: Bearer dev-token"` and use
`-X PUT` / `-X DELETE`.
