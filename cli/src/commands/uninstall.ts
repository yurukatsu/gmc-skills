import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config.js';
import { resolveTarget } from '../targets.js';
import { parseSkillRef } from '../ref.js';

export async function uninstallCommand(
  ref: string,
  opts: { target?: string; path?: string; local?: boolean },
): Promise<void> {
  const { name } = parseSkillRef(ref);
  const config = await loadConfig();
  const baseDir = resolveTarget({
    target: opts.target,
    path: opts.path,
    local: opts.local,
    config,
  });
  const destDir = path.join(baseDir, name);

  const stat = await fs.stat(destDir).catch(() => null);
  if (!stat) {
    console.log(`Not installed: ${destDir}`);
    return;
  }
  await fs.rm(destDir, { recursive: true, force: true });
  console.log(`Uninstalled ${name} from ${destDir}`);
}
