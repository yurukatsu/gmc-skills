import { MAX_FILE_BYTES, type FileNode, type SkillSummary } from '../storage.js';
import type { SkillCounters } from '../stats.js';
import { isBinaryByName } from '../binaryExts.js';
import { html, type RawHtml } from './html.js';
import { layout } from './layout.js';
import { t, type Lang } from './i18n.js';
import { renderToolbar } from './toolbar.js';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch {
    return iso;
  }
}

export interface DetailPageOptions {
  lang: Lang;
  currentPath: string;
  tree?: FileNode[];
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / 1024 / 1024).toFixed(2)} MiB`;
}

function renderFileNode(n: FileNode): RawHtml {
  const size = n.size ?? 0;
  const bin = isBinaryByName(n.name);
  const oversized = size > MAX_FILE_BYTES;
  const cls = 'tree-node file' + (bin ? ' bin' : '') + (oversized ? ' oversized' : '');
  const badge = bin || oversized ? html`<span class="size-badge">${fmtBytes(size)}</span>` : '';
  return html`<li>
    <button class="${cls}" type="button" data-path="${n.path}" data-size="${size}">
      <span class="tree-node-name">${n.name}</span>
      ${badge}
    </button>
  </li>`;
}

function renderTree(nodes: FileNode[]): RawHtml {
  return html`<ul>
    ${nodes.map((n) =>
      n.type === 'dir'
        ? html`<li>
            <button class="tree-node dir open" type="button" data-path="${n.path}">
              ${n.name}
            </button>
            ${renderTree(n.children ?? [])}
          </li>`
        : renderFileNode(n),
    )}
  </ul>`;
}

export function buildDetailPage(
  s: SkillSummary,
  counters: SkillCounters,
  opts: DetailPageOptions,
): string {
  const { lang } = opts;
  const total = s.totalDownloads ?? counters.total;
  const versions = s.versions.slice();
  const latest = versions[0];

  const versionRows = versions.map((v, i) => {
    const dl = counters.byVersion[v] ?? 0;
    return html`<tr style="--index:${i}">
      <td class="v">
        ${v}${v === latest
          ? html`<span class="badge">${t(lang, 'detail.badge_latest')}</span>`
          : ''}
      </td>
      <td class="dl">${dl.toLocaleString()}</td>
      <td class="dl-btn">
        <a
          class="download-btn"
          href="/skills/${encodeURIComponent(s.owner)}/${encodeURIComponent(
            s.name,
          )}/${encodeURIComponent(v)}/download"
          download="${s.name}-${v}.tgz"
        >
          ${t(lang, 'detail.btn_download')}
        </a>
      </td>
    </tr>`;
  });

  const versionsNoun =
    versions.length === 1
      ? t(lang, 'detail.footer_versions_one')
      : t(lang, 'detail.footer_versions_many');

  const tree = opts.tree ?? [];
  const filesSection = tree.length
    ? html`<section class="files-section">
        <div class="history-head">
          <h2>${t(lang, 'detail.files_heading')}</h2>
          <span class="line"></span>
        </div>
        <div
          class="files-layout"
          data-tree-url="/skills/${encodeURIComponent(s.owner)}/${encodeURIComponent(
            s.name,
          )}/${encodeURIComponent(s.version)}/file"
        >
          <nav
            class="tree"
            id="file-tree"
            data-label-binary="${t(lang, 'detail.files_binary')}"
            data-label-error="${t(lang, 'detail.files_error')}"
            data-label-oversized="${t(lang, 'detail.files_oversized')}"
          >
            ${renderTree(tree)}
          </nav>
          <div class="file-viewer" id="file-viewer">
            <div class="file-viewer-header">
              <span class="file-viewer-path">—</span>
              <span class="file-viewer-meta">
                <span class="file-viewer-size"></span>
                <button
                  class="file-viewer-expand"
                  type="button"
                  data-label-expand="${t(lang, 'detail.files_expand')}"
                  data-label-collapse="${t(lang, 'detail.files_collapse')}"
                  aria-pressed="false"
                  title="${t(lang, 'detail.files_expand')}"
                >
                  ⛶
                </button>
              </span>
            </div>
            <pre class="file-viewer-body"><code id="file-viewer-content"></code></pre>
            <p class="file-viewer-hint">${t(lang, 'detail.files_hint')}</p>
          </div>
        </div>
      </section>`
    : '';

  const main = html`
    <nav class="detail-nav">
      <span class="back"><a href="/?lang=${lang}">${t(lang, 'detail.back')}</a></span>
      ${renderToolbar(lang, opts.currentPath)}
    </nav>

    <section class="card">
      <span class="corner-br"></span><span class="corner-bl"></span>
      <div class="card-header">
        <span>${t(lang, 'detail.card_header_prefix')} · ${s.owner}/${s.name}</span>
        <span class="stamp">${total.toLocaleString()} ${t(lang, 'detail.total_dl_suffix')}</span>
      </div>

      <h1 class="title">
        <span class="owner">${s.owner}</span><span class="slash">/</span
        ><span class="name">${s.name}</span>
      </h1>

      <p class="lede">${s.description}</p>

      <dl class="metadata">
        <dt>${t(lang, 'detail.meta_owner')}</dt>
        <dd>${s.owner}</dd>
        <dt>${t(lang, 'detail.meta_latest')}</dt>
        <dd>${s.version}</dd>
        <dt>${t(lang, 'detail.meta_versions')}</dt>
        <dd>${versions.join(' · ')}</dd>
        ${s.author
          ? html`<dt>${t(lang, 'detail.meta_author')}</dt>
              <dd>${s.author}</dd>`
          : ''}
        ${s.tags && s.tags.length > 0
          ? html`<dt>${t(lang, 'detail.meta_tags')}</dt>
              <dd>${s.tags.join(' · ')}</dd>`
          : ''}
        <dt>${t(lang, 'detail.meta_updated')}</dt>
        <dd>${fmtDate(s.updatedAt)}</dd>
        <dt>${t(lang, 'detail.meta_last_download')}</dt>
        <dd>${fmtDate(counters.lastDownloadAt)}</dd>
        <dt>${t(lang, 'detail.meta_install')}</dt>
        <dd>
          <div class="install-field">
            <code>gmc-skills install ${s.owner}/${s.name}</code>
            <button
              class="copy-btn"
              type="button"
              data-clipboard="gmc-skills install ${s.owner}/${s.name}"
              data-label-copy="${t(lang, 'detail.copy_btn')}"
              data-label-copied="${t(lang, 'detail.copied')}"
            >
              ${t(lang, 'detail.copy_btn')}
            </button>
          </div>
        </dd>
      </dl>
    </section>

    ${filesSection}

    <section>
      <div class="history-head">
        <h2>${t(lang, 'detail.history_head')}</h2>
        <span class="line"></span>
      </div>
      <table class="versions">
        <thead>
          <tr>
            <th>${t(lang, 'detail.table_version')}</th>
            <th style="text-align:right">${t(lang, 'detail.table_downloads')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${versionRows}
        </tbody>
      </table>
    </section>

    <footer class="ledger">
      <span><strong>${s.owner}/${s.name}</strong> · ${versions.length} ${versionsNoun}</span>
      <span>gmc-skills archive</span>
    </footer>
  `;

  return layout({
    title: `${s.owner}/${s.name} · gmc-skills`,
    main,
    lang,
    includeAppJs: tree.length > 0,
  });
}
