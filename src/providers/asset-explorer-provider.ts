import * as vscode from 'vscode';
import { BigQueryClient } from '../services/bigquery-client';
import { AssetCacheService } from '../services/asset-cache-service';

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
  /** Parsed filter: "dataset.table" → both set; "name" → both equal same value */
  private datasetFilter = '';
  private tableFilter = '';

  constructor(
    private bqClient: BigQueryClient,
    private cacheService: AssetCacheService,
  ) {}

  /** Refresh tree and clear all caches */
  refresh(): void {
    this.cacheService.clear();
    this._onDidChangeTreeData.fire(undefined);
  }

  /** Set a filter pattern and re-render tree (uses cache, no API calls).
   *  Supports "dataset.table" dot notation: first part filters datasets, second filters tables.
   *  Without dot, the value filters both datasets and tables. */
  setFilter(pattern: string): void {
    this.filterPattern = pattern.toLowerCase();
    const parts = this.filterPattern.split('.');
    if (parts.length >= 2) {
      this.datasetFilter = parts[0];
      this.tableFilter = parts.slice(1).join('.');
    } else {
      this.datasetFilter = this.filterPattern;
      this.tableFilter = this.filterPattern;
    }
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
    if (!element) return this.getProjects();
    switch (element.nodeType) {
      case 'project': return this.getDatasets(element.projectId);
      case 'dataset': return this.getTables(element.projectId, element.datasetId);
      default: return [];
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
    let datasets = this.cacheService.getDatasets(projectId);
    if (!datasets) {
      datasets = await this.bqClient.listDatasets(projectId);
      this.cacheService.setDatasets(projectId, datasets);
      // Background-prefetch tables for all datasets
      this.prefetchTables(projectId, datasets);
    }

    if (!this.filterPattern) {
      return datasets.map(
        (ds) =>
          new AssetNode(ds.datasetId, 'dataset', projectId, ds.datasetId, '',
            vscode.TreeItemCollapsibleState.Collapsed),
      );
    }

    // When filtering: ensure ALL datasets have cached tables so filter results are complete.
    // Without this, datasets whose tables aren't prefetched yet would be invisible to table-name search.
    const uncached = datasets.filter((ds) => !this.cacheService.getTables(projectId, ds.datasetId));
    if (uncached.length > 0) {
      await Promise.allSettled(
        uncached.map(async (ds) => {
          const tables = await this.bqClient.listTables(projectId, ds.datasetId);
          this.cacheService.setTables(projectId, ds.datasetId, tables);
        }),
      );
    }
    const allTables = this.cacheService.getAllCachedTables(projectId);
    const isDotFilter = this.filterPattern.includes('.');

    const filtered = datasets.filter((ds) => {
      const dsName = ds.datasetId.toLowerCase();
      const tables = allTables.get(ds.datasetId);
      if (isDotFilter) {
        // "dataset.table" — dataset must match first part, and must have tables matching second part
        if (!dsName.includes(this.datasetFilter)) return false;
        return this.tableFilter
          ? (tables?.some((t) => t.tableId.toLowerCase().includes(this.tableFilter)) ?? false)
          : true;
      }
      // Single term — match dataset name OR any table name
      if (dsName.includes(this.datasetFilter)) return true;
      return tables?.some((t) => t.tableId.toLowerCase().includes(this.tableFilter)) ?? false;
    });

    return filtered.map((ds) => {
      const dsName = ds.datasetId.toLowerCase();
      const tables = allTables.get(ds.datasetId);
      const tFilter = isDotFilter ? this.tableFilter : this.filterPattern;
      const hasMatchingTables = tFilter
        ? (tables?.some((t) => t.tableId.toLowerCase().includes(tFilter)) ?? false)
        : false;
      const nameMatches = dsName.includes(this.datasetFilter);
      // Auto-expand when dataset matched via table name, or dot filter with table part
      const state = (isDotFilter && this.tableFilter) || (!nameMatches && hasMatchingTables)
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed;
      return new AssetNode(ds.datasetId, 'dataset', projectId, ds.datasetId, '', state);
    });
  }

  private async getTables(projectId: string, datasetId: string): Promise<AssetNode[]> {
    let tables = this.cacheService.getTables(projectId, datasetId);
    if (!tables) {
      tables = await this.bqClient.listTables(projectId, datasetId);
      this.cacheService.setTables(projectId, datasetId, tables);
    }

    // Determine table filtering based on filter type
    let filtered = tables;
    if (this.filterPattern) {
      const isDotFilter = this.filterPattern.includes('.');
      if (isDotFilter) {
        // Dot notation: always filter tables by second part (if present)
        filtered = this.tableFilter
          ? tables.filter((t) => t.tableId.toLowerCase().includes(this.tableFilter))
          : tables;
      } else {
        // Single term: if dataset name matches the filter, show ALL its tables.
        // If dataset was included only because of a table match, filter tables.
        const datasetNameMatches = datasetId.toLowerCase().includes(this.filterPattern);
        if (!datasetNameMatches) {
          filtered = tables.filter((t) => t.tableId.toLowerCase().includes(this.filterPattern));
        }
      }
    }
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

  /** Prefetch tables for all datasets in batches of 5 (fire-and-forget) */
  private prefetchTables(
    projectId: string,
    datasets: { datasetId: string; location: string }[],
  ): void {
    const uncached = datasets.filter(
      (ds) => !this.cacheService.getTables(projectId, ds.datasetId),
    );
    if (uncached.length === 0) return;

    const BATCH_SIZE = 5;
    (async () => {
      for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
        const batch = uncached.slice(i, i + BATCH_SIZE);
        await Promise.allSettled(
          batch.map((ds) =>
            this.bqClient.listTables(projectId, ds.datasetId).then(
              (tables) => this.cacheService.setTables(projectId, ds.datasetId, tables),
            ),
          ),
        );
      }
      // Refresh tree if filter is active so newly cached tables appear in results
      if (this.filterPattern) {
        this._onDidChangeTreeData.fire(undefined);
      }
    })();
  }
}
