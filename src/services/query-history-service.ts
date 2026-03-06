import * as vscode from 'vscode';

/** A single query history entry */
export interface HistoryEntry {
  sql: string;
  timestamp: string;
  bytesProcessed: string;
  status: 'success' | 'error';
  durationMs: number;
  rowCount?: number;
  error?: string;
  jobId?: string;
  destinationTable?: { projectId: string; datasetId: string; tableId: string };
  region?: string;
  name?: string;
}

/** Manages local query history persisted in globalState */
export class QueryHistoryService {
  private static readonly STORAGE_KEY = 'bigqueryBrowser.queryHistory';
  private entries: HistoryEntry[] = [];
  private _onDidChange = new vscode.EventEmitter<void>();
  readonly onDidChange = this._onDidChange.event;

  constructor(private globalState: vscode.Memento) {
    this.entries = globalState.get<HistoryEntry[]>(QueryHistoryService.STORAGE_KEY, []);
    this.evictExpired();
  }

  /** Add a new query to history */
  addEntry(entry: HistoryEntry): void {
    const limit = vscode.workspace
      .getConfiguration('bigqueryBrowser')
      .get<number>('queryHistoryLimit', 100);

    this.entries.unshift(entry);
    this.evictExpired();
    if (this.entries.length > limit) {
      this.entries = this.entries.slice(0, limit);
    }

    this.save();
    this._onDidChange.fire();
  }

  /** Get all history entries */
  getEntries(): HistoryEntry[] {
    return [...this.entries];
  }

  /** Rename a specific entry by stable identity (timestamp + sql) */
  renameEntry(timestamp: string, sql: string, name: string): void {
    const entry = this.entries.find(e => e.timestamp === timestamp && e.sql === sql);
    if (entry) {
      entry.name = name || undefined;
      this.save();
      this._onDidChange.fire();
    }
  }

  /** Delete a specific entry by stable identity (timestamp + sql) */
  deleteEntry(timestamp: string, sql: string): void {
    const idx = this.entries.findIndex(e => e.timestamp === timestamp && e.sql === sql);
    if (idx >= 0) {
      this.entries.splice(idx, 1);
      this.save();
      this._onDidChange.fire();
    }
  }

  /** Clear all history */
  clearHistory(): void {
    this.entries = [];
    this.save();
    this._onDidChange.fire();
  }

  /** Remove entries older than 24 hours */
  private evictExpired(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const before = this.entries.length;
    this.entries = this.entries.filter((e) => new Date(e.timestamp).getTime() > cutoff);
    if (this.entries.length !== before) {
      this.save();
      this._onDidChange.fire();
    }
  }

  private save(): void {
    this.globalState.update(QueryHistoryService.STORAGE_KEY, this.entries);
  }
}
