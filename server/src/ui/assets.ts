export const STYLE_CSS = `
:root {
  --display: 'Press Start 2P', ui-monospace, monospace;
  --body:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'Hiragino Kaku Gothic ProN',
    'Noto Sans JP', sans-serif;
  --mono: 'Space Mono', 'IBM Plex Mono', Menlo, ui-monospace, monospace;
}

/* ─── DARK (default — NES CRT screen) ─── */
:root,
:root[data-theme='dark'] {
  --bg: #0a0a14;
  --bg-alt: #1a1a2c;
  --bg-dim: #04040c;
  --ink: #f8f8f8;
  --ink-muted: #858598;
  --ink-faint: #454558;
  --rule: #3c3c50;
  --rule-faint: #24243a;
  --stamp: #e04028;
  --stamp-hot: #fc6648;
  --accent-blue: #4078f8;
  --accent-yellow: #fcd800;
  --accent-green: #00a848;
  --scanline-opacity: 0.08;
  --vignette-strength: 0.35;
}

/* ─── LIGHT (Famicom cabinet cream) ─── */
:root[data-theme='light'] {
  --bg: #eee7cf;
  --bg-alt: #fff7dc;
  --bg-dim: #d8d0b4;
  --ink: #1a1428;
  --ink-muted: #5a5466;
  --ink-faint: #9a94a2;
  --rule: #1a1428;
  --rule-faint: #b8b0a0;
  --stamp: #c02818;
  --stamp-hot: #e04a34;
  --accent-blue: #1c48b8;
  --accent-yellow: #c48800;
  --accent-green: #006828;
  --scanline-opacity: 0.03;
  --vignette-strength: 0.12;
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
    --bg: #eee7cf;
    --bg-alt: #fff7dc;
    --bg-dim: #d8d0b4;
    --ink: #1a1428;
    --ink-muted: #5a5466;
    --ink-faint: #9a94a2;
    --rule: #1a1428;
    --rule-faint: #b8b0a0;
    --stamp: #c02818;
    --stamp-hot: #e04a34;
    --accent-blue: #1c48b8;
    --accent-yellow: #c48800;
    --accent-green: #006828;
    --scanline-opacity: 0.03;
    --vignette-strength: 0.12;
  }
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--body);
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background 0ms, color 0ms;
}

/* Press Start 2P is a raster pixel font — render it without AA so each
   pixel stays crisp. Reserved for the iconic title elements only; the rest
   of the UI uses the readable body sans. */
.brand,
.title,
.entry-stat .count,
.card-header .stamp {
  font-family: var(--display);
  -webkit-font-smoothing: none;
  -moz-osx-font-smoothing: auto;
}

/* CRT scanlines — one horizontal dark line every 3px. */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(
    to bottom,
    transparent 0,
    transparent 2px,
    rgba(0, 0, 0, var(--scanline-opacity)) 2px,
    rgba(0, 0, 0, var(--scanline-opacity)) 3px
  );
  z-index: 1;
  mix-blend-mode: multiply;
}

/* CRT vignette: edges fall off into deeper dark, mimicking a curved tube. */
body::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background: radial-gradient(
    ellipse 115% 90% at 50% 50%,
    transparent 55%,
    rgba(0, 0, 0, var(--vignette-strength)) 100%
  );
  z-index: 1;
}

a {
  color: inherit;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: color 0ms, border-color 0ms;
}
a:hover { color: var(--stamp); border-bottom-color: var(--stamp); }

.page {
  max-width: 1080px;
  margin: 0 auto;
  padding: 40px 32px 72px;
  position: relative;
  z-index: 2;
}

/* ────────────── DIALOG BOX (NES window frame) ──────────────
   Nested 4px + 2px borders, no radius, used by most containers. */
.masthead,
.controls,
.entry,
.card,
.ledger,
.files-layout {
  background: var(--bg-alt);
  border: 4px solid var(--ink);
  position: relative;
}
.masthead::before,
.controls::before,
.entry::before,
.card::before,
.ledger::before,
.files-layout::before {
  content: '';
  position: absolute;
  inset: 4px;
  border: 2px solid var(--ink);
  pointer-events: none;
  z-index: 0;
}
.masthead > *,
.controls > *,
.entry > *,
.card > *,
.ledger > * {
  position: relative;
  z-index: 1;
}

/* ──────────────── MASTHEAD (title screen) ──────────────── */

.masthead {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 32px;
  padding: 32px 28px 28px;
  margin-bottom: 28px;
}

.brand {
  font-family: var(--display);
  font-weight: 400;
  font-size: clamp(22px, 3.8vw, 40px);
  line-height: 1.25;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: var(--ink);
  text-shadow:
    4px 4px 0 var(--stamp),
    8px 8px 0 var(--rule);
  margin: 0;
  padding: 4px 0 0;
}
.brand em {
  font-style: normal;
  color: var(--stamp);
  text-shadow:
    4px 4px 0 var(--ink),
    8px 8px 0 var(--rule);
}

.subtitle {
  margin: 20px 0 0;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--ink-muted);
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.subtitle::after {
  content: '▶';
  color: var(--stamp);
  font-size: 14px;
}

@keyframes blink {
  50% { opacity: 0; }
}

.masthead-meta {
  text-align: right;
  font-size: 12px;
  color: var(--ink-muted);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  min-height: 80px;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.masthead-meta .filing {
  color: var(--bg);
  background: var(--stamp);
  border: 2px solid var(--ink);
  padding: 6px 12px;
  letter-spacing: 0.1em;
  font-size: 12px;
  font-weight: 700;
}
.masthead-meta .count {
  color: var(--ink);
  font-size: 13px;
  letter-spacing: 0.08em;
}
.masthead-meta .count strong {
  color: var(--accent-yellow);
  font-weight: 400;
}

.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
}
.toolbar a,
.toolbar button {
  appearance: none;
  background: var(--bg);
  border: 2px solid var(--ink);
  color: var(--ink);
  font-family: var(--body);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.04em;
  padding: 8px 14px;
  cursor: pointer;
  text-transform: uppercase;
  transition: none;
  line-height: 1;
}
.toolbar a:hover,
.toolbar button:hover {
  background: var(--ink);
  color: var(--bg);
  border-bottom-color: var(--ink);
}

/* ──────────────── CONTROLS ──────────────── */

.controls {
  margin: 0 0 24px;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.search {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
}
.search label {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--accent-yellow);
  text-transform: uppercase;
}
.search label::before {
  content: '▶ ';
  color: var(--stamp);
  font-size: 14px;
}
.search input {
  appearance: none;
  background: var(--bg);
  border: 2px solid var(--ink);
  padding: 8px 12px;
  font-family: var(--body);
  font-size: 16px;
  color: var(--ink);
  outline: none;
}
.search input::placeholder {
  color: var(--ink-muted);
}
.search input:focus {
  border-color: var(--stamp);
  box-shadow: 0 0 0 2px var(--stamp);
}
.search kbd {
  font-family: var(--mono);
  font-size: 12px;
  font-weight: 700;
  padding: 5px 9px;
  border: 2px solid var(--ink);
  background: var(--bg);
  color: var(--ink);
  letter-spacing: 0;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}
.filter-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 12px;
}
.filter-label {
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--accent-yellow);
  text-transform: uppercase;
}

.chip {
  appearance: none;
  background: var(--bg);
  border: 2px solid var(--ink);
  color: var(--ink);
  font-weight: 700;
  font-size: 12px;
  padding: 6px 12px;
  cursor: pointer;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  transition: none;
  line-height: 1.2;
}
.chip:hover { background: var(--ink); color: var(--bg); }
.chip[aria-pressed='true'] {
  background: var(--stamp);
  color: var(--bg);
  border-color: var(--ink);
}
.chip-sort[aria-pressed='true'][data-order='asc']::after {
  content: ' ▲';
  font-size: 1.2em;
}
.chip-sort[aria-pressed='true'][data-order='desc']::after {
  content: ' ▼';
  font-size: 1.2em;
}

/* ──────────────── ENTRIES (menu list) ──────────────── */

.entries {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.entry {
  display: grid;
  grid-template-columns: 56px 1fr auto;
  gap: 20px;
  padding: 18px 22px;
}
.entry:hover {
  background: var(--bg-dim);
}
.entry:hover::after {
  /* Cursor arrow on hover — classic JRPG menu selector. */
  content: '▶';
  position: absolute;
  left: -22px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--stamp);
  font-size: 18px;
  font-weight: 700;
}

.entry-number {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--accent-yellow);
  padding-top: 4px;
  font-variant-numeric: tabular-nums;
}

.entry-body { min-width: 0; }

.entry-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.01em;
  word-break: break-word;
}
.entry-title a { border-bottom: 0; display: inline-block; }
.entry-title .owner { color: var(--ink-muted); font-weight: 600; }
.entry-title .slash { color: var(--stamp); margin: 0 0.1em; font-weight: 700; }
.entry-title .name { color: var(--ink); }
.entry-title a:hover .name { color: var(--stamp); }

.entry-desc {
  margin: 6px 0 10px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--ink);
  max-width: 62ch;
}

.entry-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  margin: 0;
  font-size: 13px;
  color: var(--ink-muted);
}
.entry-meta dt {
  text-transform: uppercase;
  color: var(--accent-yellow);
  margin-right: 4px;
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.06em;
}
.entry-meta dd {
  margin: 0;
  color: var(--ink);
}
.entry-meta .row { display: inline-flex; align-items: baseline; gap: 6px; }

.entry-stat {
  text-align: right;
  align-self: center;
  line-height: 1;
}
.entry-stat .count {
  display: block;
  font-size: 24px;
  color: var(--accent-yellow);
  line-height: 1;
  letter-spacing: 0.02em;
  text-shadow: 2px 2px 0 var(--stamp);
}
.entry-stat .label {
  font-size: 11px;
  letter-spacing: 0.12em;
  color: var(--ink-muted);
  margin-top: 10px;
  display: block;
  text-transform: uppercase;
  font-weight: 700;
}

.empty {
  padding: 56px 0;
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  color: var(--stamp);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.error-banner {
  margin: 16px 0;
  padding: 12px 16px;
  border: 3px solid var(--stamp);
  background: var(--bg-alt);
  color: var(--stamp);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

/* ──────────────── PAGE NAV ──────────────── */

.page-nav {
  margin: 24px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  font-size: 13px;
  font-weight: 700;
}
.page-nav .chip {
  padding: 8px 16px;
  min-width: 96px;
  text-align: center;
}
.page-nav .chip[disabled] {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}
.page-indicator {
  color: var(--ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.page-indicator strong {
  color: var(--accent-yellow);
  font-weight: 700;
  font-size: 15px;
}

/* ──────────────── LEDGER / HUD ──────────────── */

.ledger {
  margin-top: 28px;
  padding: 14px 22px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--ink-muted);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  text-transform: uppercase;
}
.ledger strong {
  color: var(--accent-yellow);
  font-weight: 700;
}

/* ──────────────── DETAIL PAGE ──────────────── */

/* Detail-page header row: back link + toolbar in one compact line. */
.detail-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin: 0 0 24px;
  flex-wrap: wrap;
}

.back {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.detail-nav .back { margin: 0; }
.back a { color: var(--accent-blue); border-bottom: 0; }
.back a::before {
  content: '◄ ';
  font-size: 1.2em;
}
.back a:hover { color: var(--stamp); }

.card {
  padding: 28px 32px;
  margin-bottom: 28px;
}
/* Deprecated ornamental corners — hidden in pixel theme. */
.card .corner-br,
.card .corner-bl { display: none; }

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-muted);
  margin-bottom: 18px;
  gap: 16px;
}
.card-header .stamp {
  color: var(--bg);
  background: var(--stamp);
  border: 2px solid var(--ink);
  padding: 6px 10px;
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.1em;
  white-space: nowrap;
  transform: none;
  text-shadow: none;
  box-shadow: none;
}

.title {
  margin: 0 0 14px;
  font-family: var(--display);
  font-size: clamp(18px, 3vw, 32px);
  line-height: 1.2;
  letter-spacing: 0.02em;
  word-break: break-word;
  text-transform: uppercase;
  text-shadow: 3px 3px 0 var(--stamp);
}
.title .owner { color: var(--ink-muted); text-shadow: 3px 3px 0 var(--rule); }
.title .slash { color: var(--stamp); margin: 0 0.05em; text-shadow: 3px 3px 0 var(--ink); }
.title .name { color: var(--ink); }

.lede {
  font-family: var(--body);
  font-size: 17px;
  line-height: 1.5;
  max-width: 60ch;
  margin: 18px 0 28px;
  color: var(--ink);
}

.metadata {
  display: grid;
  grid-template-columns: 150px 1fr;
  gap: 10px 18px;
  padding: 18px 0 0;
  margin: 0;
  border-top: 2px dashed var(--rule);
  font-size: 14px;
}
.metadata dt {
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent-yellow);
  padding-top: 3px;
  font-weight: 700;
  font-size: 12px;
}
.metadata dd {
  margin: 0;
  color: var(--ink);
  word-break: break-word;
  font-family: var(--body);
  font-size: 15px;
}
.metadata code {
  font-family: var(--mono);
  font-size: 12px;
  background: var(--bg);
  padding: 4px 8px;
  border: 2px solid var(--ink);
  color: var(--stamp);
  display: inline-block;
}

/* Install command — code + COPY button joined as a single pixel-bordered field. */
.install-field {
  display: inline-flex;
  align-items: stretch;
  border: 2px solid var(--ink);
  background: var(--bg);
  max-width: 100%;
}
.install-field code {
  font-family: var(--mono);
  font-size: 13px;
  color: var(--stamp);
  background: var(--bg);
  padding: 8px 12px;
  border: 0;
  display: block;
  overflow-x: auto;
  white-space: nowrap;
  line-height: 1.2;
}
.copy-btn {
  appearance: none;
  background: var(--ink);
  color: var(--bg);
  border: 0;
  border-left: 2px solid var(--ink);
  font-family: var(--body);
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 0.08em;
  padding: 0 14px;
  cursor: pointer;
  text-transform: uppercase;
  line-height: 1;
  transition: none;
  min-width: 80px;
}
.copy-btn:hover { background: var(--stamp); }
.copy-btn.copied { background: var(--accent-green); color: var(--bg); }

/* ──────────────── SECTION HEADERS ──────────────── */

.history-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0 0 18px;
}
.history-head h2 {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.04em;
  margin: 0;
  color: var(--accent-yellow);
  text-transform: uppercase;
  font-style: normal;
}
.history-head h2::before {
  content: '▶ ';
  color: var(--stamp);
  font-size: 0.9em;
}
.history-head .line {
  flex: 1;
  height: 3px;
  background: var(--ink);
  position: relative;
}
.history-head .line::before {
  content: '';
  position: absolute;
  inset: -3px 0;
  background: repeating-linear-gradient(
    to right,
    var(--ink) 0,
    var(--ink) 6px,
    transparent 6px,
    transparent 10px
  );
  height: 3px;
  top: 0;
}
.history-head .line::after { display: none; }

/* ──────────────── VERSION HISTORY ──────────────── */

.versions {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  border: 3px solid var(--ink);
  background: var(--bg-alt);
}
.versions th {
  text-align: left;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  color: var(--accent-yellow);
  padding: 12px 14px;
  border-bottom: 2px solid var(--ink);
  background: var(--bg-dim);
}
.versions td {
  padding: 12px 14px;
  border-bottom: 1px dashed var(--rule);
  vertical-align: middle;
  font-size: 14px;
}
.versions tr:last-child td { border-bottom: 0; }
.versions tr:hover td { background: var(--bg-dim); }
.versions .v { color: var(--ink); letter-spacing: 0.02em; font-weight: 700; }
.versions .v .badge {
  display: inline-block;
  margin-left: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 3px 8px;
  background: var(--stamp);
  color: var(--bg);
  border: 2px solid var(--ink);
  text-transform: uppercase;
}
.versions .dl { color: var(--accent-yellow); text-align: right; width: 120px; font-family: var(--mono); font-size: 14px; font-weight: 700; }
.versions .dl-btn { text-align: right; width: 160px; }
.download-btn {
  font-family: var(--body);
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--bg);
  border: 2px solid var(--ink);
  padding: 9px 14px;
  background: var(--accent-green);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  line-height: 1;
  transition: none;
}
.download-btn::before {
  content: '▼';
  font-size: 14px;
  line-height: 1;
}
.download-btn:hover {
  background: var(--stamp);
  color: var(--bg);
}

@keyframes fadeUp {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ──────────────── FILE EXPLORER ──────────────── */

.files-section { margin: 40px 0 32px; }

.files-layout {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 0;
  min-height: 360px;
  max-height: 640px;
}
.files-layout > * { position: relative; z-index: 1; }

.tree {
  font-family: var(--mono);
  font-size: 12px;
  overflow: auto;
  padding: 14px 10px;
  border-right: 2px solid var(--ink);
  background: var(--bg);
}
.tree ul { list-style: none; padding: 0; margin: 0; }
.tree > ul { padding: 0; }
.tree ul ul { padding-left: 12px; border-left: 2px dashed var(--rule); margin-left: 4px; }

.tree-node {
  appearance: none;
  background: none;
  border: 0;
  padding: 4px 8px 4px 20px;
  margin: 0;
  width: 100%;
  text-align: left;
  font-family: inherit;
  font-size: inherit;
  color: var(--ink);
  cursor: pointer;
  display: block;
  position: relative;
  letter-spacing: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: none;
}
.tree-node:hover { background: var(--bg-alt); color: var(--stamp); }
.tree-node.active {
  background: var(--stamp);
  color: var(--bg);
}
.tree-node::before {
  position: absolute;
  left: 4px;
  top: 4px;
  font-size: 10px;
  width: 12px;
  text-align: center;
  color: var(--ink-muted);
}
.tree-node.dir::before { content: '▼'; }
.tree-node.dir.collapsed::before { content: '▶'; }
.tree-node.dir.collapsed + ul { display: none; }
.tree-node.file::before { content: '·'; color: var(--ink-faint); }
.tree-node.active::before { color: var(--bg); }

.tree-node .tree-node-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.tree-node .size-badge {
  float: right;
  font-size: 9px;
  letter-spacing: 0.04em;
  color: var(--ink-faint);
  padding: 1px 6px;
  margin-left: 8px;
  border: 1px solid var(--rule);
  line-height: 1.4;
  flex-shrink: 0;
  background: var(--bg-alt);
}
.tree-node.oversized .size-badge {
  color: var(--stamp);
  border-color: var(--stamp);
}
.tree-node.bin { color: var(--ink-muted); }

.file-viewer {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  position: relative;
  background: var(--bg);
}
.file-viewer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 2px solid var(--ink);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: var(--ink-muted);
  background: var(--bg-alt);
  text-transform: uppercase;
}
.file-viewer-path {
  color: var(--ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: 0.04em;
}
.file-viewer-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
.file-viewer-size {
  color: var(--ink-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  font-family: var(--mono);
}
.file-viewer-expand {
  appearance: none;
  background: var(--bg);
  border: 2px solid var(--ink);
  color: var(--ink);
  width: 32px;
  height: 28px;
  padding: 0;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  transition: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--body);
}
.file-viewer-expand:hover {
  background: var(--ink);
  color: var(--bg);
}
.file-viewer-expand[aria-pressed='true'] {
  background: var(--stamp);
  color: var(--bg);
  border-color: var(--ink);
}
.file-viewer-body {
  margin: 0;
  padding: 12px 0;
  overflow-x: scroll;
  overflow-y: auto;
  flex: 1 1 0;
  min-height: 0;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.55;
  counter-reset: line;
  background: var(--bg);
  border: 0;
  scrollbar-gutter: stable;
}
.file-viewer-body::-webkit-scrollbar {
  width: 10px;
  height: 10px;
  -webkit-appearance: none;
}
.file-viewer-body::-webkit-scrollbar-track {
  background: var(--bg-dim);
  border-top: 2px solid var(--ink);
}
.file-viewer-body::-webkit-scrollbar-thumb {
  background: var(--ink);
  border: 2px solid var(--bg-dim);
}
.file-viewer-body::-webkit-scrollbar-thumb:hover {
  background: var(--stamp);
}
.file-viewer-body::-webkit-scrollbar-corner {
  background: var(--bg-dim);
}
.file-viewer-body code {
  display: block;
  width: max-content;
  min-width: 100%;
  padding: 0;
  background: transparent;
  border: 0;
  font-size: inherit;
}
.file-viewer-body .line {
  display: block;
  width: max-content;
  min-width: 100%;
  padding: 0 16px 0 0;
  white-space: pre;
}
.file-viewer-body .line::before {
  content: counter(line);
  counter-increment: line;
  display: inline-block;
  width: 3em;
  padding-right: 12px;
  margin-right: 12px;
  text-align: right;
  color: var(--ink-faint);
  border-right: 2px solid var(--rule);
  user-select: none;
}
.file-viewer-hint {
  position: absolute;
  bottom: 10px;
  right: 16px;
  margin: 0;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-faint);
  pointer-events: none;
}
.file-viewer.loaded .file-viewer-hint { display: none; }

/* Expanded (modal) state */
.files-layout.expanded {
  position: fixed;
  inset: 40px;
  z-index: 100;
  max-height: none;
  background: var(--bg-alt);
  box-shadow: 0 0 0 4px var(--ink), 0 12px 0 8px rgba(0, 0, 0, 0.4);
}
.files-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  z-index: 99;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms steps(3);
}
.files-backdrop.visible {
  opacity: 1;
  pointer-events: auto;
}
body.files-expanded-open { overflow: hidden; }

/* ──────────────── RESPONSIVE ──────────────── */

@media (max-width: 720px) {
  .files-layout {
    grid-template-columns: 1fr;
    max-height: none;
  }
  .tree { max-height: 260px; border-right: 0; border-bottom: 2px solid var(--ink); }
}

@media (max-width: 720px) {
  .page { padding: 24px 16px 56px; }
  .masthead { grid-template-columns: 1fr; padding: 24px 20px 20px; }
  .masthead-meta { align-items: flex-start; min-height: auto; margin-top: 12px; flex-direction: row; gap: 12px; flex-wrap: wrap; text-align: left; }
  .entry { grid-template-columns: 36px 1fr; padding: 14px 16px; gap: 12px; }
  .entry-stat { grid-column: 2; text-align: left; }
  .entry-stat .count { display: inline; font-size: 16px; margin-right: 8px; }
  .entry-stat .label { display: inline; margin-top: 0; }
  .metadata { grid-template-columns: 1fr; gap: 2px 0; }
  .metadata dt { padding-top: 12px; }
  .card { padding: 24px 20px; }
  .versions .dl-btn, .versions .dl { width: auto; }
  .entry:hover::after { display: none; }
}
`;

export const APP_JS = `
(() => {
  // ─── Theme ───
  const root = document.documentElement;
  const THEME_KEY = 'gmc-skills.theme';
  const themeBtn = document.getElementById('theme-toggle');

  function applyTheme(t) {
    if (t === 'auto') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', t);
    }
    if (themeBtn) themeBtn.dataset.current = t;
    updateThemeLabel(t);
  }

  function updateThemeLabel(t) {
    if (!themeBtn) return;
    const label = themeBtn.querySelector('.theme-label');
    if (!label) return;
    const labels = { auto: themeBtn.dataset.labelAuto, light: themeBtn.dataset.labelLight, dark: themeBtn.dataset.labelDark };
    label.textContent = labels[t] || t;
  }

  const savedTheme = (() => {
    try { return localStorage.getItem(THEME_KEY); } catch { return null; }
  })();
  applyTheme(savedTheme || 'auto');

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const order = ['auto', 'light', 'dark'];
      const current = themeBtn.dataset.current || 'auto';
      const next = order[(order.indexOf(current) + 1) % order.length];
      try { localStorage.setItem(THEME_KEY, next); } catch {}
      applyTheme(next);
    });
  }

  // ─── Search / Filter ───
  const entries = document.getElementById('entries');
  const search = document.getElementById('search');
  const ledgerFirst = document.getElementById('ledger-first');
  const ledgerLast = document.getElementById('ledger-last');
  const ledgerTotal = document.getElementById('ledger-total');
  const mastheadCount = document.getElementById('masthead-count');
  const pageCurrent = document.getElementById('page-current');
  const pageTotal = document.getElementById('page-total');
  const pagePrev = document.querySelector('.page-prev');
  const pageNext = document.querySelector('.page-next');
  const ownerChips = Array.from(document.querySelectorAll('[data-filter="owner"]'));
  const tagChips = Array.from(document.querySelectorAll('[data-filter="tag"]'));
  const sortChips = Array.from(document.querySelectorAll('[data-sort]'));

  // File explorer and copy buttons run on the detail page, which has no
  // list/search — set them up before the early return below.
  setupFileExplorer();
  setupCopyButtons();

  if (!entries || !search) return;

  const labels = {
    dl: (entries.dataset.labelDl) || 'DL',
    version: (entries.dataset.labelVersion) || 'Version',
    updated: (entries.dataset.labelUpdated) || 'Updated',
    tags: (entries.dataset.labelTags) || 'Tags',
    noMatch: (entries.dataset.labelNoMatch) || '— no entries match —',
  };

  let activeOwner = null;
  let activeTag = null;
  let activeSort = entries.dataset.sort || 'name';
  let activeOrder = entries.dataset.order || (activeSort === 'name' ? 'asc' : 'desc');
  let activePage = parseInt(entries.dataset.page || '1', 10);
  let perPage = parseInt(entries.dataset.perPage || '20', 10);
  let abortCtrl = null;

  function debounce(fn, ms) {
    let t = null;
    return (...args) => {
      if (t) clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function updateChip(chip, pressed) {
    chip.setAttribute('aria-pressed', pressed ? 'true' : 'false');
  }

  function escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function pad(n) { return String(n).padStart(3, '0'); }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toISOString().slice(0, 10);
  }

  function renderEntry(s, i) {
    const tagsHtml = (s.tags || []).length
      ? '<div class="row"><dt>' + escape(labels.tags) + '</dt><dd>' +
        (s.tags.slice(0, 4).map(escape).join(' · ')) + '</dd></div>'
      : '';
    return [
      '<article class="entry" style="--index:', i, '">',
      '  <div class="entry-number">No.', pad(i + 1), '</div>',
      '  <div class="entry-body">',
      '    <h2 class="entry-title">',
      '      <a href="/ui/', encodeURIComponent(s.owner), '/', encodeURIComponent(s.name), '">',
      '        <span class="owner">', escape(s.owner), '</span><span class="slash">/</span>',
      '        <span class="name">', escape(s.name), '</span>',
      '      </a>',
      '    </h2>',
      '    <p class="entry-desc">', escape(s.description), '</p>',
      '    <dl class="entry-meta">',
      '      <div class="row"><dt>', escape(labels.version), '</dt><dd>', escape(s.version), '</dd></div>',
      '      <div class="row"><dt>', escape(labels.updated), '</dt><dd>', formatDate(s.updatedAt), '</dd></div>',
      tagsHtml,
      '    </dl>',
      '  </div>',
      '  <div class="entry-stat">',
      '    <span class="count">', (s.totalDownloads ?? s.downloads ?? 0).toLocaleString(), '</span>',
      '    <span class="label">', escape(labels.dl), '</span>',
      '  </div>',
      '</article>',
    ].join('');
  }

  function updatePaginationUI(page, pages, total) {
    if (pageCurrent) pageCurrent.textContent = String(page);
    if (pageTotal) pageTotal.textContent = String(pages);
    if (ledgerTotal) ledgerTotal.textContent = String(total);
    if (mastheadCount) mastheadCount.textContent = String(total);
    const firstIdx = total === 0 ? 0 : (page - 1) * perPage + 1;
    const lastIdx = Math.min(total, page * perPage);
    if (ledgerFirst) ledgerFirst.textContent = String(firstIdx);
    if (ledgerLast) ledgerLast.textContent = String(lastIdx);
    if (pagePrev) {
      if (page <= 1) pagePrev.setAttribute('disabled', '');
      else pagePrev.removeAttribute('disabled');
    }
    if (pageNext) {
      if (page >= pages) pageNext.setAttribute('disabled', '');
      else pageNext.removeAttribute('disabled');
    }
  }

  async function refresh(resetPage) {
    if (resetPage) activePage = 1;
    if (abortCtrl) abortCtrl.abort();
    abortCtrl = new AbortController();
    const q = search.value.trim();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (activeOwner) params.set('owner', activeOwner);
    if (activeTag) params.set('tag', activeTag);
    if (activeSort && activeSort !== 'name') params.set('sort', activeSort);
    const naturalOrder = activeSort === 'name' ? 'asc' : 'desc';
    if (activeOrder !== naturalOrder) params.set('order', activeOrder);
    if (activePage > 1) params.set('page', String(activePage));

    try {
      const url = '/skills' + (params.toString() ? '?' + params : '');
      const res = await fetch(url, { signal: abortCtrl.signal });
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      const items = data.items || [];
      const total = data.total ?? items.length;
      const pages = data.pages ?? 1;
      const page = data.page ?? 1;
      activePage = page;
      if (data.per_page) perPage = data.per_page;
      entries.innerHTML = items.length
        ? items.map(renderEntry).join('')
        : '<div class="empty">' + escape(labels.noMatch) + '</div>';
      updatePaginationUI(page, pages, total);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
    }
  }

  const debounced = debounce(() => refresh(true), 180);
  search.addEventListener('input', debounced);

  if (pagePrev) {
    pagePrev.addEventListener('click', () => {
      if (activePage <= 1) return;
      activePage -= 1;
      refresh(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  if (pageNext) {
    pageNext.addEventListener('click', () => {
      activePage += 1;
      refresh(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  ownerChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.value || null;
      activeOwner = activeOwner === val ? null : val;
      ownerChips.forEach((c) => updateChip(c, c.dataset.value === activeOwner));
      refresh(true);
    });
  });
  tagChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.value || null;
      activeTag = activeTag === val ? null : val;
      tagChips.forEach((c) => updateChip(c, c.dataset.value === activeTag));
      refresh(true);
    });
  });
  sortChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.sort || 'name';
      if (activeSort === val) {
        activeOrder = activeOrder === 'asc' ? 'desc' : 'asc';
      } else {
        activeSort = val;
        activeOrder = chip.dataset.defaultOrder || 'asc';
      }
      sortChips.forEach((c) => {
        const pressed = c.dataset.sort === activeSort;
        updateChip(c, pressed);
        if (pressed) c.setAttribute('data-order', activeOrder);
      });
      refresh(true);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement !== search && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      search.focus();
      search.select();
    }
    if (e.key === 'Escape' && document.activeElement === search) {
      search.blur();
    }
  });

  // ─── Copy-to-clipboard buttons ───
  function setupCopyButtons() {
    const buttons = document.querySelectorAll('.copy-btn[data-clipboard]');
    buttons.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const text = btn.dataset.clipboard;
        if (!text) return;
        const original = btn.dataset.labelCopy || btn.textContent.trim();
        const copied = btn.dataset.labelCopied || 'COPIED';
        try {
          await navigator.clipboard.writeText(text);
        } catch (err) {
          console.error('clipboard write failed', err);
          return;
        }
        btn.textContent = copied;
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = original;
          btn.classList.remove('copied');
        }, 1600);
      });
    });
  }

  // ─── File explorer (detail page) ───
  function setupFileExplorer() {
    const layout = document.querySelector('.files-layout');
    if (!layout) return;
    const tree = layout.querySelector('#file-tree');
    const viewer = layout.querySelector('#file-viewer');
    const pathEl = layout.querySelector('.file-viewer-path');
    const sizeEl = layout.querySelector('.file-viewer-size');
    const contentEl = layout.querySelector('#file-viewer-content');
    const baseUrl = layout.dataset.treeUrl;
    if (!tree || !viewer || !pathEl || !sizeEl || !contentEl || !baseUrl) return;
    let activeButton = null;
    let activePath = null;

    function escape(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }

    function fmtBytes(n) {
      if (n < 1024) return n + ' B';
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KiB';
      return (n / 1024 / 1024).toFixed(2) + ' MiB';
    }

    function renderText(text) {
      const lines = text.split('\\n');
      contentEl.innerHTML = lines
        .map((l) => '<span class="line">' + escape(l) + '</span>')
        .join('\\n');
    }

    async function loadFile(path) {
      if (activePath === path) return;
      activePath = path;
      pathEl.textContent = path;
      sizeEl.textContent = '…';
      contentEl.textContent = '';
      viewer.classList.add('loaded');
      try {
        const res = await fetch(baseUrl + '?path=' + encodeURIComponent(path));
        const ct = (res.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('application/json')) {
          const data = await res.json();
          if (data.oversized) {
            sizeEl.textContent = fmtBytes(data.size) + ' · too large';
            contentEl.textContent =
              '(' + (tree.dataset.labelOversized || 'file too large to preview') + ')';
          } else if (data.binary) {
            sizeEl.textContent = fmtBytes(data.size) + ' · binary';
            contentEl.textContent = '(' + (tree.dataset.labelBinary || 'binary file') + ')';
          } else {
            sizeEl.textContent = '';
            contentEl.textContent = data.error || 'Error';
          }
        } else {
          const text = await res.text();
          const sz = parseInt(res.headers.get('x-gmc-size') || String(text.length), 10);
          sizeEl.textContent = fmtBytes(sz);
          renderText(text);
        }
      } catch (err) {
        sizeEl.textContent = '';
        contentEl.textContent = tree.dataset.labelError || 'Error';
        console.error(err);
      }
    }

    tree.addEventListener('click', (e) => {
      const btn = e.target.closest('.tree-node');
      if (!btn || !tree.contains(btn)) return;
      if (btn.classList.contains('dir')) {
        btn.classList.toggle('collapsed');
        return;
      }
      if (btn.classList.contains('file')) {
        if (activeButton) activeButton.classList.remove('active');
        btn.classList.add('active');
        activeButton = btn;
        loadFile(btn.dataset.path);
      }
    });

    // Preload SKILL.md if present, otherwise the first previewable file.
    const first = tree.querySelector('[data-path="SKILL.md"]') ||
      tree.querySelector('.tree-node.file:not(.bin):not(.oversized)') ||
      tree.querySelector('.tree-node.file');
    if (first) first.click();

    // ─── Expand / collapse viewer ───
    const expandBtn = layout.querySelector('.file-viewer-expand');
    if (expandBtn) {
      const backdrop = document.createElement('div');
      backdrop.className = 'files-backdrop';
      // Append inside .page so backdrop and expanded layout share the same
      // stacking context (.page has z-index:2 which would otherwise trap
      // the expanded layout below a body-level backdrop).
      const pageEl = document.querySelector('.page') || document.body;
      pageEl.appendChild(backdrop);

      const close = () => {
        layout.classList.remove('expanded');
        backdrop.classList.remove('visible');
        document.body.classList.remove('files-expanded-open');
        expandBtn.setAttribute('aria-pressed', 'false');
        expandBtn.textContent = '⛶';
        expandBtn.title = expandBtn.dataset.labelExpand || 'Expand';
      };
      const open = () => {
        layout.classList.add('expanded');
        backdrop.classList.add('visible');
        document.body.classList.add('files-expanded-open');
        expandBtn.setAttribute('aria-pressed', 'true');
        expandBtn.textContent = '✕';
        expandBtn.title = expandBtn.dataset.labelCollapse || 'Collapse';
      };
      expandBtn.addEventListener('click', () => {
        if (layout.classList.contains('expanded')) close();
        else open();
      });
      backdrop.addEventListener('click', close);
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && layout.classList.contains('expanded')) {
          e.preventDefault();
          close();
        }
      });
    }
  }
})();
`;
