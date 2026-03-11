import * as fs from 'fs';
import * as path from 'path';

/** Cache TTL: 12 hours */
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CACHE_FILENAME = 'asset-cache.json';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CacheStore {
  datasets: Record<string, CacheEntry<{ datasetId: string; location: string }[]>>;
  tables: Record<string, CacheEntry<{ tableId: string; type: string }[]>>;
}

/** File-backed cache for BigQuery asset lists with 12h retention */
export class AssetCacheService {
  private store: CacheStore = { datasets: {}, tables: {} };
  private readonly cachePath: string;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(storagePath: string) {
    this.cachePath = path.join(storagePath, CACHE_FILENAME);
    this.load();
  }

  getDatasets(projectId: string): { datasetId: string; location: string }[] | undefined {
    const entry = this.store.datasets[projectId];
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.data;
    }
    return undefined;
  }

  setDatasets(projectId: string, data: { datasetId: string; location: string }[]): void {
    this.store.datasets[projectId] = { data, timestamp: Date.now() };
    this.schedulePersist();
  }

  getTables(projectId: string, datasetId: string): { tableId: string; type: string }[] | undefined {
    const key = `${projectId}.${datasetId}`;
    const entry = this.store.tables[key];
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.data;
    }
    return undefined;
  }

  setTables(projectId: string, datasetId: string, data: { tableId: string; type: string }[]): void {
    this.store.tables[`${projectId}.${datasetId}`] = { data, timestamp: Date.now() };
    this.schedulePersist();
  }

  /** Get the region/location for a dataset from cached dataset list */
  getDatasetLocation(projectId: string, datasetId: string): string | undefined {
    return this.getDatasets(projectId)?.find(d => d.datasetId === datasetId)?.location;
  }

  /** Get all valid cached tables for a project, keyed by datasetId */
  getAllCachedTables(projectId: string): Map<string, { tableId: string; type: string }[]> {
    const result = new Map<string, { tableId: string; type: string }[]>();
    const prefix = `${projectId}.`;
    for (const [key, entry] of Object.entries(this.store.tables)) {
      if (key.startsWith(prefix) && Date.now() - entry.timestamp < CACHE_TTL_MS) {
        result.set(key.substring(prefix.length), entry.data);
      }
    }
    return result;
  }

  clear(): void {
    this.store = { datasets: {}, tables: {} };
    this.flushSync();
  }

  /** Flush pending writes and clean up timer */
  dispose(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    this.flushSync();
  }

  private load(): void {
    try {
      if (fs.existsSync(this.cachePath)) {
        this.store = JSON.parse(fs.readFileSync(this.cachePath, 'utf-8'));
      }
    } catch {
      this.store = { datasets: {}, tables: {} };
    }
  }

  /** Debounced write — batches rapid updates (e.g. background prefetch) */
  private schedulePersist(): void {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
    }
    this.writeTimer = setTimeout(() => this.flushSync(), 500);
  }

  private flushSync(): void {
    try {
      const dir = path.dirname(this.cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.cachePath, JSON.stringify(this.store), 'utf-8');
    } catch {
      // Cache write failures are non-critical
    }
  }
}
