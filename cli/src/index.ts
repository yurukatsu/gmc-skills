#!/usr/bin/env node
import { Command } from 'commander';
import { loginCommand } from './commands/login.js';
import { initCommand } from './commands/init.js';
import { publishCommand } from './commands/publish.js';
import { installCommand } from './commands/install.js';
import { uninstallCommand } from './commands/uninstall.js';
import { listCommand } from './commands/list.js';
import { searchCommand } from './commands/search.js';
import { infoCommand } from './commands/info.js';
import { unpublishCommand } from './commands/unpublish.js';

const program = new Command();

program
  .name('gmc-skills')
  .description('CLI for the gmc-skills internal SKILL registry')
  .version('0.1.0');

program
  .command('login')
  .description('Save registry URL, auth token, and user identity to ~/.gmc-skills/config.json')
  .option('-r, --registry <url>', 'Registry server URL')
  .option('-t, --token <token>', 'Auth token')
  .option('-e, --email <email>', 'Your email (used as commit author for publishes)')
  .option('-n, --name <name>', 'Your display name (defaults to email if omitted)')
  .option(
    '-g, --gitlab-account <account>',
    'Your GitLab account name; used as default owner (e.g. gm2101111)',
  )
  .action(loginCommand);

program
  .command('init <name>')
  .description('Scaffold a new SKILL directory with SKILL.md')
  .option('-d, --dir <path>', 'Parent directory (default: current)')
  .action(initCommand);

program
  .command('publish [path]')
  .description('Publish the SKILL at the given path (or current directory)')
  .option(
    '-v, --as <version>',
    'override the version from SKILL.md (e.g. 0.2.0); on-disk SKILL.md is not modified',
  )
  .action(publishCommand);

program
  .command('unpublish <ref>')
  .description(
    'Remove a SKILL version (name@version) or all versions (name --all) from the registry',
  )
  .option('--all', 'Delete every version of the named skill')
  .action(unpublishCommand);

program
  .command('install <ref>')
  .description('Install a SKILL. Use "name" (latest) or "name@version".')
  .option('-t, --target <agent>', 'Target agent: claude, opencode, cline, codex, gemini', 'claude')
  .option('-p, --path <path>', 'Custom install path (overrides --target)')
  .option('--local', 'Install into ./<agent-dir>/skills instead of $HOME')
  .action(installCommand);

program
  .command('uninstall <ref>')
  .description('Remove an installed SKILL (version part of ref is ignored)')
  .option('-t, --target <agent>', 'Target agent', 'claude')
  .option('-p, --path <path>', 'Custom install path')
  .action(uninstallCommand);

program
  .command('list')
  .description('List all SKILLs in the registry (paginated)')
  .option('-p, --page <n>', 'Page number (1-based)', '1')
  .option('-P, --per-page <n>', 'Entries per page', '50')
  .action(listCommand);

program
  .command('search [query]')
  .alias('find')
  .description(
    'Search the registry. Accepts a text query and/or filters (--owner, --tag). `find` is an alias.',
  )
  .option('-o, --owner <account>', 'Filter to a specific owner (exact match)')
  .option('-T, --tag <tag>', 'Filter to skills that have this tag (exact match)')
  .option('-l, --limit <n>', 'Alias for --per-page (legacy)')
  .option('-p, --page <n>', 'Page number (1-based)', '1')
  .option('-P, --per-page <n>', 'Entries per page', '50')
  .action(searchCommand);

program
  .command('info <ref>')
  .description('Show metadata. Use "name" (latest + versions list) or "name@version".')
  .action(infoCommand);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
