import { describe, expect, it } from 'vitest';
import { buildResultsHtml, estimateInitialColumnWidth } from './query-results-webview-html';

describe('buildResultsHtml', () => {
  it('includes interactive controls for resizing and cell copy', () => {
    const html = buildResultsHtml(
      'nonce',
      'vscode-resource:',
      JSON.stringify({
        columns: ['id', 'name'],
        rows: [{ id: '1', name: 'Ada' }],
        page: 0,
        totalPages: 1,
        totalRows: '1',
        sortColumn: '',
        sortDir: 'ASC',
        bytesProcessed: '1 B',
        cacheHit: false,
        jobId: 'job-1',
        sql: '',
        canPage: false,
      }),
    );

    expect(html).toContain('class="column-resize-handle"');
    expect(html).toContain('id="cellMenuCopy"');
    expect(html).toContain('data-copy-value');
    expect(html).toContain('min-width: 100%; table-layout: fixed');
    expect(html).toContain('const persistedState = vscode.getState() || {};');
    expect(html).toContain("window.addEventListener('pointermove', onResizeMove);");
  });

  it('sizes columns from their header text length by default', () => {
    expect(estimateInitialColumnWidth('id')).toBeLessThan(estimateInitialColumnWidth('customer_name'));
    expect(estimateInitialColumnWidth('customer_name')).toBeGreaterThanOrEqual(estimateInitialColumnWidth('name'));
  });

  it('keeps filter input updates isolated from a full rerender', () => {
    const html = buildResultsHtml(
      'nonce',
      'vscode-resource:',
      JSON.stringify({
        columns: ['id'],
        rows: [{ id: '1' }],
        page: 0,
        totalPages: 1,
        totalRows: '1',
        sortColumn: '',
        sortDir: 'ASC',
        bytesProcessed: '1 B',
        cacheHit: false,
        jobId: 'job-1',
        sql: '',
        canPage: false,
      }),
    );

    expect(html).toContain('filterText = e.target.value;');
    expect(html).toContain('applyFilter();');
    expect(html).not.toContain('filterText = e.target.value;\n      render();');
  });

  it('restores focus when rebuilding the column search input', () => {
    const html = buildResultsHtml(
      'nonce',
      'vscode-resource:',
      JSON.stringify({
        columns: ['id'],
        rows: [{ id: '1' }],
        page: 0,
        totalPages: 1,
        totalRows: '1',
        sortColumn: '',
        sortDir: 'ASC',
        bytesProcessed: '1 B',
        cacheHit: false,
        jobId: 'job-1',
        sql: '',
        canPage: false,
      }),
    );

    expect(html).toContain('colSearchSelection = {');
    expect(html).toContain('buildColDropdown(true);');
    expect(html).toContain('searchInput.focus({ preventScroll: true });');
  });

  it('persists resized column widths and suppresses accidental sort clicks after resize', () => {
    const html = buildResultsHtml(
      'nonce',
      'vscode-resource:',
      JSON.stringify({
        columns: ['id'],
        rows: [{ id: '1' }],
        page: 0,
        totalPages: 1,
        totalRows: '1',
        sortColumn: '',
        sortDir: 'ASC',
        bytesProcessed: '1 B',
        cacheHit: false,
        jobId: 'job-1',
        sql: '',
        canPage: false,
      }),
    );

    expect(html).toContain('vscode.setState({');
    expect(html).toContain('columnWidths: Object.fromEntries(columnWidths.entries())');
    expect(html).toContain('suppressHeaderClick = true;');
    expect(html).toContain('const nextWidth = resizeState.startWidth + (e.clientX - resizeState.startX);');
    expect(html).toContain('commitResize(nextWidth);');
  });
});
