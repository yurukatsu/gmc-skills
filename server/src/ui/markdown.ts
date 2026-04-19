import { Marked } from 'marked';
import { raw, type RawHtml } from './html.js';

const marked = new Marked({ gfm: true, breaks: false });

function stripDangerous(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

export function renderMarkdown(md: string): RawHtml {
  const parsed = marked.parse(md, { async: false });
  const html = typeof parsed === 'string' ? parsed : '';
  return raw(stripDangerous(html));
}
