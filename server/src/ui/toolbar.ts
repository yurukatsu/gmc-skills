import { html, type RawHtml } from './html.js';
import { t, type Lang } from './i18n.js';

export function renderToolbar(lang: Lang, currentPath: string): RawHtml {
  const nextLang: Lang = lang === 'en' ? 'ja' : 'en';
  const url = new URL(currentPath, 'http://localhost');
  url.searchParams.set('lang', nextLang);
  const langHref = url.pathname + url.search;
  return html`<div class="toolbar">
    <button
      id="theme-toggle"
      type="button"
      data-current="auto"
      data-label-auto="${t(lang, 'theme.auto')}"
      data-label-light="${t(lang, 'theme.light')}"
      data-label-dark="${t(lang, 'theme.dark')}"
      title="toggle theme"
    >
      <span class="theme-label">${t(lang, 'theme.auto')}</span>
    </button>
    <a href="${langHref}">${t(lang, 'lang.switch')}</a>
  </div>`;
}
