# Code Standards & Architecture Patterns

## File Organization

### Naming Convention
- **kebab-case** for all TypeScript files (e.g., `asset-explorer-provider.ts`)
- **Self-documenting names** — file purpose clear without reading content
- **Suffix conventions:**
  - `-provider.ts` — VS Code TreeDataProvider, HoverProvider, WebviewProvider
  - `-service.ts` — Business logic, reusable, singleton pattern
  - `-command.ts` — Command handler, invoked by VS Code commands

**Examples:**
```
asset-explorer-provider.ts  ✓ (not asset-explorer.ts or assetExplorer.ts)
bigquery-client.ts          ✓ (not bqClient.ts or BigQueryClient.ts)
auto-dry-run-service.ts     ✓ (not autoDryRun.ts)
```

### Directory Structure
```
src/
├── extension.ts           # Entry point (activate/deactivate)
├── commands/              # Command handlers
├── services/              # Business logic
├── providers/             # VS Code providers (TreeView, Hover, Webview)
└── utils/                 # Utility functions
```

**Rule:** Each service/provider/command = dedicated file (no file exceeds 350 lines)

## Architecture Patterns

### 1. Service Locator Pattern
Services are singletons initialized in extension.ts and passed to consumers.

```typescript
// extension.ts
const authService = new AuthService();
const bigQueryClient = new BigQueryClient(authService);
const autoRunService = new AutoDryRunService(bigQueryClient);

// Exported for test injection
export { authService, bigQueryClient, autoRunService };
```

**Benefit:** Centralized initialization, easy mocking for tests, dependency clarity.

### 2. Provider Pattern (VS Code)
Use native VS Code providers for UI components.

```typescript
// TreeDataProvider for asset explorer
class AssetExplorerProvider implements TreeDataProvider<AssetItem> {
  getTreeItem(element: AssetItem) { /* ... */ }
  getChildren(element?: AssetItem) { /* ... */ }
}

// HoverProvider for schema tooltips
class SchemaHoverProvider implements HoverProvider {
  provideHover(document, position, token) { /* ... */ }
}

// WebviewProvider for results panel
class QueryResultsProvider implements WebviewPanelSerializer {
  resolveWebviewPanel(webviewPanel, state, options) { /* ... */ }
}
```

**Benefit:** Integrates with VS Code native UI, theme-aware, performant.

### 3. Lazy Initialization
BigQuery client created on first use, not at extension startup.

```typescript
// auth-service.ts
private bigQueryClient: BigQuery | null = null;

async getClient() {
  if (!this.bigQueryClient) {
    this.bigQueryClient = new BigQuery({ /* ... */ });
  }
  return this.bigQueryClient;
}
```

**Benefit:** Faster extension activation, no auth needed if extension not used.

### 4. Command Handler Pattern
Commands extract input, call services, display output.

```typescript
// run-query-command.ts
export async function runQuery(context: ExtensionContext) {
  return async () => {
    try {
      const sql = getActiveEditorText();
      const result = await bigQueryClient.runQuery(sql);
      await queryResultsProvider.show(result);
    } catch (error) {
      vscode.window.showErrorMessage(error.message);
    }
  };
}
```

**Benefit:** Single responsibility, testable, reusable.

### 5. Caching Strategy
Implement TTL-based caching to reduce API calls.

```typescript
// bigquery-client.ts
private datasetCache: Map<string, CachedDataset[]> = new Map();
private cacheTimestamp: Map<string, number> = new Map();
private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async listDatasets(projectId: string) {
  const cached = this.datasetCache.get(projectId);
  const timestamp = this.cacheTimestamp.get(projectId) || 0;

  if (cached && Date.now() - timestamp < this.CACHE_TTL_MS) {
    return cached;
  }

  // Fetch from API, cache, return
}
```

**Benefit:** Reduces BigQuery API quota usage, improves perceived performance.

### 6. Async Error Handling
All async operations must handle errors gracefully.

```typescript
async runQuery(sql: string) {
  try {
    const result = await this.bigQueryClient.createQueryJob({ query: sql });
    return result;
  } catch (error) {
    if (error.code === 'INVALID_ARGUMENT') {
      throw new Error(`Invalid SQL: ${error.message}`);
    }
    if (error.code === 'PERMISSION_DENIED') {
      throw new Error('Permission denied. Check authentication.');
    }
    throw error;
  }
}
```

**Benefit:** User-friendly error messages, easier debugging.

## TypeScript Standards

### Type Safety
- **Strict mode enabled** in tsconfig.json
- Avoid `any` types — use specific types or generics
- Use unions for multi-type properties

```typescript
// ✓ Good
type QueryStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'ERROR';
interface QueryResult {
  rows: Array<Record<string, unknown>>;
  totalRows: number;
  jobId: string;
}

// ✗ Bad
type QueryStatus = any;
interface QueryResult {
  rows: any[];
  [key: string]: any;
}
```

### Naming Conventions
- **Classes:** PascalCase (e.g., `AuthService`, `BigQueryClient`)
- **Functions/Methods:** camelCase (e.g., `getTableSchema`, `runQuery`)
- **Constants:** UPPER_SNAKE_CASE (e.g., `CACHE_TTL_MS`, `MAX_RESULTS`)
- **Interfaces:** PascalCase with I prefix optional (e.g., `QueryOptions` or `IQueryOptions`)

```typescript
class BigQueryClient {
  private readonly MAX_RETRIES = 3;
  private readonly CACHE_TTL_MS = 86400000;

  async getTableSchema(projectId: string, datasetId: string, table: string) {
    // Implementation
  }
}
```

### Return Types
Explicitly declare return types for all functions.

```typescript
// ✓ Good
async function getTableMetadata(projectId: string): Promise<TableMetadata> {
  return { /* ... */ };
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024).toFixed(2)} KB`;
}

// ✗ Bad
async function getTableMetadata(projectId) {
  return { /* ... */ };
}

function formatBytes(bytes) {
  // ...
}
```

## Code Structure

### File Size Limits
- **Target:** Under 200 lines per file
- **Maximum:** 350 lines (split if exceeding)
- **Exception:** Complex providers may reach 250 lines with proper documentation

**Reason:** Easier to read, test, and maintain. LLM context efficiency.

### Module Exports
Each file exports only necessary types/functions.

```typescript
// auth-service.ts
export class AuthService {
  async getClient(): Promise<BigQuery> { /* ... */ }
}

export interface AuthConfig {
  keyFilePath?: string;
}

// ✗ Avoid exporting internals
// export const INTERNAL_CACHE = new Map();
```

### Imports Order
1. VS Code imports
2. @google-cloud imports
3. Local imports (services, providers, utils)
4. Types

```typescript
import * as vscode from 'vscode';
import { BigQuery } from '@google-cloud/bigquery';
import { AuthService } from './services/auth-service';
import { QueryOptions } from '../types';
```

## Error Handling Patterns

### User-Facing Errors
Always provide context and actionable messages.

```typescript
// ✓ Good
throw new Error('Query failed: Syntax error in WHERE clause. Check line 5.');

// ✗ Bad
throw new Error('Query failed');
throw new Error(JSON.stringify(error));
```

### Network Errors
Implement retry logic for transient failures.

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(100 * Math.pow(2, i)); // Exponential backoff
    }
  }
}
```

### BigQuery-Specific Errors
Handle common BigQuery API errors.

```typescript
if (error.code === 400) {
  // INVALID_ARGUMENT — invalid SQL or parameters
  throw new Error(`Invalid query: ${error.message}`);
}
if (error.code === 401) {
  // UNAUTHENTICATED — auth failed
  throw new Error('Authentication failed. Run: gcloud auth application-default login');
}
if (error.code === 403) {
  // PERMISSION_DENIED — insufficient permissions
  throw new Error(`Permission denied on ${error.message}. Check IAM roles.`);
}
if (error.code === 409) {
  // ALREADY_EXISTS — resource conflict
  throw new Error(`Resource already exists: ${error.message}`);
}
```

## Security Practices

### 1. Content Security Policy (CSP) in Webviews
All webview panels use nonce-based CSP to prevent XSS.

```typescript
// query-results-provider.ts
const nonce = getNonce(); // Random string per panel
const csp = `default-src 'none';
             script-src 'nonce-${nonce}';
             style-src 'nonce-${nonce}' 'unsafe-inline';`;

webviewPanel.webview.options = { enableScripts: true };
webviewPanel.webview.html = `
  <html>
  <head>
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <script nonce="${nonce}">
      // Safe to inline
    </script>
  </head>
  </html>
`;
```

**Benefit:** Prevents inline script injection attacks.

### 2. SQL Injection Prevention (ORDER BY)
When building ORDER BY queries with user-provided column names, always escape backticks and validate direction.

```typescript
// bigquery-client.ts: fetchResultPage()
const safeCol = sortColumn.replace(/`/g, '\\`');  // Escape backticks in column name
const safeDir = sortDirection === 'DESC' ? 'DESC' : 'ASC';  // Strict validation
const sql = `SELECT * FROM \`${dest.projectId}.${dest.datasetId}.${dest.tableId}\` ORDER BY \`${safeCol}\` ${safeDir}`;
await client.createQueryJob({ query: sql, useLegacySql: false });
```

**Key Points:**
- Always backtick-escape column names: `sortColumn.replace(/\`/g, '\\`')`
- Validate direction strictly (not via interpolation): `sortDirection === 'DESC' ? 'DESC' : 'ASC'`
- Use backticks around table and column references in final SQL
- Never interpolate direction; use ternary operator

**Benefit:** Prevents SQL injection via malicious column names or sort direction.

### 2. HTML Escaping
Always escape user data in HTML output.

```typescript
// ✓ Good — Escape special chars
const escapedValue = value.replace(/</g, '&lt;').replace(/>/g, '&gt;');
const html = `<td>${escapedValue}</td>`;

// ✗ Bad — Direct insertion
const html = `<td>${value}</td>`; // XSS vulnerability if value has tags
```

### 3. Race Condition Prevention (Concurrent Async Operations)
When multiple async operations can race (e.g., user rapidly paging between multiple result panels), use sequence counters to guard stale responses.

```typescript
// query-results-provider.ts: PanelSession
interface PanelSession {
  fetchSeq: number; // Incremented per fetch, prevents stale responses
  // ... other state
}

async fetchPage(session: PanelSession, ...): Promise<void> {
  const seq = ++session.fetchSeq; // Increment before async call
  try {
    const result = await this.bqClient.fetchResultPage(...);
    // Drop stale response if newer fetch started
    if (seq !== session.fetchSeq) return;
    // Safe to update UI with current result
    session.panel.webview.postMessage({ command: 'updateData', state: vs });
  } catch (err) {
    // Error handling
  }
}
```

**Benefit:** Prevents UI flicker from out-of-order async results in multi-panel scenarios.

### 4. Sensitive Data Handling
Never log or expose credentials.

```typescript
// ✓ Good
const client = new BigQuery({ keyFilename: keyPath });
// Do NOT log: console.log(keyPath);

// ✗ Bad
console.log('Auth config:', { keyFilePath, projectId }); // Exposes path
fs.readFileSync(keyPath).toString(); // Never convert to string in logs
```

### 5. API Key Management
- Service account keys: Load from file, never embed
- ADC: Managed by gcloud CLI, no exposure needed

```typescript
// ✓ Good
const keyPath = vscode.workspace
  .getConfiguration('bigqueryBrowser')
  .get<string>('keyFilePath');
const client = new BigQuery({ keyFilename: keyPath });

// ✗ Bad
const keyJson = JSON.parse(process.env.GCP_KEY); // Exposes in env
const client = new BigQuery({ credentials: keyJson });
```

## Testing Standards

### Unit Test Patterns
Test services in isolation with mocked BigQuery SDK.

```typescript
// __tests__/services/bigquery-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BigQueryClient } from '../../services/bigquery-client';

describe('BigQueryClient', () => {
  let client: BigQueryClient;

  beforeEach(() => {
    // Mock BigQuery SDK
    vi.mock('@google-cloud/bigquery');
    client = new BigQueryClient(mockAuthService);
  });

  it('should cache datasets for 24h', async () => {
    const result1 = await client.listDatasets('project-1');
    const result2 = await client.listDatasets('project-1');

    expect(result1).toBe(result2); // Same reference (cached)
  });

  it('should throw formatted error for invalid SQL', async () => {
    expect(() => client.runQuery('SELEC *')).rejects.toThrow(
      /Invalid SQL/
    );
  });
});
```

### Integration Test Patterns
Test provider/command interactions (use test editor).

```typescript
// __tests__/commands/run-query-command.test.ts
describe('runQuery command', () => {
  it('should execute query and show results panel', async () => {
    const editor = await openTestEditor('SELECT 1 as col');
    await vscode.commands.executeCommand('bigqueryBrowser.runQuery');

    // Verify results panel opened
    expect(vscode.window.activeTextEditor).toBeDefined();
  });
});
```

### Test Coverage Goals
- **Services:** 80%+ coverage (critical for reliability)
- **Providers:** 60%+ coverage (UI-heavy, harder to test)
- **Commands:** 70%+ coverage (entry points)

## Documentation in Code

### Function Documentation
Document complex logic, non-obvious behavior.

```typescript
/**
 * Fetch BigQuery results with optional sorting via temp table.
 *
 * If sortKey is provided, creates a temporary table with ORDER BY
 * to enable free re-paging using tabledata.list (avoids costly full scan).
 * Temp table cached by jobId for session duration.
 *
 * @param jobId - Query job ID
 * @param pageToken - Pagination token (from previous page)
 * @param sortKey - Optional column to sort by (e.g., "timestamp DESC")
 * @param limit - Rows per page
 * @returns Promise<Page<Record<string, unknown>>>
 * @throws Error if job not found or sorting fails
 */
async fetchResultPage(
  jobId: string,
  pageToken?: string,
  sortKey?: string,
  limit = 50
): Promise<Page<Record<string, unknown>>> {
  // Implementation
}
```

### Inline Comments
Use for non-obvious algorithm or BigQuery SDK quirk.

```typescript
// BigQuery's tabledata.list is free but returns arbitrary order.
// To enable sorting, we create a temp table with ORDER BY,
// then list results (still free).
if (sortKey) {
  const tempTable = await this.createSortedTable(jobId, sortKey);
  return this.listTableData(tempTable, pageToken, limit);
}
```

### Configuration Comments
Document why settings are bounded.

```typescript
"maxResults": {
  "type": "number",
  "default": 50,
  "minimum": 10,        // Avoid UI lag with tiny pages
  "maximum": 1000,      // Avoid memory issues with huge pages
  "description": "Rows per page in results webview"
}
```

## Performance Optimizations

### Lazy Loading
Defer non-critical initialization.

```typescript
// ✗ Bad — All providers loaded at startup
const explorer = new AssetExplorerProvider(client);
const metadata = new TableMetadataProvider(client);
const history = new QueryHistoryProvider(client);
// Total init time: 2s

// ✓ Good — Load on demand
let explorer: AssetExplorerProvider | null = null;
function getExplorer() {
  if (!explorer) explorer = new AssetExplorerProvider(client);
  return explorer;
}
// Startup time: 500ms
```

### Result Streaming
For large result sets, stream to user instead of buffering.

```typescript
// ✓ Good — Stream paginated results
const page1 = await client.getQueryResults(jobId, null, 50);
webview.show(page1);
// User clicks next page
const page2 = await client.getQueryResults(jobId, pageToken, 50);
webview.update(page2);

// ✗ Bad — Load entire result set
const allRows = [];
let pageToken: string | null = null;
do {
  const page = await client.getQueryResults(jobId, pageToken, 50);
  allRows.push(...page.rows);
  pageToken = page.nextPageToken;
} while (pageToken);
webview.show(allRows);
```

### Caching Effectiveness
Monitor cache hit rates; invalidate conservatively.

```typescript
// ✓ Effective — 24h TTL, high hit rate for typical workflows
private listDatasets(projectId: string): Promise<Dataset[]> {
  // Cached 24h, one API call per project per day
}

// ✗ Ineffective — 5min TTL, too aggressive invalidation
private getConfig(): Config {
  // Fetched 288 times per day (every 5 min)
}
```

## Configuration Management

### Reading Settings
Always use workspace/user scopes (never hardcode).

```typescript
// ✓ Good
const config = vscode.workspace.getConfiguration('bigqueryBrowser');
const projectId = config.get<string>('projectId');
const maxResults = config.get<number>('maxResults', 50); // Fallback default

// ✗ Bad
const projectId = 'my-project'; // Hardcoded
const maxResults = 50; // Should come from settings
```

### Listening to Config Changes
Re-initialize services when settings change.

```typescript
// extension.ts
vscode.workspace.onDidChangeConfiguration((event) => {
  if (event.affectsConfiguration('bigqueryBrowser')) {
    // Re-initialize auth client (in case key path changed)
    authService.resetClient();
    // Refresh UI
    explorer.refresh();
  }
});
```

## Debugging Guidelines

### Logging for Development
Use console logs strategically (remove before release).

```typescript
// Acceptable during development
console.log('[BigQueryClient] Fetching datasets for', projectId);
console.log('[QueryResult] Total rows:', result.totalRows);

// Never commit to repo
console.log(fullError); // Might expose sensitive data
console.log(credentials); // Never log auth
```

### Error Traces
Include stack traces for internal errors (not user errors).

```typescript
try {
  await bigQueryClient.runQuery(sql);
} catch (error) {
  if (isBigQueryError(error)) {
    // User error — friendly message
    vscode.window.showErrorMessage(`Query error: ${error.message}`);
  } else {
    // Internal error — include trace for debugging
    console.error('Unexpected error:', error);
    vscode.window.showErrorMessage(
      `Internal error: ${error.message}. Check console.`
    );
  }
}
```

## Summary of Best Practices

| Practice | Benefit |
|----------|---------|
| kebab-case file names | Self-documenting, consistent |
| Service locator pattern | Testable, clear dependencies |
| Lazy initialization | Fast startup, efficient resources |
| Caching with TTL | Reduced API calls, better UX |
| Type safety (strict mode) | Fewer bugs, better IDE support |
| Try-catch error handling | User-friendly, no silent failures |
| CSP + HTML escaping | Secure webviews, XSS prevention |
| Async/await pattern | Readable, proper error handling |
| Under 200 LOC per file | Better readability, maintainability |
| Documented functions | Easier onboarding, fewer bugs |
