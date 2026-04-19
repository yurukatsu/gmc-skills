import type { SkillSummary, Storage } from './storage.js';

/**
 * In-memory index of skill summaries. Reads go through this cache;
 * the underlying storage.list() is consulted at most once per TTL.
 *
 * The index stores raw SkillSummary objects (no download-count augmentation).
 * Routes augment with DownloadStats before returning.
 */
export class SkillIndex {
  private entries = new Map<string, SkillSummary>();
  private lastRefresh = 0;
  private pending: Promise<void> | null = null;

  constructor(
    private readonly storage: Storage,
    private readonly refreshTtlMs = 5000,
  ) {}

  async init(): Promise<void> {
    await this.refresh();
  }

  private key(owner: string, name: string): string {
    return `${owner}/${name}`;
  }

  private async ensureFresh(): Promise<void> {
    if (Date.now() - this.lastRefresh < this.refreshTtlMs) return;
    if (this.pending) return this.pending;
    this.pending = this.refresh();
    try {
      await this.pending;
    } finally {
      this.pending = null;
    }
  }

  async refresh(): Promise<void> {
    const all = await this.storage.list();
    const next = new Map<string, SkillSummary>();
    for (const s of all) next.set(this.key(s.owner, s.name), s);
    this.entries = next;
    this.lastRefresh = Date.now();
  }

  /** Called after a successful publish or delete to update just one entry. */
  async refreshOne(owner: string, name: string): Promise<void> {
    try {
      const summary = await this.storage.getLatest(owner, name);
      this.entries.set(this.key(owner, name), summary);
    } catch {
      this.entries.delete(this.key(owner, name));
    }
  }

  /** Snapshot of all entries. TTL-refreshes first. */
  async snapshot(): Promise<SkillSummary[]> {
    await this.ensureFresh();
    return Array.from(this.entries.values());
  }

  size(): number {
    return this.entries.size;
  }
}
