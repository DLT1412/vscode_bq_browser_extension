/** Builds the webview HTML for query results with paging, sorting, filtering, and datetime formatting */
export function buildResultsHtml(
  nonce: string,
  cspSource: string,
  initialData: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>Query Results</title>
  <style nonce="${nonce}">
    body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); padding: 0; margin: 0; display: flex; flex-direction: column; height: 100vh; }
    .toolbar { padding: 8px 12px; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); flex-wrap: wrap; }
    .toolbar button { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 4px 10px; cursor: pointer; border-radius: 2px; font-size: 12px; }
    .toolbar button:hover { background: var(--vscode-button-hoverBackground); }
    .toolbar button:disabled { opacity: 0.5; cursor: default; }
    .filter-input { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 3px 8px; font-size: 12px; border-radius: 2px; min-width: 150px; }
    .stats { font-size: 12px; color: var(--vscode-descriptionForeground); margin-left: auto; }
    .table-container { overflow: auto; flex: 1; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th { position: sticky; top: 0; background: var(--vscode-editorGroupHeader-tabsBackground); color: var(--vscode-foreground); font-weight: 600; text-align: left; padding: 6px 10px; border-bottom: 2px solid var(--vscode-panel-border); white-space: nowrap; cursor: pointer; user-select: none; }
    th:hover { background: var(--vscode-list-hoverBackground); }
    th .sort-icon { margin-left: 4px; opacity: 0.5; }
    th.sorted .sort-icon { opacity: 1; }
    td { padding: 4px 10px; border-bottom: 1px solid var(--vscode-panel-border); white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
    tr:hover td { background: var(--vscode-list-hoverBackground); }
    tr.hidden { display: none; }
    .null-value { color: var(--vscode-descriptionForeground); font-style: italic; }
    .pager { padding: 6px 12px; display: flex; align-items: center; gap: 8px; border-top: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); font-size: 12px; }
    .pager-info { color: var(--vscode-descriptionForeground); }
    .col-picker-wrap { position: relative; }
    .col-picker-dropdown { display: none; position: absolute; top: 100%; left: 0; z-index: 100; background: var(--vscode-dropdown-background, var(--vscode-sideBar-background)); border: 1px solid var(--vscode-panel-border); border-radius: 3px; max-height: 320px; overflow-y: auto; min-width: 180px; padding: 4px 0; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
    .col-picker-dropdown.open { display: block; }
    .col-picker-dropdown label { display: flex; align-items: center; gap: 6px; padding: 3px 10px; font-size: 12px; cursor: pointer; white-space: nowrap; }
    .col-picker-dropdown label:hover { background: var(--vscode-list-hoverBackground); }
    .col-picker-actions { display: flex; gap: 4px; padding: 4px 10px 6px; border-bottom: 1px solid var(--vscode-panel-border); margin-bottom: 2px; flex-wrap: wrap; }
    .col-picker-actions button { font-size: 11px; padding: 2px 6px; }
    .col-picker-search { width: 100%; margin-top: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); padding: 3px 6px; font-size: 11px; border-radius: 2px; box-sizing: border-box; }
    .sql-panel { border-bottom: 1px solid var(--vscode-panel-border); background: var(--vscode-sideBar-background); }
    .sql-header { display: flex; align-items: center; gap: 6px; padding: 4px 12px; cursor: pointer; font-size: 12px; color: var(--vscode-descriptionForeground); user-select: none; }
    .sql-header:hover { background: var(--vscode-list-hoverBackground); }
    .sql-header .chevron { transition: transform 0.15s; display: inline-block; }
    .sql-header .chevron.open { transform: rotate(90deg); }
    .sql-body { display: none; padding: 6px 12px; max-height: 200px; overflow: auto; }
    .sql-body.open { display: block; }
    .sql-body pre { margin: 0; font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; white-space: pre-wrap; word-break: break-all; color: var(--vscode-editor-foreground); background: var(--vscode-editor-background); padding: 8px; border-radius: 3px; border: 1px solid var(--vscode-panel-border); max-height: 180px; overflow: auto; }
    .sql-body .sql-actions { display: flex; gap: 4px; margin-top: 4px; align-items: center; }
    .sql-body .sql-actions button { font-size: 11px; padding: 2px 8px; background: var(--vscode-button-secondaryBackground, var(--vscode-button-background)); color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground)); border: none; border-radius: 2px; cursor: pointer; }
    .sql-body .sql-actions button:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="toolbar">
    <button id="btnCsv">Export CSV</button>
    <button id="btnJson">Export JSON</button>
    <button id="btnCopy">Copy All</button>
    <div class="col-picker-wrap">
      <button id="btnColumns">Columns</button>
      <div class="col-picker-dropdown" id="colDropdown"></div>
    </div>
    <input class="filter-input" id="filterInput" type="text" placeholder="Filter rows..." />
    <span class="stats" id="stats"></span>
  </div>
  <div class="sql-panel" id="sqlPanel" style="display:none">
    <div class="sql-header" id="sqlToggle">
      <span class="chevron" id="sqlChevron">▶</span> <span>SQL Query</span>
    </div>
    <div class="sql-body" id="sqlBody">
      <pre id="sqlCode"></pre>
      <div class="sql-actions">
        <button id="btnCopySql">Copy SQL</button>
        <button id="btnOpenEditor">Open in Editor</button>
      </div>
    </div>
  </div>
  <div class="table-container">
    <table>
      <thead id="thead"><tr></tr></thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>
  <div class="pager">
    <button id="btnPrev" disabled>&lt; Prev</button>
    <span class="pager-info" id="pageInfo">Page 1</span>
    <button id="btnNext" disabled>Next &gt;</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let state = ${initialData};
    let filterText = '';
    let visibleColumns = new Set(state.columns);

    function formatValue(val) {
      if (val === null || val === undefined) return null;
      if (typeof val === 'object' && val !== null && 'value' in val) return String(val.value);
      if (val instanceof Date) return val.toISOString();
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    }

    function escapeHtml(s) {
      return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function render() {
      const { columns, rows, page, totalPages, totalRows, sortColumn, sortDir, bytesProcessed, cacheHit, jobId } = state;
      const shownCols = columns.filter(c => visibleColumns.has(c));
      // Header
      document.getElementById('thead').innerHTML = '<tr>' + shownCols.map(c => {
        const sorted = c === sortColumn;
        const icon = sorted ? (sortDir === 'ASC' ? '▲' : '▼') : '⇅';
        return '<th class="' + (sorted ? 'sorted' : '') + '" data-col="' + escapeHtml(c) + '">' + escapeHtml(c) + '<span class="sort-icon">' + icon + '</span></th>';
      }).join('') + '</tr>';

      // Body
      const formatted = rows.map(row => shownCols.map(c => formatValue(row[c])));
      const filter = filterText.toLowerCase();
      document.getElementById('tbody').innerHTML = formatted.map((cells, i) => {
        const visible = !filter || cells.some(v => v !== null && v.toLowerCase().includes(filter));
        return '<tr class="' + (visible ? '' : 'hidden') + '">' + cells.map(v =>
          v === null ? '<td class="null-value">NULL</td>' : '<td title="' + escapeHtml(v) + '">' + escapeHtml(v) + '</td>'
        ).join('') + '</tr>';
      }).join('');

      // Stats
      document.getElementById('stats').textContent = totalRows + ' total rows | ' + bytesProcessed + (cacheHit ? ' (cached)' : '') + ' | Job: ' + jobId;

      // Pager
      document.getElementById('pageInfo').textContent = 'Page ' + (page + 1) + ' of ' + Math.max(1, totalPages);
      // Hide pager for preview data (no destination table to page through)
      const pager = document.querySelector('.pager');
      if (!state.canPage) {
        pager.style.display = 'none';
      } else {
        pager.style.display = '';
        document.getElementById('btnPrev').disabled = page <= 0;
        document.getElementById('btnNext').disabled = page >= totalPages - 1;
      }
    }

    // SQL panel (read-only display with copy and open in editor)
    if (state.sql) {
      document.getElementById('sqlPanel').style.display = '';
      document.getElementById('sqlCode').textContent = state.sql;
    }
    document.getElementById('sqlToggle').addEventListener('click', () => {
      const body = document.getElementById('sqlBody');
      const chevron = document.getElementById('sqlChevron');
      const isOpen = body.classList.toggle('open');
      chevron.classList.toggle('open', isOpen);
    });
    document.getElementById('btnCopySql').addEventListener('click', () => {
      vscode.postMessage({ command: 'copyToClipboard', text: state.sql });
    });
    document.getElementById('btnOpenEditor').addEventListener('click', () => {
      vscode.postMessage({ command: 'openInEditor', sql: state.sql });
    });

    // Sort click
    document.getElementById('thead').addEventListener('click', (e) => {
      const th = e.target.closest('th');
      if (!th) return;
      const col = th.dataset.col;
      const newDir = (col === state.sortColumn && state.sortDir === 'ASC') ? 'DESC' : 'ASC';
      vscode.postMessage({ command: 'sort', column: col, direction: newDir, visibleColumns: getShownCols() });
    });

    // Page buttons — send visible columns for selectedFields optimization
    document.getElementById('btnPrev').addEventListener('click', () => {
      if (state.page > 0) vscode.postMessage({ command: 'changePage', page: state.page - 1, visibleColumns: getShownCols() });
    });
    document.getElementById('btnNext').addEventListener('click', () => {
      if (state.page < state.totalPages - 1) vscode.postMessage({ command: 'changePage', page: state.page + 1, visibleColumns: getShownCols() });
    });

    // Filter
    document.getElementById('filterInput').addEventListener('input', (e) => {
      filterText = e.target.value;
      render();
    });

    // Shared helper for visible columns — used by paging, sort, export, copy
    function getShownCols() { return state.columns.filter(c => visibleColumns.has(c)); }

    document.getElementById('btnCsv').addEventListener('click', () => {
      const cols = getShownCols();
      const header = cols.join(',');
      const body = state.rows.map(r => cols.map(c => {
        const v = formatValue(r[c]);
        if (v === null) return '';
        return v.includes(',') || v.includes('"') || v.includes('\\n') || v.includes('\\r') ? '"' + v.replace(/"/g, '""') + '"' : v;
      }).join(',')).join('\\n');
      vscode.postMessage({ command: 'exportCsv', data: header + '\\n' + body });
    });

    document.getElementById('btnJson').addEventListener('click', () => {
      const cols = getShownCols();
      const filtered = state.rows.map(r => { const o = {}; cols.forEach(c => o[c] = r[c]); return o; });
      vscode.postMessage({ command: 'exportJson', data: JSON.stringify(filtered, null, 2) });
    });

    document.getElementById('btnCopy').addEventListener('click', () => {
      const cols = getShownCols();
      const header = cols.join('\\t');
      const body = state.rows.map(r => cols.map(c => { const v = formatValue(r[c]); return v === null ? '' : v; }).join('\\t')).join('\\n');
      vscode.postMessage({ command: 'copyToClipboard', text: header + '\\n' + body });
    });

    // Column picker with search
    let colSearchText = '';
    function buildColDropdown() {
      const dd = document.getElementById('colDropdown');
      const allCols = state.columns;
      const searchLower = colSearchText.toLowerCase();
      const filtered = searchLower ? allCols.filter(c => c.toLowerCase().includes(searchLower)) : allCols;

      dd.innerHTML = '<div class="col-picker-actions">'
        + '<button id="colAll">All</button><button id="colNone">None</button>'
        + '<input class="col-picker-search" id="colSearch" type="text" placeholder="Search columns..." value="' + escapeHtml(colSearchText) + '" />'
        + '</div>'
        + filtered.map(c =>
          '<label><input type="checkbox" data-col="' + escapeHtml(c) + '"' + (visibleColumns.has(c) ? ' checked' : '') + '> ' + escapeHtml(c) + '</label>'
        ).join('');

      // All/None apply to filtered results when searching, or all columns when not
      const targetCols = searchLower ? filtered : allCols;
      dd.querySelector('#colAll').addEventListener('click', () => { targetCols.forEach(c => visibleColumns.add(c)); buildColDropdown(); render(); });
      dd.querySelector('#colNone').addEventListener('click', () => { targetCols.forEach(c => visibleColumns.delete(c)); buildColDropdown(); render(); });

      const searchInput = dd.querySelector('#colSearch');
      searchInput.addEventListener('input', (e) => { colSearchText = e.target.value; buildColDropdown(); });
      searchInput.focus();

      dd.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
          if (cb.checked) visibleColumns.add(cb.dataset.col);
          else visibleColumns.delete(cb.dataset.col);
          render();
        });
      });
    }

    document.getElementById('btnColumns').addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = document.getElementById('colDropdown');
      const isOpen = dd.classList.contains('open');
      dd.classList.toggle('open', !isOpen);
      if (!isOpen) { colSearchText = ''; buildColDropdown(); }
    });

    document.addEventListener('click', (e) => {
      const wrap = document.querySelector('.col-picker-wrap');
      if (!wrap.contains(e.target)) {
        document.getElementById('colDropdown').classList.remove('open');
      }
    });

    // Receive data updates from extension
    window.addEventListener('message', (event) => {
      if (event.data.command === 'updateData') {
        const prevColumns = new Set(state.columns);
        state = event.data.state;
        // Preserve column visibility across paging/sorting — only reset if schema changed
        const schemaChanged = state.columns.length !== prevColumns.size || state.columns.some(c => !prevColumns.has(c));
        if (schemaChanged) {
          visibleColumns = new Set(state.columns);
        }
        render();
      }
    });

    // Initial render
    render();
  </script>
</body>
</html>`;
}
