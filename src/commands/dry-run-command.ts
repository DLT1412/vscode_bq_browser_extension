import * as vscode from 'vscode';
import { BigQueryClient, getCostPerTb } from '../services/bigquery-client';
import { parseQueryDirectives } from '../utils/sql-directive-parser';

/** Dry run the current editor's SQL to estimate cost */
export async function dryRunCommand(bqClient: BigQueryClient): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('No active editor with SQL to analyze');
    return;
  }

  const selection = editor.selection;
  const sql = selection.isEmpty
    ? editor.document.getText()
    : editor.document.getText(selection);

  if (!sql.trim()) {
    vscode.window.showWarningMessage('No SQL to analyze');
    return;
  }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Estimating query cost...' },
    async () => {
      try {
        const fullText = editor.document.getText();
        const directives = parseQueryDirectives(fullText);
        const result = await bqClient.dryRun(sql, directives);
        const costEstimate = estimateCost(Number(result.totalBytesProcessed));
        vscode.window.showInformationMessage(
          `Estimated: ${result.formattedBytes} processed (~$${costEstimate})`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Dry run failed: ${message}`);
      }
    },
  );
}

/** Estimate cost in USD using configurable cost per TB */
function estimateCost(bytes: number): string {
  const tb = bytes / (1024 ** 4);
  const cost = tb * getCostPerTb();
  if (cost < 0.01) return '< 0.01';
  return cost.toFixed(4);
}
