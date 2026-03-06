# Recent Feature Updates (March 2026)

## Overview
Documentation of recent changes to results display, security, history management, and commands.

## Multi-Panel Results Display

### Change
Each query/preview now opens in a **separate webview panel** with a unique tab, instead of reusing a single panel.

### Implementation
- **PanelSession:** Each panel maintains its own session with viewState, destTable cache, sortedDestCache, and fetchSeq
- **Tab Titles:** Descriptive, auto-generated from SQL (e.g., "SELECT · my_table") via `deriveQueryTitle(sql)`
- **Separate Instances:** Multiple queries can have results visible simultaneously
- **Session Isolation:** Each panel manages its own paging, sorting, and column visibility

### User Benefit
- Compare results side-by-side
- Navigate back to previous results without re-running
- Cleaner workspace organization

## Collapsible SQL Panel in Results

### Change
Results webview now displays the executed SQL in a **collapsible read-only panel** with quick actions.

### Implementation
- **Display:** Read-only textarea (no editing)
- **Actions:**
  - "Copy SQL" button → copies to clipboard
  - "Open in Editor" button → opens in new editor tab
- **State:** Collapsible (user can hide to save vertical space)
- **Content:** Displays original SQL from query execution

### User Benefit
- Quickly reference what query was run
- Copy SQL for modification without re-typing
- Easily open for editing in full editor

## Column Visibility Persistence

### Change
Column visibility selections now **persist across paging and sorting operations**.

### Implementation
- **Storage:** Selected columns stored in `ResultViewState.columns` per panel
- **API Integration:** Pass `selectedFields` array directly to BigQuery `tabledata.list` API
- **Scope:** Per-panel (each result panel tracks its own visibility state)
- **Behavior:** Resetting sort clears column selection if user changes sort

### User Benefit
- No need to re-select visible columns after paging
- Reduces visual clutter in wide result sets
- Directly passed to API, minimizes data transfer

## Security Hardening

### SQL Injection Prevention (ORDER BY)

**Problem:** User-provided column names in ORDER BY queries could be exploited.

**Solution:**
```typescript
const safeCol = sortColumn.replace(/`/g, '\\`');  // Escape backticks
const safeDir = sortDirection === 'DESC' ? 'DESC' : 'ASC';  // Strict validation
const sql = `SELECT * FROM \`${dest.projectId}.${dest.datasetId}.${dest.tableId}\` ORDER BY \`${safeCol}\` ${safeDir}`;
```

**Safeguards:**
1. Backtick-escape column names (prevents SQL break-out)
2. Strict validation of sort direction (no interpolation)
3. Validated against schema before use

### Race Condition Guard (fetchSeq)

**Problem:** Rapidly paging/sorting could cause UI to show stale data if responses arrive out-of-order.

**Solution:**
```typescript
const seq = ++session.fetchSeq;  // Increment before fetch
const result = await bigQueryClient.fetchResultPage(...);
if (seq !== session.fetchSeq) return;  // Drop if stale
```

**Benefit:** Ensures only the most recent fetch result is displayed.

## History Entry Management

### Changes

#### Stable Identity (Not Array Index)
History entries are now identified by **stable key: (timestamp + sql)** instead of array position.

**Benefit:**
- Delete/rename operations work reliably across sessions
- Entries remain valid even if history is reordered
- No broken references if history is cleared/reloaded

#### New Methods
- `deleteEntry(timestamp: string, sql: string)` — Safe deletion by identity
- `renameEntry(timestamp: string, sql: string, name: string)` — Custom naming

#### Entry Naming
History entries can now have optional custom names (stored in `entry.name`).

**User Benefit:**
- Rename queries for better organization (e.g., "Bug fix query" instead of SQL snippet)
- TreeView displays custom name if set, otherwise SQL preview

## Commands (23 Total)

### New Commands
- `bigqueryBrowser.deleteHistoryEntry` — Remove query from history
- `bigqueryBrowser.copyHistorySql` — Copy query SQL to clipboard

### Removed Commands
- `bigqueryBrowser.selectProject` — Redundant; replaced by unified `setDefaultProject`

### Updated Commands
- `setDefaultProject` — Now unified (formerly split into setDefaultProject + selectProject)

### Related Commands (Existing)
- `renameHistoryEntry` — Rename history entry with custom name
- `filterHistory` / `clearHistoryFilter` — Filter/clear history search

## Utility Function: deriveQueryTitle

**Location:** `src/utils/sql-title-helper.ts`

**Purpose:** Generate short, readable tab titles from SQL statements.

**Signature:**
```typescript
export function deriveQueryTitle(sql: string): string
```

**Examples:**
- `SELECT * FROM users` → "SELECT · users"
- `INSERT INTO logs VALUES (...)` → "INSERT · logs"
- `WITH temp AS (...) SELECT * FROM temp` → "WITH"
- `UPDATE projects SET active=true` → "UPDATE · projects"

**Logic:**
1. Extract SQL operation (SELECT, INSERT, UPDATE, DELETE, CREATE, MERGE, WITH)
2. Extract table name from FROM/INTO/UPDATE/JOIN clause
3. Combine as "OPERATION · table_name"
4. Truncate to 40 characters if needed

**Usage:** Called in `QueryResultsProvider.showResults()` to set webview panel title.

## Status Bar Fix

### Change
Fixed ghost command in status bar: `selectProject` → `setDefaultProject`

### Issue
Status bar project indicator was calling removed `selectProject` command, causing "Command not found" error.

### Solution
Updated status bar click handler to call `setDefaultProject` (the unified command).

## Impact Summary

| Area | Change | User Impact |
|------|--------|-------------|
| Results | Multi-panel tabs | Compare queries side-by-side |
| Results | SQL panel + Copy/Open | Quick SQL access without re-running |
| Results | Column visibility persists | Less re-selection, cleaner UX |
| Security | SQL injection hardening | Safer sorting on untrusted table names |
| Concurrency | fetchSeq guard | Eliminated UI flicker in multi-panel scenarios |
| History | Stable identity (timestamp+sql) | Safe delete/rename operations |
| History | Custom naming | Better query organization |
| Commands | Added 2, removed 1 | Net +1 command (23 total) |
| Status Bar | Fixed setDefaultProject call | Project selection now works |

## Testing Recommendations

- [ ] Open multiple queries; verify each has separate panel
- [ ] Run query; verify tab title is descriptive
- [ ] Expand SQL panel; copy and verify clipboard content
- [ ] Verify column visibility persists after paging
- [ ] Rapidly sort/page; ensure no stale data displayed
- [ ] Delete history entry; verify safe removal
- [ ] Rename history entry; verify across reload
- [ ] Click status bar project indicator; verify dialog opens
