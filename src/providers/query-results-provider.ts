import * as vscode from 'vscode';
import { QueryResult, BigQueryClient, DestinationTable, QueryOptions, formatBytes } from '../services/bigquery-client';
import { buildResultsHtml } from './query-results-webview-html';

/** Current result view state shared with the webview */
interface ResultViewState {
  columns: string[];
  rows: Record<string, unknown>[];
  page: number;
  totalPages: number;
  totalRows: string;
  sortColumn: string;
  sortDir: 'ASC' | 'DESC';
  bytesProcessed: string;
  cacheHit: boolean;
  jobId: string;
  sql: string;
  canPage: boolean; // false for preview (no dest table)
}

/** Per-panel session holding all state for one result tab */
interface PanelSession {
  panel: vscode.WebviewPanel;
  originalDestTable: DestinationTable | undefined;
  destTable: DestinationTable | undefined;
  sortedDestCache: Map<string, DestinationTable>;
  queryOptions: QueryOptions | undefined;
  viewState: ResultViewState;
  fetchSeq: number; // guards against race conditions in concurrent fetches
}

/** Manages multiple webview panels for displaying query results */
export class QueryResultsProvider {
  private sessions = new Map<vscode.WebviewPanel, PanelSession>();
  private sortDebounceTimers = new Map<vscode.WebviewPanel, ReturnType<typeof setTimeout>>();

  /** Read pageSize dynamically so config changes take effect mid-session */
  private get pageSize(): number {
    return vscode.workspace.getConfiguration('bigqueryBrowser').get('maxResults', 50);
  }

  constructor(
    private extensionUri: vscode.Uri,
    private bqClient: BigQueryClient,
  ) {}

  /** Show query results in a new webview panel with a descriptive title */
  showResults(result: QueryResult, queryOptions?: QueryOptions, title?: string, sql?: string): void {
    const columns = result.schema.map((f) => f.name || 'unknown');
    const totalRows = Number(result.totalRows) || result.rows.length;
    const panelTitle = title || 'Query Results';

    const viewState: ResultViewState = {
      columns,
      rows: result.rows,
      page: 0,
      totalPages: Math.max(1, Math.ceil(totalRows / this.pageSize)),
      totalRows: `${totalRows.toLocaleString()}`,
      sortColumn: '',
      sortDir: 'ASC',
      bytesProcessed: formatBytes(Number(result.bytesProcessed)),
      cacheHit: result.cacheHit,
      jobId: result.jobId,
      sql: sql || '',
      canPage: !!result.destinationTable,
    };

    const panel = vscode.window.createWebviewPanel(
      'bigqueryResults', panelTitle, vscode.ViewColumn.Two,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    const session: PanelSession = {
      panel,
      originalDestTable: result.destinationTable,
      destTable: result.destinationTable,
      sortedDestCache: new Map(),
      queryOptions,
      viewState,
      fetchSeq: 0,
    };

    this.sessions.set(panel, session);
    panel.onDidDispose(() => { this.sessions.delete(panel); });
    panel.webview.onDidReceiveMessage((msg) => this.handleMessage(session, msg));

    const nonce = getNonce();
    const safeState = JSON.stringify(viewState).replace(/</g, '\\u003c');
    panel.webview.html = buildResultsHtml(nonce, panel.webview.cspSource, safeState);
  }

  private async handleMessage(session: PanelSession, msg: { command: string; [key: string]: unknown }): Promise<void> {
    switch (msg.command) {
      case 'changePage':
        await this.fetchPage(session, msg.page as number, session.viewState.sortColumn, session.viewState.sortDir, msg.visibleColumns as string[] | undefined);
        break;
      case 'sort': {
        const col = msg.column as string;
        const dir = msg.direction as string;
        if (!session.viewState.columns.includes(col)) break;
        if (dir !== 'ASC' && dir !== 'DESC') break;
        // Debounce sort to prevent rapid clicks from firing multiple billable ORDER BY queries
        const existingTimer = this.sortDebounceTimers.get(session.panel);
        if (existingTimer) clearTimeout(existingTimer);
        const timer = setTimeout(() => {
          this.sortDebounceTimers.delete(session.panel);
          this.fetchPage(session, 0, col, dir, msg.visibleColumns as string[] | undefined);
        }, 300);
        this.sortDebounceTimers.set(session.panel, timer);
        break;
      }
      case 'copyToClipboard':
        await vscode.env.clipboard.writeText(msg.text as string);
        vscode.window.showInformationMessage('Copied to clipboard');
        break;
      case 'exportCsv':
        await this.exportData(msg.data as string, 'csv');
        break;
      case 'exportJson':
        await this.exportData(msg.data as string, 'json');
        break;
      case 'openInEditor': {
        const doc = await vscode.workspace.openTextDocument({ language: 'bigquerysql', content: msg.sql as string });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);
        break;
      }
    }
  }

  private async fetchPage(session: PanelSession, page: number, sortColumn?: string, sortDir?: 'ASC' | 'DESC', selectedFields?: string[]): Promise<void> {
    if (!session.originalDestTable) return;
    const seq = ++session.fetchSeq; // race condition guard
    const vs = session.viewState;
    const fields = selectedFields && selectedFields.length > 0 && selectedFields.length < vs.columns.length
      ? selectedFields : undefined;
    try {
      const sortKey = sortColumn ? `${sortColumn}:${sortDir}` : '';
      const cachedSorted = sortKey ? session.sortedDestCache.get(sortKey) : undefined;

      if (!sortColumn) {
        session.destTable = session.originalDestTable;
        const result = await this.bqClient.fetchResultPage(
          session.destTable, page, this.pageSize, undefined, 'ASC', session.queryOptions, false, fields,
        );
        vs.rows = result.rows;
      } else if (cachedSorted) {
        session.destTable = cachedSorted;
        const result = await this.bqClient.fetchResultPage(
          session.destTable, page, this.pageSize, undefined, 'ASC', session.queryOptions, false, fields,
        );
        vs.rows = result.rows;
      } else {
        const result = await this.bqClient.fetchResultPage(
          session.originalDestTable, page, this.pageSize, sortColumn, sortDir || 'ASC', session.queryOptions, true,
        );
        vs.rows = result.rows;
        if (result.sortedDestTable) {
          session.sortedDestCache.set(sortKey, result.sortedDestTable);
          session.destTable = result.sortedDestTable;
        }
      }

      // Drop stale response if a newer fetch was started or panel was disposed
      if (seq !== session.fetchSeq) return;
      if (!this.sessions.has(session.panel)) return;
      vs.page = page;
      vs.sortColumn = sortColumn || '';
      vs.sortDir = sortDir || 'ASC';
      session.panel.webview.postMessage({ command: 'updateData', state: vs });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      vscode.window.showErrorMessage(`Failed to fetch page: ${message}`);
    }
  }

  private async exportData(data: string, format: string): Promise<void> {
    const uri = await vscode.window.showSaveDialog({
      filters: { [format.toUpperCase()]: [format] },
      defaultUri: vscode.Uri.file(`query-results.${format}`),
    });
    if (uri) {
      await vscode.workspace.fs.writeFile(uri, Buffer.from(data, 'utf-8'));
      vscode.window.showInformationMessage(`Exported to ${uri.fsPath}`);
    }
  }

  dispose(): void {
    for (const timer of this.sortDebounceTimers.values()) clearTimeout(timer);
    this.sortDebounceTimers.clear();
    for (const session of this.sessions.values()) {
      session.panel.dispose();
    }
    this.sessions.clear();
  }
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
