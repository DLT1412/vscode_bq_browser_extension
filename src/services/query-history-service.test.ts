import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryHistoryService, HistoryEntry } from './query-history-service';
import * as vscode from 'vscode';

describe('QueryHistoryService', () => {
  let mockMemento: vscode.Memento;
  let service: QueryHistoryService;

  beforeEach(() => {
    mockMemento = {
      get: vi.fn((key: string, defaultValue?: unknown) => defaultValue) as vscode.Memento['get'],
      update: vi.fn(),
      keys: vi.fn(() => []),
    } as unknown as vscode.Memento;
    service = new QueryHistoryService(mockMemento);
  });

  describe('addEntry', () => {
    it('adds a new entry to history', () => {
      const entry: HistoryEntry = {
        sql: 'SELECT 1',
        timestamp: new Date().toISOString(),
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      };

      service.addEntry(entry);
      const entries = service.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual(entry);
    });

    it('adds new entries to the front of history', () => {
      const now = new Date().toISOString();
      const entry1: HistoryEntry = {
        sql: 'SELECT 1',
        timestamp: now,
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      };
      const entry2: HistoryEntry = {
        sql: 'SELECT 2',
        timestamp: now,
        bytesProcessed: '2048',
        status: 'success',
        durationMs: 150,
      };

      service.addEntry(entry1);
      service.addEntry(entry2);

      const entries = service.getEntries();
      expect(entries[0].sql).toBe('SELECT 2');
      expect(entries[1].sql).toBe('SELECT 1');
    });

    it('respects queryHistoryLimit config', () => {
      // Mock workspace getConfiguration before creating service
      const originalGetConfig = vscode.workspace.getConfiguration;
      vscode.workspace.getConfiguration = vi.fn((section?: string) => ({
        get: vi.fn((key: string, defaultValue?: any) => {
          if (key === 'queryHistoryLimit') return 3;
          return defaultValue;
        }),
      })) as any;

      const now = new Date().toISOString();
      for (let i = 0; i < 5; i++) {
        service.addEntry({
          sql: `SELECT ${i}`,
          timestamp: now,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        });
      }

      const entries = service.getEntries();
      expect(entries).toHaveLength(3);
      // Most recent entries should be kept
      expect(entries[0].sql).toBe('SELECT 4');
      expect(entries[1].sql).toBe('SELECT 3');
      expect(entries[2].sql).toBe('SELECT 2');

      // Restore original
      vscode.workspace.getConfiguration = originalGetConfig;
    });

    it('persists entry to memento', () => {
      const entry: HistoryEntry = {
        sql: 'SELECT 1',
        timestamp: new Date().toISOString(),
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      };

      service.addEntry(entry);

      expect(mockMemento.update).toHaveBeenCalled();
    });

    it('fires onDidChange event when entry added', () => {
      return new Promise<void>((resolve) => {
        service.onDidChange(() => {
          resolve();
        });

        service.addEntry({
          sql: 'SELECT 1',
          timestamp: new Date().toISOString(),
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        });
      });
    });

    it('evicts expired entries when adding', () => {
      // Add an old entry that should be evicted
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      const newDate = new Date().toISOString();

      // Mock memento to return an old entry
      vi.mocked(mockMemento.get).mockReturnValueOnce([
        {
          sql: 'SELECT old',
          timestamp: oldDate,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        },
      ]);

      // Recreate service with mocked memento
      service = new QueryHistoryService(mockMemento);

      // Add new entry
      service.addEntry({
        sql: 'SELECT new',
        timestamp: newDate,
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      });

      const entries = service.getEntries();
      // Only the new entry should remain
      expect(entries).toHaveLength(1);
      expect(entries[0].sql).toBe('SELECT new');
    });
  });

  describe('getEntries', () => {
    it('returns empty array initially', () => {
      const entries = service.getEntries();
      expect(entries).toEqual([]);
    });

    it('returns a copy of entries', () => {
      const entry: HistoryEntry = {
        sql: 'SELECT 1',
        timestamp: new Date().toISOString(),
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      };

      service.addEntry(entry);
      const entries1 = service.getEntries();
      const entries2 = service.getEntries();

      expect(entries1).toEqual(entries2);
      expect(entries1).not.toBe(entries2); // Different array references
    });

    it('maintains insertion order (LIFO)', () => {
      const now = new Date().toISOString();
      for (let i = 0; i < 3; i++) {
        service.addEntry({
          sql: `SELECT ${i}`,
          timestamp: now,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        });
      }

      const entries = service.getEntries();
      expect(entries[0].sql).toBe('SELECT 2');
      expect(entries[1].sql).toBe('SELECT 1');
      expect(entries[2].sql).toBe('SELECT 0');
    });
  });

  describe('renameEntry', () => {
    it('renames an existing entry by timestamp and sql', () => {
      const timestamp = new Date().toISOString();
      const entry: HistoryEntry = {
        sql: 'SELECT 1',
        timestamp,
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      };

      service.addEntry(entry);
      service.renameEntry(timestamp, 'SELECT 1', 'My Query');

      const entries = service.getEntries();
      expect(entries[0].name).toBe('My Query');
    });

    it('does not rename non-matching entries', () => {
      const timestamp = new Date().toISOString();
      service.addEntry({
        sql: 'SELECT 1',
        timestamp,
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      });

      service.renameEntry(timestamp, 'SELECT 999', 'My Query');

      const entries = service.getEntries();
      expect(entries[0].name).toBeUndefined();
    });

    it('removes name when setting to undefined', () => {
      const timestamp = new Date().toISOString();
      const entry: HistoryEntry = {
        sql: 'SELECT 1',
        timestamp,
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
        name: 'My Query',
      };

      service.addEntry(entry);
      service.renameEntry(timestamp, 'SELECT 1', '');

      const entries = service.getEntries();
      expect(entries[0].name).toBeUndefined();
    });

    it('persists rename to memento', () => {
      const timestamp = new Date().toISOString();
      service.addEntry({
        sql: 'SELECT 1',
        timestamp,
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      });

      vi.clearAllMocks();
      service.renameEntry(timestamp, 'SELECT 1', 'My Query');

      expect(mockMemento.update).toHaveBeenCalled();
    });

    it('fires onDidChange event on rename', () => {
      return new Promise<void>((resolve) => {
        const timestamp = new Date().toISOString();
        service.addEntry({
          sql: 'SELECT 1',
          timestamp,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        });

        vi.clearAllMocks();
        service.onDidChange(() => {
          resolve();
        });

        service.renameEntry(timestamp, 'SELECT 1', 'My Query');
      });
    });
  });

  describe('deleteEntry', () => {
    it('deletes an existing entry by timestamp and sql', () => {
      const timestamp = new Date().toISOString();
      service.addEntry({
        sql: 'SELECT 1',
        timestamp,
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      });

      service.deleteEntry(timestamp, 'SELECT 1');

      const entries = service.getEntries();
      expect(entries).toHaveLength(0);
    });

    it('does not delete non-matching entries', () => {
      const timestamp = new Date().toISOString();
      service.addEntry({
        sql: 'SELECT 1',
        timestamp,
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      });

      service.deleteEntry(timestamp, 'SELECT 999');

      const entries = service.getEntries();
      expect(entries).toHaveLength(1);
    });

    it('persists deletion to memento', () => {
      const timestamp = new Date().toISOString();
      service.addEntry({
        sql: 'SELECT 1',
        timestamp,
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      });

      vi.clearAllMocks();
      service.deleteEntry(timestamp, 'SELECT 1');

      expect(mockMemento.update).toHaveBeenCalled();
    });

    it('fires onDidChange event on delete', () => {
      return new Promise<void>((resolve) => {
        const timestamp = new Date().toISOString();
        service.addEntry({
          sql: 'SELECT 1',
          timestamp,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        });

        vi.clearAllMocks();
        service.onDidChange(() => {
          resolve();
        });

        service.deleteEntry(timestamp, 'SELECT 1');
      });
    });
  });

  describe('clearHistory', () => {
    it('clears all entries', () => {
      const now = new Date().toISOString();
      for (let i = 0; i < 5; i++) {
        service.addEntry({
          sql: `SELECT ${i}`,
          timestamp: now,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        });
      }

      service.clearHistory();

      const entries = service.getEntries();
      expect(entries).toHaveLength(0);
    });

    it('persists clear to memento', () => {
      service.addEntry({
        sql: 'SELECT 1',
        timestamp: new Date().toISOString(),
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      });

      vi.clearAllMocks();
      service.clearHistory();

      expect(mockMemento.update).toHaveBeenCalled();
    });

    it('fires onDidChange event on clear', () => {
      return new Promise<void>((resolve) => {
        service.addEntry({
          sql: 'SELECT 1',
          timestamp: new Date().toISOString(),
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        });

        vi.clearAllMocks();
        service.onDidChange(() => {
          resolve();
        });

        service.clearHistory();
      });
    });
  });

  describe('eviction of expired entries', () => {
    it('evicts entries older than 24 hours', () => {
      const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
      const newDate = new Date().toISOString();

      vi.mocked(mockMemento.get).mockReturnValueOnce([
        {
          sql: 'SELECT old',
          timestamp: oldDate,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        },
        {
          sql: 'SELECT new',
          timestamp: newDate,
          bytesProcessed: '2048',
          status: 'success',
          durationMs: 200,
        },
      ]);

      service = new QueryHistoryService(mockMemento);
      const entries = service.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0].sql).toBe('SELECT new');
    });

    it('keeps entries exactly at 24-hour boundary', () => {
      const exactlyOldDate = new Date(Date.now() - 24 * 60 * 60 * 1000 - 1).toISOString();
      const justOldEnough = new Date(Date.now() - 24 * 60 * 60 * 1000 + 1000).toISOString();

      vi.mocked(mockMemento.get).mockReturnValueOnce([
        {
          sql: 'SELECT old',
          timestamp: exactlyOldDate,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        },
        {
          sql: 'SELECT fresh',
          timestamp: justOldEnough,
          bytesProcessed: '2048',
          status: 'success',
          durationMs: 200,
        },
      ]);

      service = new QueryHistoryService(mockMemento);
      const entries = service.getEntries();

      expect(entries).toHaveLength(1);
      expect(entries[0].sql).toBe('SELECT fresh');
    });
  });

  describe('entry types and fields', () => {
    it('supports all HistoryEntry fields', () => {
      const timestamp = new Date().toISOString();
      const entry: HistoryEntry = {
        sql: 'SELECT 1',
        timestamp,
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
        rowCount: 42,
        error: undefined,
        jobId: 'job-123',
        destinationTable: {
          projectId: 'my-project',
          datasetId: 'my-dataset',
          tableId: 'my-table',
        },
        region: 'US',
        name: 'My Query',
      };

      service.addEntry(entry);
      const entries = service.getEntries();

      expect(entries[0]).toEqual(entry);
    });

    it('handles error status entries', () => {
      const timestamp = new Date().toISOString();
      const entry: HistoryEntry = {
        sql: 'SELECT invalid syntax',
        timestamp,
        bytesProcessed: '0',
        status: 'error',
        durationMs: 50,
        error: 'Syntax error',
      };

      service.addEntry(entry);
      const entries = service.getEntries();

      expect(entries[0].status).toBe('error');
      expect(entries[0].error).toBe('Syntax error');
    });
  });
});
