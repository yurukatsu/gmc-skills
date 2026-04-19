const RAW = Symbol('raw-html');

export interface RawHtml {
  readonly [RAW]: string;
}

export function raw(s: string): RawHtml {
  return { [RAW]: s };
}

export function isRawHtml(v: unknown): v is RawHtml {
  return typeof v === 'object' && v !== null && RAW in v;
}

export function escapeHtml(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

type Interp = string | number | RawHtml | null | undefined | false | Interp[];

export function html(strings: TemplateStringsArray, ...values: Interp[]): RawHtml {
  let out = '';
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) out += renderValue(values[i]);
  }
  return raw(out);
}

function renderValue(v: Interp): string {
  if (v === null || v === undefined || v === false) return '';
  if (Array.isArray(v)) return v.map(renderValue).join('');
  if (isRawHtml(v)) return v[RAW];
  return escapeHtml(v);
}

export function toHtmlString(r: RawHtml): string {
  return r[RAW];
}
