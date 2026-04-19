import { promises as fs } from 'node:fs';
import path from 'node:path';
import { extract as tarExtract } from 'tar';
import { requireRegistry, loadConfig } from '../config.js';
import { RegistryClient } from '../client.js';
import { resolveTarget } from '../targets.js';
import { parseSkillRef } from '../ref.js';

export async function installCommand(
  ref: string,
  opts: { target?: string; path?: string; local?: boolean },
): Promise<void> {
  const { owner, name, version: requestedVersion } = parseSkillRef(ref);
  const config = await loadConfig();
  const { registry, token } = await requireRegistry();
  const client = new RegistryClient(registry, token);

  let version = requestedVersion;
  if (!version) {
    const summary = await client.getLatest(owner, name);
    version = summary.version;
  }

  const baseDir = resolveTarget({
    target: opts.target,
    path: opts.path,
    local: opts.local,
    config,
  });
  await fs.mkdir(baseDir, { recursive: true });

  const destDir = path.join(baseDir, name);
  await fs.rm(destDir, { recursive: true, force: true });

  const stream = await client.download(owner, name, version);
  await new Promise<void>((resolve, reject) => {
    const extract = tarExtract({ cwd: baseDir, strip: 0 });
    stream.pipe(extract);
    extract.on('finish', () => {
      resolve();
    });
    extract.on('error', reject);
    stream.on('error', reject);
  });

  console.log(`Installed ${owner}/${name}@${version} → ${destDir}`);
}
