---
name: find-gmc-skills
description: Helps users discover and install agent skills from the in-house gmc-skills registry when they ask questions like "how do I do X", "find a skill for X", "is there an internal skill that can...", or express interest in extending capabilities with internally-published skills.
---

# Find gmc-skills

This skill helps you discover and install skills from the in-house `gmc-skills`
registry — the internal SKILL distribution channel for the company. It's the
counterpart to `find-skills` (which talks to the public skills.sh marketplace),
but scoped to whatever your team has published internally.

## When to Use This Skill

Use this skill when the user:

- Asks "how do I do X" where X might be a common task an internal team handles
- Says "find a skill for X" / "is there an internal skill for X"
- Asks "can you do X" where X is a company-specific capability
- Expresses interest in extending agent capabilities with internal SKILLs
- Wants to search internal tools, runbooks, or workflows
- Mentions they wish they had help with a domain owned by another internal team

If the user is asking about **public, open-source** skills (React, Tailwind,
generic testing, etc.), prefer the `find-skills` skill instead. Use this one
when the need is clearly internal (release process, internal API, in-house
infra, company-specific runbooks).

## What is gmc-skills?

`gmc-skills` is the internal SKILL registry + CLI. It runs on a server inside
the corp network and stores SKILLs in a GitLab monorepo. Each SKILL is scoped
by `<owner>/<name>` where the owner is the publisher's GitLab account
(e.g. `gm2101111`). Each version is a git tag `<owner>/<name>@<version>`.

**Key commands:**

- `gmc-skills login --registry <url> --token <token>` — first-time auth + identity
- `gmc-skills list [--page N]` — list every skill (paginated, 50/page)
- `gmc-skills search <query>` — search by name / description / tag (`find` alias)
- `gmc-skills info <owner>/<name>` — details, all versions, install command
- `gmc-skills install <owner>/<name>[@<version>] [--target <agent>]` — install
- `gmc-skills uninstall <owner>/<name>` — remove a previously-installed SKILL

**Browse from a browser:** the registry's web UI (e.g.
`http://gmc-skills.corp.example.com/`) shows the same archive with filter chips
(by owner, by tag) and sort by name / downloads / updated date.

## How to Help Users Find Skills

### Step 1: Check that the user is logged in

`gmc-skills` needs a registry URL + bearer token + user identity in
`~/.gmc-skills/config.json`. Run `gmc-skills list` first; if it errors with
"no registry configured", walk the user through:

```bash
gmc-skills login \
  --registry <internal registry URL> \
  --token <bearer token from your ops/wiki page> \
  --email you@corp.example.com \
  --name "Your Name" \
  --gitlab-account <your gm-id>
```

The registry URL and shared token live on the internal wiki (do not commit
them to git, do not paste them in chat).

### Step 2: Understand what they need

Identify:

1. The **domain** (release process, internal API, monitoring, infra, …)
2. The **specific task** (cut a release, regenerate clients, add an alert, …)
3. Whether the team that owns this domain is likely to have published a SKILL

### Step 3: Browse the archive when possible

The web UI is the fastest way to scan what's available. If the user can open a
browser, point them at the archive URL and use:

- **Sort by downloads (desc)** — most-used SKILLs surface first
- **Filter by owner** — narrow to a specific team's GitLab account
- **Filter by tag** — narrow by domain (`release`, `api`, `monitoring`, …)
- **Sort by updated (desc)** — see what's been touched recently

### Step 4: Search from the CLI

```bash
gmc-skills search <query>
# or with filters:
gmc-skills search <query> --owner <gm-id>
gmc-skills search <query> --tag <tag>
```

Examples:

- "how do I cut a release?" → `gmc-skills search release`
- "is there one for the orders API?" → `gmc-skills search orders`
- "I need help with our CI pipeline" → `gmc-skills search pipeline`

If the user doesn't know what to search, fall back to `gmc-skills list` and
skim the descriptions.

Then drill in:

```bash
gmc-skills info <owner>/<name>
```

`info` prints the description, latest version + full version list, owner,
tags, last updated timestamp, and per-version + total download counts.

### Step 5: Verify quality before recommending

Internal SKILLs don't have GitHub stars; rely on these signals:

1. **Total downloads** — `info` shows total + per-version counts. Higher =
   more battle-tested.
2. **Owner trust** — well-known internal teams (platform, infra, devex) are
   safer than unfamiliar personal accounts. If the owner is unknown, confirm
   with the user before recommending.
3. **Update recency** — stale SKILLs (no commit for many months) may not
   reflect current internal practice. Check `Updated:` in `info`.
4. **Version maturity** — `0.x` is still iterating; `1.x+` is more stable.
   Pin to a specific version if the user needs reproducibility.

**Do not recommend a SKILL just because it appeared in search.** A name match
isn't enough — read the description and confirm it actually does what the user
needs.

### Step 6: Present options to the user

When you find relevant SKILLs, show:

1. `<owner>/<name>` and one-line description
2. Latest version, total downloads, last updated
3. Install command
4. (If browsing the web UI) the archive URL for the detail page

Example response:

```
I found a SKILL that fits: platform/release-notes (v0.3.2, 412 installs,
updated 2026-04-12). It generates release notes from a milestone's merged PRs
and posts them to the team Slack.

To install:
gmc-skills install platform/release-notes --target claude
```

### Step 7: Offer to install

If the user agrees, run the install:

```bash
gmc-skills install <owner>/<name>[@<version>] --target <agent>
```

`--target` selects the destination agent. Supported values map to:

| target     | install path                                       |
| ---------- | -------------------------------------------------- |
| `claude`   | `~/.claude/skills/<name>/` (default)               |
| `opencode` | `~/.config/opencode/skills/<name>/`                |
| `cline`    | `~/.vscode/extensions/.cline/skills/<name>/`       |
| `codex`    | `~/.codex/skills/<name>/`                          |
| `gemini`   | `~/.gemini/skills/<name>/`                         |

Other useful flags:

- `--local` — install into `./<agent-dir>/skills/` instead of `$HOME` (project-local)
- `-p, --path <path>` — custom directory, overrides `--target`

Pin to a version for reproducibility (`<owner>/<name>@<version>`); omit it to
take latest.

## Common Internal Categories

Adjust to your organisation's actual taxonomy. Examples:

| Category       | Example queries                              |
| -------------- | -------------------------------------------- |
| Release        | release, changelog, version, deploy          |
| Internal APIs  | api, sdk, client, schema                     |
| Pipelines      | pipeline, ci, cd, gitlab-ci                  |
| Monitoring    | monitor, alert, sla, slo, dashboard           |
| Infrastructure | terraform, k8s, helm, cluster                |
| Documentation  | docs, runbook, onboarding                    |
| Code Quality   | review, lint, security, compliance           |
| Onboarding     | onboarding, setup, dev-env                   |

## Tips for Effective Searches

1. **Use specific keywords**: "ingest pipeline" beats "pipeline".
2. **Try Japanese + English**: Some descriptions are bilingual; try both.
3. **Filter by owner**: If you know which team owns the domain, pass
   `--owner <gm-id>` to narrow quickly.
4. **Use the web UI for browsing**: tag chips and sort make exploration much
   faster than CLI scrolling.

## When No Skills Are Found

If nothing matches:

1. Acknowledge no SKILL matched
2. Offer to help with the task using your general capabilities
3. Suggest the user (or the team that owns the domain) author one:

```bash
gmc-skills init my-skill --dir ~/tmp
# edit ~/tmp/my-skill/SKILL.md (frontmatter + body)
gmc-skills publish ~/tmp/my-skill
```

Once published the SKILL is immediately available to everyone via
`gmc-skills install <owner>/<name>`.

Example wrap-up:

```
I searched gmc-skills for "xyz" but no internal SKILL matched. I can still
help with this task using my general capabilities — would you like to proceed?

If "xyz" is something the team handles often, the owning team could publish a
SKILL so others get it for free:
gmc-skills init xyz-skill --dir ~/tmp
# edit ~/tmp/xyz-skill/SKILL.md
gmc-skills publish ~/tmp/xyz-skill
```
