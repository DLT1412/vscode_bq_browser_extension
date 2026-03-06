# BigQuery Browser — Project Overview & PDR

## Project Identity

**Name:** BigQuery Browser
**Type:** VS Code Extension
**Version:** 0.1.0
**License:** MIT
**Publisher:** duclt

**One-liner:** Browse BigQuery assets, write SQL, execute queries, and view results — all inside VS Code.

## Target Audience

- **Data Analysts** — Explore BigQuery datasets/tables, write and run SQL queries
- **Data Engineers** — Develop and test BigQuery pipelines without switching tools
- **GCP Teams** — Teams already using BigQuery with VS Code as primary editor

## Key Capabilities

1. **Asset Browsing** — Tree view of GCP projects, datasets, and tables with filtering
2. **SQL Editor** — BigQuery SQL syntax highlighting and editor integration
3. **Query Execution** — Run queries with results in rich paginated webview
4. **Cost Estimation** — Dry-run queries, real-time auto-cost estimation while typing
5. **Results Management** — Paging, sorting, filtering, column visibility, export (CSV/JSON/TSV), clipboard
6. **Query History** — Persistent 24h history, re-run with result re-view
7. **Schema Discovery** — Hover tooltips on table refs, table metadata panel with SQL view for views
8. **Per-Query Overrides** — SQL directives for project and location per query
9. **Configuration UI** — Guided walkthrough (8 steps) for auth, projects, region, cost limit
10. **Free Data Preview** — Preview table data using free `tabledata.list` API (zero cost)

## Success Metrics

- **Usability:** Users can browse datasets and run queries within 5 minutes of install
- **Performance:** Results webview renders <500ms for typical pages
- **Cost Awareness:** Auto dry-run prevents accidental expensive queries
- **Retention:** 24h query history enables iterative development without re-typing

## Tech Stack (Summary)

| Layer | Technology |
|-------|-----------|
| **Language** | TypeScript 5.5.0 |
| **API** | VS Code Extension API (v1.85+) |
| **BigQuery** | @google-cloud/bigquery 7.9.0 |
| **UI** | Native TreeView + Webview + React 18.3.1 |
| **Bundler** | esbuild 0.24.0 |
| **Testing** | vitest 2.1.0 |

## Architecture (3-Layer)

```
┌─────────────────────────────────────────────────────────┐
│  VS Code UI Layer                                       │
│  (TreeView, Commands, Status Bar, Hover, Webview)      │
├─────────────────────────────────────────────────────────┤
│  Provider Layer (7 providers, ~900 lines)               │
│  • AssetExplorerProvider (projects/datasets/tables)     │
│  • QueryHistoryProvider (browsable history)             │
│  • QueryResultsProvider (paginated webview results)     │
│  • TableMetadataProvider (schema/stats webview)         │
│  • SchemaHoverProvider (column hover tooltips)          │
│  • StatusBarProvider (indicators)                       │
├─────────────────────────────────────────────────────────┤
│  Service Layer (4 services, ~667 lines)                 │
│  • AuthService (GCP auth, lazy client init)             │
│  • BigQueryClient (BQ API wrapper, 305 lines)           │
│  • AutoDryRunService (1.5s debounce cost estimate)      │
│  • QueryHistoryService (persistence, 24h auto-evict)    │
├─────────────────────────────────────────────────────────┤
│  @google-cloud/bigquery SDK (BigQuery API)              │
└─────────────────────────────────────────────────────────┘
```

## Current Feature Set (MVP)

- [x] Authentication (ADC, service account key)
- [x] Asset explorer (browse projects/datasets/tables)
- [x] SQL editor with BigQuery syntax highlighting
- [x] Query execution and result display (separate tab per query/preview)
- [x] Results paging (free via tabledata.list)
- [x] Results sorting (via ORDER BY with cached temp table)
- [x] Results filtering (client-side in webview)
- [x] Results export (CSV, JSON, TSV) respecting visible columns
- [x] Data preview (zero-cost via `tabledata.list` API, not SELECT *)
- [x] Table metadata (schema, row count, size, partitioning, labels)
- [x] View SQL viewer (for BigQuery views)
- [x] Dry-run (cost estimation before query)
- [x] Auto dry-run (real-time cost while typing)
- [x] Schema hover (columns on table reference hover)
- [x] Query history (24h retention, re-run with result re-view)
- [x] SQL directives (@project, @region per-query overrides)
- [x] Status bar indicators (project, cost, auto-estimate)
- [x] Explorer filtering (filter dataset/table names)
- [x] Column visibility toggle (show/hide columns, persists across paging/sorting)
- [x] Collapsible SQL panel in results (read-only with Copy & Open buttons)
- [x] Query progress monitoring (stage progress with job cancellation)
- [x] Cost safety limit (maximumBytesBilled setting, default 200 GB)
- [x] Extension walkthrough (8-step guided setup)

## Functional Requirements (Delivered)

| Requirement | Status | Implementation |
|-------------|--------|-----------------|
| Browse GCP projects, datasets, tables | ✓ | AssetExplorerProvider with TreeView |
| Execute BigQuery SQL with progress | ✓ | RunQueryCommand, BigQueryClient (polls job metadata, cancellable) |
| Display paginated results in separate tabs | ✓ | QueryResultsProvider (multi-panel, PanelSession per query) |
| Column visibility with persistence | ✓ | Column dropdown; selectedFields persist across paging/sorting |
| Display query SQL in results | ✓ | Collapsible SQL panel with Copy + Open in Editor buttons |
| Estimate query cost | ✓ | DryRunCommand, AutoDryRunService |
| Navigate large result sets | ✓ | Paging via tabledata.list (free), pagination |
| Sort results by column | ✓ | ORDER BY with backtick-escaped column names (SQL injection hardened) |
| Filter results client-side | ✓ | HTML table filtering in webview |
| Export to CSV/JSON/TSV | ✓ | Results webview export buttons (respects visible columns) |
| View table schema | ✓ | TableMetadataProvider + hover with search box |
| View view SQL | ✓ | TableMetadataProvider "View SQL" tab with Copy button |
| Persist query history | ✓ | QueryHistoryService (globalState, stable identity by timestamp+sql) |
| Provide authentication | ✓ | AuthService (ADC + service key) |
| Per-query project/location | ✓ | SQL directive parser |
| Cost safety limit | ✓ | maximumBytesBilled config (0-disabled, default 200GB) |
| Guided setup | ✓ | 8-step walkthrough in package.json |

## Non-Functional Requirements (Delivered)

| Requirement | Status | Implementation |
|-------------|--------|-----------------|
| Launch performance | ✓ | Lazy initialization, no startup delay |
| Results rendering | ✓ | React webview, <500ms typical |
| Memory footprint | ✓ | Native TreeView (no heavy UI libs) |
| Security (CSP) | ✓ | Nonce-based webview CSP |
| Query cost awareness | ✓ | Dry-run + auto dry-run with debounce |
| History cleanup | ✓ | 24h auto-eviction, configurable limit |
| API efficiency | ✓ | Free paging, sorted temp table caching |

## Known Limitations

1. **Temp Tables** — Sorted results create temporary cached tables in execution project (cleaned up after 7 days by BigQuery auto-cleanup)
2. **History Storage** — 24-hour limit, auto-eviction; local to VS Code globalState
3. **Large Result Sets** — Paging handles arbitrary sizes; export is client-side buffered
4. **Preview Cache** — Table metadata/schema cached 5min-24h per cache type
5. **Preview Data** — Not available for BigQuery views (only physical tables via `tabledata.list`)
6. **Paging in Preview** — Pagination controls hidden for preview data (read-only, no destination table)
7. **Large Datasets** — Datasets with >1000 tables show warning; pagination (500 per page) recommended

## Future Roadmap (Candidate Features)

**Phase 2 (Post-MVP):**
- [ ] Saved queries (pinned, starred, tagged)
- [ ] Query charts/visualization (line, bar, pie)
- [ ] Batch query runner (multi-file execution)
- [ ] Column statistics (cardinality, null count, type preview)
- [ ] Query performance profiling (elapsed time, bytes scanned per step)
- [ ] Dark mode refinements for results webview
- [ ] Keyboard navigation for tree views
- [ ] Query templates with placeholders

**Phase 3 (Long-term):**
- [ ] Scheduled query management
- [ ] Dataset/table creation wizard
- [ ] Data quality rules/checks
- [ ] Integration with BigQuery notebooks
- [ ] Collaborative query sharing

## Development Status

- **Current Phase:** MVP — All core features implemented and tested
- **Test Coverage:** Unit tests for services and parsers via vitest
- **Build Status:** esbuild bundling, typechecking clean
- **Quality Gates:** Linting + type checking before package

## Dependencies & Compatibility

- **VS Code:** ^1.85.0
- **Node:** ^18.0.0 (esbuild, packaging)
- **Google Cloud SDK:** @google-cloud/bigquery ^7.9.0 (included)
- **Authentication:** GCP Application Default Credentials OR service account JSON key
- **BigQuery API:** Must be enabled on GCP project

## Success Criteria (MVP Complete)

1. Extension activates without errors ✓
2. Asset explorer loads datasets/tables within 3s ✓
3. Query execution and result display works end-to-end ✓
4. Cost estimation prevents expensive queries ✓
5. Results can be paged, sorted, filtered, exported ✓
6. Query history persists and reloads ✓
7. Authentication works via ADC and service key ✓
8. No major performance regressions ✓

## Maintenance & Support

- **Code Review:** TypeScript strict mode, vitest coverage
- **Documentation:** README (features + setup), inline comments for complex logic
- **Versioning:** Semantic versioning, changelog in package.json
- **Releases:** Manual via vsce, published to VS Code Marketplace

## Contact & Contribution

- **Author:** duclt
- **License:** MIT
- **Issue Tracking:** GitHub issues (via VS Code Marketplace)
