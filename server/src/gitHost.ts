export type HostKind = 'github' | 'gitlab';

export interface HostRepoInfo {
  kind: HostKind;
  apiBase: string;
  /** Full repo path: "owner/repo" on GitHub, possibly "group/subgroup/repo" on GitLab. */
  path: string;
  /** Token extracted from URL (user:password@host form), if present. */
  token?: string;
}

const URL_RE = /^(https?):\/\/(?:([^:]+)(?::([^@]+))?@)?([^/]+)\/(.+?)(?:\.git)?\/?$/;

export function detectHost(url: string, explicit?: HostKind): HostRepoInfo | null {
  const m = URL_RE.exec(url);
  if (!m) return null;
  const [, scheme, , password, host, path] = m;

  let kind: HostKind | undefined = explicit;
  if (!kind) {
    if (host === 'github.com') kind = 'github';
    else if (host === 'gitlab.com') kind = 'gitlab';
    else return null;
  }

  if (kind === 'github' && path.split('/').length !== 2) {
    return null;
  }

  // SaaS endpoints are hardcoded. Self-hosted uses the repo URL's scheme + host
  // (preserves http vs https and port, so IP-based internal servers work).
  const apiBase =
    kind === 'github'
      ? host === 'github.com'
        ? 'https://api.github.com'
        : `${scheme}://${host}/api/v3`
      : host === 'gitlab.com'
        ? 'https://gitlab.com/api/v4'
        : `${scheme}://${host}/api/v4`;

  return { kind, apiBase, path, token: password };
}

export interface CreatePullRequestInput {
  title: string;
  body: string;
  sourceBranch: string;
  targetBranch: string;
}

export interface PullRequestResult {
  url: string;
  number: number;
}

export function createPullRequest(
  host: HostRepoInfo,
  token: string,
  input: CreatePullRequestInput,
): Promise<PullRequestResult> {
  if (host.kind === 'github') return createGitHubPR(host, token, input);
  return createGitLabMR(host, token, input);
}

interface GitHubPullResponse {
  html_url: string;
  number: number;
}

async function createGitHubPR(
  host: HostRepoInfo,
  token: string,
  input: CreatePullRequestInput,
): Promise<PullRequestResult> {
  const res = await fetch(`${host.apiBase}/repos/${host.path}/pulls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      title: input.title,
      head: input.sourceBranch,
      base: input.targetBranch,
      body: input.body,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub PR creation failed: ${res.status} ${res.statusText} ${text}`);
  }
  const data = (await res.json()) as GitHubPullResponse;
  return { url: data.html_url, number: data.number };
}

interface GitLabMergeResponse {
  web_url: string;
  iid: number;
}

async function createGitLabMR(
  host: HostRepoInfo,
  token: string,
  input: CreatePullRequestInput,
): Promise<PullRequestResult> {
  const projectId = encodeURIComponent(host.path);
  const res = await fetch(`${host.apiBase}/projects/${projectId}/merge_requests`, {
    method: 'POST',
    headers: {
      'PRIVATE-TOKEN': token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: input.title,
      description: input.body,
      source_branch: input.sourceBranch,
      target_branch: input.targetBranch,
      remove_source_branch: true,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitLab MR creation failed: ${res.status} ${res.statusText} ${text}`);
  }
  const data = (await res.json()) as GitLabMergeResponse;
  return { url: data.web_url, number: data.iid };
}
