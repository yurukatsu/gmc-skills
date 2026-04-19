import { promises as fs } from 'node:fs';
import path from 'node:path';
import { isErrnoException } from './errors.js';

export interface SkillCounters {
  total: number;
  byVersion: Record<string, number>;
  lastDownloadAt: string | null;
}

interface StatsFile {
  skills: Record<string, SkillCounters>;
}

const EMPTY_READ: SkillCounters = { total: 0, byVersion: {}, lastDownloadAt: null };

export class DownloadStats {
  private readonly skills = new Map<string, SkillCounters>();
  private flushTimer: NodeJS.Timeout | null = null;
  private pendingFlush: Promise<void> | null = null;

  constructor(private readonly file: string) {}

  async init(): Promise<void> {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw) as Partial<StatsFile>;
      const skills = parsed.skills ?? {};
      for (const [k, v] of Object.entries(skills)) {
        this.skills.set(k, {
          total: v.total,
          byVersion: { ...v.byVersion },
          lastDownloadAt: v.lastDownloadAt,
        });
      }
    } catch (err) {
      if (isErrnoException(err) && err.code === 'ENOENT') return;
      throw err;
    }
  }

  private keyOf(owner: string, name: string): string {
    return `${owner}/${name}`;
  }

  get(owner: string, name: string): SkillCounters {
    const entry = this.skills.get(this.keyOf(owner, name));
    return entry ? { ...entry, byVersion: { ...entry.byVersion } } : { ...EMPTY_READ };
  }

  increment(owner: string, name: string, version: string): void {
    const k = this.keyOf(owner, name);
    const existing = this.skills.get(k);
    const entry: SkillCounters = existing ?? { total: 0, byVersion: {}, lastDownloadAt: null };
    entry.total += 1;
    entry.byVersion[version] = (entry.byVersion[version] ?? 0) + 1;
    entry.lastDownloadAt = new Date().toISOString();
    this.skills.set(k, entry);
    this.scheduleFlush();
  }

  forget(owner: string, name: string, version?: string): void {
    const k = this.keyOf(owner, name);
    const entry = this.skills.get(k);
    if (!entry) return;
    if (version === undefined) {
      this.skills.delete(k);
    } else {
      const lost = entry.byVersion[version] ?? 0;
      const { [version]: _, ...rest } = entry.byVersion;
      entry.byVersion = rest;
      entry.total = Math.max(0, entry.total - lost);
      if (entry.total === 0 && Object.keys(entry.byVersion).length === 0) {
        this.skills.delete(k);
      }
    }
    this.scheduleFlush();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, 200);
  }

  async flush(): Promise<void> {
    if (this.pendingFlush) return this.pendingFlush;
    this.pendingFlush = (async () => {
      try {
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        const obj: StatsFile = { skills: Object.fromEntries(this.skills.entries()) };
        const tmp = `${this.file}.tmp-${process.pid}`;
        await fs.writeFile(tmp, JSON.stringify(obj, null, 2));
        await fs.rename(tmp, this.file);
      } finally {
        this.pendingFlush = null;
      }
    })();
    return this.pendingFlush;
  }
}
