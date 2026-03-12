import * as vscode from 'vscode';
import { BigQueryClient } from '../services/bigquery-client';
import { parseQueryDirectives } from '../utils/sql-directive-parser';
import type { QueryResultsProvider } from '../providers/query-results-provider';
import type { QueryHistoryService } from '../services/query-history-service';

/** Derive a short tab title from SQL (e.g. "SELECT · my_table") */
function deriveQueryTitle(sql: string): string {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  // Extract operation keyword
  const opMatch = normalized.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|MERGE|WITH)\b/i);
  const op = opMatch ? opMatch[1].toUpperCase() : 'SQL';
  // Extract first table reference after FROM/INTO/UPDATE/JOIN/TABLE
  const tableMatch = normalized.match(/(?:FROM|INTO|UPDATE|JOIN|TABLE)\s+`?([a-zA-Z0-9_.-]+)`?/i);
  const table = tableMatch ? tableMatch[1].split('.').pop() : undefined;
  const title = table ? `${op} · ${table}` : op;
  return title.length > 40 ? title.substring(0, 40) + '…' : title;
}

/** Execute the current editor's SQL query and display results */
export async function runQueryCommand(
  bqClient: BigQueryClient,
  resultsProvider: QueryResultsProvider,
  historyService?: QueryHistoryService,
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor with SQL to run');
    return;
  }

  // Use selection if available, otherwise full document
  const selection = editor.selection;
  const sql = selection.isEmpty
    ? editor.document.getText()
    : editor.document.getText(selection);

  if (!sql.trim()) {
    vscode.window.showWarningMessage('No SQL to execute');
    return;
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Running BigQuery query...', cancellable: true },
    async (progress, token) => {
      const startTime = Date.now();
      try {
        const fullText = editor.document.getText();
        const directives = parseQueryDirectives(fullText);
        const result = await bqClient.runQuery(sql, directives, (msg) => {
          progress.report({ message: msg });
        }, token);
        const duration = Date.now() - startTime;
        // Derive tab title from SQL: use first meaningful keyword + table reference
        const sqlTitle = deriveQueryTitle(sql);
        resultsProvider.showResults(result, directives, sqlTitle, sql);

        // Record in history — destinationTable is only present for DQL queries (SELECT/WITH)
        const config = vscode.workspace.getConfiguration('bigqueryBrowser');
        historyService?.addEntry({
          sql,
          timestamp: new Date().toISOString(),
          bytesProcessed: result.bytesProcessed,
          status: 'success',
          durationMs: duration,
          rowCount: Number(result.totalRows) || result.rows.length,
          jobId: result.jobId,
          destinationTable: result.destinationTable,
          region: directives.region || config.get<string>('location', 'US'),
        });
      } catch (err) {
        const duration = Date.now() - startTime;
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Query failed: ${message}`);

        historyService?.addEntry({
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
