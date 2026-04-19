# Past traps to avoid

These are real bugs that bit us — re-read before working in the relevant area.

## Asset caching after server changes

CSS/JS are baked into the Node bundle as template strings. Browsers + Docker
layer caches both hide updates. The fix in place:

- `ASSET_VERSION = Date.now().toString(36)` in
  [server/src/ui/layout.ts](../../server/src/ui/layout.ts) → `?v=<id>` on every
  asset URL.
- `Cache-Control: public, max-age=10, must-revalidate` on `/assets/*` in
  [server/src/routes.ts](../../server/src/routes.ts).

When debugging "the change isn't showing": (1) hard-refresh, (2) check the
Network tab for the `?v=` query param being present and refreshed.

## Stacking-context trap (modal backdrop)

`.page` has `position: relative; z-index: 2`, which **creates a stacking
context**. A `.files-backdrop` appended to `<body>` (z-index 99) ends up
**above** the entire `.page` subtree (z-index 2 absolute), even though the
in-page expanded layout has z-index 100 within `.page`'s context. Result: the
modal goes dark and unclickable.

Fix in place: `setupFileExplorer` appends the backdrop **inside `.page`**, not
to body. Don't move it.

## Sort direction sign

`paginatedList` in [server/src/routes.ts](../../server/src/routes.ts) once had
`dir * (...) * -1`, which silently flipped asc/desc. The current correct form
is `dir * ((a.totalDownloads ?? 0) - (b.totalDownloads ?? 0))`. If you touch
sort, smoke-test all combinations of (sort key × asc/desc).

## File-viewer scrollbars

For `<pre>` to show a horizontal scrollbar, the inner block elements must
themselves be wider than the parent. Setting only `overflow: auto` on the
`<pre>` is not enough. The fix is `width: max-content; min-width: 100%` on
both `.file-viewer-body code` and `.file-viewer-body .line`.

For vertical, the flex column needs `min-height: 0` on every level
(`.file-viewer` and `.file-viewer-body`) — the default `min-height: auto`
prevents shrinking below content.

macOS hides overlay scrollbars by default. Use `overflow-x: scroll` (not
`auto`) plus `::-webkit-scrollbar` styles to force a visible bar.

## SetupFileExplorer must run before list-page early-return

The IIFE in `APP_JS` early-returns if the `entries`/`search` elements are
missing — that's the list-page guard. The detail page also lacks those
elements. So `setupFileExplorer()` and `setupCopyButtons()` are called
**before** the early-return. Don't move them after.

## Press Start 2P glyph support

Press Start 2P only ships ASCII + a small set of glyphs. Avoid `№`, `⇣`, `⤢`,
`⤡`, fleurons, etc. — use `No.`, `↓`, `⛶`, `✕`, etc. instead. For body text
this is irrelevant since it's now system sans, but for any text inside `.brand
/.title/.entry-stat .count/.card-header .stamp` (the four pixel-font holdouts)
this still applies.

## i18n + CSS arrows

When you add a `←` / `→` to an i18n string and the surrounding CSS pseudo also
inserts `◄ ` / `▶ `, you get a double-arrow visual bug. Choose one location
(prefer CSS) and keep i18n strings text-only.

## Commander reserved flag

`-V, --version` is reserved by Commander.js. The publish command uses
`-v, --as <version>` to override the SKILL's version. Don't try to add another
`--version` flag.

## Path traversal defense in depth

`sanitizeFilePath` rejects `..`, absolute paths, empty segments. Both
`FilesystemStorage.readFile` and `GitStorage.readFile` additionally re-resolve
the absolute path and check it's still under the skill dir. Keep both layers
when adding new file APIs.

## Email obfuscation in `.env.example`

A previous edit collapsed `[email protected]` (Cloudflare email
obfuscation tag inserted by some tooling). If you're regenerating
`.env.example`, double-check that any email addresses come through verbatim.
