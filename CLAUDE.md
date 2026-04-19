# gmc-skills

Internal SKILL registry + CLI for Anthropic Agent Skills, scoped by `<owner>/<name>`
(e.g. `gm2101111/my-skill`). Three pieces:

- **CLI** ([cli/](cli/)) — talks HTTP only, never touches Git.
- **Server** ([server/](server/)) — Hono on Node 22, owns all Git operations.
- **Monorepo** — `skills/<owner>/<name>/SKILL.md` on the default branch; each
  published version is a git tag `<owner>/<name>@<version>` (semver).

## Layout

- [server/src/](server/src/) — routes, storage, in-memory index, SSR UI.
- [server/src/ui/](server/src/ui/) — HTML SSR via custom `html` tagged template.
- [cli/src/commands/](cli/src/commands/) — one file per CLI command.
- [docs/en/](docs/en/), [docs/ja/](docs/ja/) — bilingual user docs; update both.
- [examples/sample-skill/](examples/sample-skill/) — reference SKILL for smoke tests.
- `.env.example` — full env-var matrix with comments.

## Before reporting a task done

Run `npm run check` (lint + format + build) in the package you touched. Both
`server/` and `cli/` have it. UI changes also need a hard-refresh test in the
browser since stale asset cache hides bugs.

## Detailed guidance

For human developers and operators (tech stack rationale + in-house deployment):

- [docs/en/development.md](docs/en/development.md) /
  [docs/ja/development.md](docs/ja/development.md)

For AI agents — read these on a fresh session before working in the relevant
area:

- [.claude/rules/project.md](.claude/rules/project.md) — architecture, env vars,
  storage backends, publish modes.
- [.claude/rules/ui.md](.claude/rules/ui.md) — design system (NES-pixel for
  titles, system sans for body), theming, asset cache-bust.
- [.claude/rules/style.md](.claude/rules/style.md) — TypeScript / lint / SSR
  conventions and sanitization rules.
- [.claude/rules/workflows.md](.claude/rules/workflows.md) — local smoke testing
  recipes (filesystem, git, PR mode, Docker).
- [.claude/rules/gotchas.md](.claude/rules/gotchas.md) — past traps to avoid
  (cache-busting, stacking contexts, glyph support, etc.).
