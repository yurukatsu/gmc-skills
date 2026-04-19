import { serve } from '@hono/node-server';
import path from 'node:path';
import { FilesystemStorage, type Storage } from './storage.js';
import { GitStorage } from './gitStorage.js';
import { buildApp } from './routes.js';
import { DownloadStats } from './stats.js';
import { SkillIndex } from './skillIndex.js';

function createStorage(storageRoot: string): Storage {
  const gitRepo = process.env.GMC_SKILLS_GIT_REPO;
  if (!gitRepo) return new FilesystemStorage(storageRoot);

  const modeEnv = process.env.GMC_SKILLS_PUBLISH_MODE;
  if (modeEnv !== undefined && modeEnv !== 'direct' && modeEnv !== 'pr') {
    throw new Error(`GMC_SKILLS_PUBLISH_MODE must be "direct" or "pr", got "${modeEnv}"`);
  }
  const hostKindEnv = process.env.GMC_SKILLS_GIT_HOST;
  if (hostKindEnv !== undefined && hostKindEnv !== 'github' && hostKindEnv !== 'gitlab') {
    throw new Error(`GMC_SKILLS_GIT_HOST must be "github" or "gitlab", got "${hostKindEnv}"`);
  }
  return new GitStorage({
    repoUrl: gitRepo,
    workDir: storageRoot,
    branch: process.env.GMC_SKILLS_GIT_BRANCH ?? 'main',
    authorName: process.env.GMC_SKILLS_GIT_AUTHOR_NAME ?? 'gmc-skills-server',
    authorEmail: process.env.GMC_SKILLS_GIT_AUTHOR_EMAIL ?? 'gmc-skills@localhost',
    publishMode: modeEnv ?? 'direct',
    hostKind: hostKindEnv,
    hostToken: process.env.GMC_SKILLS_HOST_TOKEN ?? process.env.GMC_SKILLS_GITHUB_TOKEN,
    hostApiBase: process.env.GMC_SKILLS_HOST_API_BASE,
  });
}

async function main(): Promise<void> {
  const token = process.env.GMC_SKILLS_TOKEN;
  if (!token) {
    console.error('GMC_SKILLS_TOKEN env var is required');
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 8787);
  const storageRoot = path.resolve(process.env.GMC_SKILLS_STORAGE ?? './registry-storage');
  const statsFile = path.resolve(
    process.env.GMC_SKILLS_STATS_FILE ?? path.join(storageRoot, '.gmc-stats.json'),
  );
  const storage = createStorage(storageRoot);
  await storage.init();
  const stats = new DownloadStats(statsFile);
  await stats.init();
  const index = new SkillIndex(storage);
  await index.init();

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\nreceived ${signal}, flushing stats…`);
    await stats.flush().catch(() => {
      // best-effort
    });
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  const app = buildApp({ storage, stats, index, token });
  serve({ fetch: app.fetch, port }, (info) => {
    const storageMode = process.env.GMC_SKILLS_GIT_REPO ? 'git' : 'filesystem';
    const publishMode = process.env.GMC_SKILLS_PUBLISH_MODE ?? 'direct';
    const suffix =
      storageMode === 'git' ? ` (git storage, ${publishMode} publish)` : ' (filesystem storage)';
    console.log(`gmc-skills-server listening on http://localhost:${info.port}${suffix}`);
    console.log(`  workdir: ${storageRoot}`);
    console.log(`  stats:   ${statsFile}`);
    console.log(`  index:   ${index.size()} skills cached`);
    console.log(`  web UI:  http://localhost:${info.port}/`);
  });
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
