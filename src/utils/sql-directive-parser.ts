/** Per-query overrides parsed from SQL comment directives */
export interface QueryDirectives {
  project?: string;
  region?: string;
}

/**
 * Parse `-- @project: xxx` and `-- @region: xxx` directives from SQL text.
 * Only scans leading comment lines (before first non-comment, non-empty line).
 */
export function parseQueryDirectives(sql: string): QueryDirectives {
  const directives: QueryDirectives = {};
  const lines = sql.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--')) {
      const match = trimmed.match(/^--\s*@(project|region)\s*:\s*(.+)/i);
      if (match) {
        const key = match[1].toLowerCase() as 'project' | 'region';
        directives[key] = match[2].trim();
      }
      continue;
    }
    // Stop at first non-comment, non-empty line
    break;
  }

  return directives;
}
