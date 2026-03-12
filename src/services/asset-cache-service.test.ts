import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { AssetCacheService } from './asset-cache-service';

describe('AssetCacheService', () => {
  let tempDir: string;
  let service: AssetCacheService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bq-cache-test-'));
    service = new AssetCacheService(tempDir);
  });

  afterEach(() => {
    service.dispose();
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('datasets cache', () => {
    it('sets and gets datasets', () => {
      const datasets = [
        { datasetId: 'dataset1', location: 'US' },
        { datasetId: 'dataset2', location: 'EU' },
      ];

      service.setDatasets('project1', datasets);
      const cached = service.getDatasets('project1');

      expect(cached).toEqual(datasets);
    });

    it('returns undefined for uncached project', () => {
      const cached = service.getDatasets('unknown-project');
      expect(cached).toBeUndefined();
    });

    it('returns undefined for expired cache', () => {
      const datasets = [{ datasetId: 'dataset1', location: 'US' }];
      service.setDatasets('project1', datasets);

      // Mock Date.now to simulate cache expiry (12+ hours later)
      const originalNow = Date.now;
      vi.spyOn(Date, 'now').mockReturnValue(originalNow() + 13 * 60 * 60 * 1000);

      const cached = service.getDatasets('project1');
      expect(cached).toBeUndefined();

      vi.restoreAllMocks();
    });

    it('caches different projects separately', () => {
      const ds1 = [{ datasetId: 'ds1', location: 'US' }];
      const ds2 = [{ datasetId: 'ds2', location: 'EU' }];

      service.setDatasets('project1', ds1);
      service.setDatasets('project2', ds2);

      expect(service.getDatasets('project1')).toEqual(ds1);
      expect(service.getDatasets('project2')).toEqual(ds2);
    });

    it('overwrites previous dataset cache', () => {
      const ds1 = [{ datasetId: 'dataset1', location: 'US' }];
      const ds2 = [{ datasetId: 'dataset2', location: 'EU' }];

      service.setDatasets('project1', ds1);
      expect(service.getDatasets('project1')).toEqual(ds1);

      service.setDatasets('project1', ds2);
      expect(service.getDatasets('project1')).toEqual(ds2);
    });

    it('handles empty dataset list', () => {
      service.setDatasets('project1', []);
      expect(service.getDatasets('project1')).toEqual([]);
    });
  });

  describe('tables cache', () => {
    it('sets and gets tables', () => {
      const tables = [
        { tableId: 'table1', type: 'TABLE' },
        { tableId: 'table2', type: 'VIEW' },
      ];

      service.setTables('project1', 'dataset1', tables);
      const cached = service.getTables('project1', 'dataset1');

      expect(cached).toEqual(tables);
    });

    it('returns undefined for uncached dataset', () => {
      const cached = service.getTables('project1', 'unknown-dataset');
      expect(cached).toBeUndefined();
    });

    it('returns undefined for expired table cache', () => {
      const tables = [{ tableId: 'table1', type: 'TABLE' }];
      service.setTables('project1', 'dataset1', tables);

      const originalNow = Date.now;
      vi.spyOn(Date, 'now').mockReturnValue(originalNow() + 13 * 60 * 60 * 1000);

      const cached = service.getTables('project1', 'dataset1');
      expect(cached).toBeUndefined();

      vi.restoreAllMocks();
    });

    it('caches different datasets separately', () => {
      const t1 = [{ tableId: 'table1', type: 'TABLE' }];
      const t2 = [{ tableId: 'table2', type: 'VIEW' }];

      service.setTables('project1', 'dataset1', t1);
      service.setTables('project1', 'dataset2', t2);

      expect(service.getTables('project1', 'dataset1')).toEqual(t1);
      expect(service.getTables('project1', 'dataset2')).toEqual(t2);
    });

    it('caches tables for different projects independently', () => {
      const t1 = [{ tableId: 'table1', type: 'TABLE' }];
      const t2 = [{ tableId: 'table2', type: 'VIEW' }];

      service.setTables('project1', 'dataset1', t1);
      service.setTables('project2', 'dataset1', t2);

      expect(service.getTables('project1', 'dataset1')).toEqual(t1);
      expect(service.getTables('project2', 'dataset1')).toEqual(t2);
    });

    it('handles empty table list', () => {
      service.setTables('project1', 'dataset1', []);
      expect(service.getTables('project1', 'dataset1')).toEqual([]);
    });
  });

  describe('getDatasetLocation', () => {
    it('returns location for cached dataset', () => {
      const datasets = [
        { datasetId: 'dataset1', location: 'US' },
        { datasetId: 'dataset2', location: 'EU' },
      ];

      service.setDatasets('project1', datasets);
      const location = service.getDatasetLocation('project1', 'dataset2');

      expect(location).toBe('EU');
    });

    it('returns undefined for uncached dataset', () => {
      const datasets = [{ datasetId: 'dataset1', location: 'US' }];
      service.setDatasets('project1', datasets);

      const location = service.getDatasetLocation('project1', 'dataset2');
      expect(location).toBeUndefined();
    });

    it('returns undefined for uncached project', () => {
      const location = service.getDatasetLocation('unknown-project', 'dataset1');
      expect(location).toBeUndefined();
    });
  });

  describe('getAllCachedTables', () => {
    it('returns all cached tables for project', () => {
      service.setTables('project1', 'dataset1', [{ tableId: 'table1', type: 'TABLE' }]);
      service.setTables('project1', 'dataset2', [{ tableId: 'table2', type: 'VIEW' }]);

      const allTables = service.getAllCachedTables('project1');

      expect(allTables.size).toBe(2);
      expect(allTables.get('dataset1')).toEqual([{ tableId: 'table1', type: 'TABLE' }]);
      expect(allTables.get('dataset2')).toEqual([{ tableId: 'table2', type: 'VIEW' }]);
    });

    it('returns empty map for uncached project', () => {
      const allTables = service.getAllCachedTables('unknown-project');
      expect(allTables.size).toBe(0);
    });

    it('excludes expired entries from getAllCachedTables', () => {
      service.setTables('project1', 'dataset1', [{ tableId: 'table1', type: 'TABLE' }]);
      service.setTables('project1', 'dataset2', [{ tableId: 'table2', type: 'VIEW' }]);

      const originalNow = Date.now;
      vi.spyOn(Date, 'now').mockReturnValue(originalNow() + 13 * 60 * 60 * 1000);

      const allTables = service.getAllCachedTables('project1');
      expect(allTables.size).toBe(0);

      vi.restoreAllMocks();
    });

    it('includes only tables from requested project', () => {
      service.setTables('project1', 'dataset1', [{ tableId: 'table1', type: 'TABLE' }]);
      service.setTables('project2', 'dataset1', [{ tableId: 'table2', type: 'VIEW' }]);

      const p1Tables = service.getAllCachedTables('project1');
      const p2Tables = service.getAllCachedTables('project2');

      expect(p1Tables.size).toBe(1);
      expect(p2Tables.size).toBe(1);
      expect(p1Tables.get('dataset1')?.[0].tableId).toBe('table1');
      expect(p2Tables.get('dataset1')?.[0].tableId).toBe('table2');
    });
  });

  describe('clear', () => {
    it('clears all cached data', () => {
      service.setDatasets('project1', [{ datasetId: 'dataset1', location: 'US' }]);
      service.setTables('project1', 'dataset1', [{ tableId: 'table1', type: 'TABLE' }]);

      service.clear();

      expect(service.getDatasets('project1')).toBeUndefined();
      expect(service.getTables('project1', 'dataset1')).toBeUndefined();
    });

    it('clears cache file on disk', () => {
      service.setDatasets('project1', [{ datasetId: 'dataset1', location: 'US' }]);
      service.dispose(); // Flush to disk

      const cacheFile = path.join(tempDir, 'asset-cache.json');
      expect(fs.existsSync(cacheFile)).toBe(true);

      // Create new service and clear
      service = new AssetCacheService(tempDir);
      service.clear();
      service.dispose(); // Flush to disk

      const content = fs.readFileSync(cacheFile, 'utf-8');
      const data = JSON.parse(content);
      expect(data.datasets).toEqual({});
      expect(data.tables).toEqual({});
    });
  });

  describe('dispose', () => {
    it('flushes pending writes', () => {
      const datasets = [{ datasetId: 'dataset1', location: 'US' }];
      service.setDatasets('project1', datasets);

      // Don't wait for debounce, just dispose
      service.dispose();

      const cacheFile = path.join(tempDir, 'asset-cache.json');
      expect(fs.existsSync(cacheFile)).toBe(true);

      const content = fs.readFileSync(cacheFile, 'utf-8');
      const data = JSON.parse(content);
      expect(data.datasets['project1']).toBeDefined();
    });

    it('handles multiple dispose calls gracefully', () => {
      service.setDatasets('project1', [{ datasetId: 'dataset1', location: 'US' }]);

      service.dispose();
      expect(() => service.dispose()).not.toThrow();
    });
  });

  describe('persistence', () => {
    it('persists cache to disk', () => {
      const datasets = [{ datasetId: 'dataset1', location: 'US' }];
      service.setDatasets('project1', datasets);
      service.dispose();

      const cacheFile = path.join(tempDir, 'asset-cache.json');
      expect(fs.existsSync(cacheFile)).toBe(true);

      const content = fs.readFileSync(cacheFile, 'utf-8');
      const data = JSON.parse(content);
      // Cache stores entries with timestamp, so check the data field
      expect(data.datasets['project1'].data).toEqual(datasets);
    });

    it('loads cache from disk on initialization', () => {
      const datasets = [{ datasetId: 'dataset1', location: 'US' }];
      service.setDatasets('project1', datasets);
      service.dispose();

      // Create new service instance
      const newService = new AssetCacheService(tempDir);
      const cached = newService.getDatasets('project1');

      expect(cached).toEqual(datasets);
      newService.dispose();
    });

    it('handles missing cache file gracefully', () => {
      const newService = new AssetCacheService(tempDir);
      expect(newService.getDatasets('project1')).toBeUndefined();
      newService.dispose();
    });

    it('handles corrupted cache file gracefully', () => {
      const cacheFile = path.join(tempDir, 'asset-cache.json');
      fs.writeFileSync(cacheFile, 'invalid json {{{');

      const newService = new AssetCacheService(tempDir);
      // Should not throw, should start with empty cache
      expect(newService.getDatasets('project1')).toBeUndefined();
      newService.dispose();
    });
  });

  describe('debounced writes', () => {
    it('batches multiple writes within debounce window', async () => {
      const cacheFile = path.join(tempDir, 'asset-cache.json');

      service.setDatasets('project1', [{ datasetId: 'dataset1', location: 'US' }]);
      service.setTables('project1', 'dataset1', [{ tableId: 'table1', type: 'TABLE' }]);

      // Should not have written yet (still in debounce window)
      expect(fs.existsSync(cacheFile)).toBe(false);

      // Wait for debounce to expire (500ms)
      await new Promise((r) => setTimeout(r, 600));
      expect(fs.existsSync(cacheFile)).toBe(true);
      service.dispose();
    });

    it('resets debounce timer on new write', async () => {
      const cacheFile = path.join(tempDir, 'asset-cache.json');

      service.setDatasets('project1', [{ datasetId: 'dataset1', location: 'US' }]);

      await new Promise((r) => setTimeout(r, 300));
      // After 300ms, file shouldn't be written yet
      expect(fs.existsSync(cacheFile)).toBe(false);

      // Write again, reset timer
      service.setTables('project1', 'dataset1', [{ tableId: 'table1', type: 'TABLE' }]);

      await new Promise((r) => setTimeout(r, 600));
      // After another 600ms, should be written
      expect(fs.existsSync(cacheFile)).toBe(true);
      service.dispose();
    });
  });

  describe('large dataset handling', () => {
    it('handles large number of datasets', () => {
      const datasets = Array.from({ length: 100 }, (_, i) => ({
        datasetId: `dataset${i}`,
        location: i % 2 === 0 ? 'US' : 'EU',
      }));

      service.setDatasets('project1', datasets);
      const cached = service.getDatasets('project1');

      expect(cached).toHaveLength(100);
      expect(cached?.[50]).toEqual(datasets[50]);
    });

    it('handles large number of tables per dataset', () => {
      const tables = Array.from({ length: 500 }, (_, i) => ({
        tableId: `table${i}`,
        type: i % 2 === 0 ? 'TABLE' : 'VIEW',
      }));

      service.setTables('project1', 'dataset1', tables);
      const cached = service.getTables('project1', 'dataset1');

      expect(cached).toHaveLength(500);
    });

    it('handles multiple projects and datasets', () => {
      for (let p = 0; p < 5; p++) {
        for (let d = 0; d < 5; d++) {
          const tables = Array.from({ length: 10 }, (_, t) => ({
            tableId: `table${t}`,
            type: 'TABLE',
          }));
          service.setTables(`project${p}`, `dataset${d}`, tables);
        }
      }

      const allTables = service.getAllCachedTables('project2');
      expect(allTables.size).toBe(5);
    });
  });
});
