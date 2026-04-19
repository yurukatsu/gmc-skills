import { requireRegistry } from '../config.js';
import { RegistryClient } from '../client.js';

export interface ListOptions {
  page?: string;
  perPage?: string;
}

export async function listCommand(opts: ListOptions): Promise<void> {
  const { registry, token } = await requireRegistry();
  const client = new RegistryClient(registry, token);
  const page = opts.page ? Number.parseInt(opts.page, 10) : 1;
  const perPage = opts.perPage ? Number.parseInt(opts.perPage, 10) : 50;
  if (!Number.isInteger(page) || page <= 0) throw new Error('--page must be a positive integer');
  if (!Number.isInteger(perPage) || perPage <= 0)
    throw new Error('--per-page must be a positive integer');

  const result = await client.list({ page, perPage });
  const skills = result.items;
  if (skills.length === 0) {
    if (result.total === 0) console.log('(no skills published yet)');
    else console.log(`(page ${page} of ${result.pages} — no entries; total ${result.total})`);
    return;
  }
  const refs = skills.map((s) => `${s.owner}/${s.name}`);
  const refWidth = Math.max(...refs.map((r) => r.length), 4);
  const verWidth = Math.max(...skills.map((s) => s.version.length), 7);
  for (let i = 0; i < skills.length; i++) {
    const s = skills[i];
    const extra = s.versions.length > 1 ? ` (+${s.versions.length - 1} older)` : '';
    const dl = s.totalDownloads !== undefined ? `  ${s.totalDownloads.toLocaleString()} DL` : '';
    console.log(
      `${refs[i].padEnd(refWidth)}  ${s.version.padEnd(verWidth)}  ${s.description}${extra}${dl}`,
    );
  }
  if (result.pages > 1) {
    const from = (result.page - 1) * result.per_page + 1;
    const to = Math.min(result.total, result.page * result.per_page);
    console.log(
      `\n  page ${result.page} / ${result.pages}  (${from}–${to} of ${result.total})` +
        (result.page < result.pages ? `  — next: --page ${result.page + 1}` : ''),
    );
  }
}
