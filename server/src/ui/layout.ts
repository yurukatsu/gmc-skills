import { html, toHtmlString, type RawHtml } from './html.js';
import { t, type Lang } from './i18n.js';

export interface LayoutOptions {
  title: string;
  main: RawHtml;
  lang: Lang;
  includeAppJs?: boolean;
}

/** Bumped once per server process → cache-bust on every restart. */
const ASSET_VERSION = Date.now().toString(36);

export function layout(opts: LayoutOptions): string {
  const nextLang: Lang = opts.lang === 'en' ? 'ja' : 'en';
  const v = ASSET_VERSION;
  const page = html`<!DOCTYPE html>
    <html lang="${opts.lang}">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <title>${opts.title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Space+Mono:wght@400;700&family=VT323&family=DotGothic16&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/assets/style.css?v=${v}" />
        <script>
          (function () {
            try {
              var s = localStorage.getItem('gmc-skills.theme');
              if (s === 'light' || s === 'dark') {
                document.documentElement.setAttribute('data-theme', s);
              }
            } catch (e) {}
          })();
        </script>
      </head>
      <body>
        <div class="page">${opts.main}</div>
        ${opts.includeAppJs ? html`<script src="/assets/app.js?v=${v}" defer></script>` : ''}
      </body>
    </html>`;
  // keep a reference to lang switching target so TS is happy (not rendered)
  void t(nextLang, 'lang.switch');
  return toHtmlString(page);
}
