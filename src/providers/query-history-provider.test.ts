import { describe, it, expect, beforeEach, vi } from 'vitest';
import { QueryHistoryProvider } from './query-history-provider';
import { QueryHistoryService, HistoryEntry } from '../services/query-history-service';
import * as vscode from 'vscode';

/**
 * Test formatShortTime and formatTimestamp by testing the provider's output.
 * These are internal functions in query-history-provider, tested indirectly through HistoryNode labels.
 */
describe('query-history-provider', () => {
  let mockHistoryService: QueryHistoryService;
  let provider: QueryHistoryProvider;

  beforeEach(() => {
    mockHistoryService = {
      getEntries: vi.fn(() => []),
      onDidChange: vi.fn((cb) => ({
        dispose: () => {},
      })),
    } as any;

    provider = new QueryHistoryProvider(mockHistoryService);
  });

  describe('QueryHistoryProvider', () => {
    it('initializes with no entries', async () => {
      const children = await provider.getChildren();
      expect(children).toHaveLength(0);
    });

    it('returns nodes for each entry', async () => {
      const now = new Date().toISOString();
      const entries: HistoryEntry[] = [
        {
          sql: 'SELECT 1',
          timestamp: now,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        },
        {
          sql: 'SELECT 2',
          timestamp: now,
          bytesProcessed: '2048',
          status: 'success',
          durationMs: 150,
        },
      ];

      vi.mocked(mockHistoryService.getEntries).mockReturnValue(entries);

      const children = await provider.getChildren();

      expect(children).toHaveLength(2);
      expect(children[0].entry.sql).toBe('SELECT 1');
      expect(children[1].entry.sql).toBe('SELECT 2');
    });

    it('sets filter pattern and filters entries', async () => {
      const now = new Date().toISOString();
      const entries: HistoryEntry[] = [
        {
          sql: 'SELECT * FROM users',
          timestamp: now,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
          name: 'User Query',
        },
        {
          sql: 'SELECT * FROM products',
          timestamp: now,
          bytesProcessed: '2048',
          status: 'success',
          durationMs: 150,
          name: 'Product Query',
        },
      ];

      vi.mocked(mockHistoryService.getEntries).mockReturnValue(entries);

      provider.setFilter('user');
      const children = await provider.getChildren();

      expect(children).toHaveLength(1);
      expect(children[0].entry.name).toBe('User Query');
    });

    it('filters by SQL content when no name', async () => {
      const now = new Date().toISOString();
      const entries: HistoryEntry[] = [
        {
          sql: 'SELECT * FROM products',
          timestamp: now,
          bytesProcessed: '2048',
          status: 'success',
          durationMs: 150,
        },
      ];

      vi.mocked(mockHistoryService.getEntries).mockReturnValue(entries);

      provider.setFilter('products');
      const children = await provider.getChildren();

      expect(children).toHaveLength(1);
    });

    it('filter is case-insensitive', async () => {
      const now = new Date().toISOString();
      const entries: HistoryEntry[] = [
        {
          sql: 'SELECT * FROM USERS',
          timestamp: now,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
          name: 'User Query',
        },
      ];

      vi.mocked(mockHistoryService.getEntries).mockReturnValue(entries);

      provider.setFilter('USER');
      const children = await provider.getChildren();

      expect(children).toHaveLength(1);
    });

    it('clears filter when pattern is empty', async () => {
      const now = new Date().toISOString();
      const entries: HistoryEntry[] = [
        {
          sql: 'SELECT 1',
          timestamp: now,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        },
        {
          sql: 'SELECT 2',
          timestamp: now,
          bytesProcessed: '2048',
          status: 'success',
          durationMs: 150,
        },
      ];

      vi.mocked(mockHistoryService.getEntries).mockReturnValue(entries);

      provider.setFilter('SELECT 1');
      let children = await provider.getChildren();
      expect(children).toHaveLength(1);

      provider.setFilter('');
      children = await provider.getChildren();
      expect(children).toHaveLength(2);
    });

    it('gets filter pattern', () => {
      provider.setFilter('test');
      expect(provider.getFilter()).toBe('test');
    });

    it('getTreeItem returns the element', () => {
      const now = new Date().toISOString();
      const entry: HistoryEntry = {
        sql: 'SELECT 1',
        timestamp: now,
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      };

      const node = new (vscode.TreeItem as any)(entry, 0);
      node.entry = entry;
      node.index = 0;

      const result = provider.getTreeItem(node);
      expect(result).toBe(node);
    });

    it('getSql returns entry SQL', async () => {
      const now = new Date().toISOString();
      const entry: HistoryEntry = {
        sql: 'SELECT * FROM my_table',
        timestamp: now,
        bytesProcessed: '1024',
        status: 'success',
        durationMs: 100,
      };

      const node = new (vscode.TreeItem as any)(entry, 0);
      node.entry = entry;
      node.index = 0;

      const sql = provider.getSql(node);
      expect(sql).toBe('SELECT * FROM my_table');
    });

    it('fires onDidChangeTreeData event', () => {
      return new Promise<void>((resolve) => {
        let firedCount = 0;
        provider.onDidChangeTreeData(() => {
          firedCount++;
        });

        provider.setFilter('test');

        setTimeout(() => {
          expect(firedCount).toBeGreaterThan(0);
          resolve();
        }, 10);
      });
    });

    it('truncates long SQL in node label', async () => {
      const now = new Date().toISOString();
      const longSql = 'SELECT * FROM table WHERE ' + 'condition = true AND '.repeat(20);
      const entries: HistoryEntry[] = [
        {
          sql: longSql,
          timestamp: now,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        },
      ];

      vi.mocked(mockHistoryService.getEntries).mockReturnValue(entries);

      const children = await provider.getChildren();
      expect(children[0].label).toContain('...');
    });

    it('uses custom name in node label when available', async () => {
      const now = new Date().toISOString();
      const entries: HistoryEntry[] = [
        {
          sql: 'SELECT 1',
          timestamp: now,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
          name: 'My Custom Name',
        },
      ];

      vi.mocked(mockHistoryService.getEntries).mockReturnValue(entries);

      const children = await provider.getChildren();
      expect(children[0].label).toContain('My Custom Name');
    });

    it('includes timestamp prefix in node label', async () => {
      const now = new Date().toISOString();
      const entries: HistoryEntry[] = [
        {
          sql: 'SELECT 1',
          timestamp: now,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        },
      ];

      vi.mocked(mockHistoryService.getEntries).mockReturnValue(entries);

      const children = await provider.getChildren();
      // Should have format like [MM/DD HH:mm]
      expect(children[0].label).toMatch(/\[\d{2}\/\d{2} \d{2}:\d{2}\]/);
    });

    it('sets correct context value for history entries', async () => {
      const now = new Date().toISOString();
      const entries: HistoryEntry[] = [
        {
          sql: 'SELECT 1',
          timestamp: now,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        },
      ];

      vi.mocked(mockHistoryService.getEntries).mockReturnValue(entries);

      const children = await provider.getChildren();
      expect(children[0].contextValue).toBe('historyEntry');
    });

    it('shows success icon for successful queries', async () => {
      const now = new Date().toISOString();
      const entries: HistoryEntry[] = [
        {
          sql: 'SELECT 1',
          timestamp: now,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        },
      ];

      vi.mocked(mockHistoryService.getEntries).mockReturnValue(entries);

      const children = await provider.getChildren();
      expect(children[0].iconPath).toBeDefined();
    });

    it('shows error icon for failed queries', async () => {
      const now = new Date().toISOString();
      const entries: HistoryEntry[] = [
        {
          sql: 'SELECT invalid',
          timestamp: now,
          bytesProcessed: '0',
          status: 'error',
          durationMs: 100,
          error: 'Syntax error',
        },
      ];

      vi.mocked(mockHistoryService.getEntries).mockReturnValue(entries);

      const children = await provider.getChildren();
      expect(children[0].iconPath).toBeDefined();
    });

    it('includes tooltip with full entry details', async () => {
      const now = new Date().toISOString();
      const entries: HistoryEntry[] = [
        {
          sql: 'SELECT 1',
          timestamp: now,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
          error: undefined,
        },
      ];

      vi.mocked(mockHistoryService.getEntries).mockReturnValue(entries);

      const children = await provider.getChildren();
      const tooltip = children[0].tooltip as string;
      expect(tooltip).toContain('SELECT 1');
      expect(tooltip).toContain('Status: success');
      expect(tooltip).toContain('Duration: 100ms');
      expect(tooltip).toContain('Bytes: 1024');
    });

    it('formats description with relative time', async () => {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000).toISOString();

      const entries: HistoryEntry[] = [
        {
          sql: 'SELECT 1',
          timestamp: oneMinuteAgo,
          bytesProcessed: '1024',
          status: 'success',
          durationMs: 100,
        },
      ];

      vi.mocked(mockHistoryService.getEntries).mockReturnValue(entries);

      const children = await provider.getChildren();
      // formatTimestamp should show "1m ago" or similar
      expect(children[0].description).toBeDefined();
    });
  });
});
