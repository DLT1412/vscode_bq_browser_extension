import * as vscode from 'vscode';
import { BigQueryClient, TableMetadata, formatBytes } from '../services/bigquery-client';

/** Manages the webview panel for displaying table metadata/schema */
export class TableMetadataProvider {
  private panel: vscode.WebviewPanel | null = null;

  constructor(
    private extensionUri: vscode.Uri,
    private bqClient: BigQueryClient,
  ) {}

  /** Show table metadata in a webview panel */
  async showMetadata(projectId: string, datasetId: string, tableId: string): Promise<void> {
    const metadata = await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Loading metadata for ${tableId}...` },
      () => this.bqClient.getTableMetadata(projectId, datasetId, tableId),
    );

    if (!metadata) return;

    if (!this.panel) {
      this.panel = vscode.window.createWebviewPanel(
        'bigqueryMetadata',
        `Schema: ${tableId}`,
        vscode.ViewColumn.Two,
        { enableScripts: true },
      );
      this.panel.onDidDispose(() => { this.panel = null; });
    }

    this.panel.title = `Schema: ${tableId}`;
    this.panel.reveal(vscode.ViewColumn.Two);
    this.panel.webview.onDidReceiveMessage((msg) => {
      if (msg.command === 'copyToClipboard') {
        vscode.env.clipboard.writeText(msg.text);
      }
    });
    this.panel.webview.html = this.getHtml(metadata, this.panel.webview.cspSource);
  }

  private getHtml(meta: TableMetadata, cspSource: string): string {
    const nonce = getNonce();
    const schemaRows = renderSchemaFields(meta.schema, 0).join('');

    const labelRows = Object.entries(meta.labels)
      .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
      .join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>Table Schema</title>
  <style nonce="${nonce}">
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 16px; margin: 0; }
    h2 { font-size: 16px; margin: 16px 0 8px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
    h2:first-child { margin-top: 0; }
    .ref { font-size: 13px; color: var(--vscode-descriptionForeground); margin-bottom: 16px; }
    .info-grid { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; font-size: 13px; }
    .info-grid dt { color: var(--vscode-descriptionForeground); }
    .info-grid dd { margin: 0; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 8px; }
    th { text-align: left; padding: 6px 10px; background: var(--vscode-editorGroupHeader-tabsBackground); border-bottom: 2px solid var(--vscode-panel-border); }
    td { padding: 4px 10px; border-bottom: 1px solid var(--vscode-panel-border); }
    code { background: var(--vscode-textCodeBlock-background); padding: 1px 4px; border-radius: 2px; font-size: 12px; }
    button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 10px; cursor: pointer; border-radius: 2px; font-size: 12px; margin-right: 4px; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .tabs { display: flex; gap: 0; margin-bottom: 12px; border-bottom: 1px solid var(--vscode-panel-border); }
    .tab { padding: 8px 16px; cursor: pointer; border-bottom: 2px solid transparent; font-size: 13px; }
    .tab.active { border-bottom-color: var(--vscode-focusBorder); font-weight: 600; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    .field-toggle { cursor: pointer; user-select: none; display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; margin-right: 4px; font-size: 9px; color: var(--vscode-descriptionForeground); border-radius: 3px; vertical-align: middle; }
    .field-toggle:hover { color: var(--vscode-foreground); background: var(--vscode-list-hoverBackground); }
    .field-spacer { display: inline-block; width: 20px; }
    tr.nested-child td:first-child { border-left: 2px solid var(--vscode-panel-border); }
    tr.nested-depth-1 td:first-child { padding-left: 28px; }
    tr.nested-depth-2 td:first-child { padding-left: 48px; }
    tr.nested-depth-3 td:first-child { padding-left: 68px; }
    tr.nested-depth-4 td:first-child { padding-left: 88px; }
    tr.nested-child { opacity: 0.9; }
    tr.nested-child td { font-size: 12px; }
    tr.nested-collapsed { display: none; }
    tr.record-parent td { background: var(--vscode-editorGroupHeader-tabsBackground); }
  </style>
</head>
<body>
  <div class="ref">${escapeHtml(`${meta.projectId}.${meta.datasetId}.${meta.tableId}`)}</div>
  <div class="tabs">
    <div class="tab active" data-tab="overview">Overview</div>
    <div class="tab" data-tab="schema">Schema (${meta.schema.length})</div>
    ${meta.viewQuery ? '<div class="tab" data-tab="viewsql">View SQL</div>' : ''}
    ${labelRows ? '<div class="tab" data-tab="labels">Labels</div>' : ''}
  </div>

  <div id="overview" class="tab-content active">
    <dl class="info-grid">
      <dt>Type</dt><dd>${escapeHtml(meta.type)}</dd>
      <dt>Rows</dt><dd>${Number(meta.numRows).toLocaleString()}</dd>
      <dt>Size</dt><dd>${formatBytes(Number(meta.numBytes))}</dd>
      <dt>Created</dt><dd>${meta.createdAt ? new Date(meta.createdAt).toLocaleString() : '-'}</dd>
      <dt>Modified</dt><dd>${meta.modifiedAt ? new Date(meta.modifiedAt).toLocaleString() : '-'}</dd>
      ${meta.description ? `<dt>Description</dt><dd>${escapeHtml(meta.description)}</dd>` : ''}
      ${meta.partitioning ? `<dt>Partitioned</dt><dd>${escapeHtml(meta.partitioning.type)} on ${escapeHtml(meta.partitioning.field || 'ingestion time')}</dd>` : ''}
      ${meta.clustering ? `<dt>Clustered</dt><dd>${escapeHtml(meta.clustering.join(', '))}</dd>` : ''}
    </dl>
  </div>

  <div id="schema" class="tab-content">
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
      <button id="copyColumns">Copy Column Names</button>
      <input id="schemaSearch" type="text" placeholder="Search columns..." style="background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);padding:3px 8px;font-size:12px;border-radius:2px;flex:1;max-width:250px;" />
    </div>
    <table>
      <thead><tr><th>Column</th><th>Type</th><th>Mode</th><th>Description</th></tr></thead>
      <tbody id="schemaBody">${schemaRows}</tbody>
    </table>
  </div>

  ${meta.viewQuery ? `<div id="viewsql" class="tab-content" data-sql="${escapeHtml(meta.viewQuery)}">
    <button id="copySql">Copy SQL</button>
    <pre style="background:var(--vscode-textCodeBlock-background);padding:12px;border-radius:4px;overflow-x:auto;font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;">${escapeHtml(meta.viewQuery)}</pre>
  </div>` : ''}

  ${labelRows ? `<div id="labels" class="tab-content">
    <table>
      <thead><tr><th>Key</th><th>Value</th></tr></thead>
      <tbody>${labelRows}</tbody>
    </table>
  </div>` : ''}

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const columns = ${JSON.stringify(flattenColumnNames(meta.schema)).replace(/</g, '\\u003c')};

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.getAttribute('data-tab');
        if (!target) return;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(target).classList.add('active');
      });
    });

    document.getElementById('copyColumns').addEventListener('click', () => {
      vscode.postMessage({ command: 'copyToClipboard', text: columns.join(', ') });
    });

    // Toggle nested RECORD/STRUCT children
    document.getElementById('schemaBody').addEventListener('click', (e) => {
      const toggle = e.target.closest('.field-toggle');
      if (!toggle) return;
      const tr = toggle.closest('tr');
      const parentId = tr.dataset.fieldId;
      const isOpen = toggle.textContent.trim() === '▼';
      toggle.textContent = isOpen ? '▶' : '▼';
      document.querySelectorAll('#schemaBody tr[data-parent-id="' + parentId + '"]').forEach(child => {
        if (isOpen) {
          child.classList.add('nested-collapsed');
          // Also collapse any open children recursively
          const childId = child.dataset.fieldId;
          if (childId) {
            const childToggle = child.querySelector('.field-toggle');
            if (childToggle && childToggle.textContent.trim() === '▼') {
              childToggle.textContent = '▶';
              document.querySelectorAll('#schemaBody tr[data-parent-id="' + childId + '"]').forEach(gc => gc.classList.add('nested-collapsed'));
            }
          }
        } else {
          child.classList.remove('nested-collapsed');
        }
      });
    });

    document.getElementById('schemaSearch').addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      document.querySelectorAll('#schemaBody tr').forEach(tr => {
        const text = tr.textContent.toLowerCase();
        tr.style.display = !q || text.includes(q) ? '' : 'none';
      });
    });

    const copySqlBtn = document.getElementById('copySql');
    if (copySqlBtn) {
      copySqlBtn.addEventListener('click', () => {
        const sqlEl = document.getElementById('viewsql');
        if (sqlEl) vscode.postMessage({ command: 'copyToClipboard', text: sqlEl.getAttribute('data-sql') || '' });
      });
    }
  </script>
</body>
</html>`;
  }

  dispose(): void {
    this.panel?.dispose();
  }
}

/** Render schema fields recursively with indentation for nested RECORD/STRUCT */
function renderSchemaFields(
  fields: import('@google-cloud/bigquery').TableField[],
  depth: number,
  parentId?: string,
): string[] {
  const rows: string[] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const fieldId = parentId ? `${parentId}.${f.name}` : (f.name || `field_${i}`);
    const hasChildren = f.type === 'RECORD' || f.type === 'STRUCT';
    const toggle = hasChildren ? '<span class="field-toggle">▼</span>' : '<span class="field-spacer"></span>';
    const classes: string[] = [];
    if (parentId) classes.push('nested-child', `nested-depth-${Math.min(depth, 4)}`);
    if (hasChildren) classes.push('record-parent');
    const cssClass = classes.length ? ` class="${classes.join(' ')}"` : '';
    const childCount = hasChildren && f.fields ? ` <span style="color:var(--vscode-descriptionForeground);font-size:11px">(${f.fields.length})</span>` : '';

    rows.push(`<tr${cssClass} data-field-id="${escapeHtml(fieldId)}"${parentId ? ` data-parent-id="${escapeHtml(parentId)}"` : ''}>
      <td>${toggle}<strong>${escapeHtml(f.name || '')}</strong>${childCount}</td>
      <td><code>${escapeHtml(f.type || '')}</code></td>
      <td>${escapeHtml(f.mode || 'NULLABLE')}</td>
      <td>${escapeHtml(f.description || '-')}</td>
    </tr>`);

    if (hasChildren && f.fields && f.fields.length > 0) {
      rows.push(...renderSchemaFields(f.fields, depth + 1, fieldId));
    }
  }
  return rows;
}

/** Flatten column names including nested paths (e.g. "address.city") */
function flattenColumnNames(
  fields: import('@google-cloud/bigquery').TableField[],
  prefix?: string,
): string[] {
  const names: string[] = [];
  for (const f of fields) {
    const fullName = prefix ? `${prefix}.${f.name}` : (f.name || '');
    names.push(fullName);
    if ((f.type === 'RECORD' || f.type === 'STRUCT') && f.fields) {
      names.push(...flattenColumnNames(f.fields, fullName));
    }
  }
  return names;
}

function getNonce(): string {
  let text = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
