import { requireRegistry } from '../config.js';
import { RegistryClient, type SkillVersion } from '../client.js';
import { parseSkillRef } from '../ref.js';

function printRecord(r: SkillVersion): void {
  console.log(`Name:        ${r.owner}/${r.name}`);
  console.log(`Version:     ${r.version}`);
  console.log(`Description: ${r.description}`);
  if (r.author) console.log(`Author:      ${r.author}`);
  if (r.tags?.length) console.log(`Tags:        ${r.tags.join(', ')}`);
  console.log(`Updated:     ${r.updatedAt}`);
  if (r.downloads !== undefined) console.log(`Downloads:   ${r.downloads.toLocaleString()}`);
}

export async function infoCommand(ref: string): Promise<void> {
  const { owner, name, version } = parseSkillRef(ref);
  const { registry, token } = await requireRegistry();
  const client = new RegistryClient(registry, token);

  if (version) {
    printRecord(await client.getVersion(owner, name, version));
    return;
  }
  const summary = await client.getLatest(owner, name);
  printRecord(summary);
  if (summary.versions.length > 1) {
    console.log(`Versions:    ${summary.versions.join(', ')}`);
  }
  if (summary.totalDownloads !== undefined) {
    console.log(`Total DL:    ${summary.totalDownloads.toLocaleString()}`);
  }
}
