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
    .table-container { overflow: auto; flex: 1; position: relative; }
    table { border-collapse: collapse; min-width: 100%; table-layout: fixed; font-size: 13px; }
    th { position: sticky; top: 0; background: var(--vscode-editorGroupHeader-tabsBackground); color: var(--vscode-foreground); font-weight: 600; text-align: left; border-bottom: 2px solid var(--vscode-panel-border); white-space: nowrap; user-select: none; padding: 0; }
    th:hover { background: var(--vscode-list-hoverBackground); }
    .th-inner { position: relative; display: flex; align-items: center; gap: 4px; padding: 6px 10px; min-width: 0; }
    .th-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .column-resize-handle { position: absolute; top: 0; right: -4px; width: 12px; height: 100%; cursor: col-resize; touch-action: none; z-index: 2; }
    th .sort-icon { margin-left: 4px; opacity: 0.5; flex: 0 0 auto; }
    th.sorted .sort-icon { opacity: 1; }
    td { padding: 4px 10px; border-bottom: 1px solid var(--vscode-panel-border); vertical-align: top; }
    .cell-content { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 1; overflow: hidden; white-space: normal; word-break: break-word; line-height: 1.4; min-width: 0; }
    .cell-null .cell-content { color: var(--vscode-descriptionForeground); font-style: italic; }
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
    .cell-context-menu { position: fixed; display: none; z-index: 250; min-width: 120px; background: var(--vscode-menu-background, var(--vscode-sideBar-background)); color: var(--vscode-menu-foreground, var(--vscode-foreground)); border: 1px solid var(--vscode-panel-border); border-radius: 3px; box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35); padding: 4px 0; }
    .cell-context-menu.open { display: block; }
    .cell-context-menu button { width: 100%; text-align: left; background: transparent; color: inherit; border: none; padding: 6px 12px; border-radius: 0; cursor: pointer; font-size: 12px; }
    .cell-context-menu button:hover { background: var(--vscode-list-hoverBackground); }
    body.column-resizing, body.column-resizing * { cursor: col-resize !important; user-select: none !important; }
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
  <div class="cell-context-menu" id="cellMenu" role="menu" aria-hidden="true">
    <button type="button" id="cellMenuCopy" role="menuitem">Copy</button>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const persistedState = vscode.getState() || {};
    let state = ${initialData};
    let filterText = '';
    let visibleColumns = new Set(state.columns);
    let columnWidths = new Map(Object.entries(persistedState.columnWidths || {}));
    let activeCellCopyText = '';
    let resizeState = null;
    let colSearchSelection = null;
    let suppressHeaderClick = false;

    const MIN_COLUMN_WIDTH = 80;
    const MAX_COLUMN_WIDTH = 400;
    const filterInput = document.getElementById('filterInput');
    const tableEl = document.querySelector('table');
    const theadEl = document.getElementById('thead');
    const tbodyEl = document.getElementById('tbody');
    const pagerEl = document.querySelector('.pager');
    const cellMenuEl = document.getElementById('cellMenu');
    const cellMenuCopyEl = document.getElementById('cellMenuCopy');

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

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function estimateInitialColumnWidth(columnName) {
      const textWidth = columnName.length * 7 + 50;
      return clamp(textWidth, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH);
    }

    function syncColumnWidths() {
      for (const col of state.columns) {
        if (!columnWidths.has(col)) columnWidths.set(col, estimateInitialColumnWidth(col));
      }
      for (const key of Array.from(columnWidths.keys())) {
        if (!state.columns.includes(key)) columnWidths.delete(key);
      }
      persistColumnWidths();
    }

    function getColumnWidth(col) {
      return columnWidths.get(col) || estimateInitialColumnWidth(col);
    }

    function persistColumnWidths() {
      vscode.setState({
        ...persistedState,
        columnWidths: Object.fromEntries(columnWidths.entries()),
      });
    }

    function setColumnWidth(col, width) {
      columnWidths.set(col, clamp(width, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH));
      persistColumnWidths();
      const totalWidth = state.columns
        .filter(c => visibleColumns.has(c))
        .reduce((sum, c) => sum + getColumnWidth(c), 0);
      tableEl.style.width = totalWidth + 'px';
    }

    function renderTable() {
      const { columns, rows, page, totalPages, totalRows, sortColumn, sortDir, bytesProcessed, cacheHit, jobId } = state;
      const shownCols = columns.filter((c) => visibleColumns.has(c));
      theadEl.innerHTML = '<tr>' + shownCols.map((c) => {
        const sorted = c === sortColumn;
        const icon = sorted ? (sortDir === 'ASC' ? '▲' : '▼') : '⇅';
        const width = getColumnWidth(c);
        return '<th class="' + (sorted ? 'sorted' : '') + '" data-col="' + escapeHtml(c) + '" style="width:' + width + 'px;min-width:' + width + 'px;max-width:' + width + 'px;">'
          + '<div class="th-inner">'
          + '<span class="th-label">' + escapeHtml(c) + '</span>'
          + '<span class="sort-icon">' + icon + '</span>'
          + '<span class="column-resize-handle" data-col="' + escapeHtml(c) + '" aria-hidden="true"></span>'
          + '</div>'
          + '</th>';
      }).join('') + '</tr>';

      tbodyEl.innerHTML = rows.map((row) => {
        const cells = shownCols.map((c) => formatValue(row[c]));
        const rowSearch = cells
          .map((v) => (v === null ? 'null' : v.toLowerCase()))
          .join(' ');
        return '<tr data-search="' + escapeHtml(rowSearch) + '">'
          + cells.map((v, index) => {
            const col = shownCols[index];
            const width = getColumnWidth(col);
            if (v === null) {
              return '<td class="cell-null" data-col="' + escapeHtml(col) + '" data-copy-value="NULL" style="width:' + width + 'px;min-width:' + width + 'px;max-width:' + width + 'px;"><div class="cell-content">NULL</div></td>';
            }
            return '<td data-col="' + escapeHtml(col) + '" data-copy-value="' + escapeHtml(v) + '" title="' + escapeHtml(v) + '" style="width:' + width + 'px;min-width:' + width + 'px;max-width:' + width + 'px;"><div class="cell-content">' + escapeHtml(v) + '</div></td>';
          }).join('')
          + '</tr>';
      }).join('');

      tableEl.style.width = shownCols.reduce((sum, c) => sum + getColumnWidth(c), 0) + 'px';
      document.getElementById('stats').textContent = totalRows + ' total rows | ' + bytesProcessed + (cacheHit ? ' (cached)' : '') + ' | Job: ' + jobId;
      document.getElementById('pageInfo').textContent = 'Page ' + (page + 1) + ' of ' + Math.max(1, totalPages);
      pagerEl.style.display = state.canPage ? '' : 'none';
      document.getElementById('btnPrev').disabled = page <= 0;
      document.getElementById('btnNext').disabled = page >= totalPages - 1;
      applyFilter();
    }

    function applyFilter() {
      const filter = filterText.toLowerCase();
      tbodyEl.querySelectorAll('tr').forEach((tr) => {
        const search = tr.dataset.search || '';
        tr.classList.toggle('hidden', !!filter && !search.includes(filter));
      });
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
    theadEl.addEventListener('click', (e) => {
      if (suppressHeaderClick) {
        suppressHeaderClick = false;
        return;
      }
      const th = e.target.closest('th');
      if (!th) return;
      if (e.target.closest('.column-resize-handle')) return;
      const col = th.dataset.col;
      const newDir = (col === state.sortColumn && state.sortDir === 'ASC') ? 'DESC' : 'ASC';
      vscode.postMessage({ command: 'sort', column: col, direction: newDir, visibleColumns: getShownCols() });
    });

    function commitResize(nextWidth) {
      if (!resizeState) return;
      const width = clamp(nextWidth, MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH);
      resizeState.width = width;
      document.querySelectorAll('[data-col]').forEach((el) => {
        if (el.getAttribute('data-col') !== resizeState.col) return;
        el.style.width = width + 'px';
        el.style.minWidth = width + 'px';
        el.style.maxWidth = width + 'px';
      });
      const totalWidth = state.columns
        .filter(c => visibleColumns.has(c))
        .reduce((sum, c) => sum + (c === resizeState.col ? width : getColumnWidth(c)), 0);
      tableEl.style.width = totalWidth + 'px';
    }

    function endResize(e) {
      if (!resizeState) return;
      const nextWidth = resizeState.startWidth + (e.clientX - resizeState.startX);
      commitResize(nextWidth);
      document.body.classList.remove('column-resizing');
      window.removeEventListener('pointermove', onResizeMove);
      window.removeEventListener('pointerup', endResize);
      window.removeEventListener('pointercancel', endResize);
      suppressHeaderClick = true;
      setColumnWidth(resizeState.col, resizeState.width);
      resizeState = null;
    }

    function onResizeMove(e) {
      if (!resizeState) return;
      const nextWidth = resizeState.startWidth + (e.clientX - resizeState.startX);
      commitResize(nextWidth);
    }

    theadEl.addEventListener('pointerdown', (e) => {
      const handle = e.target.closest('.column-resize-handle');
      if (!handle) return;
      e.preventDefault();
      e.stopPropagation();
      const col = handle.dataset.col;
      if (!col) return;
      resizeState = {
        col,
        startX: e.clientX,
        startWidth: getColumnWidth(col),
        width: getColumnWidth(col),
      };
      document.body.classList.add('column-resizing');
      if (handle.setPointerCapture) {
        handle.setPointerCapture(e.pointerId);
      }
      window.addEventListener('pointermove', onResizeMove);
      window.addEventListener('pointerup', endResize);
      window.addEventListener('pointercancel', endResize);
    });

    // Page buttons — send visible columns for selectedFields optimization
    document.getElementById('btnPrev').addEventListener('click', () => {
      if (state.page > 0) vscode.postMessage({ command: 'changePage', page: state.page - 1, visibleColumns: getShownCols() });
    });
    document.getElementById('btnNext').addEventListener('click', () => {
      if (state.page < state.totalPages - 1) vscode.postMessage({ command: 'changePage', page: state.page + 1, visibleColumns: getShownCols() });
    });

    // Filter
    filterInput.addEventListener('input', (e) => {
      const selectionStart = filterInput.selectionStart;
      const selectionEnd = filterInput.selectionEnd;
      filterText = e.target.value;
      applyFilter();
      if (document.activeElement !== filterInput) {
        filterInput.focus({ preventScroll: true });
      }
      if (selectionStart !== null && selectionEnd !== null) {
        filterInput.setSelectionRange(selectionStart, selectionEnd);
      }
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
    function buildColDropdown(shouldFocusSearch = false) {
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
      dd.querySelector('#colAll').addEventListener('click', () => { targetCols.forEach(c => visibleColumns.add(c)); buildColDropdown(); renderTable(); });
      dd.querySelector('#colNone').addEventListener('click', () => { targetCols.forEach(c => visibleColumns.delete(c)); buildColDropdown(); renderTable(); });

      const searchInput = dd.querySelector('#colSearch');
      searchInput.addEventListener('input', (e) => {
        colSearchText = e.target.value;
        colSearchSelection = {
          start: e.target.selectionStart,
          end: e.target.selectionEnd,
        };
        buildColDropdown(true);
      });
      if (shouldFocusSearch) {
        searchInput.focus({ preventScroll: true });
        if (colSearchSelection && colSearchSelection.start !== null && colSearchSelection.end !== null) {
          searchInput.setSelectionRange(colSearchSelection.start, colSearchSelection.end);
        }
      }

      dd.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', () => {
          if (cb.checked) visibleColumns.add(cb.dataset.col);
          else visibleColumns.delete(cb.dataset.col);
          renderTable();
        });
      });
    }

    document.getElementById('btnColumns').addEventListener('click', (e) => {
      e.stopPropagation();
      const dd = document.getElementById('colDropdown');
      const isOpen = dd.classList.contains('open');
      dd.classList.toggle('open', !isOpen);
      if (!isOpen) { colSearchText = ''; buildColDropdown(true); }
    });

    document.addEventListener('click', (e) => {
      const wrap = document.querySelector('.col-picker-wrap');
      if (!wrap.contains(e.target)) {
        document.getElementById('colDropdown').classList.remove('open');
      }
    });

    function hideCellMenu() {
      cellMenuEl.classList.remove('open');
      cellMenuEl.setAttribute('aria-hidden', 'true');
      activeCellCopyText = '';
    }

    function showCellMenu(x, y, text) {
      activeCellCopyText = text;
      cellMenuEl.style.left = Math.max(0, Math.min(x, window.innerWidth - 140)) + 'px';
      cellMenuEl.style.top = Math.max(0, Math.min(y, window.innerHeight - 50)) + 'px';
      cellMenuEl.classList.add('open');
      cellMenuEl.setAttribute('aria-hidden', 'false');
    }

    tbodyEl.addEventListener('contextmenu', (e) => {
      const cell = e.target.closest('td');
      if (!cell) return;
      e.preventDefault();
      e.stopPropagation();
      showCellMenu(e.clientX, e.clientY, cell.dataset.copyValue || cell.textContent || '');
    });

    tbodyEl.addEventListener('click', () => hideCellMenu());
    cellMenuCopyEl.addEventListener('click', () => {
      if (!activeCellCopyText) return;
      vscode.postMessage({ command: 'copyToClipboard', text: activeCellCopyText });
      hideCellMenu();
    });

    document.addEventListener('click', (e) => {
      if (!cellMenuEl.contains(e.target)) hideCellMenu();
    });
    document.addEventListener('scroll', hideCellMenu, true);
    window.addEventListener('resize', hideCellMenu);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideCellMenu();
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
          syncColumnWidths();
        }
        renderTable();
      }
    });

    // Initial render
    syncColumnWidths();
    renderTable();
  </script>
</body>
</html>`;
}

export function estimateInitialColumnWidth(columnName: string): number {
  const textWidth = columnName.length * 7 + 50;
  return Math.min(400, Math.max(80, textWidth));
}
