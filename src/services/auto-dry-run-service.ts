import * as vscode from 'vscode';
import { BigQueryClient, formatBytes, getCostPerTb } from './bigquery-client';
import { StatusBarProvider } from '../providers/status-bar-provider';
import { parseQueryDirectives } from '../utils/sql-directive-parser';

/** Watches .bqsql editors and auto-runs dry-run with debounce */
export class AutoDryRunService {
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private disposables: vscode.Disposable[] = [];
  private running = false;

  constructor(
    private bqClient: BigQueryClient,
    private statusBar: StatusBarProvider,
    private diagnostics: vscode.DiagnosticCollection,
  ) {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => this.onDocumentChange(e)),
      vscode.window.onDidChangeActiveTextEditor((e) => this.onEditorChange(e)),
    );

    // Run for current editor on startup
    if (vscode.window.activeTextEditor) {
      this.onEditorChange(vscode.window.activeTextEditor);
    }
  }

  private isEnabled(): boolean {
    return vscode.workspace
      .getConfiguration('bigqueryBrowser')
      .get<boolean>('autoDryRun', true);
  }

  private isBqsqlDocument(doc: vscode.TextDocument): boolean {
    return doc.languageId === 'bigquerysql';
  }

  private onEditorChange(editor: vscode.TextEditor | undefined): void {
    if (!editor || !this.isBqsqlDocument(editor.document)) {
      this.statusBar.hideAutoEstimate();
      return;
    }
    this.scheduleDryRun(editor.document);
  }

  private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (!this.isBqsqlDocument(event.document)) return;
    this.scheduleDryRun(event.document);
  }

  private scheduleDryRun(document: vscode.TextDocument): void {
    if (!this.isEnabled()) {
      this.statusBar.hideAutoEstimate();
      return;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => this.executeDryRun(document), 1500);
  }

  private async executeDryRun(document: vscode.TextDocument): Promise<void> {
    // Guard: skip if active editor changed since debounce was scheduled
    const activeDoc = vscode.window.activeTextEditor?.document;
    if (activeDoc !== document) return;

    const sql = document.getText().trim();
    if (!sql || this.running) return;

    this.running = true;
    this.statusBar.updateAutoEstimate('$(loading~spin) Estimating...', false);

    try {
      const directives = parseQueryDirectives(sql);
      const result = await this.bqClient.dryRun(sql, directives);
      const bytes = Number(result.totalBytesProcessed);
      const cost = (bytes / 1024 ** 4) * getCostPerTb();
      const costStr = cost < 0.01 ? '< $0.01' : `~$${cost.toFixed(4)}`;
      this.statusBar.updateAutoEstimate(
        `$(check) ${formatBytes(bytes)} ${costStr}`,
        false,
      );
      // Clear diagnostics on success
      this.diagnostics.set(document.uri, []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setErrorDiagnostic(document, message);
      // Extract position info for status bar
      const posMatch = message.match(/\[(\d+:\d+)\]/);
      const posInfo = posMatch ? ` at [${posMatch[1]}]` : '';
      this.statusBar.updateAutoEstimate(
        `$(error) Syntax error${posInfo}`,
        true,
      );
    } finally {
      this.running = false;
    }
  }

  /** Parse BigQuery error message and set inline diagnostic */
  private setErrorDiagnostic(document: vscode.TextDocument, message: string): void {
    // BigQuery errors often contain position like [line:col] e.g. "at [2:5]"
    const posMatch = message.match(/\[(\d+):(\d+)\]/);
    let range: vscode.Range;
    if (posMatch) {
      const line = Math.max(0, parseInt(posMatch[1], 10) - 1);
      const col = Math.max(0, parseInt(posMatch[2], 10) - 1);
      // Highlight the whole line where the error occurs
      const lineText = line < document.lineCount ? document.lineAt(line).text : '';
      range = new vscode.Range(line, col, line, Math.max(col + 1, lineText.length));
    } else {
      // No position info — mark first line
      range = new vscode.Range(0, 0, 0, document.lineAt(0).text.length);
    }

    // Clean up the error message for display
    const cleanMsg = message.replace(/^Syntax error in SQL query\s*/i, '').trim() || message;

    const diagnostic = new vscode.Diagnostic(range, cleanMsg, vscode.DiagnosticSeverity.Error);
    diagnostic.source = 'BigQuery';
    this.diagnostics.set(document.uri, [diagnostic]);
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
