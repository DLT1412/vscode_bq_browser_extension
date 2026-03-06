# Project Roadmap

## Current Status: MVP Complete

**Phase:** 0.1.0 — All core features implemented and tested
**Release Date:** Current
**Development Status:** Stable, ready for production use

All major features for browsing BigQuery, writing SQL, executing queries, and viewing results are complete and functional.

## Phase 1: MVP (Current — v0.1.0)

**Status:** ✓ Complete

### Core Features Delivered
- [x] Asset explorer (projects → datasets → tables)
- [x] SQL editor with BigQuery syntax highlighting
- [x] Query execution with paginated results webview
- [x] Dry-run (cost estimation before execution)
- [x] Auto dry-run (real-time cost while typing)
- [x] Results paging (free via tabledata.list)
- [x] Results sorting (via ORDER BY with temp table cache)
- [x] Results filtering (client-side in webview)
- [x] Results export (CSV, JSON, TSV, clipboard)
- [x] Table metadata (schema, row count, size, partitioning)
- [x] Table preview (quick data peek)
- [x] Schema hover (columns on reference hover)
- [x] Query history (24h retention, re-run with results re-view)
- [x] SQL directives (@project, @region per-query overrides)
- [x] Authentication (ADC, service account key)
- [x] Status bar indicators (project, cost, auto-estimate)
- [x] Explorer filtering (filter by dataset/table name)

### Success Metrics Achieved
- Extension activates without errors ✓
- Asset explorer loads in <3s ✓
- Query execution end-to-end works ✓
- Cost estimation prevents expensive queries ✓
- Results can be paged, sorted, filtered, exported ✓
- Query history persists across sessions ✓
- Authentication via ADC and service key works ✓
- No major performance regressions ✓

## Phase 2: Enhanced Features (Q2 2026 — Candidate)

**Status:** Planned
**Priority:** Medium
**Effort:** 4-6 weeks

### Query Management
- [ ] **Saved Queries** — Pin, star, tag, organize queries by project
- [ ] **Query Templates** — Reusable SQL with placeholders (e.g., `{{table_name}}`)
- [ ] **Query Bookmarks** — Quick access to frequently run queries
- [ ] **Search Queries** — Full-text search across history + saved queries

**Why:** Users often run similar queries on different tables/dates. Templates reduce manual editing and typos.

### Visualization & Analysis
- [ ] **Query Results Charts** — Line, bar, pie, scatter plots
- [ ] **Column Statistics** — Cardinality, null count, min/max for preview tables
- [ ] **Query Performance Metrics** — Elapsed time, bytes scanned, slots used per stage
- [ ] **Query Profiling** — Breakdown of computation time by step

**Why:** Visualizations help spot patterns quickly. Performance metrics help optimize queries.

### Batch Operations
- [ ] **Batch Query Runner** — Execute multiple .bqsql files in sequence
- [ ] **Query Result Comparison** — Side-by-side diff of two query results
- [ ] **Schedule Queries** — Run queries on schedule (via BigQuery scheduled queries)

**Why:** Data teams often need to run multiple related queries. Scheduling enables automated reporting.

### Developer Experience
- [ ] **Keyboard Navigation** — Arrow keys in tree views, Vim keybindings option
- [ ] **Auto-complete for Table Names** — IntelliSense in SQL editor
- [ ] **Column Type Hints** — Show column types in SQL editor
- [ ] **Query Linting** — Warn about deprecated functions, style issues

**Why:** Reduces time-to-productivity. Catches errors earlier.

## Phase 3: Advanced Features (Q3-Q4 2026 — Candidate)

**Status:** Planned
**Priority:** Low-Medium
**Effort:** 6-10 weeks

### Data Quality & Governance
- [ ] **Data Lineage** — Trace column origins across tables
- [ ] **Data Quality Rules** — Custom checks (row counts, nulls, duplicates)
- [ ] **Dataset/Table Tagging** — Manage tags for governance
- [ ] **Access Audit** — View who accessed table, when

**Why:** Data teams need to understand data dependencies and ensure quality.

### Collaboration & Sharing
- [ ] **Share Query Results** — Generate shareable links to results
- [ ] **Comments on Queries** — Annotate queries with team notes
- [ ] **Query Suggestions** — Recommend similar queries based on table access patterns
- [ ] **Team Settings** — Shared query library, default settings per team

**Why:** Enables collaboration across data teams without leaving VS Code.

### BigQuery-Specific Features
- [ ] **BigQuery ML Integration** — Create/train models directly from extension
- [ ] **Parameterized Queries** — Use `?` or `@param` syntax for safety
- [ ] **BigQuery Notebooks** — Link to/preview BigQuery notebooks
- [ ] **GIS Visualization** — Map visualization for GEOGRAPHY queries

**Why:** BigQuery-specific workflows become faster and more accessible.

### Performance & Optimization
- [ ] **Query Cost Optimization** — Suggest cheaper alternative SQL
- [ ] **Materialized View Suggestions** — Recommend views for frequently filtered tables
- [ ] **Partitioning Advisor** — Suggest partition keys for large tables
- [ ] **Slot Reservation Manager** — Monitor and manage query slots

**Why:** Helps teams control BigQuery costs (largest concern for data teams).

## Phase 4: Long-Term Vision (2027+)

**Status:** Aspirational
**Priority:** Low
**Effort:** Ongoing

### ML & AI Integration
- [ ] **Query Copilot** — AI-powered SQL suggestion from natural language
- [ ] **Anomaly Detection** — Alert on unusual query results
- [ ] **Query Optimization AI** — Automatic query rewriting for performance
- [ ] **Data Profiling AI** — Automatic data quality assessment

### Ecosystem Integration
- [ ] **Looker Integration** — Link to/create Looker looks from queries
- [ ] **Dataflow Integration** — Trigger Dataflow jobs from results
- [ ] **Cloud Functions Integration** — Deploy UDFs directly
- [ ] **Marketplace Integration** — Access BigQuery Marketplace datasets

### Mobile/Web
- [ ] **VS Code Web Extension** — Run in VS Code Web (github.dev)
- [ ] **Mobile App** — Lightweight companion app for query browsing
- [ ] **Web Dashboard** — Shareable team query dashboard

## Dependency & Release Planning

### Q2 2026 (Phase 2)
- Requires: TypeScript 5.5, React 18.3, Vitest 2.1 (all current)
- Breaking Changes: None expected
- Migration Path: Automatic (backward compatible)
- Release: v0.2.0 → v0.5.0 (multiple point releases)

### Q3-Q4 2026 (Phase 3)
- May require: Additional npm packages (data lineage libs, visualization libs)
- Breaking Changes: None expected (additive features only)
- Release: v0.6.0 → v0.9.0

### 2027+ (Phase 4)
- May require: Different bundling strategy (larger size)
- Breaking Changes: Possible (if UI/API redesign needed)
- Release: v1.0.0+

## Known Limitations & Constraints

### Current Limitations
1. **Temp Tables** — Sorted results create persistent temp tables (cleaned by BigQuery after 7 days)
2. **History Storage** — 24h limit, local to VS Code globalState
3. **Large Exports** — CSV/JSON export buffered in memory (may slow for >100k rows)
4. **Real-time Sync** — No auto-refresh if dataset changes externally
5. **Filtered Paging** — Filter is client-side only (can't filter on server)

### Constraints
- **VS Code API** — Limited to v1.85+ (older versions not supported)
- **BigQuery API** — Follows official SDK capabilities
- **Performance** — Must keep startup <1s, paging <500ms
- **Size** — Bundled extension must stay <5MB (currently ~1.2MB)
- **Security** — CSP, no eval(), strict data handling

## Community & Contribution

### Feedback Channels
- GitHub Issues — Report bugs, request features
- VS Code Marketplace Reviews — User feedback
- Discussion Forum — Feature discussions, design feedback

### Contribution Guidelines
- Fork repository, create feature branch
- Follow code standards (kebab-case, TypeScript strict, <200 LOC/file)
- Add tests for new features (target 80% coverage)
- Update docs in `./docs` folder
- Create PR with description of changes

### Contribution Areas (Help Wanted)
- [ ] Documentation improvements (README, guides, tutorials)
- [ ] Test coverage expansion (currently ~60%, target 80%)
- [ ] Performance profiling (identify bottlenecks)
- [ ] UX/UI feedback (usability testing, design suggestions)
- [ ] Language/region support (RTL, internationalization)

## Version Numbering

**Semantic Versioning:** MAJOR.MINOR.PATCH

- **MAJOR** — Breaking changes (0→1 at production-ready, future major features)
- **MINOR** — New features (0.1 → 0.2 → ... → 0.9 → 1.0)
- **PATCH** — Bug fixes, documentation (0.1.0 → 0.1.1)

**Timeline:**
- v0.1.0 — Current (MVP, all core features)
- v0.2.0 → v0.5.0 — Phase 2 features (Q2 2026)
- v0.6.0 → v0.9.0 — Phase 3 features (Q3-Q4 2026)
- v1.0.0 — Production release (Q1 2027, post-Phase 2 stability)

## Success Criteria by Phase

### Phase 2 Success
- Saved queries used by 80% of active users
- Visualization feature adopted for 40% of queries
- Batch runner eliminates 20% of manual multi-query workflows
- 50k+ downloads on VS Code Marketplace

### Phase 3 Success
- Data lineage trusted for compliance audits
- Cost optimization suggestions save users 15% on BigQuery spend
- Collaboration features enable cross-team workflows
- 100k+ downloads on VS Code Marketplace

### Phase 4 Success (Long-term)
- Copilot adoption reaches 60% of power users
- Extension becomes standard tool in data teams
- Official Google BigQuery integration/recommendation
- 500k+ downloads on VS Code Marketplace

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| BigQuery API breaking changes | Low | Medium | Monitor SDK updates, test on new versions |
| User data privacy concerns | Medium | High | Transparent data handling, no telemetry |
| Performance degradation (large datasets) | Medium | Medium | Implement lazy loading, pagination limits |
| VS Code API changes | Low | Medium | Pin extension to v1.85+, test on new releases |
| Team capacity constraints | Medium | Medium | Prioritize Phase 2 features, defer Phase 3 |
| Security vulnerabilities | Low | High | Regular dependency updates, security audit |

## Maintenance Commitments

### Security Updates
- Critical vulnerabilities: Fixed within 48 hours
- High severity: Fixed within 1 week
- Medium severity: Fixed within 2 weeks

### Dependency Updates
- Monthly review of npm dependencies
- Update minor/patch versions on schedule
- Test all updates before release

### Bug Fixes
- Critical bugs: Fixed immediately
- High priority: Fixed within 1 week
- Normal priority: Fixed within 2 weeks

### Documentation
- Update README with new features
- Keep docs in sync with code changes
- Maintain changelog in package.json

## Glossary

- **ADC** — Application Default Credentials (gcloud auth)
- **BigQuery SDK** — @google-cloud/bigquery npm package
- **Temp Table** — Temporary table created for sorted result caching
- **Dry-Run** — Query cost estimation without execution
- **TTL** — Time-To-Live (cache expiration period)
- **CSV/JSON/TSV** — Export formats for query results
- **CSP** — Content Security Policy (webview security)
- **Materialized View** — Precomputed query results for performance
- **Slots** — BigQuery capacity reservation for query execution
