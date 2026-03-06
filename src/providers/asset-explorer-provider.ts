import * as vscode from 'vscode';
import { BigQueryClient } from '../services/bigquery-client';

/** Default cache TTL in milliseconds (24 hours) */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** Cached entry with timestamp */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/** Types of nodes in the asset explorer tree */
type NodeType = 'project' | 'dataset' | 'table' | 'view';

/** A node in the BigQuery asset explorer tree */
export class AssetNode extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly nodeType: NodeType,
    public readonly projectId: string,
    public readonly datasetId: string = '',
    public readonly tableId: string = '',
    collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.contextValue = nodeType;
    this.tooltip = this.buildTooltip();
    this.iconPath = this.getIcon();
    // Click table/view → open schema view
    if (nodeType === 'table' || nodeType === 'view') {
      this.command = {
        command: 'bigqueryBrowser.viewSchema',
        title: 'View Schema',
        arguments: [this],
      };
    }
  }

  private buildTooltip(): string {
    switch (this.nodeType) {
      case 'project': return this.projectId;
      case 'dataset': return `${this.projectId}.${this.datasetId}`;
      case 'table':
      case 'view':
        return `${this.projectId}.${this.datasetId}.${this.tableId}`;
    }
  }

  /** Full qualified reference for tables/views */
  getFullReference(): string {
    return `\`${this.projectId}.${this.datasetId}.${this.tableId}\``;
  }

  private getIcon(): vscode.ThemeIcon {
    switch (this.nodeType) {
      case 'project': return new vscode.ThemeIcon('project');
      case 'dataset': return new vscode.ThemeIcon('database');
      case 'table': return new vscode.ThemeIcon('table');
      case 'view': return new vscode.ThemeIcon('eye');
    }
  }
}

/** TreeDataProvider for the BigQuery asset explorer sidebar */
export class AssetExplorerProvider implements vscode.TreeDataProvider<AssetNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AssetNode | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private filterPattern = '';
  private datasetCache = new Map<string, CacheEntry<{ datasetId: string; location: string }[]>>();
  private tableCache = new Map<string, CacheEntry<{ tableId: string; type: string }[]>>();

  constructor(private bqClient: BigQueryClient) {}

  /** Refresh tree and clear all caches */
  refresh(): void {
    this.datasetCache.clear();
    this.tableCache.clear();
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Set a filter pattern and re-render tree (uses cache, no API calls) */
  setFilter(pattern: string): void {
    this.filterPattern = pattern.toLowerCase();
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Get the current filter pattern */
  getFilter(): string {
    return this.filterPattern;
  }

  getTreeItem(element: AssetNode): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AssetNode): Promise<AssetNode[]> {
    if (!element) {
      return this.getProjects();
    }

    switch (element.nodeType) {
      case 'project':
        return this.getDatasets(element.projectId);
      case 'dataset':
        return this.getTables(element.projectId, element.datasetId);
      default:
        return [];
    }
  }

  private async getProjects(): Promise<AssetNode[]> {
    const projects = await this.bqClient.listProjects();
    return projects.map(
      (p) =>
        new AssetNode(
          p.friendlyName || p.projectId,
          'project',
          p.projectId,
          '',
          '',
          vscode.TreeItemCollapsibleState.Collapsed,
        ),
    );
  }

  private async getDatasets(projectId: string): Promise<AssetNode[]> {
    const cached = this.datasetCache.get(projectId);
    let datasets: { datasetId: string; location: string }[];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      datasets = cached.data;
    } else {
      datasets = await this.bqClient.listDatasets(projectId);
      this.datasetCache.set(projectId, { data: datasets, timestamp: Date.now() });
    }

    const filtered = this.filterPattern
      ? datasets.filter((ds) => ds.datasetId.toLowerCase().includes(this.filterPattern))
      : datasets;
    return filtered.map(
      (ds) =>
        new AssetNode(
          ds.datasetId,
          'dataset',
          projectId,
          ds.datasetId,
          '',
          vscode.TreeItemCollapsibleState.Collapsed,
        ),
    );
  }

  private async getTables(projectId: string, datasetId: string): Promise<AssetNode[]> {
    const cacheKey = `${projectId}.${datasetId}`;
    const cached = this.tableCache.get(cacheKey);
    let tables: { tableId: string; type: string }[];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      tables = cached.data;
    } else {
      tables = await this.bqClient.listTables(projectId, datasetId);
      this.tableCache.set(cacheKey, { data: tables, timestamp: Date.now() });
    }

    const filtered = this.filterPattern
      ? tables.filter((t) => t.tableId.toLowerCase().includes(this.filterPattern))
      : tables;
    return filtered.map(
      (t) =>
        new AssetNode(
          t.tableId,
          t.type === 'VIEW' ? 'view' : 'table',
          projectId,
          datasetId,
          t.tableId,
          vscode.TreeItemCollapsibleState.None,
        ),
    );
  }
}
