import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isErrnoException } from '../errors.js';

export async function initCommand(name: string, opts: { dir?: string }): Promise<void> {
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(name)) {
    throw new Error('Skill name must be lowercase alphanumeric with -/_');
  }
  const parent = path.resolve(opts.dir ?? process.cwd());
  const target = path.join(parent, name);

  try {
    await fs.mkdir(target, { recursive: false });
  } catch (err) {
    if (isErrnoException(err) && err.code === 'EEXIST') {
      throw new Error(`Directory already exists: ${target}`);
    }
    throw err;
  }

  const skillMd = `---
name: ${name}
description: One-line description of what this skill does
version: 0.1.0
---

# ${name}

Describe when to use this skill and how to follow it.

## Instructions

1. Step one
2. Step two
`;
  await fs.writeFile(path.join(target, 'SKILL.md'), skillMd);
  const rel = path.relative(process.cwd(), target);
  console.log(`Created ${target}`);
  console.log(`  Edit SKILL.md, then run: gmc-skills publish ${rel === '' ? '.' : rel}`);
}
