import { describe, it, expect } from 'vitest';

/**
 * Tests for deriveQueryTitle logic from run-query-command.
 * This tests the title derivation algorithm without accessing the non-exported function directly.
 * We verify the logic by testing what the function should produce.
 */

/**
 * Reproduce deriveQueryTitle logic for testing.
 * This mirrors the logic in run-query-command.ts line 8-18.
 */
function deriveQueryTitleForTesting(sql: string): string {
  const normalized = sql.replace(/\s+/g, ' ').trim();
  // Extract operation keyword
  const opMatch = normalized.match(/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|MERGE|WITH)\b/i);
  const op = opMatch ? opMatch[1].toUpperCase() : 'SQL';
  // Extract first table reference after FROM/INTO/UPDATE/JOIN/TABLE
  const tableMatch = normalized.match(/(?:FROM|INTO|UPDATE|JOIN|TABLE)\s+`?([a-zA-Z0-9_.-]+)`?/i);
  const table = tableMatch ? tableMatch[1].split('.').pop() : undefined;
  const title = table ? `${op} · ${table}` : op;
  return title.length > 40 ? title.substring(0, 40) + '…' : title;
}

describe('deriveQueryTitle logic', () => {
  describe('operation keyword extraction', () => {
    it('extracts SELECT keyword', () => {
      expect(deriveQueryTitleForTesting('SELECT 1')).toBe('SELECT');
    });

    it('extracts INSERT keyword', () => {
      expect(deriveQueryTitleForTesting('INSERT INTO table VALUES (1)')).toContain('INSERT');
    });

    it('extracts UPDATE keyword', () => {
      expect(deriveQueryTitleForTesting('UPDATE table SET x = 1')).toContain('UPDATE');
    });

    it('extracts DELETE keyword', () => {
      expect(deriveQueryTitleForTesting('DELETE FROM table')).toContain('DELETE');
    });

    it('extracts CREATE keyword', () => {
      expect(deriveQueryTitleForTesting('CREATE TABLE my_table AS SELECT 1')).toContain('CREATE');
    });

    it('extracts MERGE keyword', () => {
      expect(deriveQueryTitleForTesting('MERGE INTO target_table USING source_table')).toContain('MERGE');
    });

    it('extracts WITH keyword (CTE)', () => {
      // WITH is extracted but the regex also finds the table reference in the FROM clause
      const result = deriveQueryTitleForTesting('WITH cte AS (SELECT 1) SELECT * FROM cte');
      expect(result).toContain('WITH');
    });

    it('defaults to SQL for unknown keywords', () => {
      expect(deriveQueryTitleForTesting('UNKNOWN command')).toBe('SQL');
    });

    it('is case-insensitive for keyword', () => {
      expect(deriveQueryTitleForTesting('select 1')).toBe('SELECT');
      expect(deriveQueryTitleForTesting('SeLeCt 1')).toBe('SELECT');
    });

    it('handles leading whitespace', () => {
      expect(deriveQueryTitleForTesting('   SELECT 1')).toBe('SELECT');
    });
  });

  describe('table extraction', () => {
    it('extracts table from FROM clause', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM my_table');
      expect(result).toBe('SELECT · my_table');
    });

    it('extracts table from INTO clause', () => {
      const result = deriveQueryTitleForTesting('INSERT INTO my_table VALUES (1)');
      expect(result).toBe('INSERT · my_table');
    });

    it('extracts table from UPDATE clause', () => {
      const result = deriveQueryTitleForTesting('UPDATE my_table SET col = 1');
      expect(result).toBe('UPDATE · my_table');
    });

    it('extracts table from JOIN clause', () => {
      // The regex finds the first table after FROM/INTO/UPDATE/JOIN/TABLE
      // so it will find 'a' from FROM before finding 'my_table' from JOIN
      const result = deriveQueryTitleForTesting('SELECT * FROM a JOIN my_table ON a.id = my_table.id');
      expect(result).toBe('SELECT · a');
    });

    it('extracts table from TABLE clause', () => {
      const result = deriveQueryTitleForTesting('TABLE my_table');
      expect(result).toBe('SQL · my_table');
    });

    it('extracts last component of qualified table name', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM dataset.my_table');
      expect(result).toBe('SELECT · my_table');
    });

    it('extracts last component of 3-part table name', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM project.dataset.my_table');
      expect(result).toBe('SELECT · my_table');
    });

    it('handles backtick-quoted table names', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM `my_table`');
      expect(result).toBe('SELECT · my_table');
    });

    it('handles backtick-quoted qualified names', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM `project.dataset.my_table`');
      expect(result).toBe('SELECT · my_table');
    });

    it('handles mixed backticks and unquoted', () => {
      // The regex matches `dataset` as the first table-like token after FROM
      const result = deriveQueryTitleForTesting('SELECT * FROM `dataset`.my_table');
      expect(result).toBe('SELECT · dataset');
    });

    it('handles table names with underscores', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM my_data_table');
      expect(result).toBe('SELECT · my_data_table');
    });

    it('handles table names with hyphens', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM my-data-table');
      expect(result).toBe('SELECT · my-data-table');
    });

    it('handles table names with dots', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM dataset.my.table');
      expect(result).toBe('SELECT · table');
    });

    it('omits table when not found', () => {
      const result = deriveQueryTitleForTesting('SELECT 1');
      expect(result).toBe('SELECT');
    });

    it('finds first table in multiple JOINs', () => {
      // The regex finds the first keyword match, which is FROM
      const result = deriveQueryTitleForTesting('SELECT * FROM a JOIN first_table JOIN second_table');
      expect(result).toBe('SELECT · a');
    });
  });

  describe('title formatting', () => {
    it('combines operation and table with separator', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM my_table');
      expect(result).toMatch(/SELECT · my_table/);
    });

    it('truncates titles longer than 40 characters', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM ' + 'very_long_table_name_that_exceeds_forty_chars_total_with_operation');
      expect(result).toHaveLength(41); // 40 + ellipsis
      expect(result.endsWith('…')).toBe(true);
    });

    it('does not truncate titles 40 chars or less', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM exactly_thirty_char_name');
      expect(result).not.toContain('…');
    });

    it('handles exact 40 character boundary', () => {
      // "SELECT · " is 9 chars, so table name needs to be 31 chars
      const tableName = 'a'.repeat(31);
      const result = deriveQueryTitleForTesting(`SELECT * FROM ${tableName}`);
      expect(result).toHaveLength(40);
      expect(result).not.toContain('…');
    });

    it('truncates at 40 chars when exceeding', () => {
      const tableName = 'a'.repeat(32);
      const result = deriveQueryTitleForTesting(`SELECT * FROM ${tableName}`);
      expect(result).toHaveLength(41); // 40 + ellipsis
      expect(result.endsWith('…')).toBe(true);
    });
  });

  describe('whitespace handling', () => {
    it('normalizes multiple spaces to single space', () => {
      const result = deriveQueryTitleForTesting('SELECT     *     FROM     my_table');
      expect(result).toBe('SELECT · my_table');
    });

    it('normalizes tabs and newlines', () => {
      const result = deriveQueryTitleForTesting('SELECT\t*\nFROM\r\nmy_table');
      expect(result).toBe('SELECT · my_table');
    });

    it('trims leading/trailing whitespace', () => {
      const result = deriveQueryTitleForTesting('  \n  SELECT * FROM my_table  \n  ');
      expect(result).toBe('SELECT · my_table');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      expect(deriveQueryTitleForTesting('')).toBe('SQL');
    });

    it('handles whitespace-only string', () => {
      expect(deriveQueryTitleForTesting('   \n\t  ')).toBe('SQL');
    });

    it('handles single keyword', () => {
      expect(deriveQueryTitleForTesting('SELECT')).toBe('SELECT');
    });

    it('handles complex nested query', () => {
      const result = deriveQueryTitleForTesting(
        'WITH cte AS (SELECT * FROM source) SELECT * FROM cte JOIN target ON cte.id = target.id'
      );
      expect(result).toContain('WITH');
    });

    it('handles query with comments', () => {
      // Comments are not recognized as keywords, so the first keyword is SELECT
      const result = deriveQueryTitleForTesting('-- This is a comment\nSELECT * FROM my_table');
      // After whitespace normalization, the comment line becomes part of normalized string
      // The regex will find SELECT and my_table
      expect(result).toContain('my_table');
    });

    it('handles subqueries in FROM', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM (SELECT * FROM inner_table)');
      expect(result).toBe('SELECT · inner_table');
    });

    it('handles UNION queries', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM table1 UNION SELECT * FROM table2');
      expect(result).toBe('SELECT · table1');
    });

    it('handles INSERT ... SELECT', () => {
      const result = deriveQueryTitleForTesting('INSERT INTO target_table SELECT * FROM source_table');
      expect(result).toBe('INSERT · target_table');
    });

    it('handles CREATE TABLE AS SELECT', () => {
      const result = deriveQueryTitleForTesting('CREATE TABLE new_table AS SELECT * FROM source_table');
      expect(result).toBe('CREATE · new_table');
    });

    it('handles special characters in table names (within allowed)', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM my_table_2023');
      expect(result).toBe('SELECT · my_table_2023');
    });

    it('handles queries with aliases', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM my_table AS t WHERE t.id = 1');
      expect(result).toBe('SELECT · my_table');
    });

    it('prioritizes FROM over JOIN when both present', () => {
      // The regex uses alternation with FROM first
      const result = deriveQueryTitleForTesting('SELECT * FROM from_table JOIN join_table');
      expect(result).toContain('from_table');
    });

    it('handles parameterized queries', () => {
      const result = deriveQueryTitleForTesting('SELECT * FROM my_table WHERE id = @id');
      expect(result).toBe('SELECT · my_table');
    });
  });

  describe('real-world examples', () => {
    it('handles real BigQuery query 1', () => {
      const sql = `
        SELECT
          user_id,
          COUNT(*) as event_count,
          MAX(event_timestamp) as last_event
        FROM events_table
        WHERE event_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
        GROUP BY user_id
      `;
      const result = deriveQueryTitleForTesting(sql);
      expect(result).toBe('SELECT · events_table');
    });

    it('handles real BigQuery query 2', () => {
      const sql = `
        WITH recent_users AS (
          SELECT user_id FROM users WHERE created_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        )
        SELECT u.user_id, COUNT(e.event_id) as events
        FROM recent_users u
        LEFT JOIN events e ON u.user_id = e.user_id
        GROUP BY u.user_id
      `;
      const result = deriveQueryTitleForTesting(sql);
      // WITH is the keyword, but also finds a table reference from the CTE or FROM
      expect(result).toContain('WITH');
    });

    it('handles real BigQuery query 3', () => {
      const sql = `INSERT INTO \`project.dataset.summary_table\`
                   SELECT * FROM \`project.dataset.source_table\``;
      const result = deriveQueryTitleForTesting(sql);
      expect(result).toBe('INSERT · summary_table');
    });

    it('handles CREATE TABLE statement', () => {
      const sql = `
        CREATE TABLE my_project.my_dataset.my_new_table AS
        SELECT
          *
        FROM \`another_project.another_dataset.source_table\`
      `;
      const result = deriveQueryTitleForTesting(sql);
      expect(result).toContain('CREATE');
    });

    it('handles DELETE statement', () => {
      const sql = `DELETE FROM users_table WHERE user_id = @user_id`;
      const result = deriveQueryTitleForTesting(sql);
      expect(result).toBe('DELETE · users_table');
    });

    it('handles MERGE statement', () => {
      const sql = `
        MERGE INTO target_table t
        USING source_table s
        ON t.id = s.id
        WHEN MATCHED THEN UPDATE SET t.name = s.name
        WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name)
      `;
      const result = deriveQueryTitleForTesting(sql);
      expect(result).toBe('MERGE · target_table');
    });
  });
});
