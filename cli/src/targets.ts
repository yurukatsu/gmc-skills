import path from 'node:path';
import os from 'node:os';
import type { Config } from './config.js';

export const DEFAULT_TARGETS: Record<string, string> = {
  claude: '~/.claude/skills',
  opencode: '~/.config/opencode/skills',
  cline: '~/.vscode/extensions/.cline/skills',
  codex: '~/.codex/skills',
  gemini: '~/.gemini/skills',
};

export const LOCAL_TARGETS: Record<string, string> = {
  claude: '.claude/skills',
  opencode: '.opencode/skills',
  cline: '.cline/skills',
  codex: '.codex/skills',
  gemini: '.gemini/skills',
};

function expandHome(p: string): string {
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  if (p === '~') return os.homedir();
  return p;
}

export function resolveTarget(opts: {
  target?: string;
  path?: string;
  local?: boolean;
  config: Config;
}): string {
  if (opts.path) return path.resolve(expandHome(opts.path));

  const targetName = opts.target ?? opts.config.defaultTarget ?? 'claude';
  const override = opts.config.targets?.[targetName];
  if (override) return path.resolve(expandHome(override));

  const table = opts.local ? LOCAL_TARGETS : DEFAULT_TARGETS;
  const base = table[targetName];
  if (!base) {
    throw new Error(
      `Unknown target "${targetName}". Known targets: ${Object.keys(DEFAULT_TARGETS).join(', ')}. Use --path for a custom location.`,
    );
  }
  return opts.local ? path.resolve(base) : expandHome(base);
}
