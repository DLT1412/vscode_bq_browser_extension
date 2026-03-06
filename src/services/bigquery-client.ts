import { BigQuery, Dataset, Table, TableField } from '@google-cloud/bigquery';
import * as vscode from 'vscode';
import { AuthService } from './auth-service';
import { QueryDirectives } from '../utils/sql-directive-parser';

/** Optional per-query overrides for project and location */
export type QueryOptions = QueryDirectives;

/** Destination table reference for paging/sorting on temp results */
export interface DestinationTable {
  projectId: string;
  datasetId: string;
  tableId: string;
}

/** Query execution result */
export interface QueryResult {
  rows: Record<string, unknown>[];
  schema: TableField[];
  totalRows: string;
  jobId: string;
  bytesProcessed: string;
  cacheHit: boolean;
  destinationTable?: DestinationTable;
}

/** Dry run estimation result */
export interface DryRunResult {
  totalBytesProcessed: string;
  formattedBytes: string;
}

/** Table metadata information */
export interface TableMetadata {
  projectId: string;
  datasetId: string;
  tableId: string;
  type: string;
  description: string;
  numRows: string;
  numBytes: string;
  createdAt: string;
  modifiedAt: string;
  schema: TableField[];
  labels: Record<string, string>;
  partitioning: { type: string; field: string } | null;
  clustering: string[] | null;
  viewQuery: string | null;
}

/** Wraps @google-cloud/bigquery with typed convenience methods */
export class BigQueryClient {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  private get bq(): BigQuery {
    return this.authService.getClient();
  }

  /** List accessible projects using resource manager API */
  async listProjects(): Promise<{ projectId: string; friendlyName: string }[]> {
    try {
      // Use the BigQuery client to get the current project
      // For multiple projects, users configure via settings
      const projectId = await this.authService.getProjectId();
      if (!projectId) {
        return [];
      }
      return [{ projectId, friendlyName: projectId }];
    } catch (err) {
      this.handleError('listing projects', err);
      return [];
    }
  }

  /** List datasets in a project */
  async listDatasets(projectId: string): Promise<{ datasetId: string; location: string }[]> {
    try {
      const [datasets] = await this.bq.getDatasets({ projectId });
      return datasets.map((ds: Dataset) => ({
        datasetId: ds.id!,
        location: ds.metadata?.location || '',
      }));
    } catch (err) {
      this.handleError('listing datasets', err);
      return [];
    }
  }

  /** Maximum tables to load per dataset before suggesting filter */
  private static readonly TABLE_LIST_LIMIT = 1000;

  /** List tables and views in a dataset with pagination and timeout handling */
  async listTables(
    projectId: string,
    datasetId: string,
  ): Promise<{ tableId: string; type: string }[]> {
    try {
      const dataset = this.bq.dataset(datasetId, { projectId });
      const allTables: { tableId: string; type: string }[] = [];
      let pageToken: string | undefined;

      // Paginate to handle large datasets, cap at TABLE_LIST_LIMIT
      do {
        const [tables, , response] = await dataset.getTables({
          maxResults: 500,
          pageToken,
          autoPaginate: false,
        });
        for (const t of tables) {
          allTables.push({
            tableId: t.id!,
            type: (t as Table).metadata?.type || 'TABLE',
          });
        }
        pageToken = (response as { nextPageToken?: string })?.nextPageToken;

        if (allTables.length >= BigQueryClient.TABLE_LIST_LIMIT) {
          vscode.window.showWarningMessage(
            `Dataset ${datasetId} has ${allTables.length}+ tables. Only the first ${BigQueryClient.TABLE_LIST_LIMIT} are shown. Use the Filter Explorer to narrow results.`,
          );
          break;
        }
      } while (pageToken);

      return allTables;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Provide specific guidance for timeout errors
      if (message.includes('timeout') || message.includes('DEADLINE_EXCEEDED') || message.includes('ETIMEDOUT')) {
        vscode.window.showErrorMessage(
          `Listing tables in ${datasetId} timed out. This dataset may have too many tables. Try using Filter Explorer to narrow results, or check your network connection.`,
        );
        return [];
      }
      this.handleError('listing tables', err);
      return [];
    }
  }

  /** Get table schema */
  async getTableSchema(
    projectId: string,
    datasetId: string,
    tableId: string,
  ): Promise<TableField[]> {
    try {
      const [metadata] = await this.bq
        .dataset(datasetId, { projectId })
        .table(tableId)
        .getMetadata();
      return metadata.schema?.fields || [];
    } catch (err) {
      this.handleError('getting table schema', err);
      return [];
    }
  }

  /** Get full table metadata */
  async getTableMetadata(
    projectId: string,
    datasetId: string,
    tableId: string,
  ): Promise<TableMetadata | null> {
    try {
      const [metadata] = await this.bq
        .dataset(datasetId, { projectId })
        .table(tableId)
        .getMetadata();

      return {
        projectId,
        datasetId,
        tableId,
        type: metadata.type || 'TABLE',
        description: metadata.description || '',
        numRows: metadata.numRows || '0',
        numBytes: metadata.numBytes || '0',
        createdAt: metadata.creationTime
          ? new Date(Number(metadata.creationTime)).toISOString()
          : '',
        modifiedAt: metadata.lastModifiedTime
          ? new Date(Number(metadata.lastModifiedTime)).toISOString()
          : '',
        schema: metadata.schema?.fields || [],
        labels: metadata.labels || {},
        partitioning: metadata.timePartitioning
          ? { type: metadata.timePartitioning.type, field: metadata.timePartitioning.field || '' }
          : null,
        clustering: metadata.clustering?.fields || null,
        viewQuery: metadata.view?.query || null,
      };
    } catch (err) {
      this.handleError('getting table metadata', err);
      return null;
    }
  }

  /** Progress callback type for query execution */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static formatJobProgress(metadata: any): string {
    const stats = metadata?.statistics;
    const state = metadata?.status?.state || 'UNKNOWN';
    if (state === 'DONE') return 'Fetching results...';
    const stages = stats?.query?.queryPlan;
    if (!stages || !Array.isArray(stages) || stages.length === 0) return `${state}...`;
    const completed = stages.filter((s: { status: string }) => s.status === 'COMPLETE').length;
    const total = stages.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return `${state} — ${completed}/${total} stages (${pct}%)`;
  }

  /** Maximum poll attempts before auto-cancelling (1 hour at 1s intervals) */
  private static readonly MAX_POLL_ATTEMPTS = 3600;

  /** Execute a BigQuery SQL query with optional per-query overrides, progress reporting, and cancellation */
  async runQuery(
    sql: string,
    options?: QueryOptions,
    onProgress?: (message: string) => void,
    cancellationToken?: vscode.CancellationToken,
  ): Promise<QueryResult> {
    const config = vscode.workspace.getConfiguration('bigqueryBrowser');
    const maxResults = config.get<number>('maxResults', 50);
    const maxBytesBilled = this.getMaxBytesBilled();
    const client = this.getClientWithOverrides(options);

    const [job] = await client.createQueryJob({
      query: sql,
      useLegacySql: false,
      maximumBytesBilled: maxBytesBilled,
    });

    // Poll job progress until done, with timeout and cancellation support
    if (onProgress) {
      let pollCount = 0;
      let isDone = false;
      while (!isDone) {
        // Check user cancellation
        if (cancellationToken?.isCancellationRequested) {
          await job.cancel();
          throw new Error('Query cancelled by user');
        }
        // Check timeout
        if (pollCount >= BigQueryClient.MAX_POLL_ATTEMPTS) {
          await job.cancel();
          throw new Error('Query timed out after 1 hour and was cancelled');
        }
        const [meta] = await job.getMetadata();
        const state = meta.status?.state;
        onProgress(BigQueryClient.formatJobProgress(meta));
        if (state === 'DONE') {
          if (meta.status?.errorResult) {
            throw new Error(meta.status.errorResult.message);
          }
          isDone = true;
        } else {
          pollCount++;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }

    const [rows, , queryResponse] = await job.getQueryResults({ maxResults });
    const [jobMetadata] = await job.getMetadata();
    const stats = jobMetadata.statistics;
    const destTableRef = jobMetadata.configuration?.query?.destinationTable;
    const schema = destTableRef
      ? (await client
          .dataset(destTableRef.datasetId)
          .table(destTableRef.tableId)
          .getMetadata())[0].schema?.fields || []
      : stats?.query?.schema?.fields || [];

    const destTable: DestinationTable | undefined = destTableRef
      ? { projectId: destTableRef.projectId, datasetId: destTableRef.datasetId, tableId: destTableRef.tableId }
      : undefined;

    return {
      rows: rows as Record<string, unknown>[],
      schema,
      totalRows: (queryResponse as { totalRows?: string })?.totalRows || String(rows.length),
      jobId: job.id!,
      bytesProcessed: stats?.totalBytesProcessed || '0',
      cacheHit: stats?.query?.cacheHit || false,
      destinationTable: destTable,
    };
  }

  /** Dry run to estimate query cost with optional per-query overrides */
  async dryRun(sql: string, options?: QueryOptions): Promise<DryRunResult> {
    const client = this.getClientWithOverrides(options);
    const [job] = await client.createQueryJob({
      query: sql,
      useLegacySql: false,
      dryRun: true,
    });

    const totalBytesProcessed = job.metadata.statistics?.totalBytesProcessed || '0';

    return {
      totalBytesProcessed,
      formattedBytes: formatBytes(Number(totalBytesProcessed)),
    };
  }

  /** Preview table data using free tabledata.list API (no query cost) */
  async previewTable(
    projectId: string,
    datasetId: string,
    tableId: string,
    limit = 100,
    selectedFields?: string[],
  ): Promise<QueryResult> {
    const table = this.bq.dataset(datasetId, { projectId }).table(tableId);
    const [metadata] = await table.getMetadata();
    const schema: TableField[] = metadata.schema?.fields || [];
    const getRowsOptions: Record<string, unknown> = { maxResults: limit };
    if (selectedFields && selectedFields.length > 0) {
      getRowsOptions.selectedFields = selectedFields.join(',');
    }
    const [rows] = await table.getRows(getRowsOptions);

    return {
      rows: rows as Record<string, unknown>[],
      schema,
      totalRows: metadata.numRows || String(rows.length),
      jobId: '',
      bytesProcessed: '0',
      cacheHit: false,
      // No destinationTable — prevents sort queries against physical table (would cost money)
    };
  }

  /** Fetch a page from a destination/temp table.
   *  Without sort: uses free tabledata.list API (no query cost).
   *  With sort + newSort=true: runs ORDER BY query, returns new dest table for future free reads.
   *  With sort + newSort=false: reads from already-sorted dest table via tabledata.list. */
  async fetchResultPage(
    dest: DestinationTable,
    page: number,
    pageSize: number,
    sortColumn?: string,
    sortDirection: 'ASC' | 'DESC' = 'ASC',
    options?: QueryOptions,
    newSort = false,
    selectedFields?: string[],
  ): Promise<{ rows: Record<string, unknown>[]; sortedDestTable?: DestinationTable }> {
    if (sortColumn && newSort) {
      // Sort query — creates a new temp table with sorted results
      const client = this.getClientWithOverrides(options);
      const maxBytesBilled = this.getMaxBytesBilled();
      // Runtime sanitization: escape backticks in column name, validate direction
      const safeCol = sortColumn.replace(/`/g, '\\`');
      const safeDir = sortDirection === 'DESC' ? 'DESC' : 'ASC';
      const sql = `SELECT * FROM \`${dest.projectId}.${dest.datasetId}.${dest.tableId}\` ORDER BY \`${safeCol}\` ${safeDir}`;
      const [job] = await client.createQueryJob({ query: sql, useLegacySql: false, maximumBytesBilled: maxBytesBilled });
      const [rows] = await job.getQueryResults({ maxResults: pageSize });
      const [meta] = await job.getMetadata();
      const dt = meta.configuration?.query?.destinationTable;
      const sortedDestTable: DestinationTable | undefined = dt
        ? { projectId: dt.projectId, datasetId: dt.datasetId, tableId: dt.tableId }
        : undefined;
      return { rows: rows as Record<string, unknown>[], sortedDestTable };
    }
    // Free read via tabledata.list — no query cost
    const table = this.bq.dataset(dest.datasetId, { projectId: dest.projectId }).table(dest.tableId);
    const getRowsOptions: Record<string, unknown> = {
      startIndex: String(page * pageSize),
      maxResults: pageSize,
    };
    if (selectedFields && selectedFields.length > 0) {
      getRowsOptions.selectedFields = selectedFields.join(',');
    }
    const [rows] = await table.getRows(getRowsOptions);
    return { rows: rows as Record<string, unknown>[] };
  }

  /** Get a BigQuery client for query execution, applying per-query overrides if present.
   *  Uses executionProjectId as the base project for billing, falls back to projectId. */
  private getClientWithOverrides(options?: QueryOptions): BigQuery {
    const config = vscode.workspace.getConfiguration('bigqueryBrowser');
    const execProject = config.get<string>('executionProjectId') || undefined;
    const baseProject = config.get<string>('projectId') || undefined;
    const baseLocation = config.get<string>('location', 'US');

    // If no overrides and no separate execution project, use default client
    if (!options?.project && !options?.region && !execProject) {
      return this.bq;
    }

    const keyFilePath = config.get<string>('keyFilePath') || undefined;
    const clientOpts: ConstructorParameters<typeof BigQuery>[0] = {
      projectId: options?.project || execProject || baseProject,
      location: options?.region || baseLocation,
    };
    if (keyFilePath) {
      clientOpts.keyFilename = keyFilePath;
    }
    return new BigQuery(clientOpts);
  }

  /** Get maximumBytesBilled from config, converting GB to bytes string */
  private getMaxBytesBilled(): string | undefined {
    const config = vscode.workspace.getConfiguration('bigqueryBrowser');
    const maxGb = config.get<number>('maximumBytesBilledGb', 200);
    if (maxGb <= 0) return undefined;
    return String(maxGb * 1024 * 1024 * 1024);
  }

  private handleError(action: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`BigQuery error ${action}: ${message}`);
  }
}

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (!isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Get cost per TB from config (supports flat-rate billing) */
export function getCostPerTb(): number {
  return vscode.workspace.getConfiguration('bigqueryBrowser').get<number>('costPerTbUsd', 6.25);
}
