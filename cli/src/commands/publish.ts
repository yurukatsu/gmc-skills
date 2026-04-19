import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { create as tarCreate } from 'tar';
import type { Readable } from 'node:stream';
import YAML from 'yaml';
import { loadConfig, requireRegistry } from '../config.js';
import { readSkillDir } from '../skill.js';
import { RegistryClient } from '../client.js';
import { authorFromConfig } from '../ref.js';

const IGNORE_ENTRIES = new Set(['node_modules', '.git', '.DS_Store', 'dist']);
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

async function listSkillEntries(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => !IGNORE_ENTRIES.has(e.name)).map((e) => e.name);
}

async function streamToBuffer(stream: Readable): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function rewriteSkillVersion(content: string, newVersion: string): string {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!m) throw new Error('SKILL.md missing frontmatter');
  const parsed = YAML.parse(m[1]) as Record<string, unknown>;
  parsed.version = newVersion;
  const rebuilt = YAML.stringify(parsed).trimEnd();
  return content.replace(m[0], `---\n${rebuilt}\n---`);
}

async function stagingDirFor(srcDir: string, newVersion: string): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'gmc-publish-'));
  await fs.cp(srcDir, tmp, {
    recursive: true,
    filter: (src) => {
      const base = path.basename(src);
      return !IGNORE_ENTRIES.has(base);
    },
  });
  const mdPath = path.join(tmp, 'SKILL.md');
  const content = await fs.readFile(mdPath, 'utf8');
  await fs.writeFile(mdPath, rewriteSkillVersion(content, newVersion));
  return tmp;
}

export interface PublishOptions {
  as?: string;
}

export async function publishCommand(
  dirArg: string | undefined,
  opts: PublishOptions,
): Promise<void> {
  const dir = path.resolve(dirArg ?? process.cwd());
  const stat = await fs.stat(dir).catch(() => null);
  if (!stat?.isDirectory()) throw new Error(`Not a directory: ${dir}`);

  if (opts.as !== undefined && !SEMVER_RE.test(opts.as)) {
    throw new Error(`--as "${opts.as}" is not a valid semver (x.y.z)`);
  }

  const { frontmatter } = await readSkillDir(dir);
  const effectiveVersion = opts.as ?? frontmatter.version;
  const overridden = opts.as !== undefined && opts.as !== frontmatter.version;

  const config = await loadConfig();
  const owner = frontmatter.owner ?? config.user?.gitlabAccount;
  if (!owner) {
    throw new Error(
      'Owner (GitLab account) not set. Add "owner:" to SKILL.md, or run `gmc-skills login --gitlab-account <your-account>`.',
    );
  }

  const { registry, token } = await requireRegistry();
  if (!token) {
    throw new Error('Auth token required to publish. Run: gmc-skills login --token <token>');
  }

  const srcDir = overridden ? await stagingDirFor(dir, effectiveVersion) : dir;
  try {
    const entries = await listSkillEntries(srcDir);
    const tarStream = tarCreate(
      { gzip: true, cwd: srcDir, portable: true, prefix: `${frontmatter.name}/` },
      entries,
    ) as unknown as Readable;
    const tarball = await streamToBuffer(tarStream);

    const client = new RegistryClient(registry, token);
    const author = authorFromConfig(config.user);
    const result = await client.publish(owner, frontmatter.name, effectiveVersion, tarball, author);
    console.log(
      `Published ${owner}/${frontmatter.name}@${effectiveVersion} (${tarball.length} bytes)`,
    );
    if (overridden) {
      console.log(
        `  (overrode SKILL.md version ${frontmatter.version} → ${effectiveVersion} — on-disk SKILL.md unchanged)`,
      );
    }
    if (result.prUrl) {
      console.log(`  PR opened: ${result.prUrl}`);
      console.log(
        '  Install-by-version works immediately via the tag; merge the PR to set latest.',
      );
    }
    if (!author) {
      console.log(
        '  (no user identity configured — commits will use server default; run `gmc-skills login --email you@example.com` to attribute)',
      );
    }
  } finally {
    if (overridden && srcDir !== dir) {
      await fs.rm(srcDir, { recursive: true, force: true }).catch(() => {
        // best-effort cleanup
      });
    }
  }
}
