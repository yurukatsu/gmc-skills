import type { SkillSummary } from '../storage.js';
import { html, type RawHtml } from './html.js';
import { layout } from './layout.js';
import { t, type Lang } from './i18n.js';
import { renderToolbar } from './toolbar.js';

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function shortDate(iso: string): string {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

function renderEntry(s: SkillSummary, i: number, lang: Lang): RawHtml {
  const total = s.totalDownloads ?? s.downloads ?? 0;
  const tagsRow =
    s.tags && s.tags.length > 0
      ? html`<div class="row">
          <dt>${t(lang, 'list.col_tags')}</dt>
          <dd>${s.tags.slice(0, 4).join(' · ')}</dd>
        </div>`
      : '';
  return html`<article class="entry" style="--index:${i}">
    <div class="entry-number">No.${pad3(i + 1)}</div>
    <div class="entry-body">
      <h2 class="entry-title">
        <a href="/ui/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.name)}">
          <span class="owner">${s.owner}</span><span class="slash">/</span
          ><span class="name">${s.name}</span>
        </a>
      </h2>
      <p class="entry-desc">${s.description}</p>
      <dl class="entry-meta">
        <div class="row">
          <dt>${t(lang, 'list.col_version')}</dt>
          <dd>${s.version}</dd>
        </div>
        <div class="row">
          <dt>${t(lang, 'list.col_updated')}</dt>
          <dd>${shortDate(s.updatedAt)}</dd>
        </div>
        ${tagsRow}
      </dl>
    </div>
    <div class="entry-stat">
      <span class="count">${total.toLocaleString()}</span>
      <span class="label">${t(lang, 'list.label_dl')}</span>
    </div>
  </article>`;
}

export type SortKey = 'name' | 'downloads' | 'updated';
export type SortOrder = 'asc' | 'desc';

export interface ListPageOptions {
  lang: Lang;
  currentPath: string;
  sort?: SortKey;
  order?: SortOrder;
  page?: number;
  perPage?: number;
  total?: number;
  pages?: number;
  error?: string;
}

export function buildListPage(skills: SkillSummary[], opts: ListPageOptions): string {
  const { lang } = opts;
  const sort: SortKey = opts.sort ?? 'name';
  const defaultOrder: SortOrder = sort === 'name' ? 'asc' : 'desc';
  const order: SortOrder = opts.order ?? defaultOrder;
  const page = opts.page ?? 1;
  const perPage = opts.perPage ?? skills.length;
  const total = opts.total ?? skills.length;
  const pages = opts.pages ?? 1;
  const firstIdx = total === 0 ? 0 : (page - 1) * perPage + 1;
  const lastIdx = Math.min(total, page * perPage);
  const owners = Array.from(new Set(skills.map((s) => s.owner))).sort();
  const tags = Array.from(new Set(skills.flatMap((s) => s.tags ?? []))).sort();

  const entriesHtml =
    skills.length > 0
      ? html`${skills.map((s, i) => renderEntry(s, i, lang))}`
      : html`<div class="empty">${t(lang, 'list.empty')}</div>`;

  const errorBanner = opts.error ? html`<div class="error-banner">${opts.error}</div>` : '';

  const ownerChips = owners.map(
    (o) =>
      html`<button
        class="chip"
        type="button"
        data-filter="owner"
        data-value="${o}"
        aria-pressed="false"
      >
        ${o}
      </button>`,
  );
  const tagChips = tags.map(
    (tagValue) =>
      html`<button
        class="chip"
        type="button"
        data-filter="tag"
        data-value="${tagValue}"
        aria-pressed="false"
      >
        ${tagValue}
      </button>`,
  );

  function sortChip(
    key: SortKey,
    labelKey: 'list.sort_name' | 'list.sort_downloads' | 'list.sort_updated',
    defaultOrderForKey: SortOrder,
  ) {
    const isActive = sort === key;
    const chipOrder = isActive ? order : defaultOrderForKey;
    return html`<button
      class="chip chip-sort"
      type="button"
      data-sort="${key}"
      data-default-order="${defaultOrderForKey}"
      data-order="${chipOrder}"
      aria-pressed="${isActive ? 'true' : 'false'}"
    >
      ${t(lang, labelKey)}
    </button>`;
  }

  const sortGroup = html`<div class="filter-group">
    <span class="filter-label">${t(lang, 'list.sort_label')}</span>
    ${sortChip('name', 'list.sort_name', 'asc')}
    ${sortChip('downloads', 'list.sort_downloads', 'desc')}
    ${sortChip('updated', 'list.sort_updated', 'desc')}
  </div>`;

  const filterBar = html`<div class="filters">
    ${sortGroup}
    ${owners.length > 0
      ? html`<div class="filter-group">
          <span class="filter-label">${t(lang, 'list.filter_owner')}</span>
          ${ownerChips}
        </div>`
      : ''}
    ${tags.length > 0
      ? html`<div class="filter-group">
          <span class="filter-label">${t(lang, 'list.filter_tag')}</span>
          ${tagChips}
        </div>`
      : ''}
  </div>`;

  const main = html`
    <header class="masthead">
      <div>
        <h1 class="brand">gmc::<em>skills</em></h1>
        <p class="subtitle">${t(lang, 'brand.subtitle')}</p>
      </div>
      <div class="masthead-meta">
        <div class="filing">${t(lang, 'brand.filing')}</div>
        <div class="count">
          <strong id="masthead-count">${total}</strong> ${t(lang, 'list.entries_catalogued')}
        </div>
        ${renderToolbar(lang, opts.currentPath)}
      </div>
    </header>

    ${errorBanner}

    <section class="controls">
      <div class="search">
        <label for="search">${t(lang, 'list.search_label')}</label>
        <input
          id="search"
          name="search"
          type="text"
          autocomplete="off"
          spellcheck="false"
          placeholder="${t(lang, 'list.search_placeholder')}"
        />
        <kbd>/</kbd>
      </div>
      ${filterBar}
    </section>

    <main
      class="entries"
      id="entries"
      data-label-dl="${t(lang, 'list.label_dl')}"
      data-label-version="${t(lang, 'list.col_version')}"
      data-label-updated="${t(lang, 'list.col_updated')}"
      data-label-tags="${t(lang, 'list.col_tags')}"
      data-label-no-match="${t(lang, 'list.no_match')}"
      data-sort="${sort}"
      data-order="${order}"
      data-page="${page}"
      data-per-page="${perPage}"
    >
      ${entriesHtml}
    </main>

    <nav class="page-nav" id="page-nav">
      <button class="chip page-prev" type="button" ${page <= 1 ? 'disabled' : ''}>
        ← ${t(lang, 'list.page_prev')}
      </button>
      <span class="page-indicator">
        <strong id="page-current">${page}</strong> / <strong id="page-total">${pages}</strong>
      </span>
      <button class="chip page-next" type="button" ${page >= pages ? 'disabled' : ''}>
        ${t(lang, 'list.page_next')} →
      </button>
    </nav>

    <footer class="ledger">
      <span
        ><strong id="ledger-first">${firstIdx}</strong>–<strong id="ledger-last">${lastIdx}</strong>
        / <strong id="ledger-total">${total}</strong> ${t(lang, 'list.ledger_shown')}</span
      >
      <span>gmc-skills · ${t(lang, 'list.press_slash')}</span>
    </footer>
  `;

  return layout({
    title: `gmc-skills · archive (${skills.length})`,
    main,
    lang,
    includeAppJs: true,
  });
}
