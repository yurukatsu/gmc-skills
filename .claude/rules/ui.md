# UI design system

The web UI is server-side rendered HTML with a CSS string and a JS string both
embedded in [server/src/ui/assets.ts](../../server/src/ui/assets.ts).
[server/src/ui/layout.ts](../../server/src/ui/layout.ts) wraps every page; pages
themselves are [list.ts](../../server/src/ui/list.ts) and
[detail.ts](../../server/src/ui/detail.ts).

## SSR templating

- Custom `html` tagged template + `RawHtml` opaque type in
  [server/src/ui/html.ts](../../server/src/ui/html.ts). Auto-escapes
  interpolations; pass nested `html\`...\`` for structure. **Never** concatenate
  raw user data into HTML strings.
- i18n: `t(lang, key)` from [server/src/ui/i18n.ts](../../server/src/ui/i18n.ts).
  Always add a translation for both `EN` and `JA` when introducing a new key.
  Keep arrows/icons out of i18n strings — render them in CSS pseudo-elements
  instead, otherwise theme/layout changes give double-arrow bugs.

## Theme

Two themes plus auto:

- **Dark (default)**: NES CRT screen — near-black bg, white ink, NES red /
  blue / yellow / green accents, low-opacity scanlines.
- **Light**: Famicom cabinet cream — beige bg, ink, Famicom red.

Toggle button cycles `auto → light → dark` and persists in
`localStorage['gmc-skills.theme']`. There's an inline pre-paint script in
`layout.ts` that reads the saved theme to avoid a flash.

## Typography

Press Start 2P is reserved for **iconic title elements only** (these get
`-webkit-font-smoothing: none` so each pixel stays crisp):

- `.brand` (big arcade title with stacked drop shadow)
- `.title` (skill detail page H1)
- `.entry-stat .count` (DL count, scoreboard digit style)
- `.card-header .stamp` (small red rubber-stamp tag)

Everything else uses the system sans stack (`--body`) with antialiased
smoothing — this was a deliberate readability fix. For emphasis on body-font
labels use `font-weight: 700` + `text-transform: uppercase` + letter-spacing.

`Space Mono` (`--mono`) is the code/file-viewer font.

## Borders / dialog boxes

The shared NES dialog-box look is `4px outer border + 2px inner` rendered via
`::before`. Applied to `.masthead`, `.controls`, `.entry`, `.card`, `.ledger`,
`.files-layout`. Do not introduce new gradients or rounded corners.

## CRT effects

`body::before` (scanlines) and `body::after` (vignette) are tuned to be subtle —
`--scanline-opacity` 0.08 dark / 0.03 light. Don't crank these back up; they
hurt readability.

## Layout rules learned in practice

- **Detail page header**: use `.detail-nav` (flex row with back link + toolbar).
  Do not bring back the big `.masthead` box on detail pages — it eats vertical
  space for nothing.
- **No display delays**: don't add staggered `animation-delay` on entries; users
  found it stressful. Static reveal only. Decorative `blink` animations are also
  off — keep them off unless asked.
- **Arrows**: prefer common glyphs (`▶`, `◄`, `▲`, `▼`, `↓`, `⛶`, `✕`) and bump
  font-size on the pseudo-element when needed. Avoid `⇣`, `⤢`, `⤡`, `№` —
  they render poorly or not at all in some font stacks.

## File viewer

- Horizontal scroll requires `width: max-content; min-width: 100%` on both
  `.file-viewer-body code` and `.file-viewer-body .line` (otherwise inner
  overflow doesn't propagate to the `<pre>`'s `scrollWidth`).
- Vertical: `.file-viewer-body { flex: 1 1 0; min-height: 0; overflow-y: auto }`
  inside a column flex `.file-viewer` that itself has `min-height: 0`. Without
  the `min-height: 0` the body grows past the layout's `max-height`.
- Scrollbars are forced visible (`overflow-x: scroll` + custom
  `::-webkit-scrollbar` styles) because macOS hides overlay scrollbars.
- **Expand modal**: backdrop `<div>` is appended to `.page` (not `body`) so it
  shares the same stacking context as `.files-layout.expanded` (z-index 100 vs
  99). `.page` has `z-index: 2` which would otherwise trap the modal below a
  body-level backdrop.

## Asset cache-busting

`layout.ts` defines `ASSET_VERSION = Date.now().toString(36)` at module load and
appends `?v=<id>` to `/assets/style.css` and `/assets/app.js`. Combined with
`Cache-Control: public, max-age=10, must-revalidate` in `routes.ts`, this means
a server restart invalidates browser caches. After CSS/JS edits, **always tell
the user to hard-refresh** (`Cmd/Ctrl+Shift+R`) when verifying in Docker.

## Setup gotcha

`setupFileExplorer()` and `setupCopyButtons()` must be called **before** the
early-return in the IIFE at the top of `APP_JS` — that early-return is for the
list page (which has no `entries`/`search` element), and the detail page does
not have those elements either, so otherwise these helpers never run.
