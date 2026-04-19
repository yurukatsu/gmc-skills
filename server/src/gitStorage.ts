import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { extract as tarExtract } from 'tar';
import { simpleGit, type SimpleGit } from 'simple-git';
import {
  MAX_FILE_BYTES,
  MAX_TREE_FILES,
  NonMonotonicVersionError,
  SEMVER_RE,
  SkillExistsError,
  sanitizeFilePath,
  sanitizeName,
  sanitizeOwner,
  sanitizeVersion,
  semverCompareDesc,
  type Author,
  type FileNode,
  type ReadFileResult,
  type SkillSummary,
  type SkillVersion,
  type Storage,
} from './storage.js';
import { parseSkillMarkdown, parseSkillMarkdownFull, type SkillFrontmatter } from './skill.js';
import { createPullRequest, detectHost, type HostKind, type HostRepoInfo } from './gitHost.js';

export type PublishMode = 'direct' | 'pr';

export interface GitStorageOptions {
  repoUrl: string;
  workDir: string;
  branch: string;
  authorName: string;
  authorEmail: string;
  publishMode: PublishMode;
  hostKind?: HostKind;
  hostToken?: string;
  hostApiBase?: string;
}

const READ_SYNC_TTL_MS = 5000;

interface FlatEntry {
  path: string;
  size: number;
}

function buildTreeFromFlat(flat: FlatEntry[]): FileNode[] {
  interface DirObj {
    __dir: true;
    children: Record<string, DirObj | FlatEntry>;
  }
  const root: DirObj = { __dir: true, children: {} };
  for (const f of flat) {
    const parts = f.path.split('/');
    let cur: DirObj = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      const existing = cur.children[seg] as DirObj | FlatEntry | undefined;
      if (!existing || 'size' in existing) {
        const next: DirObj = { __dir: true, children: {} };
        cur.children[seg] = next;
        cur = next;
      } else {
        cur = existing;
      }
    }
    cur.children[parts[parts.length - 1]] = f;
  }
  function convert(node: DirObj, basePath: string): FileNode[] {
    const result: FileNode[] = [];
    for (const [name, child] of Object.entries(node.children)) {
      const p = basePath ? `${basePath}/${name}` : name;
      if ('size' in child) {
        result.push({ name, path: p, type: 'file', size: child.size });
      } else {
        result.push({ name, path: p, type: 'dir', children: convert(child, p) });
      }
    }
    return result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }
  return convert(root, '');
}

export class GitStorage implements Storage {
  private git!: SimpleGit;
  private globalLock: Promise<void> = Promise.resolve();
  private host: HostRepoInfo | null = null;
  private lastSync = 0;

  constructor(private readonly opts: GitStorageOptions) {}

  async init(): Promise<void> {
    await fs.mkdir(this.opts.workDir, { recursive: true });
    const dotGit = path.join(this.opts.workDir, '.git');
    const alreadyCloned = await fs
      .stat(dotGit)
      .then(() => true)
      .catch(() => false);

    if (!alreadyCloned) {
      const entries = await fs.readdir(this.opts.workDir);
      if (entries.length > 0) {
        throw new Error(
          `Git workdir ${this.opts.workDir} is not empty and not a git clone. Remove it or point GMC_SKILLS_STORAGE elsewhere.`,
        );
      }
      await simpleGit().clone(this.opts.repoUrl, this.opts.workDir, ['-b', this.opts.branch]);
    }

    this.git = simpleGit(this.opts.workDir);
    if (alreadyCloned) {
      await this.syncLatest();
    }
    this.lastSync = Date.now();
    await this.git.addConfig('user.name', this.opts.authorName);
    await this.git.addConfig('user.email', this.opts.authorEmail);

    const detected = detectHost(this.opts.repoUrl, this.opts.hostKind);
    this.host = detected
      ? { ...detected, apiBase: this.opts.hostApiBase ?? detected.apiBase }
      : null;
    if (this.opts.publishMode === 'pr') {
      if (!this.host) {
        throw new Error(
          'PR mode requires a GitHub or GitLab repo URL. For self-hosted GitLab, set GMC_SKILLS_GIT_HOST=gitlab.',
        );
      }
      if (!this.resolveHostToken()) {
        throw new Error(
          'PR mode requires an API token. Set GMC_SKILLS_HOST_TOKEN or embed it in GMC_SKILLS_GIT_REPO as https://<user>:<token>@<host>/...',
        );
      }
    }
  }

  private resolveHostToken(): string | undefined {
    return this.opts.hostToken ?? this.host?.token;
  }

  private async withGlobalLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.globalLock;
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    this.globalLock = prev.then(() => next);
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private async syncLatest(): Promise<void> {
    await this.git.raw(['fetch', '--prune', '--prune-tags', '--tags', 'origin', this.opts.branch]);
    await this.git.reset(['--hard', `origin/${this.opts.branch}`]);
  }

  private async ensureFreshRead(): Promise<void> {
    if (Date.now() - this.lastSync < READ_SYNC_TTL_MS) return;
    await this.withGlobalLock(async () => {
      if (Date.now() - this.lastSync < READ_SYNC_TTL_MS) return;
      await this.syncLatest();
      this.lastSync = Date.now();
    });
  }

  private skillsRoot(): string {
    return path.join(this.opts.workDir, 'skills');
  }

  private skillDir(owner: string, name: string): string {
    sanitizeOwner(owner);
    sanitizeName(name);
    return path.join(this.skillsRoot(), owner, name);
  }

  private tagFor(owner: string, name: string, version: string): string {
    return `${owner}/${name}@${version}`;
  }

  private async tagExists(tag: string): Promise<boolean> {
    const out = await this.git.raw(['tag', '-l', tag]);
    return out.trim().length > 0;
  }

  private async listTagsForSkill(owner: string, name: string): Promise<string[]> {
    sanitizeOwner(owner);
    sanitizeName(name);
    const prefix = `${owner}/${name}@`;
    const out = await this.git.raw(['tag', '-l', `${prefix}*`]);
    const versions: string[] = [];
    for (const line of out.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed.startsWith(prefix)) continue;
      const v = trimmed.slice(prefix.length);
      if (SEMVER_RE.test(v)) versions.push(v);
    }
    return versions.sort(semverCompareDesc);
  }

  private async commitTime(ref: string, pathspec?: string): Promise<string> {
    try {
      const out = pathspec
        ? await this.git.raw(['log', '-1', '--format=%cI', ref, '--', pathspec])
        : await this.git.raw(['log', '-1', '--format=%cI', ref]);
      const trimmed = out.trim();
      return trimmed.length > 0 ? trimmed : new Date().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }

  async list(): Promise<SkillSummary[]> {
    await this.ensureFreshRead();
    const owners = await fs.readdir(this.skillsRoot(), { withFileTypes: true }).catch(() => []);
    const out: SkillSummary[] = [];
    for (const od of owners) {
      if (!od.isDirectory()) continue;
      const ownerPath = path.join(this.skillsRoot(), od.name);
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
    await this.ensureFreshRead();
    return this.listTagsForSkill(owner, name);
  }

  async getLatest(owner: string, name: string): Promise<SkillSummary> {
    await this.ensureFreshRead();
    const dir = this.skillDir(owner, name);
    const skillMdPath = path.join(dir, 'SKILL.md');
    const content = await fs.readFile(skillMdPath, 'utf8');
    const fm = parseSkillMarkdown(content);
    const [versions, updatedAt] = await Promise.all([
      this.listTagsForSkill(owner, name),
      this.commitTime('HEAD', `skills/${owner}/${name}`),
    ]);
    return {
      owner,
      name: fm.name,
      description: fm.description,
      version: fm.version,
      author: fm.author,
      tags: fm.tags,
      updatedAt,
      versions,
    };
  }

  async getReadme(owner: string, name: string, version?: string): Promise<string> {
    sanitizeOwner(owner);
    sanitizeName(name);
    await this.ensureFreshRead();
    if (version) {
      sanitizeVersion(version);
      const tag = this.tagFor(owner, name, version);
      if (!(await this.tagExists(tag))) {
        throw new Error(`${owner}/${name}@${version} not found`);
      }
      const content = await this.git.raw(['show', `${tag}:skills/${owner}/${name}/SKILL.md`]);
      return parseSkillMarkdownFull(content).body;
    }
    // latest: read from workdir
    const skillMdPath = path.join(this.skillDir(owner, name), 'SKILL.md');
    const content = await fs.readFile(skillMdPath, 'utf8');
    return parseSkillMarkdownFull(content).body;
  }

  async getVersion(owner: string, name: string, version: string): Promise<SkillVersion> {
    sanitizeOwner(owner);
    sanitizeName(name);
    sanitizeVersion(version);
    await this.ensureFreshRead();
    const tag = this.tagFor(owner, name, version);
    if (!(await this.tagExists(tag))) {
      throw new Error(`${owner}/${name}@${version} not found`);
    }
    const content = await this.git.raw(['show', `${tag}:skills/${owner}/${name}/SKILL.md`]);
    const fm = parseSkillMarkdown(content);
    const updatedAt = await this.commitTime(tag);
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

  async exists(owner: string, name: string, version?: string): Promise<boolean> {
    await this.ensureFreshRead();
    if (version === undefined) {
      try {
        await fs.stat(this.skillDir(owner, name));
        return true;
      } catch {
        return false;
      }
    }
    sanitizeVersion(version);
    return this.tagExists(this.tagFor(owner, name, version));
  }

  private async extractAndValidate(
    tmp: string,
    tarball: Buffer,
    owner: string,
    name: string,
    version: string,
  ): Promise<SkillFrontmatter> {
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
    return fm;
  }

  async save(
    owner: string,
    name: string,
    version: string,
    tarball: Buffer,
    author?: Author,
  ): Promise<SkillVersion> {
    sanitizeOwner(owner);
    sanitizeName(name);
    sanitizeVersion(version);
    return this.withGlobalLock(async () => {
      await this.syncLatest();
      this.lastSync = Date.now();

      const tag = this.tagFor(owner, name, version);
      if (await this.tagExists(tag)) {
        throw new SkillExistsError(owner, name, version);
      }

      const dir = this.skillDir(owner, name);
      const existingVersion = await fs
        .readFile(path.join(dir, 'SKILL.md'), 'utf8')
        .then((c) => parseSkillMarkdown(c).version)
        .catch(() => null);
      if (existingVersion && semverCompareDesc(version, existingVersion) >= 0) {
        throw new NonMonotonicVersionError(owner, name, version, existingVersion);
      }

      if (this.opts.publishMode === 'pr') {
        return this.saveViaPullRequest(owner, name, version, tarball, author);
      }
      return this.saveDirect(owner, name, version, tarball, author);
    });
  }

  private async saveDirect(
    owner: string,
    name: string,
    version: string,
    tarball: Buffer,
    author?: Author,
  ): Promise<SkillVersion> {
    const dir = this.skillDir(owner, name);
    const tag = this.tagFor(owner, name, version);
    await fs.mkdir(path.dirname(dir), { recursive: true });
    const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`;
    await fs.mkdir(tmp, { recursive: true });
    try {
      const fm = await this.extractAndValidate(tmp, tarball, owner, name, version);
      await fs.rm(dir, { recursive: true, force: true });
      await fs.rename(tmp, dir);

      await this.git.add(['-A']);
      const message = `publish ${owner}/${name}@${version}`;
      if (author) {
        await this.git.raw(['commit', '-m', message, `--author=${author.name} <${author.email}>`]);
      } else {
        await this.git.commit(message);
      }
      await this.git.addTag(tag);
      await this.git.push('origin', this.opts.branch);
      await this.git.raw(['push', 'origin', `refs/tags/${tag}`]);

      return {
        owner,
        name: fm.name,
        description: fm.description,
        version: fm.version,
        author: fm.author,
        tags: fm.tags,
        updatedAt: new Date().toISOString(),
      };
    } catch (err) {
      await fs.rm(tmp, { recursive: true, force: true }).catch(() => {
        // best-effort cleanup
      });
      throw err;
    }
  }

  private async saveViaPullRequest(
    owner: string,
    name: string,
    version: string,
    tarball: Buffer,
    author?: Author,
  ): Promise<SkillVersion> {
    if (!this.host) throw new Error('PR mode requires a supported host');
    const token = this.resolveHostToken();
    if (!token) throw new Error('PR mode requires an API token');

    const tag = this.tagFor(owner, name, version);
    const prBranch = `gmc-publish/${owner}/${name}/${version}`;
    const worktree = path.join(os.tmpdir(), `gmc-worktree-${randomUUID()}`);

    await this.git.raw(['worktree', 'add', '-b', prBranch, worktree, `origin/${this.opts.branch}`]);

    let branchPushed = false;
    let tagPushed = false;
    try {
      const wGit = simpleGit(worktree);
      const dir = path.join(worktree, 'skills', owner, name);
      await fs.mkdir(path.dirname(dir), { recursive: true });
      const tmp = `${dir}.tmp-${process.pid}-${Date.now()}`;
      await fs.mkdir(tmp, { recursive: true });
      let fm: SkillFrontmatter;
      try {
        fm = await this.extractAndValidate(tmp, tarball, owner, name, version);
        await fs.rm(dir, { recursive: true, force: true });
        await fs.rename(tmp, dir);
      } catch (err) {
        await fs.rm(tmp, { recursive: true, force: true }).catch(() => {
          // best-effort
        });
        throw err;
      }

      await wGit.add(['-A']);
      const message = `publish ${owner}/${name}@${version}`;
      if (author) {
        await wGit.raw(['commit', '-m', message, `--author=${author.name} <${author.email}>`]);
      } else {
        await wGit.commit(message);
      }
      await wGit.addTag(tag);
      await wGit.push(['-u', 'origin', prBranch]);
      branchPushed = true;
      await wGit.raw(['push', 'origin', `refs/tags/${tag}`]);
      tagPushed = true;

      const prBody = [
        `Publishing \`${owner}/${name}@${version}\`.`,
        '',
        `- Tag: \`${tag}\` (pushed to origin)`,
        author
          ? `- Requested by: ${author.name} <${author.email}>`
          : '- Requested by: (no user identity configured)',
        '',
        'Merging this PR puts the latest version on the default branch. The install-by-version endpoint already works via the tag.',
      ].join('\n');

      const pr = await createPullRequest(this.host, token, {
        title: `publish ${owner}/${name}@${version}`,
        sourceBranch: prBranch,
        targetBranch: this.opts.branch,
        body: prBody,
      });

      return {
        owner,
        name: fm.name,
        description: fm.description,
        version: fm.version,
        author: fm.author,
        tags: fm.tags,
        updatedAt: new Date().toISOString(),
        prUrl: pr.url,
      };
    } catch (err) {
      if (tagPushed) {
        await this.git.raw(['push', 'origin', `:refs/tags/${tag}`]).catch(() => {
          // ignore
        });
      }
      if (branchPushed) {
        await this.git.raw(['push', 'origin', `:${prBranch}`]).catch(() => {
          // ignore
        });
      }
      throw err;
    } finally {
      await this.git.raw(['worktree', 'remove', '--force', worktree]).catch(() => {
        // ignore
      });
      await this.git.raw(['branch', '-D', prBranch]).catch(() => {
        // ignore
      });
    }
  }

  async deleteVersion(
    owner: string,
    name: string,
    version: string,
    _author?: Author,
  ): Promise<boolean> {
    sanitizeOwner(owner);
    sanitizeName(name);
    sanitizeVersion(version);
    return this.withGlobalLock(async () => {
      await this.syncLatest();
      this.lastSync = Date.now();
      const tag = this.tagFor(owner, name, version);
      if (!(await this.tagExists(tag))) return false;

      const versions = await this.listTagsForSkill(owner, name);
      if (versions[0] === version) {
        throw new Error(
          `Cannot delete latest version ${owner}/${name}@${version}. Publish a newer version first, or use "unpublish --all".`,
        );
      }

      await this.git.raw(['tag', '-d', tag]);
      await this.git.raw(['push', 'origin', `:refs/tags/${tag}`]);
      return true;
    });
  }

  async deleteAll(owner: string, name: string, author?: Author): Promise<boolean> {
    sanitizeOwner(owner);
    sanitizeName(name);
    return this.withGlobalLock(async () => {
      await this.syncLatest();
      this.lastSync = Date.now();

      const dir = this.skillDir(owner, name);
      const dirExists = await fs
        .stat(dir)
        .then(() => true)
        .catch(() => false);
      const versions = await this.listTagsForSkill(owner, name);

      if (!dirExists && versions.length === 0) return false;

      if (dirExists) {
        await fs.rm(dir, { recursive: true, force: true });
        // Also remove empty owner dir if this was the last skill of that owner
        const ownerDir = path.dirname(dir);
        const remaining = await fs.readdir(ownerDir).catch(() => []);
        if (remaining.length === 0) {
          await fs.rm(ownerDir, { recursive: true, force: true }).catch(() => {
            // best-effort
          });
        }
        await this.git.add(['-A']);
        const status = await this.git.status();
        if (!status.isClean()) {
          const message = `delete ${owner}/${name} (all versions)`;
          if (author) {
            await this.git.raw([
              'commit',
              '-m',
              message,
              `--author=${author.name} <${author.email}>`,
            ]);
          } else {
            await this.git.commit(message);
          }
          await this.git.push('origin', this.opts.branch);
        }
      }

      for (const v of versions) {
        const tag = this.tagFor(owner, name, v);
        await this.git.raw(['tag', '-d', tag]).catch(() => {
          // best-effort
        });
        await this.git.raw(['push', 'origin', `:refs/tags/${tag}`]).catch(() => {
          // best-effort
        });
      }
      return true;
    });
  }

  async listFiles(owner: string, name: string, version: string): Promise<FileNode[]> {
    sanitizeOwner(owner);
    sanitizeName(name);
    sanitizeVersion(version);
    await this.ensureFreshRead();
    const tag = this.tagFor(owner, name, version);
    if (!(await this.tagExists(tag))) {
      throw new Error(`${owner}/${name}@${version} not found`);
    }
    const prefix = `skills/${owner}/${name}/`;
    const out = await this.git.raw(['ls-tree', '-r', '--long', tag, prefix]);
    const flat: FlatEntry[] = [];
    for (const line of out.split('\n')) {
      const trimmed = line.trimEnd();
      if (!trimmed) continue;
      const m = /^\d+\s+blob\s+[0-9a-f]+\s+(\d+)\t(.+)$/.exec(trimmed);
      if (!m) continue;
      const size = Number.parseInt(m[1], 10);
      const fullPath = m[2];
      if (!fullPath.startsWith(prefix)) continue;
      const rel = fullPath.slice(prefix.length);
      if (flat.length >= MAX_TREE_FILES) break;
      flat.push({ path: rel, size });
    }
    return buildTreeFromFlat(flat);
  }

  private async lookupBlobSize(
    owner: string,
    name: string,
    version: string,
    filePath: string,
  ): Promise<{ size: number; safe: string; tag: string }> {
    sanitizeOwner(owner);
    sanitizeName(name);
    sanitizeVersion(version);
    const safe = sanitizeFilePath(filePath);
    await this.ensureFreshRead();
    const tag = this.tagFor(owner, name, version);
    if (!(await this.tagExists(tag))) {
      throw new Error(`${owner}/${name}@${version} not found`);
    }
    const lsOut = await this.git.raw(['ls-tree', '--long', tag, `skills/${owner}/${name}/${safe}`]);
    const sizeMatch = /^\d+\s+blob\s+[0-9a-f]+\s+(\d+)\t/.exec(lsOut.trim());
    if (!sizeMatch) throw new Error('Not a file');
    return { size: Number.parseInt(sizeMatch[1], 10), safe, tag };
  }

  async statFile(
    owner: string,
    name: string,
    version: string,
    filePath: string,
  ): Promise<{ size: number; path: string }> {
    const { size, safe } = await this.lookupBlobSize(owner, name, version, filePath);
    return { size, path: safe };
  }

  async readFile(
    owner: string,
    name: string,
    version: string,
    filePath: string,
  ): Promise<ReadFileResult> {
    const { size, safe, tag } = await this.lookupBlobSize(owner, name, version, filePath);
    if (size > MAX_FILE_BYTES) {
      throw new Error(`File too large (${size} bytes; max ${MAX_FILE_BYTES})`);
    }
    const ref = `${tag}:skills/${owner}/${name}/${safe}`;
    const content = await this.gitShowBinary(ref);
    return { content, size, path: safe };
  }

  private gitShowBinary(ref: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const child = spawn('git', ['-C', this.opts.workDir, 'show', ref]);
      const chunks: Buffer[] = [];
      let stderr = '';
      child.stdout.on('data', (c: Buffer) => chunks.push(c));
      child.stderr.on('data', (c: Buffer) => {
        stderr += c.toString('utf8');
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code !== 0) reject(new Error(`git show failed (${code ?? -1}): ${stderr.trim()}`));
        else resolve(Buffer.concat(chunks));
      });
    });
  }

  async createDownloadStream(owner: string, name: string, version: string): Promise<Readable> {
    sanitizeOwner(owner);
    sanitizeName(name);
    sanitizeVersion(version);
    await this.ensureFreshRead();
    const tag = this.tagFor(owner, name, version);
    const hasTag = await this.tagExists(tag);

    let treeish: string;
    if (hasTag) {
      treeish = `${tag}:skills/${owner}/${name}`;
    } else {
      const skillMdPath = path.join(this.skillDir(owner, name), 'SKILL.md');
      const content = await fs.readFile(skillMdPath, 'utf8').catch(() => null);
      if (content === null) throw new Error(`${owner}/${name}@${version} not found`);
      const fm = parseSkillMarkdown(content);
      if (fm.version !== version) {
        throw new Error(
          `${owner}/${name}@${version} not found (no tag; HEAD has ${fm.name}@${fm.version})`,
        );
      }
      treeish = `HEAD:skills/${owner}/${name}`;
    }

    const proc = spawn('git', [
      '-C',
      this.opts.workDir,
      'archive',
      '--format=tar.gz',
      `--prefix=${name}/`,
      treeish,
    ]);
    proc.stderr.on('data', (chunk: Buffer) => {
      console.error(`git archive: ${chunk.toString('utf8')}`);
    });
    return proc.stdout;
  }
}
