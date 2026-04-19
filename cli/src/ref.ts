export interface SkillRef {
  owner: string;
  name: string;
  version?: string;
}

export function parseSkillRef(ref: string): SkillRef {
  const atIdx = ref.indexOf('@');
  const base = atIdx < 0 ? ref : ref.slice(0, atIdx);
  const version = atIdx < 0 ? undefined : ref.slice(atIdx + 1);
  const slashIdx = base.indexOf('/');
  if (slashIdx < 0) {
    throw new Error(
      `Invalid skill reference "${ref}". Expected "<owner>/<name>" or "<owner>/<name>@<version>".`,
    );
  }
  const owner = base.slice(0, slashIdx);
  const name = base.slice(slashIdx + 1);
  if (!owner) throw new Error(`Missing owner in "${ref}"`);
  if (!name) throw new Error(`Missing name in "${ref}"`);
  if (atIdx >= 0 && !version) throw new Error(`Empty version in "${ref}"`);
  return { owner, name, version };
}

export function formatSkillRef(owner: string, name: string, version?: string): string {
  return version ? `${owner}/${name}@${version}` : `${owner}/${name}`;
}

export function authorFromConfig(user?: {
  email: string;
  name?: string;
}): { name: string; email: string } | undefined {
  if (!user) return undefined;
  return { email: user.email, name: user.name ?? user.email };
}
