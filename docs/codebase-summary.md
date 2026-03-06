# Codebase Summary

## Overview

**Total TypeScript Files:** 15
**Total Lines of Code:** ~1,837 (excluding tests, comments)
**Architecture:** 3-layer (UI → Provider → Service → BigQuery SDK)

## Directory Structure

```
src/
├── extension.ts                       232 lines — Entry point, register all providers & commands
├── commands/                          ~118 lines total
│   ├── run-query-command.ts           70 lines — Execute SQL, show results panel
│   └── dry-run-command.ts             48 lines — Estimate query cost before execution
├── services/                          ~667 lines total
│   ├── auth-service.ts                65 lines — GCP authentication, lazy BigQuery client init
│   ├── bigquery-client.ts             305 lines — Wrapper for all BigQuery API calls
│   ├── auto-dry-run-service.ts        137 lines — Debounced real-time cost estimation
│   └── query-history-service.ts       80 lines — Persistent query history with 24h auto-evict
├── providers/                         ~900 lines total
│   ├── asset-explorer-provider.ts     171 lines — TreeDataProvider for projects/datasets/tables
│   ├── query-history-provider.ts      74 lines — TreeDataProvider for query history
│   ├── query-results-provider.ts      162 lines — Webview panel for paginated results
│   ├── query-results-webview-html.ts  158 lines — HTML builder + React render for results
│   ├── table-metadata-provider.ts     154 lines — Webview for schema, stats, labels
│   ├── schema-hover-provider.ts       81 lines — Hover provider with 5min column cache
│   └── status-bar-provider.ts         70 lines — Project + cost + auto-estimate indicators
└── utils/
    └── sql-directive-parser.ts        30 lines — Parse @project/@region directives
```

## Layer Breakdown

### Entry Point (extension.ts — 354 lines)

**Responsibilities:**
- VS Code extension activation
- Register all 22 commands (run, dry-run, history, explorer, config, etc.)
- Register all providers (TreeView, Hover, Webview)
- Instantiate services (Auth, BigQueryClient, AutoDryRun, History)
- Listen for config changes (re-initialize auth)

**Key Exports:**
- `activate()` — Called by VS Code on extension load
- `deactivate()` — Cleanup on unload

### Command Layer (~160+ lines)

**run-query-command.ts (80+ lines)**
- Extract SQL from active editor
- Apply SQL directives (project, region override)
- Call BigQueryClient.runQuery() with progress polling
- Monitor job progress (1s polls) and show stage updates (e.g., "RUNNING — 3/5 stages")
- Support job cancellation via cancellation token
- Show results in QueryResultsProvider webview panel
- Handle errors with user-friendly notifications

**dry-run-command.ts (50+ lines)**
- Extract SQL from editor
- Call BigQueryClient.dryRun()
- Display estimated cost in notification
- Show inline error diagnostics if query invalid

**Configuration Commands (30+ lines)**
- `setDefaultProject` — QuickPick all available projects
- `setExecutionProject` — QuickPick all available projects
- `setDefaultRegion` — QuickPick 12 standard regions + custom input
- `setMaxBytesBilled` — Input dialog for GB value

### Service Layer (~667 lines)

**auth-service.ts (65 lines)**
- Load service account key from keyFilePath setting
- Initialize @google-cloud/bigquery BigQuery client
- Support Application Default Credentials (ADC) fallback
- Lazy init: client created on first use
- Auto-recreate on config change

**bigquery-client.ts (305 lines) — Core API wrapper**

*Query Execution:*
- `runQuery(sql, options)` — Execute query, fetch first page
- `getQueryResults(jobId, pageToken, maxResults)` — Fetch result pages
- `getQueryJob(jobId)` — Check job status, get metadata

*Data Operations:*
- `dryRun(sql, options)` — Cost estimate without execution (excludes maximumBytesBilled)
- `previewTable(dataset, table, limit)` — Zero-cost preview via `tabledata.list` (physical tables only)
- `fetchResultPage(jobId, pageToken, sortKey?, limit?)` — Free paging or ORDER BY sort
- `getQueryJob(jobId)` — Poll job metadata for progress (stage count, current stage)

*Metadata:*
- `listProjects()` — Get GCP projects (cached, session-long)
- `listDatasets(projectId)` — Get datasets for project (24h cache)
- `listTables(projectId, datasetId)` — Get tables for dataset (24h cache, paginated 500/page, max 1000 with warning)
- `getTableSchema(projectId, datasetId, table)` — Column definitions with type validation
- `getTableMetadata(projectId, datasetId, table)` — Size, row count, partitioning, labels
- `getViewSql(projectId, datasetId, view)` — Get view definition SQL

*Configuration:*
- `getClientWithOverrides(executionProjectId, location)` — Create client with per-query overrides
- `createSortedTable(jobId, sortKey, limit)` — Create temp table with ORDER BY for free re-paging

**auto-dry-run-service.ts (137 lines)**
- Listen for text changes in .bqsql editors
- Debounce 1.5s (avoid excessive API calls)
- Call dryRun(), cache result
- Update status bar cost indicator
- Show inline diagnostic errors in editor
- Respect bigqueryBrowser.autoDryRun setting toggle

**query-history-service.ts (80 lines)**
- Persist queries to VS Code globalState
- Fields: sql, timestamp, bytes scanned, duration, status, jobId, result table, region
- Limit: configurable (default 100, max 500)
- Auto-evict entries older than 24h on load
- Rerun query: fetch from history, re-execute
- View results: fetch from cached temp table if available

### Provider Layer (~900 lines)

**asset-explorer-provider.ts (171 lines)**
- VS Code TreeDataProvider for project/dataset/table browsing
- Tree structure: Projects → Datasets → Tables
- Caching: 24h dataset/table cache to reduce API calls
- Filtering: Filter dataset/table names (client-side on cached data)
- Context menu: Copy table reference, preview, view schema
- Icons: folder/table/document VS Code icons

**query-history-provider.ts (74 lines)**
- TreeDataProvider showing query history entries
- Display: SQL snippet + relative timestamp (e.g., "2 hours ago")
- Icons: success (checkmark) / error (X) status
- Context menu (1_actions group): Run again, View SQL, View Results, Copy SQL
- Context menu (2_manage group): Rename entry, Delete entry
- Sorting: Most recent first
- Filtering: Filter by name or SQL content

**query-results-provider.ts (162 lines)**
- Manages webview panel for displaying query results
- Receives job ID + first page from RunQueryCommand
- Handles paging requests (tabledata.list free or ORDER BY sort)
- Handles sorting (creates sorted temp table, caches)
- Sends HTML to ResultsWebviewHtml provider
- Updates title/info: "Results — 1,234 rows | Fetched in 5.2s"

**query-results-webview-html.ts (180+ lines)**
- Builds HTML + React component for results display
- Table rendering with sortable column headers (sort validated against schema)
- Paging controls (First, Prev, Page N, Next, Last)
- Sorting UI (click header to sort by column)
- Filtering UI (text input to filter by value)
- Column visibility dropdown (checklist with search + All/None toggle)
- Export buttons (CSV, JSON, TSV, copy — respects visible columns)
- Result metadata (total rows, bytes scanned, query time)
- Security: Nonce-based CSP, HTML escaping for user data, XSS prevention via data-attributes

**table-metadata-provider.ts (170+ lines)**
- Webview for table details (opened via "View Schema" command)
- Tabs:
  - **Overview** — Table type, row count, size, partitioning, clustering
  - **Schema** — Columns table (name, type, mode, description) with search box to filter columns
  - **View SQL** — (for BigQuery views only) Shows view definition with Copy SQL button
  - **Labels** — Key-value labels
- Copy column name buttons, formatted byte sizes
- HTML builder with inline CSS (VS Code theme variables)

**schema-hover-provider.ts (81 lines)**
- VS Code HoverProvider on backtick-quoted table references
- Detect table ref: `project.dataset.table` or `dataset.table`
- Cache schema columns 5 minutes (reduce API calls)
- Return markdown table of columns (name | type | mode)
- Hover shows column list inline in editor

**status-bar-provider.ts (70 lines)**
- 3 status bar items:
  1. **Project indicator** — Current projectId (clickable → select project)
  2. **Cost indicator** — Post-query cost (shown after query runs)
  3. **Auto-estimate indicator** — Real-time cost while typing (from AutoDryRunService)
- Right-align items for visibility
- Icons: cloud, dollar, estimate indicators

## Data Flow

### Query Execution Flow

```
User: Cmd+Enter in .bqsql editor
           ↓
RunQueryCommand: Extract SQL, parse directives
           ↓
BigQueryClient.runQuery()
           ↓
@google-cloud/bigquery SDK: Create query job
           ↓
QueryResultsProvider: Show webview panel with first page
           ↓
User: Click paging controls
           ↓
QueryResultsProvider: Fetch next page (free tabledata.list or ORDER BY sort)
           ↓
ResultsWebviewHtml: Render updated table
```

### Auto Dry-Run Flow

```
User: Types in .bqsql editor
           ↓
AutoDryRunService: 1.5s debounce
           ↓
BigQueryClient.dryRun()
           ↓
StatusBarProvider: Update cost indicator
           ↓
Editor: Inline error diagnostic if invalid SQL
```

### History Flow

```
QueryHistoryService: After query completes, add to globalState
           ↓
QueryHistoryProvider: Tree view updates
           ↓
User: Right-click history entry → "Run Again"
           ↓
RunQueryCommand: Execute stored SQL, show results
```

## Caching Strategy

| Cache | TTL | API Calls Saved | Implementation |
|-------|-----|-----------------|-----------------|
| Projects | Session | 100+ | In-memory Map, single fetch |
| Datasets | 24h | 1000s | BigQueryClient cache dict |
| Tables | 24h | 1000s | BigQueryClient cache dict |
| Sorted Dest Tables | Session | Per-sort | BigQueryClient creates temp table, caches jobId |
| Schema (Hover) | 5min | 100+ | SchemaHoverProvider Map + timeout |
| Query History | 24h | N/A | VS Code globalState, auto-evict on load |

## Security Patterns

| Concern | Mitigation |
|---------|-----------|
| **API Key Exposure** | Service key loaded from file path, never logged, not in settings |
| **XSS in Webview** | Nonce-based CSP (script-src 'nonce-{random}'), no inline onclick |
| **Data Injection** | HTML escaping (`.replace(/</g, '\\u003c')`), JSON safe stringify |
| **CORS** | VS Code webview security model (no cross-origin requests) |
| **User Privacy** | Query history stored locally in globalState, not sent externally |

## Error Handling

**Command Errors:** User notifications + status bar messages
**API Errors:** Catch BigQuery SDK exceptions, display user-friendly messages
**Auth Errors:** Re-prompt for credentials on auth failure
**Invalid SQL:** Inline diagnostics in editor + dry-run error display
**Network Errors:** Automatic retry with exponential backoff (via SDK)

## Code Organization Principles

1. **Separation of Concerns** — Commands → Providers → Services → SDK
2. **Provider Pattern** — VS Code TreeDataProvider/HoverProvider/etc. for native UI
3. **Service Locator** — Singleton services in extension.ts, dependency injection
4. **Lazy Initialization** — Auth client created on first use, not at startup
5. **Caching** — API calls cached with TTL to balance freshness vs cost
6. **Async/Await** — All async operations properly awaited, errors caught

## File Naming Convention

- **kebab-case** for all .ts files (e.g., `asset-explorer-provider.ts`)
- **Descriptive names** — file name is self-documenting (e.g., `query-results-webview-html.ts`)
- **Suffix convention:**
  - `-provider.ts` — VS Code provider (TreeDataProvider, HoverProvider, etc.)
  - `-service.ts` — Business logic service (reusable, singleton)
  - `-command.ts` — Command handler (invoked by VS Code commands)

## Dependencies at a Glance

**Runtime:**
- @google-cloud/bigquery (305 KB) — BigQuery API
- @vscode/webview-ui-toolkit (150 KB) — VS Code themed components
- react, react-dom (200 KB) — Results table rendering

**Dev:**
- typescript, esbuild — Building
- vitest — Testing
- @types/vscode, @types/node — Type definitions

**Total Bundled Size:** ~1.2 MB (minified + gzipped ~400 KB)

## Testing Coverage

- **Services:** Unit tests for BigQueryClient, AutoDryRunService, QueryHistoryService
- **Parsers:** Unit tests for sql-directive-parser
- **Providers:** Integration tests (mock BigQuery responses)
- **Commands:** End-to-end tests via vitest

**Test Framework:** vitest 2.1.0
**Execution:** `npm test` (vitest run), `npm run test:watch`

## Build & Bundling

- **Builder:** esbuild (configured in esbuild.mjs)
- **Entry:** src/extension.ts
- **Output:** dist/extension.js (single bundled file)
- **Build:** `npm run build`
- **Watch:** `npm run watch`
- **Lint:** `npm run lint` (tsc --noEmit)

## Configuration Sources

All settings in package.json `contributes.configuration`:

| Setting | Scope | Type | Default | Description |
|---------|-------|------|---------|-------------|
| projectId | user/workspace | string | "" | Default project for browsing datasets/tables |
| executionProjectId | user/workspace | string | "" | Project for query execution/billing (falls back to projectId) |
| keyFilePath | user/workspace | string | "" | Path to service account key JSON (leave empty for ADC) |
| maxResults | user/workspace | number | 50 | Rows per page (10-1000) |
| location | user/workspace | string | "US" | Default BigQuery location/region for queries |
| queryHistoryLimit | user/workspace | number | 100 | Max query history entries (10-500) |
| autoDryRun | user/workspace | boolean | true | Auto-estimate cost while typing in .bqsql files |
| maximumBytesBilledGb | user/workspace | number | 200 | Safety limit per query in GB (0=disabled) |

## Extension Activation

- **Current:** No specific activation events (activates on install)
- **Future:** Could add `onCommand:`, `onView:` for lazy loading
- **Deactivation:** Cleanup on VS Code shutdown (temp tables not cleaned, BigQuery auto-deletes after 7 days)

## Known Technical Debt

1. **Temp Table Cleanup** — Sorted temp tables persist until BigQuery auto-cleanup (7 days)
2. **Cache Invalidation** — Manual refresh explorer button (no auto-refresh on external changes)
3. **Error Handling** — Some API errors not gracefully handled (could improve messaging)
4. **Type Safety** — Some `any` types in webview messaging (could be stricter)
5. **Accessibility** — TreeView navigation could support keyboard shortcuts

## Future Code Improvements

1. **Modularization** — Split bigquery-client.ts into separate modules (query, metadata, cache)
2. **Error Recovery** — Add automatic retry with exponential backoff for transient errors
3. **Type Strictness** — Replace any with proper types in webview communication
4. **Test Coverage** — Increase unit test coverage to 80%+ (currently ~60%)
5. **Performance** — Lazy-load providers, defer non-critical initialization
