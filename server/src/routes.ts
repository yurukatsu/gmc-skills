import { Hono, type Context } from 'hono';
import { stream } from 'hono/streaming';
import { bearerAuth } from './auth.js';
import {
  MAX_FILE_BYTES,
  NonMonotonicVersionError,
  SkillExistsError,
  type Author,
  type SkillSummary,
  type SkillVersion,
  type Storage,
} from './storage.js';
import { isBinaryByName } from './binaryExts.js';
import type { DownloadStats } from './stats.js';
import type { SkillIndex } from './skillIndex.js';
import { buildListPage, buildDetailPage, STYLE_CSS, APP_JS } from './ui/index.js';
import { parseLang } from './ui/i18n.js';

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

interface PaginationParams {
  page: number;
  perPage: number;
}

function parsePagination(c: Context): PaginationParams | { error: string } {
  const pageRaw = c.req.query('page');
  const perPageRaw = c.req.query('per_page') ?? c.req.query('limit');
  let page = 1;
  let perPage = DEFAULT_PER_PAGE;
  if (pageRaw !== undefined) {
    const parsed = Number.parseInt(pageRaw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0)
      return { error: 'page must be a positive integer' };
    page = parsed;
  }
  if (perPageRaw !== undefined) {
    const parsed = Number.parseInt(perPageRaw, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || parsed > MAX_PER_PAGE) {
      return { error: `per_page must be a positive integer (max ${MAX_PER_PAGE})` };
    }
    perPage = parsed;
  }
  return { page, perPage };
}

function resolveLang(c: Context): 'en' | 'ja' {
  const q = c.req.query('lang');
  if (q) return parseLang(q);
  const accept = c.req.header('accept-language');
  return parseLang(accept ?? null);
}

function extractAuthor(c: Context): Author | undefined {
  const email = c.req.header('x-user-email');
  if (!email) return undefined;
  const name = c.req.header('x-user-name');
  return { email, name: name ?? email };
}

function augmentSummary(stats: DownloadStats, s: SkillSummary): SkillSummary {
  const counter = stats.get(s.owner, s.name);
  return {
    ...s,
    totalDownloads: counter.total,
    versionDownloads: counter.byVersion,
    downloads: counter.byVersion[s.version] ?? 0,
  };
}

function augmentVersion(stats: DownloadStats, v: SkillVersion): SkillVersion {
  const counter = stats.get(v.owner, v.name);
  return { ...v, downloads: counter.byVersion[v.version] ?? 0 };
}

export interface ListResponse {
  items: SkillSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

interface ListFilters {
  q?: string;
  owner?: string;
  tag?: string;
  sort: 'name' | 'downloads' | 'updated';
  order: 'asc' | 'desc';
  page: number;
  perPage: number;
}

async function paginatedList(opts: BuildAppOptions, filters: ListFilters): Promise<ListResponse> {
  const raw = await opts.index.snapshot();
  let filtered = raw;
  if (filters.q) {
    const q = filters.q;
    filtered = filtered.filter(
      (s) =>
        s.owner.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }
  if (filters.owner) {
    const o = filters.owner;
    filtered = filtered.filter((s) => s.owner.toLowerCase() === o);
  }
  if (filters.tag) {
    const tg = filters.tag;
    filtered = filtered.filter((s) => (s.tags ?? []).some((t) => t.toLowerCase() === tg));
  }

  // Augment with stats only after filtering, before sort (downloads sort needs it).
  const enriched = filtered.map((s) => augmentSummary(opts.stats, s));
  const dir = filters.order === 'asc' ? 1 : -1;
  const nameKey = (s: SkillSummary): string => `${s.owner}/${s.name}`;
  if (filters.sort === 'name') {
    enriched.sort((a, b) => dir * nameKey(a).localeCompare(nameKey(b)));
  } else if (filters.sort === 'downloads') {
    enriched.sort(
      (a, b) =>
        dir * ((a.totalDownloads ?? 0) - (b.totalDownloads ?? 0)) ||
        nameKey(a).localeCompare(nameKey(b)),
    );
  } else {
    enriched.sort(
      (a, b) =>
        dir * (Date.parse(a.updatedAt) - Date.parse(b.updatedAt)) ||
        nameKey(a).localeCompare(nameKey(b)),
    );
  }

  const total = enriched.length;
  const pages = Math.max(1, Math.ceil(total / filters.perPage));
  const page = Math.min(filters.page, pages);
  const offset = (page - 1) * filters.perPage;
  const items = enriched.slice(offset, offset + filters.perPage);

  return { items, total, page, per_page: filters.perPage, pages };
}

export interface BuildAppOptions {
  storage: Storage;
  stats: DownloadStats;
  index: SkillIndex;
  token: string;
}

export function buildApp(opts: BuildAppOptions): Hono {
  const app = new Hono();
  const auth = bearerAuth(opts.token);

  app.get('/health', (c) => c.json({ ok: true }));

  app.get('/skills', async (c) => {
    const q = c.req.query('q')?.toLowerCase();
    const ownerFilter = c.req.query('owner')?.toLowerCase();
    const tagFilter = c.req.query('tag')?.toLowerCase();

    const sortParam = c.req.query('sort') ?? 'name';
    if (sortParam !== 'name' && sortParam !== 'downloads' && sortParam !== 'updated') {
      return c.json({ error: 'sort must be "name", "downloads", or "updated"' }, 400);
    }
    const orderRaw = c.req.query('order');
    if (orderRaw !== undefined && orderRaw !== 'asc' && orderRaw !== 'desc') {
      return c.json({ error: 'order must be "asc" or "desc"' }, 400);
    }
    const defaultOrder = sortParam === 'name' ? 'asc' : 'desc';
    const order: 'asc' | 'desc' =
      orderRaw === 'asc' || orderRaw === 'desc' ? orderRaw : defaultOrder;

    const pag = parsePagination(c);
    if ('error' in pag) return c.json({ error: pag.error }, 400);

    const result = await paginatedList(opts, {
      q,
      owner: ownerFilter,
      tag: tagFilter,
      sort: sortParam,
      order,
      page: pag.page,
      perPage: pag.perPage,
    });
    return c.json(result);
  });

  app.get('/skills/:owner/:name', async (c) => {
    try {
      const rec = await opts.storage.getLatest(c.req.param('owner'), c.req.param('name'));
      return c.json(augmentSummary(opts.stats, rec));
    } catch {
      return c.json({ error: 'Not found' }, 404);
    }
  });

  app.get('/skills/:owner/:name/:version', async (c) => {
    try {
      const rec = await opts.storage.getVersion(
        c.req.param('owner'),
        c.req.param('name'),
        c.req.param('version'),
      );
      return c.json(augmentVersion(opts.stats, rec));
    } catch {
      return c.json({ error: 'Not found' }, 404);
    }
  });

  app.get('/skills/:owner/:name/:version/files', async (c) => {
    try {
      const tree = await opts.storage.listFiles(
        c.req.param('owner'),
        c.req.param('name'),
        c.req.param('version'),
      );
      return c.json({ tree });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Not found';
      return c.json({ error: msg }, 404);
    }
  });

  app.get('/skills/:owner/:name/:version/file', async (c) => {
    const filePath = c.req.query('path');
    if (!filePath) return c.json({ error: 'path query param required' }, 400);
    const owner = c.req.param('owner');
    const name = c.req.param('name');
    const version = c.req.param('version');
    try {
      // Preflight: stat first so we can bail out for known-binary extensions
      // and oversized files without ever reading them into memory.
      const stat = await opts.storage.statFile(owner, name, version, filePath);
      if (isBinaryByName(stat.path)) {
        return c.json({ binary: true, size: stat.size, path: stat.path });
      }
      if (stat.size > MAX_FILE_BYTES) {
        return c.json({
          oversized: true,
          size: stat.size,
          maxSize: MAX_FILE_BYTES,
          path: stat.path,
        });
      }

      const {
        content,
        size,
        path: resolvedPath,
      } = await opts.storage.readFile(owner, name, version, filePath);
      // Content-based binary detection: null byte in the first 2 KiB
      const sample = content.subarray(0, Math.min(2048, content.length));
      if (sample.includes(0)) {
        return c.json({ binary: true, size, path: resolvedPath });
      }
      c.header('Content-Type', 'text/plain; charset=utf-8');
      c.header('X-Gmc-Size', String(size));
      return c.body(content.toString('utf8'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Not found';
      return c.json({ error: msg }, 404);
    }
  });

  app.get('/skills/:owner/:name/:version/readme', async (c) => {
    try {
      const body = await opts.storage.getReadme(
        c.req.param('owner'),
        c.req.param('name'),
        c.req.param('version'),
      );
      c.header('Content-Type', 'text/markdown; charset=utf-8');
      return c.body(body);
    } catch {
      return c.json({ error: 'Not found' }, 404);
    }
  });

  app.get('/skills/:owner/:name/:version/download', async (c) => {
    const owner = c.req.param('owner');
    const name = c.req.param('name');
    const version = c.req.param('version');
    if (!(await opts.storage.exists(owner, name, version))) {
      return c.json({ error: 'Not found' }, 404);
    }
    opts.stats.increment(owner, name, version);
    c.header('Content-Type', 'application/gzip');
    c.header('Content-Disposition', `attachment; filename="${name}-${version}.tgz"`);
    return stream(c, async (s) => {
      const src = await opts.storage.createDownloadStream(owner, name, version);
      for await (const chunk of src as AsyncIterable<Uint8Array>) {
        await s.write(chunk);
      }
    });
  });

  app.put('/skills/:owner/:name/:version', auth, async (c) => {
    const owner = c.req.param('owner');
    const name = c.req.param('name');
    const version = c.req.param('version');
    const arrBuf = await c.req.arrayBuffer();
    const buf = Buffer.from(arrBuf);
    if (buf.length === 0) return c.json({ error: 'Empty body' }, 400);
    try {
      const rec = await opts.storage.save(owner, name, version, buf, extractAuthor(c));
      await opts.index.refreshOne(owner, name);
      return c.json(rec, 201);
    } catch (err) {
      if (err instanceof SkillExistsError || err instanceof NonMonotonicVersionError) {
        return c.json({ error: err.message, code: err.code }, 409);
      }
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 400);
    }
  });

  app.delete('/skills/:owner/:name/:version', auth, async (c) => {
    try {
      const owner = c.req.param('owner');
      const name = c.req.param('name');
      const version = c.req.param('version');
      const removed = await opts.storage.deleteVersion(owner, name, version, extractAuthor(c));
      if (removed) {
        opts.stats.forget(owner, name, version);
        await opts.index.refreshOne(owner, name);
      }
      return c.json({ removed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 400);
    }
  });

  app.delete('/skills/:owner/:name', auth, async (c) => {
    try {
      const owner = c.req.param('owner');
      const name = c.req.param('name');
      const removed = await opts.storage.deleteAll(owner, name, extractAuthor(c));
      if (removed) {
        opts.stats.forget(owner, name);
        await opts.index.refreshOne(owner, name);
      }
      return c.json({ removed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ error: msg }, 400);
    }
  });

  // -------- UI routes (HTML) --------

  app.get('/assets/style.css', (c) => {
    c.header('Content-Type', 'text/css; charset=utf-8');
    // Short TTL + must-revalidate so that redeploys don't serve stale
    // assets. The layout also appends ?v=<assetVersion> for belt-and-suspenders.
    c.header('Cache-Control', 'public, max-age=10, must-revalidate');
    return c.body(STYLE_CSS);
  });

  app.get('/assets/app.js', (c) => {
    c.header('Content-Type', 'application/javascript; charset=utf-8');
    c.header('Cache-Control', 'public, max-age=10, must-revalidate');
    return c.body(APP_JS);
  });

  app.get('/', async (c) => {
    const lang = resolveLang(c);
    const sortRaw = c.req.query('sort');
    const sort: 'name' | 'downloads' | 'updated' =
      sortRaw === 'downloads' ? 'downloads' : sortRaw === 'updated' ? 'updated' : 'name';
    const orderRaw = c.req.query('order');
    const defaultOrder: 'asc' | 'desc' = sort === 'name' ? 'asc' : 'desc';
    const order: 'asc' | 'desc' =
      orderRaw === 'asc' || orderRaw === 'desc' ? orderRaw : defaultOrder;

    const pagRaw = parsePagination(c);
    const pag = 'error' in pagRaw ? { page: 1, perPage: DEFAULT_PER_PAGE } : pagRaw;

    const result = await paginatedList(opts, {
      sort,
      order,
      page: pag.page,
      perPage: pag.perPage,
    });
    c.header('Content-Type', 'text/html; charset=utf-8');
    return c.body(
      buildListPage(result.items, {
        lang,
        currentPath: c.req.path,
        sort,
        order,
        page: result.page,
        perPage: result.per_page,
        total: result.total,
        pages: result.pages,
      }),
    );
  });

  app.get('/ui/:owner/:name', async (c) => {
    const lang = resolveLang(c);
    try {
      const rec = await opts.storage.getLatest(c.req.param('owner'), c.req.param('name'));
      const counter = opts.stats.get(rec.owner, rec.name);
      const enriched = augmentSummary(opts.stats, rec);
      const tree = await opts.storage.listFiles(rec.owner, rec.name, rec.version).catch(() => []);
      c.header('Content-Type', 'text/html; charset=utf-8');
      return c.body(
        buildDetailPage(enriched, counter, {
          lang,
          currentPath: c.req.path,
          tree,
        }),
      );
    } catch {
      c.status(404);
      c.header('Content-Type', 'text/html; charset=utf-8');
      return c.body(
        buildListPage([], {
          lang,
          currentPath: c.req.path,
          error:
            lang === 'ja'
              ? `「${c.req.param('owner')}/${c.req.param('name')}」は見つかりません`
              : `Skill "${c.req.param('owner')}/${c.req.param('name')}" not found`,
        }),
      );
    }
  });

  return app;
}
