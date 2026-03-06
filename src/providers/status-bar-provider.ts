import * as vscode from 'vscode';

/** Manages status bar items for BigQuery Browser */
export class StatusBarProvider {
  private projectItem: vscode.StatusBarItem;
  private costItem: vscode.StatusBarItem;
  private autoEstimateItem: vscode.StatusBarItem;
  private configListener: vscode.Disposable;

  constructor() {
    this.projectItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.projectItem.command = 'bigqueryBrowser.setDefaultProject';
    this.projectItem.tooltip = 'Click to change BigQuery project';

    this.costItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 99);
    this.costItem.tooltip = 'Last query cost';

    this.autoEstimateItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 98);
    this.autoEstimateItem.tooltip = 'Auto dry-run estimate';

    this.updateProjectDisplay();

    this.configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('bigqueryBrowser.projectId')) {
        this.updateProjectDisplay();
      }
    });
  }

  /** Update the project display in status bar */
  updateProjectDisplay(): void {
    const projectId = vscode.workspace
      .getConfiguration('bigqueryBrowser')
      .get<string>('projectId', '');

    if (projectId) {
      this.projectItem.text = `$(database) ${projectId}`;
    } else {
      this.projectItem.text = '$(database) Set BQ Project';
    }
    this.projectItem.show();
  }

  /** Update the cost display after a query */
  updateCost(formattedBytes: string, cached: boolean): void {
    this.costItem.text = `$(pulse) ${formattedBytes}${cached ? ' (cached)' : ''}`;
    this.costItem.show();
  }

  /** Update auto dry-run estimate in status bar */
  updateAutoEstimate(text: string, isError: boolean): void {
    this.autoEstimateItem.text = text;
    this.autoEstimateItem.backgroundColor = isError
      ? new vscode.ThemeColor('statusBarItem.errorBackground')
      : undefined;
    this.autoEstimateItem.show();
  }

  /** Hide auto-estimate when no .bqsql editor is active */
  hideAutoEstimate(): void {
    this.autoEstimateItem.hide();
  }

  dispose(): void {
    this.configListener.dispose();
    this.projectItem.dispose();
    this.costItem.dispose();
    this.autoEstimateItem.dispose();
  }
}
