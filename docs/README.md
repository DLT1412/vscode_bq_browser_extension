# BigQuery Browser Documentation Index

Welcome to the BigQuery Browser documentation! This is your complete guide to using, developing, and maintaining the extension.

## Quick Navigation

### For Users
Start here if you're using BigQuery Browser to explore BigQuery and run queries.

- **[README.md](../README.md)** — Feature overview, installation, keyboard shortcuts, settings
  - All 22 commands documented (run, dry-run, explorer, history, config, filtering)
  - All 8 settings with defaults and ranges (including maximumBytesBilledGb)
  - SQL directives for per-query overrides
  - Export formats and capabilities (respects column visibility)

### For Developers
Start here if you're contributing code or maintaining the extension.

1. **[Code Standards](./code-standards.md)** — How we write code
   - File naming conventions (kebab-case)
   - Architecture patterns (6 core patterns)
   - TypeScript standards (strict mode, naming)
   - Error handling and security practices
   - Testing guidelines
   - **Read this first when contributing**

2. **[Codebase Summary](./codebase-summary.md)** — Navigate the code
   - Complete file-by-file reference (15 files, 1,837 LOC)
   - Layer breakdown (Entry point, Commands, Services, Providers)
   - Data flow diagrams
   - Caching strategy
   - Performance characteristics
   - **Read this to understand file structure**

3. **[System Architecture](./system-architecture.md)** — How it all works together
   - 3-layer architecture (UI → Services → SDK)
   - Detailed data flows (query execution, auto dry-run, history, caching)
   - Component interactions
   - Authentication flow
   - Webview communication protocol
   - Security architecture
   - **Read this to understand system design**

### For Designers & Product Managers
Start here for UI/UX decisions and product planning.

- **[Design Guidelines](./design-guidelines.md)** — UI/UX standards
  - VS Code theme integration
  - Color schemes (light/dark)
  - TreeView and Status Bar design
  - Webview layouts (results, metadata)
  - Keyboard navigation
  - Accessibility (WCAG 2.1 AA)
  - Animation and motion guidelines
  - **Read this before designing new features**

- **[Feature Updates](./feature-updates.md)** — Recent changes (March 2026)
  - Multi-panel results display
  - Collapsible SQL panel in results
  - Column visibility persistence
  - Security hardening (SQL injection, race conditions)
  - History management improvements
  - Command additions/removals
  - **Read this to understand recent improvements**

- **[Project Roadmap](./project-roadmap.md)** — What's coming next
  - Phase 1 (MVP, current): All core features delivered
  - Phase 2 (Q2 2026): Saved queries, charts, batch runner
  - Phase 3 (Q3-Q4 2026): Data lineage, collaboration, optimization
  - Phase 4 (2027+): Copilot, ecosystem integration
  - Success criteria and risk assessment
  - **Read this to understand future direction**

### For Project Managers
Start here for project scope and planning.

- **[Project Overview & PDR](./project-overview-pdr.md)** — Project definition
  - Project identity and target audience
  - Key capabilities summary
  - 3-layer architecture overview
  - All functional & non-functional requirements
  - Success metrics and criteria
  - Maintenance commitments
  - **Read this to understand project scope**

- **[Tech Stack](./tech-stack.md)** — Technology choices
  - Core technologies and versions
  - UI architecture (TreeView, Webview, StatusBar)
  - Runtime and dev dependencies
  - **Read this to understand tech choices**

## Documentation by Topic

### Getting Started
1. **Setup:** [README.md](../README.md) — Installation and authentication via 8-step walkthrough
2. **Features:** [README.md](../README.md) — All 22 commands and capabilities
3. **Settings:** [README.md](../README.md) — Configuration options (8 total)
4. **SQL Directives:** [README.md](../README.md) — Per-query overrides (@project, @region)

### Development
1. **Code Standards:** [code-standards.md](./code-standards.md) — Patterns and practices
2. **Architecture:** [system-architecture.md](./system-architecture.md) — System design
3. **Codebase:** [codebase-summary.md](./codebase-summary.md) — File reference
4. **Testing:** [code-standards.md](./code-standards.md#testing-standards) — Test guidelines

### Design & UX
1. **UI Design:** [design-guidelines.md](./design-guidelines.md) — Color, typography, layout
2. **Interaction:** [design-guidelines.md](./design-guidelines.md#interaction-patterns) — Keyboard, hover, async
3. **Accessibility:** [design-guidelines.md](./design-guidelines.md#accessibility-wcag-21-aa) — WCAG compliance
4. **Components:** [design-guidelines.md](./design-guidelines.md) — TreeView, StatusBar, Webview
5. **Walkthrough:** [design-guidelines.md](./design-guidelines.md#extension-walkthrough) — 8-step setup flow

### Architecture & Design
1. **High-Level:** [system-architecture.md](./system-architecture.md#high-level-architecture) — 3-layer diagram
2. **Data Flows:** [system-architecture.md](./system-architecture.md#data-flow-diagrams) — Query execution, caching
3. **Security:** [system-architecture.md](./system-architecture.md#security-architecture) — Auth, data, webview CSP
4. **Performance:** [codebase-summary.md](./codebase-summary.md#caching-strategy) — Caching and optimization

### Planning & Roadmap
1. **Current Status:** [project-overview-pdr.md](./project-overview-pdr.md#current-feature-set-mvp) — MVP complete
2. **Future Features:** [project-roadmap.md](./project-roadmap.md) — Phases 2-4
3. **Success Metrics:** [project-overview-pdr.md](./project-overview-pdr.md#success-metrics) — How we measure
4. **Risks:** [project-roadmap.md](./project-roadmap.md#risk-assessment) — Potential issues

## Document Sizes

| Document | Lines | Purpose | Last Updated |
|----------|-------|---------|--------------|
| README.md | 125+ | User guide | 2026-03-05 |
| tech-stack.md | 80 | Technology reference | 2026-03-05 |
| project-overview-pdr.md | 201 | Project definition | 2026-03-06 |
| codebase-summary.md | 350+ | Code reference | 2026-03-05 |
| code-standards.md | 673 | Development standards | 2026-03-06 |
| system-architecture.md | 642 | Technical architecture | 2026-03-06 |
| project-roadmap.md | 274 | Feature planning | 2026-03-05 |
| design-guidelines.md | 650+ | UI/UX standards | 2026-03-05 |
| feature-updates.md | 185 | Recent changes (March 2026) | 2026-03-06 |
| **Total** | **3,180+** | Comprehensive docs covering all features | Current |

## Common Questions

### "I want to contribute a feature. Where do I start?"
1. Read [Code Standards](./code-standards.md) for naming, patterns, and structure
2. Check [Codebase Summary](./codebase-summary.md) to find relevant files
3. Review [System Architecture](./system-architecture.md) to understand data flows
4. Follow patterns in existing code
5. Add tests (target 80% coverage)
6. Update docs if you change behavior

### "How does the extension work?"
1. Start with [System Architecture](./system-architecture.md#high-level-architecture) for overview
2. Follow [Data Flows](./system-architecture.md#data-flow-diagrams) for query execution
3. Check [Codebase Summary](./codebase-summary.md#layer-breakdown) for file-by-file details
4. Review [Component Interactions](./system-architecture.md#component-interactions) for message flow

### "How do I add a new UI component?"
1. Read [Design Guidelines](./design-guidelines.md#ui-design-principles) for principles
2. Check [TreeView Design](./design-guidelines.md#treeview-design) or [Webview Design](./design-guidelines.md#webview-design)
3. Follow [Code Standards](./code-standards.md) for implementation
4. Ensure accessibility ([WCAG 2.1 AA](./design-guidelines.md#accessibility-wcag-21-aa))
5. Test in light/dark modes

### "What features are coming next?"
See [Project Roadmap](./project-roadmap.md):
- **Phase 2 (Q2 2026):** Saved queries, charts, batch runner
- **Phase 3 (Q3-Q4 2026):** Data lineage, collaboration, optimization
- **Phase 4 (2027+):** Copilot, ecosystem integration

### "What are the code standards?"
Read [Code Standards](./code-standards.md):
- **File naming:** kebab-case (e.g., `asset-explorer-provider.ts`)
- **File size:** Under 200 LOC, max 350
- **Architecture:** Service Locator, Provider, Lazy Init patterns
- **Error handling:** User-friendly messages, proper try-catch
- **Security:** CSP, HTML escaping, credential handling
- **Testing:** Target 80% coverage, use vitest

### "How is data cached?"
See [Caching Strategy](./codebase-summary.md#caching-strategy) in Codebase Summary:
- **Projects:** Session-long (rarely changes)
- **Datasets/Tables:** 24 hours
- **Sorted temp tables:** Session duration
- **Schema (hover):** 5 minutes
- **Query history:** 24 hours with auto-evict

### "How do I debug an issue?"
1. Check [Error Handling Paths](./system-architecture.md#error-handling-paths)
2. Review relevant [Data Flow](./system-architecture.md#data-flow-diagrams)
3. Follow [Debugging Guidelines](./code-standards.md#debugging-guidelines) in Code Standards
4. Add console logs (remove before commit)

## Key Diagrams

### Architecture
- [High-Level 3-Layer](./system-architecture.md#high-level-architecture)
- [Extension Activation](./system-architecture.md#extension-activation-sequence)
- [Component Interactions](./system-architecture.md#component-interactions)

### Data Flows
- [Query Execution](./system-architecture.md#query-execution-flow)
- [Auto Dry-Run](./system-architecture.md#auto-dry-run-flow)
- [History Persistence](./system-architecture.md#history-persistence-flow)
- [Asset Explorer Caching](./system-architecture.md#asset-explorer-caching-flow)
- [Authentication](./system-architecture.md#authentication-flow)

### UI Design
- [Results Webview Layout](./design-guidelines.md#results-webview-layout)
- [Status Bar Items](./design-guidelines.md#layout-right-aligned-in-status-bar)
- [Table Metadata Layout](./design-guidelines.md#tablemeta-webview-layout)

## Maintenance & Updates

### When to Update Docs
- **After features:** Update [README.md](../README.md) with new commands/settings
- **After code changes:** Update [Code Standards](./code-standards.md) if patterns change
- **After architecture changes:** Update [System Architecture](./system-architecture.md)
- **After UI changes:** Update [Design Guidelines](./design-guidelines.md)
- **After planning:** Update [Project Roadmap](./project-roadmap.md)

### Update Frequency
- **README:** After each feature release
- **Roadmap:** Quarterly or when priorities change
- **Code Standards:** When new patterns emerge
- **Other docs:** As needed (usually stable)

## Glossary & Terminology

See relevant documents for definitions:
- **API Terms:** [System Architecture](./system-architecture.md) → Glossary
- **Code Terms:** [Code Standards](./code-standards.md) → Patterns section
- **Design Terms:** [Design Guidelines](./design-guidelines.md) → Glossary
- **Product Terms:** [Project Roadmap](./project-roadmap.md) → Glossary

## Contributing to Docs

Docs should be:
- **Accurate:** Verified against actual code
- **Concise:** Sacrifice grammar for brevity
- **Organized:** Clear hierarchy and cross-links
- **Visual:** Use tables, diagrams, code blocks
- **Searchable:** Use section headers for discoverability

**File size limit:** 800 lines per doc (split if exceeding)

## Report & Planning

- **Documentation Update Report:** [plans/reports/docs-manager-260306-0021-document-recent-changes.md](../plans/reports/docs-manager-260306-0021-document-recent-changes.md)
- **Previous Reports:** [plans/reports/](../plans/reports/)

## Questions or Feedback?

- **Feature requests:** File an issue on GitHub
- **Documentation improvements:** Suggest via issues
- **Accessibility concerns:** Report immediately
- **Security issues:** Contact maintainers privately

---

**Last Updated:** 2026-03-06
**Version:** 0.1.0
**Status:** Comprehensive documentation including recent March 2026 feature updates
