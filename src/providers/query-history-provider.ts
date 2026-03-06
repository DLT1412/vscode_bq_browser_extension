import * as vscode from 'vscode';
import { QueryHistoryService, HistoryEntry } from '../services/query-history-service';

/** Tree item representing a query history entry */
class HistoryNode extends vscode.TreeItem {
  constructor(
    public readonly entry: HistoryEntry,
    public readonly index: number,
  ) {
    const truncatedSql = entry.sql.replace(/\s+/g, ' ').trim();
    const sqlPreview = truncatedSql.length > 60
      ? truncatedSql.substring(0, 60) + '...'
      : truncatedSql;
    const timePrefix = formatShortTime(entry.timestamp);
    const label = `${timePrefix} ${entry.name || sqlPreview}`;

    super(label, vscode.TreeItemCollapsibleState.None);

    this.contextValue = 'historyEntry';
    this.description = formatTimestamp(entry.timestamp);
    this.tooltip = [
      entry.sql,
      '',
      `Status: ${entry.status}`,
      `Duration: ${entry.durationMs}ms`,
      `Bytes: ${entry.bytesProcessed}`,
      entry.error ? `Error: ${entry.error}` : '',
    ].filter(Boolean).join('\n');

    this.iconPath = new vscode.ThemeIcon(
      entry.status === 'success' ? 'check' : 'error',
      entry.status === 'success'
        ? new vscode.ThemeColor('testing.iconPassed')
        : new vscode.ThemeColor('testing.iconFailed'),
    );
  }
}

/** TreeDataProvider for query history sidebar */
export class QueryHistoryProvider implements vscode.TreeDataProvider<HistoryNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<HistoryNode | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private filterPattern = '';

  constructor(private historyService: QueryHistoryService) {
    historyService.onDidChange(() => {
      this._onDidChangeTreeData.fire(undefined);
    });
  }

  /** Set filter pattern and refresh tree */
  setFilter(pattern: string): void {
    this.filterPattern = pattern.toLowerCase();
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Get current filter */
  getFilter(): string {
    return this.filterPattern;
  }

  getTreeItem(element: HistoryNode): vscode.TreeItem {
    return element;
  }

  async getChildren(): Promise<HistoryNode[]> {
    const entries = this.historyService.getEntries();
    const nodes = entries.map((entry, index) => new HistoryNode(entry, index));
    if (!this.filterPattern) return nodes;
    return nodes.filter((n) => {
      const name = (n.entry.name || '').toLowerCase();
      const sql = n.entry.sql.toLowerCase();
      return name.includes(this.filterPattern) || sql.includes(this.filterPattern);
    });
  }

  /** Get SQL from a history node for re-running */
  getSql(node: HistoryNode): string {
    return node.entry.sql;
  }
}

/** Format timestamp as [MM/DD HH:mm] for label prefix */
function formatShortTime(iso: string): string {
  const date = new Date(iso);
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `[${mo}/${d} ${h}:${m}]`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString();
}
