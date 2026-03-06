# Tech Stack

## Core

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| **Language** | TypeScript | ^5.5.0 | Type safety, VS Code standard |
| **Extension API** | VS Code Extension API | ^1.85.0 | TreeView, WebView, commands, status bar |
| **BigQuery SDK** | @google-cloud/bigquery | ^7.9.0 | Official Node.js SDK, full API coverage |
| **UI Components** | @vscode/webview-ui-toolkit | ^1.4.0 | VS Code-themed webview components |
| **React** | react + react-dom | ^18.3.1 | Results webview rendering |
| **Bundler** | esbuild | ^0.24.0 | Fast builds, low overhead |
| **Testing** | vitest | ^2.1.0 | TypeScript-native, modern |
| **Packaging** | @vscode/vsce | ^3.0.0 | Official VS Code packager |

## UI Architecture

| Component | Type | Implementation | Rationale |
|-----------|------|-----------------|-----------|
| **Asset Explorer** | TreeView | Native TreeDataProvider | Lightweight, theme-consistent |
| **Query History** | TreeView | Native TreeDataProvider | Consistent with asset explorer |
| **SQL Editor** | Language | Custom language + grammar | VS Code built-in, no webview overhead |
| **Query Results** | Webview | React + HTML | Rich table, paging, sorting, export |
| **Table Metadata** | Webview | HTML | Schema, statistics, labels |
| **Status Bar** | StatusBar | 3 status items | Project, cost, auto-estimate indicators |
| **Hover Tooltips** | Hover Provider | Markdown table | Schema columns on hover |

## Authentication Flow

```
1. Check keyFilePath setting
   └─ If set → Load service account key JSON
2. Fall back to ADC (Application Default Credentials)
   └─ Use @google-cloud/bigquery built-in ADC support
3. Lazy init: BigQuery client created on first use
4. Auto-recreate if auth config changes
```

## Project Structure

```
src/
├── extension.ts                       # Entry point, activation, register all providers
├── commands/
│   ├── run-query-command.ts          # Execute SQL, show results panel (70 lines)
│   └── dry-run-command.ts            # Estimate query cost (48 lines)
├── services/
│   ├── auth-service.ts               # GCP auth, lazy client init (65 lines)
│   ├── bigquery-client.ts            # BQ API wrapper (305 lines)
│   ├── auto-dry-run-service.ts       # Real-time cost with debounce (137 lines)
│   └── query-history-service.ts      # Persistence, 24h auto-evict (80 lines)
├── providers/
│   ├── asset-explorer-provider.ts    # Projects/datasets/tables tree (171 lines)
│   ├── query-history-provider.ts     # History tree view (74 lines)
│   ├── query-results-provider.ts     # Results webview panel (162 lines)
│   ├── query-results-webview-html.ts # Results HTML + React render (158 lines)
│   ├── table-metadata-provider.ts    # Schema/metadata webview (154 lines)
│   ├── schema-hover-provider.ts      # Hover provider, 5min cache (81 lines)
│   └── status-bar-provider.ts        # Project/cost/estimate indicators (70 lines)
└── utils/
    └── sql-directive-parser.ts       # Parse @project/@region directives (30 lines)
```

## Runtime Dependencies

- **@google-cloud/bigquery** ^7.9.0 — BigQuery API wrapper, query execution, result streaming
- **@vscode/webview-ui-toolkit** ^1.4.0 — VS Code-themed UI in webview panels
- **react** ^18.3.1 — Results table webview component
- **react-dom** ^18.3.1 — React DOM rendering for webview

## Dev Dependencies

- **typescript** ^5.5.0 — Type checking
- **@types/vscode** ^1.85.0 — VS Code API types
- **@types/node** ^20.11.0 — Node.js types
- **@types/react** ^18.3.0 — React types
- **@types/react-dom** ^18.3.0 — React DOM types
- **esbuild** ^0.24.0 — Bundling and minification
- **vitest** ^2.1.0 — Unit testing
- **@vscode/vsce** ^3.0.0 — Packaging/publishing
