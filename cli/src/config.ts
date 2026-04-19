import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import { isErrnoException } from './errors.js';
import { OWNER_RE } from './skill.js';

const CONFIG_DIR = path.join(os.homedir(), '.gmc-skills');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

const ConfigSchema = z.object({
  registry: z.string().url().optional(),
  token: z.string().optional(),
  defaultTarget: z.string().optional(),
  targets: z.record(z.string()).optional(),
  user: z
    .object({
      email: z.string().email(),
      name: z.string().optional(),
      gitlabAccount: z.string().regex(OWNER_RE).optional(),
    })
    .optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export async function loadConfig(): Promise<Config> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    return ConfigSchema.parse(JSON.parse(raw) as unknown);
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') return {};
    throw err;
  }
}

export async function saveConfig(config: Config): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

export async function requireRegistry(): Promise<{ registry: string; token?: string }> {
  const config = await loadConfig();
  const registry = process.env.GMC_SKILLS_REGISTRY ?? config.registry;
  const token = process.env.GMC_SKILLS_TOKEN ?? config.token;
  if (!registry) {
    throw new Error(
      'Registry URL not configured. Run: gmc-skills login --registry <url> --token <token>',
    );
  }
  return { registry, token };
}
