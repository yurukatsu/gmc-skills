# Getting Started

> 🇯🇵 [日本語版](../ja/getting-started.md)

`gmc-skills` is an internal registry and CLI for [Anthropic Agent Skills](https://github.com/anthropics/skills). Users can `publish` a skill to a shared registry and `install` it into any coding agent (Claude Code, opencode, cline, codex, Gemini CLI).

## Architecture

```
┌───────────┐    HTTP     ┌──────────────────┐   Git push/PR   ┌────────────────────┐
│ gmc-skills│ ──────────▶ │ gmc-skills-server│ ──────────────▶ │ GitHub / GitLab    │
│   CLI     │ ◀─tarball── │  (Hono + Node)   │ ◀──── clone ──  │  monorepo          │
└───────────┘             └──────────────────┘                 └────────────────────┘
```

- **CLI** talks only HTTP — it never touches Git directly.
- **Server** owns all Git operations (clone, commit, push, PR/MR).
- **Monorepo** holds `skills/<owner>/<name>/SKILL.md` on the default branch. Each skill is identified by `<owner>/<name>` (GitLab account name + skill name) so two users can have the same local name without collision. Each published version is a git tag `<owner>/<name>@<version>`.

## Prerequisites

- Node.js 20+
- `git` on PATH (the server shells out to `git archive` for per-version downloads)
- For PR mode: a GitHub PAT (`repo` scope) or GitLab PAT (`api` scope)

## Quick start (5 minutes, filesystem mode)

This walks through the full round-trip on a single machine, with no Git required.

### 1. Start the server

```bash
cd server
npm install
GMC_SKILLS_TOKEN=dev-token npm run dev
# Listening on http://localhost:8787
```

### 2. Install the CLI globally

```bash
cd cli
npm install
npm run build
npm link   # makes `gmc-skills` available on PATH
```

### 3. Configure + publish + install

```bash
gmc-skills login \
  --registry http://localhost:8787 \
  --token dev-token \
  --email you@example.com \
  --name "Your Name" \
  --gitlab-account gm2101111      # used as default owner when SKILL.md has no `owner:` field

gmc-skills init my-first-skill --dir ~/tmp
# edit ~/tmp/my-first-skill/SKILL.md as you like

gmc-skills publish ~/tmp/my-first-skill
gmc-skills list
gmc-skills info gm2101111/my-first-skill

gmc-skills install gm2101111/my-first-skill --target claude
# → ~/.claude/skills/my-first-skill/ now contains your skill
```

Every skill in the registry is identified by `<owner>/<name>` (e.g. `gm2101111/my-first-skill`). The `owner` defaults to whatever `--gitlab-account` you set at login; you can also pin it in `SKILL.md`'s frontmatter (`owner: gm2101111`) so the skill lands in the right namespace no matter who publishes it.

## Web UI

Once the server is running, open `http://localhost:8787/` in a browser. The archive UI lets you:

- Browse all skills (numbered entries)
- Search with `/` hotkey
- Filter by owner or tag
- Sort by name / downloads / updated date (chips in the controls row)
- View version history, per-version download counts, and the rendered `SKILL.md` README on detail pages
- Browse the skill's file tree; click any file to view its source inline
- Download tarballs directly (counted the same as CLI `install`)

Toggle between English and 日本語 via the top-right, and cycle auto / light / dark theme.

## Next steps

- [CLI reference](cli.md) — every command, all options, config file format
- [Server reference](server.md) — env vars, storage modes (filesystem / git), publish modes (direct / PR/MR), UI details
