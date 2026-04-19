import { requireRegistry } from '../config.js';
import { RegistryClient } from '../client.js';

export interface SearchOptions {
  owner?: string;
  tag?: string;
  limit?: string;
  page?: string;
  perPage?: string;
}

export async function searchCommand(query: string | undefined, opts: SearchOptions): Promise<void> {
  if (!query && !opts.owner && !opts.tag) {
    throw new Error(
      'Provide a query or at least one filter (--owner, --tag). Use `gmc-skills list` to see everything.',
    );
  }
  const parsePositive = (flag: string, raw: string): number => {
    const n = Number.parseInt(raw, 10);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`${flag} must be a positive integer`);
    return n;
  };
  const page = opts.page ? parsePositive('--page', opts.page) : 1;
  const perPage = opts.perPage
    ? parsePositive('--per-page', opts.perPage)
    : opts.limit
      ? parsePositive('--limit', opts.limit)
      : 50;

  const { registry, token } = await requireRegistry();
  const client = new RegistryClient(registry, token);
  const result = await client.list({
    q: query,
    owner: opts.owner,
    tag: opts.tag,
    page,
    perPage,
  });
  const skills = result.items;
  if (skills.length === 0) {
    const desc = [
      query ? `"${query}"` : null,
      opts.owner ? `owner=${opts.owner}` : null,
      opts.tag ? `tag=${opts.tag}` : null,
    ]
      .filter(Boolean)
      .join(', ');
    console.log(`No skills matching ${desc}`);
    return;
  }
  for (const s of skills) {
    console.log(`${s.owner}/${s.name}@${s.version}  ${s.description}`);
    if (s.versions.length > 1) console.log(`  versions: ${s.versions.join(', ')}`);
    if (s.tags?.length) console.log(`  tags: ${s.tags.join(', ')}`);
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
