import * as vscode from 'vscode';
import { AuthService } from './services/auth-service';
import { BigQueryClient, formatBytes } from './services/bigquery-client';
import { AssetCacheService } from './services/asset-cache-service';
import { AssetExplorerProvider, AssetNode } from './providers/asset-explorer-provider';
import { QueryResultsProvider } from './providers/query-results-provider';
import { QueryHistoryService } from './services/query-history-service';
import { QueryHistoryProvider } from './providers/query-history-provider';
import { TableMetadataProvider } from './providers/table-metadata-provider';
import { SchemaHoverProvider } from './providers/schema-hover-provider';
import { StatusBarProvider } from './providers/status-bar-provider';
import { AutoDryRunService } from './services/auto-dry-run-service';
import { runQueryCommand } from './commands/run-query-command';
import { dryRunCommand } from './commands/dry-run-command';
import { parseQueryDirectives } from './utils/sql-directive-parser';

export function activate(context: vscode.ExtensionContext): void {
  // --- Core services ---
  const authService = new AuthService();
  const bqClient = new BigQueryClient(authService);
  const historyService = new QueryHistoryService(context.globalState);

  // --- Cache & Providers ---
  const cacheService = new AssetCacheService(context.globalStorageUri.fsPath);
  const explorerProvider = new AssetExplorerProvider(bqClient, cacheService);
  const resultsProvider = new QueryResultsProvider(context.extensionUri, bqClient);
  const historyProvider = new QueryHistoryProvider(historyService);
  const metadataProvider = new TableMetadataProvider(context.extensionUri, bqClient);
  const statusBar = new StatusBarProvider();

  // --- Diagnostics & auto dry-run ---
  const diagnostics = vscode.languages.createDiagnosticCollection('bigquery');
  const autoDryRun = new AutoDryRunService(bqClient, statusBar, diagnostics);

  // --- TreeViews ---
  const explorerView = vscode.window.createTreeView('bigqueryExplorer', {
    treeDataProvider: explorerProvider,
    showCollapseAll: true,
  });

  const historyView = vscode.window.createTreeView('bigqueryHistory', {
    treeDataProvider: historyProvider,
  });

  // --- Hover provider for schema info ---
  const hoverDisposable = vscode.languages.registerHoverProvider(
    { language: 'bigquerysql' },
    new SchemaHoverProvider(bqClient),
  );

  // --- Commands ---
  const commands: [string, (...args: unknown[]) => unknown][] = [
    ['bigqueryBrowser.runQuery', () => runQueryCommand(bqClient, resultsProvider, historyService)],
    ['bigqueryBrowser.dryRun', () => dryRunCommand(bqClient)],
    ['bigqueryBrowser.refreshExplorer', () => explorerProvider.refresh()],
    ['bigqueryBrowser.clearHistory', () => historyService.clearHistory()],
    ['bigqueryBrowser.copyTableReference', (node: unknown) => {
      if (node instanceof AssetNode) {
        vscode.env.clipboard.writeText(node.getFullReference());
        vscode.window.showInformationMessage(`Copied: ${node.getFullReference()}`);
      }
    }],
    ['bigqueryBrowser.previewTable', async (node: unknown) => {
      if (node instanceof AssetNode && node.nodeType === 'table') {
        try {
          const result = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: `Previewing ${node.tableId}...` },
            () => bqClient.previewTable(node.projectId, node.datasetId, node.tableId),
          );
          resultsProvider.showResults(result, undefined, `Preview · ${node.tableId}`);
          statusBar.updateCost(formatBytes(Number(result.bytesProcessed)), result.cacheHit);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`Preview failed: ${msg}`);
        }
      }
    }],
    ['bigqueryBrowser.viewSchema', async (node: unknown) => {
      if (node instanceof AssetNode && (node.nodeType === 'table' || node.nodeType === 'view')) {
        await metadataProvider.showMetadata(node.projectId, node.datasetId, node.tableId);
      }
    }],
    ['bigqueryBrowser.runFromHistory', (node: unknown) => {
      // The node from TreeView context menu — get SQL and run it
      if (node && typeof node === 'object' && 'entry' in node) {
        const entry = (node as { entry: { sql: string; region?: string } }).entry;
        const opts = entry.region ? { region: entry.region } : undefined;
        runQueryFromSql(entry.sql, bqClient, resultsProvider, historyService, statusBar, opts);
      }
    }],
    ['bigqueryBrowser.filterExplorer', async () => {
      const value = await vscode.window.showInputBox({
        prompt: 'Filter datasets and tables by name',
        placeHolder: 'e.g. users, orders',
        value: explorerProvider.getFilter(),
      });
      if (value !== undefined) {
        explorerProvider.setFilter(value);
        explorerView.description = value ? `Filtered: ${value}` : undefined;
        vscode.commands.executeCommand('setContext', 'bigqueryBrowser.explorerFilterActive', !!value);
      }
    }],
    ['bigqueryBrowser.clearFilter', () => {
      explorerProvider.setFilter('');
      explorerView.description = undefined;
      vscode.commands.executeCommand('setContext', 'bigqueryBrowser.explorerFilterActive', false);
    }],
    ['bigqueryBrowser.viewHistorySql', async (node: unknown) => {
      if (node && typeof node === 'object' && 'entry' in node) {
        const entry = (node as { entry: { sql: string } }).entry;
        const doc = await vscode.workspace.openTextDocument({
          language: 'bigquerysql',
          content: entry.sql,
        });
        await vscode.window.showTextDocument(doc);
      }
    }],
    ['bigqueryBrowser.viewHistoryResults', async (node: unknown) => {
      if (node && typeof node === 'object' && 'entry' in node) {
        const entry = (node as { entry: { destinationTable?: { projectId: string; datasetId: string; tableId: string }; sql: string; region?: string; name?: string; bytesProcessed: string; durationMs: number } }).entry;
        if (!entry.destinationTable) {
          vscode.window.showWarningMessage('No result table stored for this query');
          return;
        }
        const opts = entry.region ? { region: entry.region } : undefined;
        try {
          // Use free tabledata.list API instead of billable SELECT * query
          const dest = entry.destinationTable;
          const table = bqClient['bq'].dataset(dest.datasetId, { projectId: dest.projectId }).table(dest.tableId);
          const [metadata] = await vscode.window.withProgress(
            { location: vscode.ProgressLocation.Notification, title: 'Loading cached results...' },
            async () => {
              const [meta] = await table.getMetadata();
              return [meta];
            },
          );
          const schema = metadata.schema?.fields || [];
          const maxResults = vscode.workspace.getConfiguration('bigqueryBrowser').get<number>('maxResults', 50);
          const [rows] = await table.getRows({ maxResults });
          const result = {
            rows: rows as Record<string, unknown>[],
            schema,
            totalRows: metadata.numRows || String(rows.length),
            jobId: '',
            bytesProcessed: '0',
            cacheHit: true,
            destinationTable: dest,
          };
          const historyTitle = entry.name || entry.sql.replace(/\s+/g, ' ').trim().substring(0, 30);
          resultsProvider.showResults(result, opts, historyTitle, entry.sql);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          // Differentiate "table not found" (expired) from other errors
          const isExpired = message.includes('Not found') || message.includes('404') || message.includes('notFound');
          if (isExpired) {
            const bytes = formatBytes(Number(entry.bytesProcessed));
            const duration = (entry.durationMs / 1000).toFixed(1);
            const choice = await vscode.window.showWarningMessage(
              `Result table expired. Re-run this query? (Last run: ${bytes} processed, ${duration}s)`,
              'Re-run', 'Cancel',
            );
            if (choice === 'Re-run') {
              runQueryFromSql(entry.sql, bqClient, resultsProvider, historyService, statusBar, opts);
            }
          } else {
            vscode.window.showErrorMessage(`Failed to load results: ${message}`);
          }
        }
      }
    }],
    ['bigqueryBrowser.newQueryFile', async () => {
      const doc = await vscode.workspace.openTextDocument({
        language: 'bigquerysql',
        content: '-- New BigQuery SQL query\nSELECT\n  \nFROM\n  \n',
      });
      await vscode.window.showTextDocument(doc);
    }],
    ['bigqueryBrowser.setDefaultProject', async () => {
      const config = vscode.workspace.getConfiguration('bigqueryBrowser');
      const projectId = await vscode.window.showInputBox({
        prompt: 'Enter the GCP Project ID for browsing datasets and tables',
        placeHolder: 'my-project-id',
        value: config.get('projectId', ''),
      });
      if (projectId !== undefined) {
        await config.update('projectId', projectId, vscode.ConfigurationTarget.Global);
        statusBar.updateProjectDisplay();
        explorerProvider.refresh();
        vscode.window.showInformationMessage(`Browse project set to: ${projectId || '(cleared)'}`);
      }
    }],
    ['bigqueryBrowser.setExecutionProject', async () => {
      const config = vscode.workspace.getConfiguration('bigqueryBrowser');
      const projectId = await vscode.window.showInputBox({
        prompt: 'Enter the GCP Project ID for query execution & billing (leave empty to use browse project)',
        placeHolder: 'my-billing-project-id',
        value: config.get('executionProjectId', ''),
      });
      if (projectId !== undefined) {
        await config.update('executionProjectId', projectId, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage(
          projectId ? `Execution project set to: ${projectId}` : 'Execution project cleared (will use browse project)',
        );
      }
    }],
    ['bigqueryBrowser.setDefaultRegion', async () => {
      const config = vscode.workspace.getConfiguration('bigqueryBrowser');
      const currentRegion = config.get<string>('location', 'US');
      const commonRegions = [
        { label: 'US', description: 'United States multi-region' },
        { label: 'EU', description: 'European Union multi-region' },
        { label: 'us-central1', description: 'Iowa' },
        { label: 'us-east1', description: 'South Carolina' },
        { label: 'us-east4', description: 'Northern Virginia' },
        { label: 'us-west1', description: 'Oregon' },
        { label: 'europe-west1', description: 'Belgium' },
        { label: 'europe-west2', description: 'London' },
        { label: 'asia-east1', description: 'Taiwan' },
        { label: 'asia-northeast1', description: 'Tokyo' },
        { label: 'asia-southeast1', description: 'Singapore' },
        { label: 'australia-southeast1', description: 'Sydney' },
      ];
      const picked = await vscode.window.showQuickPick(
        [...commonRegions, { label: '$(edit) Enter custom region...', description: '' }],
        { placeHolder: `Current: ${currentRegion} — Select default BigQuery region` },
      );
      if (!picked) return;
      let region = picked.label;
      if (region.includes('Enter custom region')) {
        const custom = await vscode.window.showInputBox({
          prompt: 'Enter BigQuery region',
          placeHolder: 'e.g. asia-southeast1',
          value: currentRegion,
        });
        if (!custom) return;
        region = custom;
      }
      await config.update('location', region, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Default region set to: ${region}`);
    }],
    ['bigqueryBrowser.setMaxBytesBilled', async () => {
      const config = vscode.workspace.getConfiguration('bigqueryBrowser');
      const current = config.get<number>('maximumBytesBilledGb', 200);
      const input = await vscode.window.showInputBox({
        prompt: 'Maximum bytes billed per query in GB (0 = no limit)',
        placeHolder: '200',
        value: String(current),
        validateInput: (v) => {
          const n = Number(v);
          if (isNaN(n) || n < 0) return 'Enter a non-negative number';
          return undefined;
        },
      });
      if (input === undefined) return;
      const gb = Number(input);
      await config.update('maximumBytesBilledGb', gb, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(
        gb > 0 ? `Cost limit set to ${gb} GB per query` : 'Cost limit disabled (no limit)',
      );
    }],
    ['bigqueryBrowser.renameHistoryEntry', async (node: unknown) => {
      if (node && typeof node === 'object' && 'entry' in node) {
        const entry = (node as { entry: { name?: string; sql: string; timestamp: string } }).entry;
        const name = await vscode.window.showInputBox({
          prompt: 'Enter a name for this query (leave empty to use SQL preview)',
          value: entry.name || '',
          placeHolder: entry.sql.replace(/\s+/g, ' ').trim().substring(0, 60),
        });
        if (name !== undefined) {
          historyService.renameEntry(entry.timestamp, entry.sql, name);
        }
      }
    }],
    ['bigqueryBrowser.filterHistory', async () => {
      const value = await vscode.window.showInputBox({
        prompt: 'Filter history by name or SQL content',
        placeHolder: 'e.g. SELECT, my-query',
        value: historyProvider.getFilter(),
      });
      if (value !== undefined) {
        historyProvider.setFilter(value);
        historyView.description = value ? `Filtered: ${value}` : undefined;
        vscode.commands.executeCommand('setContext', 'bigqueryBrowser.historyFilterActive', !!value);
      }
    }],
    ['bigqueryBrowser.clearHistoryFilter', () => {
      historyProvider.setFilter('');
      historyView.description = undefined;
      vscode.commands.executeCommand('setContext', 'bigqueryBrowser.historyFilterActive', false);
    }],
    ['bigqueryBrowser.deleteHistoryEntry', async (node: unknown) => {
      if (node && typeof node === 'object' && 'entry' in node) {
        const entry = (node as { entry: { sql: string; timestamp: string } }).entry;
        const sqlPreview = entry.sql.replace(/\s+/g, ' ').trim().substring(0, 60);
        const choice = await vscode.window.showWarningMessage(
          `Delete this query from history?\n${sqlPreview}`,
          { modal: true },
          'Delete',
        );
        if (choice === 'Delete') {
          historyService.deleteEntry(entry.timestamp, entry.sql);
        }
      }
    }],
    ['bigqueryBrowser.copyHistorySql', (node: unknown) => {
      if (node && typeof node === 'object' && 'entry' in node) {
        const entry = (node as { entry: { sql: string } }).entry;
        vscode.env.clipboard.writeText(entry.sql);
        vscode.window.showInformationMessage('SQL copied to clipboard');
      }
    }],
  ];

  for (const [id, handler] of commands) {
    context.subscriptions.push(vscode.commands.registerCommand(id, handler));
  }

  // --- Subscriptions ---
  context.subscriptions.push(
    explorerView,
    historyView,
    hoverDisposable,
    authService,
    resultsProvider,
    metadataProvider,
    statusBar,
    autoDryRun,
    diagnostics,
    { dispose: () => cacheService.dispose() },
  );
}

/** Run a query from SQL string (used by history re-run) */
async function runQueryFromSql(
  sql: string,
  bqClient: BigQueryClient,
  resultsProvider: QueryResultsProvider,
  historyService: QueryHistoryService,
  statusBar: StatusBarProvider,
  options?: { region?: string },
): Promise<void> {
  // Parse directives from SQL text and merge with explicit options
  const directives = parseQueryDirectives(sql);
  const queryOptions = {
    project: directives.project,
    region: options?.region || directives.region,
  };
  const hasOverrides = queryOptions.project || queryOptions.region;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Running BigQuery query...', cancellable: true },
    async (progress, token) => {
      const startTime = Date.now();
      try {
        const result = await bqClient.runQuery(sql, hasOverrides ? queryOptions : undefined, (msg) => {
          progress.report({ message: msg });
        }, token);
        const duration = Date.now() - startTime;
        const sqlPreview = sql.replace(/\s+/g, ' ').trim().substring(0, 30);
        resultsProvider.showResults(result, hasOverrides ? queryOptions : undefined, `Re-run · ${sqlPreview}`, sql);
        statusBar.updateCost(formatBytes(Number(result.bytesProcessed)), result.cacheHit);

        // destinationTable is only present for DQL queries (SELECT/WITH) from BigQuery API
        const config = vscode.workspace.getConfiguration('bigqueryBrowser');
        historyService.addEntry({
          sql,
          timestamp: new Date().toISOString(),
          bytesProcessed: result.bytesProcessed,
          status: 'success',
          durationMs: duration,
          rowCount: Number(result.totalRows) || result.rows.length,
          jobId: result.jobId,
          destinationTable: result.destinationTable,
          region: queryOptions.region || config.get<string>('location', 'US'),
        });
      } catch (err) {
        const duration = Date.now() - startTime;
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Query failed: ${message}`);

        historyService.addEntry({
          sql,
          timestamp: new Date().toISOString(),
          bytesProcessed: '0',
          status: 'error',
          durationMs: duration,
          error: message,
        });
      }
    },
  );
}

export function deactivate(): void {
  // Cleanup handled by disposables
}
