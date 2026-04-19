import { loadConfig, requireRegistry } from '../config.js';
import { RegistryClient } from '../client.js';
import { authorFromConfig, parseSkillRef } from '../ref.js';

export async function unpublishCommand(ref: string, opts: { all?: boolean }): Promise<void> {
  const { owner, name, version } = parseSkillRef(ref);
  const config = await loadConfig();
  const { registry, token } = await requireRegistry();
  if (!token) {
    throw new Error('Auth token required to unpublish. Run: gmc-skills login --token <token>');
  }
  const client = new RegistryClient(registry, token);
  const author = authorFromConfig(config.user);

  if (version) {
    await client.deleteVersion(owner, name, version, author);
    console.log(`Unpublished ${owner}/${name}@${version}`);
    return;
  }
  if (!opts.all) {
    throw new Error(
      `Specify a version (${owner}/${name}@<version>) or pass --all to remove every version.`,
    );
  }
  await client.deleteAll(owner, name, author);
  console.log(`Unpublished ${owner}/${name} (all versions)`);
}
