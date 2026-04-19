import { Readable } from 'node:stream';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';

export interface Author {
  name: string;
  email: string;
}

export interface SkillVersion {
  owner: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags?: string[];
  updatedAt: string;
  prUrl?: string;
  downloads?: number;
}

export interface SkillSummary extends SkillVersion {
  versions: string[];
  totalDownloads?: number;
  versionDownloads?: Record<string, number>;
}

export interface ListResponse {
  items: SkillSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

function joinUrl(base: string, p: string): string {
  return base.replace(/\/+$/, '') + p;
}

async function checkOk(res: Response): Promise<Response> {
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {
      // response body is not readable as text
    }
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ''}`);
  }
  return res;
}

function skillPath(owner: string, name: string, ...rest: string[]): string {
  const segs = [owner, name, ...rest].map((s) => encodeURIComponent(s));
  return `/skills/${segs.join('/')}`;
}

export class RegistryClient {
  constructor(
    private registry: string,
    private token?: string,
  ) {}

  private authHeaders(author?: Author): Record<string, string> {
    const h: Record<string, string> = {};
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    if (author) {
      h['X-User-Email'] = author.email;
      h['X-User-Name'] = author.name;
    }
    return h;
  }

  async list(filters?: {
    q?: string;
    owner?: string;
    tag?: string;
    page?: number;
    perPage?: number;
    sort?: 'name' | 'downloads' | 'updated';
    order?: 'asc' | 'desc';
  }): Promise<ListResponse> {
    const params = new URLSearchParams();
    if (filters?.q) params.set('q', filters.q);
    if (filters?.owner) params.set('owner', filters.owner);
    if (filters?.tag) params.set('tag', filters.tag);
    if (filters?.page !== undefined) params.set('page', String(filters.page));
    if (filters?.perPage !== undefined) params.set('per_page', String(filters.perPage));
    if (filters?.sort) params.set('sort', filters.sort);
    if (filters?.order) params.set('order', filters.order);
    const qs = params.toString();
    const url = joinUrl(this.registry, qs ? `/skills?${qs}` : '/skills');
    const res = await checkOk(await fetch(url));
    return (await res.json()) as ListResponse;
  }

  async getLatest(owner: string, name: string): Promise<SkillSummary> {
    const res = await checkOk(await fetch(joinUrl(this.registry, skillPath(owner, name))));
    return (await res.json()) as SkillSummary;
  }

  async getVersion(owner: string, name: string, version: string): Promise<SkillVersion> {
    const res = await checkOk(await fetch(joinUrl(this.registry, skillPath(owner, name, version))));
    return (await res.json()) as SkillVersion;
  }

  async publish(
    owner: string,
    name: string,
    version: string,
    tarball: Uint8Array,
    author?: Author,
  ): Promise<SkillVersion> {
    const body = new Blob([tarball as unknown as ArrayBuffer], { type: 'application/gzip' });
    const res = await fetch(joinUrl(this.registry, skillPath(owner, name, version)), {
      method: 'PUT',
      headers: { ...this.authHeaders(author), 'Content-Type': 'application/gzip' },
      body,
    });
    await checkOk(res);
    return (await res.json()) as SkillVersion;
  }

  async download(owner: string, name: string, version: string): Promise<Readable> {
    const res = await checkOk(
      await fetch(joinUrl(this.registry, skillPath(owner, name, version, 'download'))),
    );
    if (!res.body) throw new Error('Empty response body');
    return Readable.fromWeb(res.body as unknown as WebReadableStream<Uint8Array>);
  }

  async deleteVersion(
    owner: string,
    name: string,
    version: string,
    author?: Author,
  ): Promise<void> {
    await checkOk(
      await fetch(joinUrl(this.registry, skillPath(owner, name, version)), {
        method: 'DELETE',
        headers: this.authHeaders(author),
      }),
    );
  }

  async deleteAll(owner: string, name: string, author?: Author): Promise<void> {
    await checkOk(
      await fetch(joinUrl(this.registry, skillPath(owner, name)), {
        method: 'DELETE',
        headers: this.authHeaders(author),
      }),
    );
  }
}
