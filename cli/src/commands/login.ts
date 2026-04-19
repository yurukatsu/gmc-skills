import { loadConfig, saveConfig, type Config } from '../config.js';
import { OWNER_RE } from '../skill.js';

export interface LoginOptions {
  registry?: string;
  token?: string;
  email?: string;
  name?: string;
  gitlabAccount?: string;
}

export async function loginCommand(opts: LoginOptions): Promise<void> {
  if (!opts.registry && !opts.token && !opts.email && !opts.name && !opts.gitlabAccount) {
    throw new Error(
      'Provide at least one of --registry, --token, --email, --name, --gitlab-account.',
    );
  }
  if (opts.gitlabAccount && !OWNER_RE.test(opts.gitlabAccount)) {
    throw new Error(
      `Invalid --gitlab-account "${opts.gitlabAccount}". Must be alphanumeric with -/_ (e.g. gm2101111).`,
    );
  }
  const existing = await loadConfig();

  let user = existing.user;
  if (opts.email) {
    user = {
      email: opts.email,
      ...((opts.name ?? user?.name) ? { name: opts.name ?? user?.name } : {}),
      ...((opts.gitlabAccount ?? user?.gitlabAccount)
        ? { gitlabAccount: opts.gitlabAccount ?? user?.gitlabAccount }
        : {}),
    };
  } else if (opts.name || opts.gitlabAccount) {
    if (!user) {
      throw new Error('--email is required when configuring user identity for the first time.');
    }
    user = {
      ...user,
      ...(opts.name ? { name: opts.name } : {}),
      ...(opts.gitlabAccount ? { gitlabAccount: opts.gitlabAccount } : {}),
    };
  }

  const next: Config = {
    ...existing,
    ...(opts.registry ? { registry: opts.registry } : {}),
    ...(opts.token ? { token: opts.token } : {}),
    ...(user ? { user } : {}),
  };
  await saveConfig(next);
  console.log('Saved config to ~/.gmc-skills/config.json');
  if (next.registry) console.log(`  registry: ${next.registry}`);
  if (next.token) console.log(`  token: ${'*'.repeat(Math.min(next.token.length, 8))}`);
  if (next.user) {
    console.log(`  user: ${next.user.name ?? next.user.email} <${next.user.email}>`);
    if (next.user.gitlabAccount) console.log(`  gitlab account: ${next.user.gitlabAccount}`);
  }
}
