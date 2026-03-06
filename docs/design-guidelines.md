# Design Guidelines

## UI Design Principles

### 1. Consistency with VS Code
- Use native VS Code UI components (TreeView, StatusBar, Webview)
- Follow VS Code theme variables for colors, fonts, spacing
- Adopt VS Code icons (codicons) for consistency

**Implementation:**
```typescript
// ✓ Use VS Code theme variables in webview CSS
:root {
  --vscode-editor-background: #ffffff;
  --vscode-editor-foreground: #000000;
  --vscode-button-background: #0e639c;
  --vscode-button-foreground: #ffffff;
}

// ✓ Use codicons for all UI icons
<i class="codicon codicon-play"></i>        <!-- Play icon -->
<i class="codicon codicon-eye"></i>         <!-- Eye icon -->
<i class="codicon codicon-sync"></i>        <!-- Refresh icon -->

// ✗ Avoid custom images or external icon sets
// <img src="icons/custom.svg">
```

### 2. Minimize Cognitive Load
- Show only essential information per view
- Use progressive disclosure (expand for details)
- Provide inline help and tooltips

**Implementation:**
```
Asset Explorer (TreeView):
  Projects
    → datasets (only show count, expand to see details)
      → tables (only show type icon, expand for schema)

Results Webview:
  Paginated table (show 50 rows per page, not all)
  Sort/Filter UI above table (easy to discover)
  Export buttons in toolbar (obvious location)

Status Bar:
  Project: [my-project] (clickable)
  Cost: $0.25 (from last query)
  Estimate: 25 MB (real-time, while typing)
```

### 3. Performance-First
- Render only visible content (virtual scrolling for large lists)
- Lazy-load heavy components (webviews only created on demand)
- Cache aggressively (24h for datasets, 5m for schemas)

**Implementation:**
```typescript
// ✓ Only fetch projects on first expand
getChildren(element?: AssetItem): Promise<AssetItem[]> {
  if (!element) {
    return bigQueryClient.listProjects(); // Expensive, but cached
  }
  // Subsequent calls return cached data
}

// ✓ Create webview only when user requests results
if (!webviewPanel) {
  webviewPanel = vscode.window.createWebviewPanel(...);
}
```

### 4. Discoverability
- Use context menus for hidden actions
- Show status/progress in status bar
- Provide command palette entries for all actions

**Example:**
```json
{
  "command": "bigqueryBrowser.previewTable",
  "title": "Preview Data",
  "category": "BigQuery",
  "icon": "$(eye)"
}
```

Users can find this via:
- Context menu on table in explorer
- Command palette: Cmd+Shift+P → "BigQuery: Preview Data"
- Icon button in tree view

## Visual Design

### Color Scheme

**Light Theme:**
- Background: #ffffff (VS Code default)
- Foreground: #000000
- Accent: #0e639c (VS Code blue)
- Error: #e81123 (VS Code red)
- Success: #107c10 (VS Code green)
- Warning: #ff8c00 (VS Code orange)

**Dark Theme:**
- Background: #1e1e1e (VS Code default)
- Foreground: #cccccc
- Accent: #007acc (VS Code blue)
- Error: #f48771
- Success: #89d185
- Warning: #dcdcaa

**Implementation:**
```css
/* Webview: Use CSS variables, let VS Code inject values */
:root {
  --vscode-editor-background: var(--vscode-editor-background);
  --vscode-editor-foreground: var(--vscode-editor-foreground);
  --vscode-button-background: var(--vscode-button-background);
}

/* Table styling */
table {
  background-color: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
  border-color: var(--vscode-editorGroup-border);
}

thead {
  background-color: var(--vscode-editorGroupHeader-tabsBackground);
}

/* Buttons */
button {
  background-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

button:hover {
  background-color: var(--vscode-button-hoverBackground);
}
```

### Typography

**Font Stack:**
```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  font-size: 13px;  /* VS Code editor default */
  line-height: 1.5;
}

code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
}

h1, h2, h3 {
  font-weight: 600;
  margin-top: 16px;
  margin-bottom: 8px;
}
```

**Size Hierarchy:**
- **Title (Webview):** 16px, bold
- **Heading (Webview):** 14px, bold
- **Body text:** 13px, regular
- **Small text (metadata):** 12px, regular
- **Code/monospace:** 12px, monospace

### Spacing & Layout

**Consistent Margins:**
```css
.container {
  padding: 16px;  /* Standard padding */
}

.section {
  margin-bottom: 16px;  /* Space between sections */
}

.item {
  padding: 8px 12px;  /* Item padding */
  margin-bottom: 4px;  /* Item spacing */
}

button {
  margin: 0 4px;  /* Button spacing */
  padding: 6px 12px;  /* Button padding */
}
```

**Grid Layout (Results Table):**
- **Column padding:** 12px left/right
- **Row height:** 28px (comfortable for clicking)
- **Header height:** 32px (taller for sorting UI)
- **Min column width:** 80px (avoid tiny columns)
- **Max column width:** 300px (truncate with ellipsis)

## TreeView Design

### Icon Conventions

**Asset Explorer:**
- 📁 Project — `$(folder)` codicon
- 📊 Dataset — `$(symbol-structure)` codicon
- 📄 Table — `$(table)` codicon
- 👁️ View — `$(eye)` codicon (same as table, differentiate via label)

**Query History:**
- ✓ Success — `$(pass)` codicon (green)
- ✗ Error — `$(error)` codicon (red)
- ⏳ Running — `$(loading~spin)` codicon (animated)

**Implementation:**
```typescript
getTreeItem(element: AssetItem): TreeItem {
  const item = new TreeItem(element.label);

  if (element.type === 'project') {
    item.iconPath = new ThemeIcon('folder');
    item.collapsibleState = TreeItemCollapsibleState.Collapsed;
  } else if (element.type === 'dataset') {
    item.iconPath = new ThemeIcon('symbol-structure');
    item.collapsibleState = TreeItemCollapsibleState.Collapsed;
  } else if (element.type === 'table') {
    item.iconPath = new ThemeIcon('table');
    item.collapsibleState = TreeItemCollapsibleState.None;
  }

  return item;
}
```

### Context Menu Placement

**Asset Explorer (table/view context menu):**
```
1. Copy Table Reference
2. ─────────────────────
3. Preview Data
4. View Schema
```

**Query History (entry context menu):**
```
1. Run Again (inline icon)
2. ─────────────────────
3. View SQL
4. View Results
```

### Filtering UI

**Position:** Top toolbar of TreeView (next to Refresh button)
- Icon: `$(filter)` — Filter Explorer
- When active: Input field appears below tree for typing filter text
- Placeholder: "Filter datasets, tables..."
- Client-side matching: Projects/datasets/tables with names containing text
- Clear button: `$(clear-all)` — Clear Filter

## Status Bar Design

### Layout (Right-aligned in status bar)

```
[Project: my-project] | [Cost: $0.25] | [Estimate: 25 MB]
     Item 1            Item 2          Item 3
```

**Item 1: Project Indicator**
- Icon: `$(cloud)` (codicon)
- Text: "my-project"
- Clickable: Yes (triggers selectProject command)
- Tooltip: "Click to select a different project"

**Item 2: Cost Indicator**
- Icon: `$(dollar)` (codicon)
- Text: "$0.25" (from last query)
- Visible: Only after query executes
- Tooltip: "Cost of last query, estimated: $0.25 for 25 MB"

**Item 3: Auto-Estimate Indicator**
- Icon: `$(lightbulb)` (codicon, animated while calculating)
- Text: "25 MB" (estimated from auto dry-run)
- Visible: Only in .bqsql editor with autoDryRun enabled
- Tooltip: "Estimated cost: 25 MB (from auto dry-run)"
- Color: Green if <$1, Yellow if $1-$10, Red if >$10

**Implementation:**
```typescript
const projectItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right,
  100 // Priority (higher = further right)
);
projectItem.text = '$(cloud) my-project';
projectItem.command = 'bigqueryBrowser.selectProject';
projectItem.tooltip = 'Click to select a different project';
projectItem.show();

const costItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right,
  99
);
costItem.text = '$(dollar) $0.25';
costItem.tooltip = 'Cost of last query';
costItem.show();

const estimateItem = vscode.window.createStatusBarItem(
  vscode.StatusBarAlignment.Right,
  98
);
estimateItem.text = '$(lightbulb) 25 MB';
estimateItem.color = new vscode.ThemeColor('charts.green'); // Green
estimateItem.tooltip = 'Estimated cost (from auto dry-run)';
estimateItem.show();
```

## Webview Design

### Results Webview Layout

```
┌─────────────────────────────────────────────────────────┐
│ Results — 1,234 rows | Fetched in 5.2s                  │
├─────────────────────────────────────────────────────────┤
│ [Sort ▼] [Filter: _] [CSV] [JSON] [Copy] [TSV]          │
├─────────────────────────────────────────────────────────┤
│ id │ name          │ created_at      │ price            │
├────┼───────────────┼─────────────────┼──────────────────┤
│  1 │ Product A     │ 2024-01-01      │ 9.99             │
│  2 │ Product B     │ 2024-01-02      │ 19.99            │
│ ... (47 more rows)                                       │
├─────────────────────────────────────────────────────────┤
│ [First] [< Prev] Page 3 of 25 [Next >] [Last]           │
└─────────────────────────────────────────────────────────┘
```

**Header:**
- Show query result metadata: total rows, fetch time
- Title format: "Results — [total rows] rows | Fetched in [time]s"
- Close button: Default webview close (top-right)

**Toolbar:**
- Sort dropdown: Select column + direction (ASC/DESC)
- Filter input: Real-time filter as you type
- Export buttons: CSV, JSON, TSV, Copy (side-by-side)
- Spacing: 8px between button groups

**Table:**
- Header: Bold, background color (darker than body)
- Sortable columns: Show `▲` or `▼` indicator on sorted column
- Rows: Alternating background (white / light gray) for readability
- Hover: Highlight row on hover (light background)
- Truncation: Ellipsis (`...`) for long values >100 chars
- Alignment: Right-align numbers, left-align text/strings

**Pagination:**
- Controls centered below table
- Format: "[First] [< Prev] Page X of Y [Next >] [Last]"
- Disabled state: Gray out buttons (First/Prev when on page 1, Next/Last when on last page)
- Current page: Editable text (user can jump to page)

### Table Metadata Webview Layout

```
┌─────────────────────────────────────────────────────────┐
│ my_project.my_dataset.my_table                          │
│ [Overview] [Schema] [Labels]                            │
├─────────────────────────────────────────────────────────┤
│ Overview Tab:                                            │
│ • Type: Table                                            │
│ • Row Count: 1,234,567                                   │
│ • Size: 4.56 GB                                          │
│ • Partitioning: timestamp (DAY)                          │
│ • Clustering: category, region                          │
│                                                          │
│ Schema Tab:                                              │
│ | Column       | Type      | Mode      |                │
│ |───────────────┼──────────┼──────────|                │
│ | id            | INTEGER   | NULLABLE  |                │
│ | name          | STRING    | NULLABLE  |                │
│ | price         | NUMERIC   | REQUIRED  |                │
│                                                          │
│ Labels Tab:                                              │
│ environment: production                                  │
│ owner: analytics-team                                    │
└─────────────────────────────────────────────────────────┘
```

**Tabs:**
- Overview, Schema, Labels
- Active tab: Highlighted, underlined
- Inactive: Gray text

**Schema Table:**
- Columns: Column Name | Type | Mode
- Copy button next to each column name
- Tooltip on column type: Show brief description (e.g., "NUMERIC: decimal numbers")

## Interaction Patterns

### Keyboard Navigation

**Tree View (Asset Explorer):**
- `Arrow Up/Down` — Move between items
- `Arrow Right` — Expand folder (if collapsed)
- `Arrow Left` — Collapse folder (if expanded)
- `Enter` — Select item (trigger default action)
- `Ctrl+F` / `Cmd+F` — Open filter input
- `Escape` — Clear filter, close menu

**Webview (Results Table):**
- `Tab` — Next cell / Next page
- `Shift+Tab` — Previous cell / Previous page
- `Arrow Up/Down` — Next/previous row (in cell)
- `Enter` — Accept filter, go to page
- `Escape` — Clear filter, close dropdowns

**Editor (SQL):**
- `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows/Linux) — Run Query
- `Cmd+Shift+Enter` — Dry Run
- `Cmd+K Cmd+C` — Comment selection (VS Code default)

### Hover & Tooltip Behavior

**Truncated Text:**
- Show full value on hover (tooltip)
- Format: Plain text or formatted (e.g., date formatting)

**Table Column Headers:**
- Show sort indicator on hover (▲ ▼ for clickable sorting)
- Tooltip: "Click to sort by [column name]"

**Status Bar Items:**
- Hover shows detailed tooltip
- Examples:
  - Project: "Click to select a different project"
  - Cost: "Cost of last query: $0.25 (25 MB)"
  - Estimate: "Estimated cost (from auto dry-run): 25 MB"

### Loading & Async States

**Status Bar (auto dry-run):**
- Idle: Static text + color
- Running: Animated `$(loading~spin)` icon
- Result: Show cost or error message

**Results Webview:**
- Loading first page: Show spinner, "Loading results..."
- Paging: Disable page controls while fetching, show spinner
- Error: Red banner with error message, retry button

**Tree View:**
- Expanding dataset: Show loading icon (`$(loading~spin)`)
- Error expanding: Show error icon (`$(error)`), tooltip with error

## Accessibility (WCAG 2.1 AA)

### Color Contrast
- Foreground text on background: Minimum 4.5:1 ratio
- Button text on background: Minimum 4.5:1 ratio
- Icons on background: Minimum 3:1 ratio (non-essential)

### Keyboard Accessibility
- All interactive elements accessible via Tab key
- Focus indicator visible (outline or highlight)
- No keyboard traps (Tab/Shift+Tab always moves focus)

### Screen Reader Support
- Use semantic HTML (`<button>`, `<a>`, `<table>`)
- Add `aria-label` for icons without visible text
- Add `aria-description` for complex interactions

**Example:**
```html
<!-- ✓ Good: Semantic button with ARIA label -->
<button aria-label="Export results as CSV">
  <i class="codicon codicon-file-csv"></i>
</button>

<!-- ✗ Bad: Div with click handler, no label -->
<div onclick="exportCSV()">
  <i class="codicon codicon-file-csv"></i>
</div>
```

### Text Size & Spacing
- Minimum font size: 12px (readable without zooming)
- Line height: 1.5 (spacing for readability)
- Letter spacing: Normal (no compression)

## Mobile/Responsive Design

### Webview Responsiveness
- Results webview: Horizontal scroll for wide tables (not responsive, fixed width)
- Modal dialogs: Full-width on mobile (not typical for VS Code)
- Buttons: 44px minimum height (touch-friendly, but not standard for VS Code)

**Note:** VS Code extension webviews are desktop-only, no mobile support needed. But optimize for small screens (e.g., laptop with split editor + webview).

## Animation & Motion

### Recommended Animations
- **Loading spinners:** Use `$(loading~spin)` codicon (animated in VS Code)
- **Page transitions:** Fade-in new table (200ms)
- **Status bar updates:** Subtle color transition (100ms)
- **Expand/collapse:** Smooth height transition (150ms)

### Avoid
- **Excessive animations:** Keep animations <300ms, avoid flashing
- **Auto-play:** Never auto-play animations on load
- **Parallax:** Not supported in webview
- **Mouse-tracking:** Avoid motion sickness triggers

## Extension Walkthrough

### 8-Step Setup Flow
The extension provides a guided walkthrough for first-time users (triggered on install):

1. **Authenticate** — Run `gcloud auth application-default login` or set service account key path
2. **Set Default Browse Project** — QuickPick all available GCP projects (what's shown in Explorer)
3. **Set Execution Project** — QuickPick projects for query billing (falls back to browse project)
4. **Set Default Region** — QuickPick 12 standard regions or enter custom (US, EU, asia-southeast1, etc.)
5. **Set Cost Limit** — Input GB value for maximumBytesBilled (default 200, set 0 to disable)
6. **Open Explorer** — Navigate to BigQuery Browser sidebar view
7. **Create Query File** — Create new .bqsql file with syntax highlighting
8. **Run Query** — Execute first query with Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)

**Implementation:** Defined in `package.json` `contributes.walkthroughs` with inline media and completion events tied to commands.

## Localization & Internationalization

### Current Support
- **Language:** English only (v0.1.0)
- **Region:** US-centric (date/currency formatting), but supports all BigQuery regions
- **Text direction:** LTR (left-to-right) only

### Future Preparation
- Use `vscode.l10n` for future translation support
- Avoid hardcoded strings in UI
- Format dates/numbers via locale settings (don't hardcode MM/DD)

## Design System Documentation

### Design Tokens (CSS Variables)
```css
:root {
  /* Colors */
  --color-primary: #007acc;
  --color-success: #107c10;
  --color-error: #e81123;
  --color-warning: #ff8c00;

  /* Typography */
  --font-size-base: 13px;
  --font-size-small: 12px;
  --font-size-large: 16px;

  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 12px;
  --spacing-lg: 16px;
  --spacing-xl: 24px;

  /* Borders */
  --border-radius-sm: 2px;
  --border-radius-md: 4px;
  --border-width: 1px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
}
```

### Component Examples
- **Button:** Primary (blue), Secondary (gray), Danger (red)
- **Input:** Text field with placeholder, optional label
- **Table:** Sortable headers, alternating rows, truncated cells
- **Modal:** Center-aligned, focus trap, escape to close

## Dark Mode Considerations

### Dark Mode Theme Variables
VS Code automatically provides dark theme variables:
```css
--vscode-editor-background: #1e1e1e;
--vscode-editor-foreground: #d4d4d4;
--vscode-editorGroup-border: #404040;
--vscode-button-background: #0e639c;
--vscode-button-foreground: #ffffff;
```

**Testing:** Switch VS Code theme and verify colors are readable (use DevTools in webview inspect).

## Performance Considerations

### Rendering Optimization
- **Virtual scrolling:** Not implemented (small result sets <10k rows)
- **Lazy rendering:** Load table HTML in chunks if >1000 rows
- **CSS containment:** Use `contain: layout style paint;` for performance
- **Debounce input:** Filter input debounced 300ms before re-rendering

### Asset Optimization
- **Inline CSS:** Include critical CSS in HTML head (avoid FOUC)
- **Minimize JS:** Bundle and minify React components
- **Image compression:** Use SVG for icons (scalable, small)

## Glossary

- **FOUC** — Flash Of Unstyled Content (blank page before CSS loads)
- **WCAG** — Web Content Accessibility Guidelines
- **Codicon** — VS Code's built-in icon library
- **CSP** — Content Security Policy (security headers)
- **LTR** — Left-to-right text direction
- **ARIA** — Accessible Rich Internet Applications (accessibility)
