import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatBytes, getCostPerTb, BigQueryClient } from './bigquery-client';
import { AuthService } from './auth-service';
import * as vscode from 'vscode';

// Mock AuthService
vi.mock('./auth-service');

describe('bigquery-client', () => {
  describe('formatBytes', () => {
    it('formats bytes to B', () => {
      expect(formatBytes(0)).toBe('0 B');
      expect(formatBytes(1)).toBe('1 B');
      expect(formatBytes(512)).toBe('512 B');
      expect(formatBytes(1023)).toBe('1023 B');
    });

    it('formats bytes to KB', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(2048)).toBe('2.0 KB');
      expect(formatBytes(1024 * 100)).toBe('100.0 KB');
    });

    it('formats bytes to MB', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(formatBytes(1024 * 1024 * 5)).toBe('5.0 MB');
      expect(formatBytes(1024 * 1024 * 512)).toBe('512.0 MB');
    });

    it('formats bytes to GB', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
      expect(formatBytes(1024 * 1024 * 1024 * 2)).toBe('2.0 GB');
      expect(formatBytes(1024 * 1024 * 1024 * 256)).toBe('256.0 GB');
    });

    it('formats bytes to TB', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB');
      expect(formatBytes(1024 * 1024 * 1024 * 1024 * 10)).toBe('10.0 TB');
    });

    it('formats bytes to PB', () => {
      expect(formatBytes(1024 * 1024 * 1024 * 1024 * 1024)).toBe('1.0 PB');
      expect(formatBytes(1024 * 1024 * 1024 * 1024 * 1024 * 5)).toBe('5.0 PB');
    });

    it('handles negative numbers as 0 B', () => {
      expect(formatBytes(-1)).toBe('0 B');
      expect(formatBytes(-1024)).toBe('0 B');
    });

    it('handles Infinity and NaN as 0 B', () => {
      expect(formatBytes(Infinity)).toBe('0 B');
      expect(formatBytes(-Infinity)).toBe('0 B');
      expect(formatBytes(NaN)).toBe('0 B');
    });

    it('handles boundary values between units', () => {
      // Just under 1 KB
      expect(formatBytes(1024 - 1)).toBe('1023 B');
      // Just over 1 KB
      expect(formatBytes(1024 + 1)).toBe('1.0 KB');
      // Just under 1 MB
      expect(formatBytes(1024 * 1024 - 1)).toBe('1024.0 KB');
      // Just over 1 MB
      expect(formatBytes(1024 * 1024 + 1)).toBe('1.0 MB');
    });

    it('rounds properly for decimal values', () => {
      expect(formatBytes(1536)).toBe('1.5 KB'); // 1.5 KB
      expect(formatBytes(1024 * 1024 * 1.5)).toBe('1.5 MB');
    });

    it('handles very large numbers (PB range)', () => {
      const pb = 1024 * 1024 * 1024 * 1024 * 1024;
      expect(formatBytes(pb * 100)).toBe('100.0 PB');
      expect(formatBytes(pb * 999)).toBe('999.0 PB');
    });

    it('handles zero', () => {
      expect(formatBytes(0)).toBe('0 B');
    });
  });

  describe('getCostPerTb', () => {
    it('returns default cost per TB', () => {
      const cost = getCostPerTb();
      expect(cost).toBe(6.25);
    });
  });

  describe('BigQueryClient.formatJobProgress', () => {
    it('returns "Fetching results..." when job state is DONE', () => {
      const metadata = {
        status: { state: 'DONE' },
        statistics: {},
      };
      expect(BigQueryClient.formatJobProgress(metadata)).toBe('Fetching results...');
    });

    it('returns state with "..." when no stages', () => {
      const metadata = {
        status: { state: 'RUNNING' },
        statistics: { query: {} },
      };
      expect(BigQueryClient.formatJobProgress(metadata)).toBe('RUNNING...');
    });

    it('returns state with "..." when stages is empty array', () => {
      const metadata = {
        status: { state: 'QUEUED' },
        statistics: { query: { queryPlan: [] } },
      };
      expect(BigQueryClient.formatJobProgress(metadata)).toBe('QUEUED...');
    });

    it('formats progress with completed and total stages', () => {
      const metadata = {
        status: { state: 'RUNNING' },
        statistics: {
          query: {
            queryPlan: [
              { status: 'COMPLETE' },
              { status: 'COMPLETE' },
              { status: 'RUNNING' },
              { status: 'PENDING' },
            ],
          },
        },
      };
      const result = BigQueryClient.formatJobProgress(metadata);
      expect(result).toBe('RUNNING — 2/4 stages (50%)');
    });

    it('shows 0% progress when no stages completed', () => {
      const metadata = {
        status: { state: 'RUNNING' },
        statistics: {
          query: {
            queryPlan: [
              { status: 'PENDING' },
              { status: 'PENDING' },
            ],
          },
        },
      };
      expect(BigQueryClient.formatJobProgress(metadata)).toBe('RUNNING — 0/2 stages (0%)');
    });

    it('shows 100% progress when all stages completed', () => {
      const metadata = {
        status: { state: 'RUNNING' },
        statistics: {
          query: {
            queryPlan: [
              { status: 'COMPLETE' },
              { status: 'COMPLETE' },
              { status: 'COMPLETE' },
            ],
          },
        },
      };
      expect(BigQueryClient.formatJobProgress(metadata)).toBe('RUNNING — 3/3 stages (100%)');
    });

    it('handles missing status state', () => {
      const metadata = {
        statistics: { query: { queryPlan: [] } },
      };
      expect(BigQueryClient.formatJobProgress(metadata)).toBe('UNKNOWN...');
    });

    it('handles null or undefined metadata', () => {
      expect(BigQueryClient.formatJobProgress(null)).toBe('UNKNOWN...');
      expect(BigQueryClient.formatJobProgress(undefined)).toBe('UNKNOWN...');
    });

    it('handles metadata with no statistics', () => {
      const metadata = {
        status: { state: 'RUNNING' },
      };
      expect(BigQueryClient.formatJobProgress(metadata)).toBe('RUNNING...');
    });

    it('calculates percentage correctly for partial progress', () => {
      const metadata = {
        status: { state: 'RUNNING' },
        statistics: {
          query: {
            queryPlan: [
              { status: 'COMPLETE' },
              { status: 'RUNNING' },
              { status: 'RUNNING' },
            ],
          },
        },
      };
      expect(BigQueryClient.formatJobProgress(metadata)).toBe('RUNNING — 1/3 stages (33%)');
    });

    it('rounds percentage correctly', () => {
      // 2/3 = 66.66... should round to 67%
      const metadata = {
        status: { state: 'RUNNING' },
        statistics: {
          query: {
            queryPlan: [
              { status: 'COMPLETE' },
              { status: 'COMPLETE' },
              { status: 'RUNNING' },
            ],
          },
        },
      };
      expect(BigQueryClient.formatJobProgress(metadata)).toBe('RUNNING — 2/3 stages (67%)');
    });

    it('handles single stage in various states', () => {
      const completedMeta = {
        status: { state: 'RUNNING' },
        statistics: { query: { queryPlan: [{ status: 'COMPLETE' }] } },
      };
      expect(BigQueryClient.formatJobProgress(completedMeta)).toBe('RUNNING — 1/1 stages (100%)');

      const pendingMeta = {
        status: { state: 'RUNNING' },
        statistics: { query: { queryPlan: [{ status: 'PENDING' }] } },
      };
      expect(BigQueryClient.formatJobProgress(pendingMeta)).toBe('RUNNING — 0/1 stages (0%)');
    });

    it('handles large number of stages', () => {
      const stages = Array(100)
        .fill(null)
        .map((_, i) => ({ status: i < 75 ? 'COMPLETE' : 'RUNNING' }));
      const metadata = {
        status: { state: 'RUNNING' },
        statistics: { query: { queryPlan: stages } },
      };
      expect(BigQueryClient.formatJobProgress(metadata)).toBe('RUNNING — 75/100 stages (75%)');
    });
  });
});
