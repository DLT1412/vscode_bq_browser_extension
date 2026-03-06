# System Architecture

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  VS Code UI Layer                                                │
│  ┌────────────────────┬──────────────────┬─────────────────────┐│
│  │ TreeView Provider  │ Webview Provider │ Status Bar Provider ││
│  │ (Explorer, History)│ (Results, Schema)│ (Project, Cost)     ││
│  └────────────────────┴──────────────────┴─────────────────────┘│
├──────────────────────────────────────────────────────────────────┤
│  Command & Event Layer                                           │
│  ┌──────────────┬────────────────┬──────────────────────────────┐│
│  │ RunQuery     │ DryRun         │ Explorer/History/Config      ││
│  │ Command      │ Command        │ Event Handlers               ││
│  └──────────────┴────────────────┴──────────────────────────────┘│
├──────────────────────────────────────────────────────────────────┤
│  Service Layer (Business Logic)                                  │
│  ┌──────────────┬────────────────┬────────────┬───────────────┐ │
│  │ AuthService  │ BigQueryClient │ AutoDryRun │ QueryHistory  │ │
│  │ (Auth)       │ (API Wrapper)  │ Service    │ Service       │ │
│  └──────────────┴────────────────┴────────────┴───────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│  Data Layer                                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ @google-cloud/bigquery SDK                                │ │
│  │ (Query execution, result fetching, metadata)              │ │
│  └────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│  External Services                                               │
│  ┌────────────────────┬──────────────────┬────────────────────┐ │
│  │ Google BigQuery    │ GCP IAM          │ VS Code Settings   │ │
│  │ API                │ (Authentication) │ (globalState)      │ │
│  └────────────────────┴──────────────────┴────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### 1. UI Layer (VS Code Providers)

**AssetExplorerProvider** (TreeView)
- Display projects → datasets → tables
- Respond to expand/collapse events
- Implement filtering on cached data
- Context menu: copy, preview, view schema

**QueryHistoryProvider** (TreeView)
- Display query history entries
- Show status (success/error) icons
- Relative timestamps
- Context menu: run, view SQL, view results

**QueryResultsProvider** (Webview Panel)
- Manage multiple webview panels (one per query/preview with separate tabs)
- Each panel has unique session with `PanelSession` holding viewState, destTable, sortedDestCache, fetchSeq
- Route paging/sorting requests to BigQueryClient with race condition guard (fetchSeq counter)
- Send updated HTML to webview on page change
- Handle user interactions (export, copy, SQL panel, filter)
- Display collapsible read-only SQL panel with Copy + Open in Editor buttons
- Hide pager for preview data (when `canPage: false` — no destinationTable)

**TableMetadataProvider** (Webview Panel)
- Display table schema, statistics, labels
- Show formatted byte sizes
- Provide copy-column-name buttons

**SchemaHoverProvider** (Hover)
- Detect backtick-quoted table references
- Return markdown table of columns
- Cache schema for 5 minutes

**StatusBarProvider** (Status Items)
- Project indicator (clickable → selectProject command)
- Cost indicator (from last query)
- Auto-estimate indicator (from AutoDryRunService)

### 2. Command & Event Layer

**RunQueryCommand**
1. Get active editor text
2. Parse SQL directives (@project, @region)
3. Call BigQueryClient.runQuery()
4. Poll job metadata every 1s to show progress (stage count, current stage)
5. Support job cancellation via cancellation token
6. Show results in QueryResultsProvider webview
7. Enforce maximumBytesBilled safety limit (reject if exceeded)

**DryRunCommand**
1. Get active editor text
2. Parse SQL directives
3. Call BigQueryClient.dryRun()
4. Display cost in notification

**Explorer Commands**
- refreshExplorer → Clear cache, refresh TreeView
- copyTableReference → Copy backtick-quoted table name
- previewTable → Call bigQueryClient.previewTable() (zero-cost tabledata.list)
- viewSchema → Show TableMetadataProvider with schema/overview/view SQL/labels tabs
- filterExplorer → Set filter text with client-side matching
- setDefaultProject → QuickPick projects, set projectId setting
- setExecutionProject → QuickPick projects, set executionProjectId setting
- setDefaultRegion → QuickPick 12 standard regions or custom input
- setMaxBytesBilled → Input dialog for GB value (0=disabled)

**History Commands**
- clearHistory → Clear globalState
- runFromHistory → Retrieve SQL, execute like RunQuery
- viewHistorySql → Open text document with SQL
- viewHistoryResults → Fetch cached temp table results
- deleteHistoryEntry → Remove entry by stable identity (timestamp + sql)
- copyHistorySql → Copy SQL to clipboard
- renameHistoryEntry → Rename entry with custom name
- filterHistory / clearHistoryFilter → Filter history by text

**Config Change Event**
- onDidChangeConfiguration → Reset AuthService client, refresh UI

### 3. Service Layer (Business Logic)

**AuthService**
- Load service account key from keyFilePath
- Initialize BigQuery client lazily
- Support ADC fallback
- Handle auth errors
- Re-initialize on config change

**BigQueryClient** (330+ lines — Core)
- **Query Execution:** runQuery, dryRun, getQueryResults, getQueryJob (progress polling)
- **Metadata:** listProjects, listDatasets, listTables (paginated 500/page), getTableSchema, getTableMetadata, getViewSql
- **Data Operations:** previewTable (zero-cost tabledata.list), fetchResultPage, createSortedTable
- **Caching:** Project (session), dataset/table (24h) with TTL
- **Overrides:** getClientWithOverrides for executionProjectId/location
- **Safety:** Validates sort column against schema, respects maximumBytesBilled limit

**AutoDryRunService**
- Listen to onDidChangeTextDocument for .bqsql editors
- Debounce 1.5 seconds
- Call BigQueryClient.dryRun()
- Cache result
- Update StatusBarProvider
- Show inline diagnostics (errors in editor)

**QueryHistoryService**
- Persist to VS Code globalState (key: "bigqueryBrowser.queryHistory")
- Store: sql, timestamp, bytes, duration, status, jobId, destTable, region, name (optional)
- Limit: configurable (default 100, max 500)
- Auto-evict entries >24h old on load
- Stable identity: identify entries by (timestamp + sql) not array index — enables safe delete/rename
- Methods: addEntry, getEntries, renameEntry, deleteEntry, clearHistory

### 4. Data Layer (BigQuery SDK)

**@google-cloud/bigquery v7.9.0**
- Query execution (createQueryJob, getQueryResults)
- Metadata API (listDatasets, listTables, getMetadata)
- Result streaming (tabledata.list, getQueryResultsAsStream_)
- Datatype support (STRUCT, ARRAY, GEOGRAPHY, etc.)

### 5. External Dependencies

**Google BigQuery API**
- OAuth 2.0 via service account or ADC
- HTTP REST API (not gRPC)
- ~100ms response time typical

**VS Code Settings API**
- Read config via vscode.workspace.getConfiguration()
- Persist state via context.globalState
- Listen to config changes via onDidChangeConfiguration

## Data Flow Diagrams

### Query Execution Flow

```
User Input: Cmd+Enter in .bqsql file
        ↓
RunQueryCommand (commands/run-query-command.ts)
        ├─ Extract SQL from active editor
        ├─ Parse SQL directives (@project, @region)
        └─ Call bigQueryClient.runQuery(sql, options)
                ↓
BigQueryClient.runQuery()
        ├─ Validate SQL and maximumBytesBilled safety limit
        ├─ Create BigQuery client with overrides (if any)
        └─ Call client.createQueryJob(query: string)
                ↓
@google-cloud/bigquery SDK
        ├─ POST /projects/{project}/queries
        └─ Return jobReference { projectId, jobId }
                ↓
RunQueryCommand: Poll getQueryJob() every 1s for progress
        ├─ Show "RUNNING — stage X of Y (progress%)" in title/status
        └─ Support cancellation token for user stop
                ↓
BigQueryClient.getQueryResults(jobId) — Fetch first page
        ├─ Call client.getQueryResults(jobId, { pageSize: 50 })
        └─ Return { rows, totalRows, pageToken }
                ↓
RunQueryCommand
        └─ Call queryResultsProvider.show(jobId, firstPage)
                ↓
QueryResultsProvider (WebviewProvider)
        ├─ Create new webview panel (separate tab per query/preview)
        ├─ Generate unique tab title via deriveQueryTitle(sql) (e.g., "SELECT · users")
        ├─ Initialize PanelSession: { panel, viewState, destTable, fetchSeq, sortedDestCache }
        ├─ Build HTML via ResultsWebviewHtml
        ├─ Render React table + column visibility toggle + collapsible SQL panel
        └─ webviewPanel.webview.html = htmlContent
                ↓
VS Code Webview
        └─ Display paginated results table with "Columns" dropdown
        └─ Show collapsible SQL panel (read-only with Copy + Open buttons)
        └─ Hide pager if canPage=false (preview data, no destinationTable)

User: Clicks page 2
        ↓
Webview JS: vscode.postMessage({ command: 'changePage', page: 1, visibleColumns: [...] })
        ↓
QueryResultsProvider.fetchPage()
        ├─ Increment fetchSeq (race condition guard)
        ├─ Pass selectedFields to API (persistent across paging)
        ├─ Fetch page via bigQueryClient.fetchResultPage()
        ├─ Check if seq still current (drop if stale)
        └─ Send updated HTML with new rows
                ↓
Webview: Render new table
```

### Auto Dry-Run Flow

```
User: Types in .bqsql editor
        ↓
onDidChangeTextDocument event (if .bqsql file)
        ↓
AutoDryRunService.onDidChangeTextDocument()
        ├─ Get current SQL
        ├─ Check if autoDryRun setting enabled
        └─ Debounce 1.5 seconds
                ↓
AutoDryRunService.performDryRun()
        ├─ Extract SQL directives
        └─ Call bigQueryClient.dryRun(sql, options)
                ↓
BigQueryClient.dryRun()
        ├─ Create BigQuery client with overrides
        └─ Call client.query(query, { dryRun: true })
                ↓
@google-cloud/bigquery SDK
        ├─ POST /projects/{project}/queries (dryRun=true)
        └─ Return { jobCompleted: true, totalBytesProcessed }
                ↓
AutoDryRunService
        ├─ Cache result
        ├─ Update statusBarProvider cost indicator
        ├─ Show inline diagnostics if errors
        └─ Return { bytes, estimated_cost }
```

### History Persistence Flow

```
Query completes: bigQueryClient.runQuery() returns result
        ↓
RunQueryCommand (or equivalent)
        ├─ Extract query metadata: sql, bytes, duration, jobId, status
        └─ Call queryHistoryService.addEntry(entry)
                ↓
QueryHistoryService.addEntry()
        ├─ Read current history from globalState
        ├─ Prepend new entry (most recent first)
        ├─ Trim to queryHistoryLimit
        ├─ Auto-evict entries >24h old
        └─ Write back to globalState
                ↓
VS Code globalState persisted to disk
        ↓
On extension load: QueryHistoryService.loadHistory()
        ├─ Read from globalState
        ├─ Auto-evict old entries
        └─ Populate history TreeView
```

### Asset Explorer Caching Flow

```
First time: assetExplorerProvider.getChildren(null) — Get projects
        ↓
bigQueryClient.listProjects()
        ├─ Not cached (only fetch once per session)
        └─ Cache in memory (Map<projectId, Project>)
                ↓
User expands project: assetExplorerProvider.getChildren(project)
        ├─ Call bigQueryClient.listDatasets(projectId)
        └─ Check cache: Hit? Return cached | Miss? Fetch from API
                ↓
BigQueryClient.listDatasets(projectId)
        ├─ Check datasetCache: Hit if <24h old
        ├─ If miss: Fetch from API, cache with timestamp
        └─ Return datasets
                ↓
TreeView renders datasets in project node
        ↓
User expands dataset: assetExplorerProvider.getChildren(dataset)
        ├─ Call bigQueryClient.listTables(projectId, datasetId)
        └─ Similar caching logic as datasets
                ↓
TreeView renders tables in dataset node

User: 23 hours later, TreeView auto-refreshes
        ├─ Re-fetch datasets (cache still valid)
        └─ No API calls (24h TTL)

User: 25 hours later, TreeView auto-refreshes
        ├─ Cache expired
        ├─ Re-fetch datasets from API
        └─ Update cache timestamp
```

## Component Interactions

### Extension Activation Sequence

```
VS Code loads extension
        ↓
extension.activate() called
        ├─ Create AuthService
        ├─ Create BigQueryClient (passed AuthService)
        ├─ Create AutoDryRunService (passed BigQueryClient)
        ├─ Create QueryHistoryService
        │
        ├─ Register all commands:
        │  ├─ runQuery
        │  ├─ dryRun
        │  ├─ refreshExplorer, copyTableReference, etc.
        │  └─ ...more commands
        │
        ├─ Register all providers:
        │  ├─ TreeDataProvider for AssetExplorer
        │  ├─ TreeDataProvider for QueryHistory
        │  ├─ WebviewPanelSerializer for QueryResults
        │  ├─ WebviewPanelSerializer for TableMetadata
        │  ├─ HoverProvider for Schema
        │  └─ StatusBar items
        │
        ├─ Register event listeners:
        │  ├─ onDidChangeConfiguration → Reset auth, refresh UI
        │  ├─ onDidChangeTextDocument → AutoDryRunService
        │  └─ onDidCloseTextDocument → Cleanup (if needed)
        │
        └─ Return: { assetExplorerProvider, ... }
```

### Runtime Interactions

```
Service → Service:
  AuthService
    ├─ Provides BigQuery client to BigQueryClient, AutoDryRunService
    └─ Listens to config changes, re-initializes self

  BigQueryClient
    ├─ Called by RunQueryCommand, DryRunCommand
    ├─ Called by AutoDryRunService (dry-run)
    ├─ Called by QueryResultsProvider (paging)
    ├─ Called by AssetExplorerProvider (metadata)
    └─ Called by SchemaHoverProvider (columns)

  AutoDryRunService
    ├─ Calls BigQueryClient.dryRun()
    └─ Updates StatusBarProvider

  QueryHistoryService
    ├─ Called by RunQueryCommand (add entry)
    └─ Called by QueryHistoryProvider (load)

Provider → Service:
  AssetExplorerProvider
    └─ Calls BigQueryClient (listProjects, listDatasets, listTables)

  QueryResultsProvider
    └─ Calls BigQueryClient (getQueryResults, createSortedTable)

  TableMetadataProvider
    └─ Calls BigQueryClient (getTableMetadata, getTableSchema)

  SchemaHoverProvider
    └─ Calls BigQueryClient (getTableSchema)

  StatusBarProvider
    └─ Listens to AutoDryRunService for cost updates

Command → Service:
  RunQueryCommand
    ├─ Calls BigQueryClient.runQuery()
    ├─ Calls QueryResultsProvider.show()
    └─ Calls QueryHistoryService.addEntry()

  DryRunCommand
    └─ Calls BigQueryClient.dryRun()

Webview ↔ Provider:
  QueryResultsProvider webview
    ├─ onDidReceiveMessage: { command: 'nextPage', ... }
    └─ webview.postMessage: { type: 'update', html: ... }
```

## Authentication Flow

```
Extension startup
        ↓
AuthService.getClient()
        ├─ Check keyFilePath setting
        │  ├─ If set: Load service account JSON key
        │  └─ If empty: Use ADC (Application Default Credentials)
        │
        ├─ Initialize BigQuery client:
        │  new BigQuery({
        │    projectId: 'default',
        │    keyFilename: keyPath, // or undefined for ADC
        │    location: 'US',
        │  })
        │
        └─ Cache client in authService.bigQueryClient
                ↓
User runs query
        ├─ BigQueryClient.runQuery() called
        ├─ Use cached client OR
        ├─ Create new client with overrides (executionProjectId, location)
        └─ Execute query
                ↓
BigQuery SDK handles auth
        ├─ If keyFilePath: Use service account credentials
        ├─ If ADC: Use gcloud credentials (from ~/.config/gcloud/)
        └─ Send authenticated request to BigQuery API
                ↓
Query executes
        ├─ If auth succeeds: Get results
        └─ If auth fails: Show error → "Run gcloud auth application-default login"

Config change detected (keyFilePath updated)
        ├─ extension.onDidChangeConfiguration()
        └─ AuthService.resetClient() → New client on next use
```

## Webview Communication Protocol

### Query Results Webview

**Webview → Provider (user actions):**
```json
// User clicks "Next Page"
{ "command": "nextPage", "pageToken": "xyz123" }

// User sorts by column
{ "command": "sort", "column": "timestamp", "direction": "ASC" }

// User filters results
{ "command": "filter", "value": "production" }

// User exports
{ "command": "export", "format": "csv" }

// User copies to clipboard
{ "command": "copy", "format": "json" }
```

**Provider → Webview (state updates):**
```json
{
  "type": "update",
  "html": "<table>...</table>",
  "totalRows": 1234,
  "currentPage": 2,
  "pageSize": 50
}

{
  "type": "error",
  "message": "Failed to fetch page: Invalid page token"
}
```

## Caching Strategy Details

### Projects Cache
- **Scope:** Session-wide
- **TTL:** Infinite (until extension reload)
- **Size:** Typically 5-50 projects per user
- **Hit Rate:** 95%+ (rarely changes during session)
- **Invalidation:** Manual via "Refresh Explorer" command

### Datasets/Tables Cache
- **Scope:** Per BigQueryClient instance
- **TTL:** 24 hours
- **Size:** Typically 50-500 datasets, 1000-10000 tables per project
- **Hit Rate:** 80%+ (users typically work on subset of datasets)
- **Invalidation:** TTL expiry or "Refresh Explorer" command

### Sorted Table Cache
- **Scope:** Session-wide in BigQueryClient
- **TTL:** Session duration
- **Size:** 1-5 temp tables per session (created on demand)
- **Hit Rate:** 90%+ (user re-pages same sorted result)
- **Invalidation:** Session end (temp tables deleted by BigQuery after 7 days)
- **Storage:** Temp tables in GCP project (NOT local storage)

### Schema Cache (Hover)
- **Scope:** Per SchemaHoverProvider instance
- **TTL:** 5 minutes
- **Size:** Typically 10-50 schemas cached
- **Hit Rate:** 70%+ (users hover on same tables repeatedly)
- **Invalidation:** TTL expiry or manual

### History Cache
- **Scope:** VS Code globalState (persistent)
- **TTL:** 24 hours (entries evicted after 24h)
- **Size:** 100 entries default (configurable to 500)
- **Hit Rate:** 100% (read from disk)
- **Invalidation:** Auto-eviction on load, manual "Clear History"

## Error Handling Paths

### Invalid SQL
```
BigQueryClient.runQuery() throws 400 error
        ├─ Extract error message: "Syntax error at [line:col]"
        └─ Show notification: "Query failed: Syntax error at line 5"
                ├─ User sees error in notification
                ├─ (Auto dry-run also shows inline diagnostic)
                └─ User fixes and re-runs
```

### Permission Denied
```
BigQueryClient.runQuery() throws 403 error
        ├─ Extract error: "User does not have bigquery.jobs.create"
        └─ Show notification: "Permission denied. Check IAM roles."
                ├─ User logs in again or switches credentials
                └─ Extension suggests: Run gcloud auth login
```

### Auth Failed
```
BigQueryClient.createQueryJob() throws 401 error
        ├─ Extract error: "Invalid Credentials"
        └─ Show notification: "Authentication failed"
                ├─ AuthService.resetClient()
                ├─ User runs: gcloud auth application-default login
                └─ Extension auto-retries on next command
```

### Network Timeout
```
BigQueryClient.getQueryResults() throws timeout error
        ├─ Retry with exponential backoff (100ms, 200ms, 400ms)
        ├─ If all retries fail: Show error
        └─ User can manually retry via paging controls
```

## Performance Characteristics

| Operation | Typical Time | API Calls |
|-----------|--------------|-----------|
| Browse projects | <100ms | 1 (if not cached) |
| Expand dataset | <200ms | 1 (if not cached) |
| Run small query | 1-3s | 2 (createQueryJob + getResults) |
| Run large query | 5-30s | 2 (same, but BigQuery execution slower) |
| Fetch result page | 100-300ms | 1 (tabledata.list or ORDER BY) |
| Sort results | 500-2000ms | 1 (ORDER BY creates temp table) |
| Dry-run query | 200-500ms | 1 (same as run, but no result stream) |
| Auto dry-run (debounced) | 200-500ms | 1 per 1.5s (debounced) |
| Schema hover | <50ms | 0 (cached) or 200-500ms (new schema) |

## Scalability Considerations

### Limits by Default Settings
- **Max results per page:** 50 rows (configurable 10-1000)
- **Query history limit:** 100 entries (configurable 10-500)
- **Cache TTL:** 24h for datasets/tables, 5m for schema
- **Datasets/tables per project:** Typically <10k (BigQuery API limit ~25k)

### Scaling Recommendations
- **Large result sets (>100k rows):** Keep maxResults at 50, rely on paging
- **Many datasets (>1000):** Use filter feature, increase cache TTL
- **Frequent queries:** Enable auto dry-run, monitor cost indicator
- **Team with many projects (>100):** May see 1-2s project list delay (acceptable)

## Deployment & Lifecycle

### Extension Load
- Activation on extension install
- No startup delay (lazy initialization)
- All providers registered, ready to handle events

### Runtime
- Listen to VS Code events (text change, config change, commands)
- Maintain caches and connections
- Clean up resources on view close

### Shutdown
- Deactivate on VS Code close
- Cleanup: Close BigQuery client, cancel pending queries
- Temp tables NOT cleaned (BigQuery auto-deletes after 7 days)

## Security Architecture

### Authentication
- Service account key: File-based, loaded once per session
- ADC: Managed by gcloud CLI, no exposure in extension
- No credentials stored in settings, logs, or webview

### Data in Transit
- HTTPS to Google BigQuery API (enforced by SDK)
- All requests authenticated (OAuth 2.0)

### Data at Rest
- Query history: Stored in VS Code globalState (encrypted by VS Code)
- Temp tables: Stored in GCP project (subject to GCP security policies)
- No local caching of query results

### Webview Security
- Content Security Policy (CSP): Nonce-based, no inline scripts
- HTML escaping: All user data sanitized before rendering
- Event delegation: No onclick handlers (safe from injection)

### SQL Injection Prevention (ORDER BY Hardening)
- **Column Name Escaping:** `sortColumn.replace(/\`/g, '\\`')` before SQL construction
- **Direction Validation:** Ensure sortDirection is strictly 'ASC' or 'DESC' (runtime check)
- **Query Pattern:** `SELECT * FROM \`project.dataset.table\` ORDER BY \`escaped_col\` ASC|DESC`
- **No Interpolation:** Column name never directly interpolated; always backtick-escaped

### Race Condition Protection (Multi-Panel Paging)
- **fetchSeq Counter:** Each `PanelSession` maintains sequence number, incremented per fetch
- **Stale Response Guard:** Response dropped if `seq !== session.fetchSeq` at update time
- **Benefit:** Prevents UI flicker when user rapidly pages/sorts across concurrent panels
- **Example:** User opens panel A, clicks page 2 → fetchSeq=1; opens panel B, clicks sort → A's page 2 response ignored if B's sort fetches first
