import { promises as fs } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { z } from 'zod';
import { isErrnoException } from './errors.js';

export const OWNER_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,38}$/;

export const SkillFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-_]*$/, 'name must be lowercase alphanumeric with -/_'),
  owner: z
    .string()
    .regex(OWNER_RE, 'owner must be alphanumeric with -/_ (e.g. gm2101111)')
    .optional(),
  description: z.string().min(1),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'version must be semver (x.y.z)')
    .default('0.1.0'),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export function parseSkillMarkdown(content: string): {
  frontmatter: SkillFrontmatter;
  body: string;
} {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) {
    throw new Error('SKILL.md missing frontmatter (--- block at top of file)');
  }
  const [, yamlBlock, body] = match;
  const raw: unknown = YAML.parse(yamlBlock);
  const frontmatter = SkillFrontmatterSchema.parse(raw);
  return { frontmatter, body };
}

export async function readSkillDir(
  dir: string,
): Promise<{ frontmatter: SkillFrontmatter; body: string }> {
  const skillPath = path.join(dir, 'SKILL.md');
  try {
    const content = await fs.readFile(skillPath, 'utf8');
    return parseSkillMarkdown(content);
  } catch (err) {
    if (isErrnoException(err) && err.code === 'ENOENT') {
      throw new Error(`SKILL.md not found in ${dir}`);
    }
    throw err;
  }
}
