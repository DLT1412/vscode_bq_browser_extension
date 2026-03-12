# Changelog

## [0.2.0] - 2026-03-12

### Added
- Comprehensive unit test suite (172 tests) with vitest
- Clear Filter buttons in Explorer and History sidebar headers (appear when filter is active)
- Eager table loading when filtering Explorer — filter results are immediate even before background prefetch completes

### Fixed
- Explorer filter missed tables in datasets not yet prefetched (partial cache race condition)
- Clear Explorer Filter and Clear History Filter commands were inaccessible from sidebar UI
- Destination table metadata fetch errors now logged to console instead of crashing query results

### Changed
- Increased max table fetch per dataset from 1,000 to 10,000

## [0.1.1] - 2025-12-01

### Added
- File-backed asset cache with background table prefetch

## [0.1.0] - 2025-11-30

### Added
- Initial release of BigQuery Browser VS Code extension
- Asset Explorer with project/dataset/table browsing
- SQL Editor with BigQuery syntax highlighting
- Query execution with paginated results
- Auto dry-run with inline error diagnostics
- Query history with 24h retention
- Table metadata and schema viewer
- Schema hover for backtick-quoted table references
- SQL directives (`@project`, `@region`)
- Export to CSV/JSON/clipboard
- Column sorting via temp table queries
