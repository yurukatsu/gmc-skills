import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createGunzip, createGzip } from 'node:zlib';
import { extract as tarExtract, create as tarCreate } from 'tar';
import {
  OWNER_RE,
  parseSkillMarkdown,
  parseSkillMarkdownFull,
  type SkillFrontmatter,
} from './skill.js';

export interface SkillVersion {
  owner: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tags?: string[];
  updatedAt: string;
  prUrl?: string;
  /** Download count. Populated by routes via DownloadStats; absent in raw storage results. */
  downloads?: number;
}

export interface SkillSummary extends SkillVersion {
  versions: string[];
  /** Aggregated total downloads across all versions. Populated by routes. */
  totalDownloads?: number;
  /** Per-version download breakdown. Populated by routes. */
  versionDownloads?: Record<string, number>;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  children?: FileNode[];
}

export interface ReadFileResult {
  content: Buffer;
  size: number;
  path: string;
}

export const MAX_TREE_DEPTH = 10;
export const MAX_TREE_FILES = 500;
export const MAX_FILE_BYTES = 1024 * 1024; // 1 MiB

export interface Author {
  name: string;
  email: string;
}

export interface Storage {
  init(): Promise<void>;
  list(): Promise<SkillSummary[]>;
  listVersions(owner: string, name: string): Promise<string[]>;
  getLatest(owner: string, name: string): Promise<SkillSummary>;
  getVersion(owner: string, name: string, version: string): Promise<SkillVersion>;
  getReadme(owner: string, name: string, version?: string): Promise<string>;
  exists(owner: string, name: string, version?: string): Promise<boolean>;
  save(
    owner: string,
    name: string,
    version: string,
    tarball: Buffer,
    author?: Author,
  ): Promise<SkillVersion>;
  deleteVersion(owner: string, name: string, version: string, author?: Author): Promise<boolean>;
  deleteAll(owner: string, name: string, author?: Author): Promise<boolean>;
  createDownloadStream(owner: string, name: string, version: string): Promise<Readable>;
  listFiles(owner: string, name: string, version: string): Promise<FileNode[]>;
  readFile(owner: string, name: string, version: string, filePath: string): Promise<ReadFileResult>;
  statFile(
    owner: string,
    name: string,
    version: string,
    filePath: string,
  ): Promise<{ size: number; path: string }>;
}

export class SkillExistsError extends Error {
  readonly code = 'SKILL_VERSION_EXISTS';
  constructor(owner: string, name: string, version: string) {
    super(`${owner}/${name}@${version} already exists. Bump the version in SKILL.md.`);
  }
}

export class NonMonotonicVersionError extends Error {
  readonly code = 'SKILL_VERSION_NOT_MONOTONIC';
  constructor(owner: string, name: string, attempted: string, current: string) {
    super(
      `${owner}/${name}@${attempted} must be greater than the current latest ${owner}/${name}@${current}. Bump the version in SKILL.md.`,
    );
  }
}

export const SEMVER_RE = /^\d+\.\d+\.\d+$/;
export const NAME_RE = /^[a-z0-9][a-z0-9-_]*$/;

export function sanitizeOwner(owner: string): void {
  if (!OWNER_RE.test(owner)) throw new Error(`Invalid skill owner: "${owner}"`);
}

export function sanitizeName(name: string): void {
  if (!NAME_RE.test(name)) throw new Error(`Invalid skill name: "${name}"`);
}

export function sanitizeVersion(version: string): void {
  if (!SEMVER_RE.test(version)) throw new Error(`Invalid version: "${version}" (expected x.y.z)`);
}

export function semverCompareDesc(a: string, b: string): number {
  const [aM, am, ap] = a.split('.').map(Number);
  const [bM, bm, bp] = b.split('.').map(Number);
  if (aM !== bM) return bM - aM;
  if (am !== bm) return bm - am;
  return bp - ap;
}

const SKIP_ENTRIES = new Set(['node_modules', '.git', '.DS_Store', 'dist']);

export function sanitizeFilePath(requested: string): string {
  const normalized = requested.replace(/\\/g, '/');
  if (normalized === '' || normalized === '.' || normalized.startsWith('/')) {
    throw new Error('Invalid path');
  }
  const parts = normalized.split('/');
  for (const p of parts) {
    if (p === '' || p === '.' || p === '..') throw new Error('Invalid path');
  }
  return parts.join('/');
}

async function walkTree(
  root: string,
  rel: string,
  depth: number,
  state: { count: number },
): Promise<FileNode[]> {
  if (depth > MAX_TREE_DEPTH || state.count >= MAX_TREE_FILES) return [];
  const absDir = path.join(root, rel);
  const entries = await fs.readdir(absDir, { withFileTypes: true });
  const nodes: FileNode[] = [];
  for (const e of entries) {
    if (state.count >= MAX_TREE_FILES) break;
    if (SKIP_ENTRIES.has(e.name) || e.name.startsWith('.')) continue;
    const childRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      const children = await walkTree(root, childRel, depth + 1, state);
      nodes.push({ name: e.name, path: childRel, type: 'dir', children });
    } else if (e.isFile()) {
      state.count += 1;
      const st = await fs.stat(path.join(absDir, e.name));
      nodes.push({ name: e.name, path: childRel, type: 'file', size: st.size });
    }
  }
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function toSkillVersion(owner: string, fm: SkillFrontmatter, updatedAt: string): SkillVersion {
  return {
    owner,
    name: fm.name,
    description: fm.description,
    version: fm.version,
    author: fm.author,
    tags: fm.tags,
    updatedAt,
  };
}

export class FilesystemStorage implements Storage {
  private readonly skillsRoot: string;
  private readonly mutex = new Map<string, Promise<void>>();

  constructor(root: string) {
    this.skillsRoot = path.join(root, 'skills');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.skillsRoot, { recursive: true });
  }

  private ownerDir(owner: string): string {
    sanitizeOwner(owner);
    return path.join(this.skillsRoot, owner);
  }

  private nameDir(owner: string, name: string): string {
    sanitizeName(name);
    return path.join(this.ownerDir(owner), name);
  }

  private versionDir(owner: string, name: string, version: string): string {
    sanitizeVersion(version);
    return path.join(this.nameDir(owner, name), version);
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.mutex.get(key) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    const chained = prev.then(() => next);
    this.mutex.set(key, chained);
    await prev;
    try {
      return await fn();
    } finally {
      release();
      if (this.mutex.get(key) === chained) this.mutex.delete(key);
    }
  }

  async list(): Promise<SkillSummary[]> {
    await this.init();
    const owners = await fs.readdir(this.skillsRoot, { withFileTypes: true });
    const out: SkillSummary[] = [];
    for (const od of owners) {
      if (!od.isDirectory()) continue;
      const ownerPath = path.join(this.skillsRoot, od.name);
      const names = await fs.readdir(ownerPath, { withFileTypes: true }).catch(() => []);
      for (const nd of names) {
        if (!nd.isDirectory()) continue;
        try {
          out.push(await this.getLatest(od.name, nd.name));
        } catch {
          // skip malformed
        }
      }
    }
    return out.sort((a, b) => `${a.owner}/${a.name}`.localeCompare(`${b.owner}/${b.name}`));
  }

  async listVersions(owner: string, name: string): Promise<string[]> {
    const dir = this.nameDir(owner, name);
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    const versions = entries
      .filter((e) => e.isDirectory() && SEMVER_RE.test(e.name))
      .map((e) => e.name);
    return versions.sort(semverCompareDesc);
  }

  async getLatest(owner: string, name: string): Promise<SkillSummary> {
    const versions = await this.listVersions(owner, name);
    if (versions.length === 0) throw new Error(`No versions found for ${owner}/${name}`);
    const latest = versions[0];
    const v = await this.getVersion(owner, name, latest);
    return { ...v, versions };
  }

  async getVersion(owner: string, name: string, version: string): Promise<SkillVersion> {
    const dir = this.versionDir(owner, name, version);
    const skillMd = path.join(dir, 'SKILL.md');
    const [content, stat] = await Promise.all([fs.readFile(skillMd, 'utf8'), fs.stat(dir)]);
    const fm = parseSkillMarkdown(content);
    return toSkillVersion(owner, fm, stat.mtime.toISOString());
  }

  async getReadme(owner: string, name: string, version?: string): Promise<string> {
    const resolved = version ?? (await this.listVersions(owner, name))[0];
    if (!resolved) throw new Error(`No versions for ${owner}/${name}`);
    const dir = this.versionDir(owner, name, resolved);
    const content = await fs.readFile(path.join(dir, 'SKILL.md'), 'utf8');
    return parseSkillMarkdownFull(content).body;
  }

  async exists(owner: string, name: string, version?: string): Promise<boolean> {
    try {
      const dir =
        version === undefined ? this.nameDir(owner, name) : this.versionDir(owner, name, version);
      await fs.stat(dir);
      return true;
    } catch {
      return false;
    }
  }

  async save(
    owner: string,
    name: string,
    version: string,
    tarball: Buffer,
    _author?: Author,
  ): Promise<SkillVersion> {
    return this.withLock(`${owner}/${name}`, async () => {
      await this.init();
      if (await this.exists(owner, name, version)) {
        throw new SkillExistsError(owner, name, version);
      }
      const dir = this.versionDir(owner, name, version);
      await fs.mkdir(path.dirname(dir), { recursive: true });
      const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`;
      await fs.mkdir(tmp, { recursive: true });
      try {
        await new Promise<void>((resolve, reject) => {
          const extract = tarExtract({ cwd: tmp, strip: 1 });
          const input = Readable.from(tarball);
          input.pipe(createGunzip()).pipe(extract);
          extract.on('finish', () => {
            resolve();
          });
          extract.on('error', reject);
          input.on('error', reject);
        });
        const content = await fs.readFile(path.join(tmp, 'SKILL.md'), 'utf8');
        const fm = parseSkillMarkdown(content);
        if (fm.name !== name) {
          throw new Error(`SKILL.md name "${fm.name}" does not match publish target "${name}"`);
        }
        if (fm.version !== version) {
          throw new Error(
            `SKILL.md version "${fm.version}" does not match publish target "${version}"`,
          );
        }
        if (fm.owner && fm.owner !== owner) {
          throw new Error(`SKILL.md owner "${fm.owner}" does not match publish target "${owner}"`);
        }
        await fs.rename(tmp, dir);
        return await this.getVersion(owner, name, version);
      } catch (err) {
        await fs.rm(tmp, { recursive: true, force: true }).catch(() => {
          // best-effort cleanup
        });
        throw err;
      }
    });
  }

  async deleteVersion(
    owner: string,
    name: string,
    version: string,
    _author?: Author,
  ): Promise<boolean> {
    return this.withLock(`${owner}/${name}`, async () => {
      const dir = this.versionDir(owner, name, version);
      const stat = await fs.stat(dir).catch(() => null);
      if (!stat) return false;
      await fs.rm(dir, { recursive: true, force: true });
      const remaining = await this.listVersions(owner, name);
      if (remaining.length === 0) {
        await fs.rm(this.nameDir(owner, name), { recursive: true, force: true }).catch(() => {
          // best-effort
        });
      }
      return true;
    });
  }

  async deleteAll(owner: string, name: string, _author?: Author): Promise<boolean> {
    return this.withLock(`${owner}/${name}`, async () => {
      const dir = this.nameDir(owner, name);
      const stat = await fs.stat(dir).catch(() => null);
      if (!stat) return false;
      await fs.rm(dir, { recursive: true, force: true });
      return true;
    });
  }

  async createDownloadStream(owner: string, name: string, version: string): Promise<Readable> {
    const versionDir = this.versionDir(owner, name, version);
    const entries = await fs.readdir(versionDir);
    const tar = tarCreate(
      { cwd: versionDir, portable: true, prefix: `${name}/` },
      entries,
    ) as unknown as Readable;
    return tar.pipe(createGzip());
  }

  async listFiles(owner: string, name: string, version: string): Promise<FileNode[]> {
    const dir = this.versionDir(owner, name, version);
    await fs.stat(dir);
    return walkTree(dir, '', 0, { count: 0 });
  }

  private resolveFilePath(
    owner: string,
    name: string,
    version: string,
    filePath: string,
  ): { full: string; safe: string } {
    const safe = sanitizeFilePath(filePath);
    const root = this.versionDir(owner, name, version);
    const resolvedRoot = path.resolve(root);
    const full = path.resolve(path.join(resolvedRoot, safe));
    if (full !== resolvedRoot && !full.startsWith(resolvedRoot + path.sep)) {
      throw new Error('Path escapes skill directory');
    }
    return { full, safe };
  }

  async statFile(
    owner: string,
    name: string,
    version: string,
    filePath: string,
  ): Promise<{ size: number; path: string }> {
    const { full, safe } = this.resolveFilePath(owner, name, version, filePath);
    const st = await fs.stat(full);
    if (!st.isFile()) throw new Error('Not a file');
    return { size: st.size, path: safe };
  }

  async readFile(
    owner: string,
    name: string,
    version: string,
    filePath: string,
  ): Promise<ReadFileResult> {
    const { full, safe } = this.resolveFilePath(owner, name, version, filePath);
    const st = await fs.stat(full);
    if (!st.isFile()) throw new Error('Not a file');
    if (st.size > MAX_FILE_BYTES) {
      throw new Error(`File too large (${st.size} bytes; max ${MAX_FILE_BYTES})`);
    }
    const content = await fs.readFile(full);
    return { content, size: st.size, path: safe };
  }
}
