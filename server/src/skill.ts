import YAML from 'yaml';
import { z } from 'zod';

export const OWNER_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,38}$/;

export const SkillFrontmatterSchema = z.object({
  name: z.string().regex(/^[a-z0-9][a-z0-9-_]*$/),
  owner: z.string().regex(OWNER_RE).optional(),
  description: z.string().min(1),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .default('0.1.0'),
  author: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

export interface ParsedSkillMarkdown {
  frontmatter: SkillFrontmatter;
  body: string;
}

export function parseSkillMarkdown(content: string): SkillFrontmatter {
  return parseSkillMarkdownFull(content).frontmatter;
}

export function parseSkillMarkdownFull(content: string): ParsedSkillMarkdown {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) throw new Error('SKILL.md missing frontmatter');
  const raw: unknown = YAML.parse(match[1]);
  const frontmatter = SkillFrontmatterSchema.parse(raw);
  return { frontmatter, body: match[2] };
}
