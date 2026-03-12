import { describe, it, expect } from 'vitest';
import { parseQueryDirectives, QueryDirectives } from './sql-directive-parser';

describe('sql-directive-parser', () => {
  describe('parseQueryDirectives', () => {
    it('parses @project directive', () => {
      const sql = '-- @project:my-project\nSELECT 1';
      const result = parseQueryDirectives(sql);
      expect(result.project).toBe('my-project');
      expect(result.region).toBeUndefined();
    });

    it('parses @region directive', () => {
      const sql = '-- @region:EU\nSELECT 1';
      const result = parseQueryDirectives(sql);
      expect(result.region).toBe('EU');
      expect(result.project).toBeUndefined();
    });

    it('parses both @project and @region directives', () => {
      const sql = '-- @project:my-project\n-- @region:asia-southeast1\nSELECT 1';
      const result = parseQueryDirectives(sql);
      expect(result.project).toBe('my-project');
      expect(result.region).toBe('asia-southeast1');
    });

    it('handles directives in any order', () => {
      const sql = '-- @region:US\n-- @project:other-project\nSELECT * FROM table';
      const result = parseQueryDirectives(sql);
      expect(result.project).toBe('other-project');
      expect(result.region).toBe('US');
    });

    it('ignores whitespace around colon and value', () => {
      const sql = '--  @project  :  my-project  \nSELECT 1';
      const result = parseQueryDirectives(sql);
      expect(result.project).toBe('my-project');
    });

    it('handles case-insensitive directives', () => {
      const sql = '-- @PROJECT:my-project\n-- @REGION:EU\nSELECT 1';
      const result = parseQueryDirectives(sql);
      expect(result.project).toBe('my-project');
      expect(result.region).toBe('EU');
    });

    it('stops parsing at first non-comment line', () => {
      const sql = '-- @project:first\nSELECT 1\n-- @project:second';
      const result = parseQueryDirectives(sql);
      expect(result.project).toBe('first');
    });

    it('continues parsing directives after blank lines if no SQL content yet', () => {
      const sql = '-- @project:first\n\n-- @project:second\nSELECT 1';
      const result = parseQueryDirectives(sql);
      // Blank lines don't stop parsing, only non-comment lines do
      expect(result.project).toBe('second');
    });

    it('handles empty SQL', () => {
      const result = parseQueryDirectives('');
      expect(result).toEqual({});
    });

    it('handles SQL with no directives', () => {
      const sql = 'SELECT * FROM table';
      const result = parseQueryDirectives(sql);
      expect(result).toEqual({});
    });

    it('handles SQL with only comments', () => {
      const sql = '-- This is a comment\n-- Another comment';
      const result = parseQueryDirectives(sql);
      expect(result).toEqual({});
    });

    it('ignores invalid directive syntax', () => {
      const sql = '-- @invalid\n-- @project\nSELECT 1';
      const result = parseQueryDirectives(sql);
      expect(result).toEqual({});
    });

    it('handles project IDs with hyphens and underscores', () => {
      const sql = '-- @project:my-complex_project-123\nSELECT 1';
      const result = parseQueryDirectives(sql);
      expect(result.project).toBe('my-complex_project-123');
    });

    it('handles region names with hyphens', () => {
      const sql = '-- @region:asia-southeast1\nSELECT 1';
      const result = parseQueryDirectives(sql);
      expect(result.region).toBe('asia-southeast1');
    });

    it('handles Windows line endings (CRLF)', () => {
      const sql = '-- @project:my-project\r\nSELECT 1';
      const result = parseQueryDirectives(sql);
      expect(result.project).toBe('my-project');
    });

    it('trims extra whitespace from values', () => {
      const sql = '-- @project:  my-project   \nSELECT 1';
      const result = parseQueryDirectives(sql);
      expect(result.project).toBe('my-project');
    });

    it('last directive value wins if duplicated', () => {
      const sql = '-- @project:first\n-- @project:second\nSELECT 1';
      const result = parseQueryDirectives(sql);
      expect(result.project).toBe('second');
    });

    it('handles leading empty lines', () => {
      const sql = '\n\n-- @project:my-project\nSELECT 1';
      const result = parseQueryDirectives(sql);
      expect(result.project).toBe('my-project');
    });

    it('handles very long project IDs', () => {
      const longId = 'a'.repeat(256);
      const sql = `-- @project:${longId}\nSELECT 1`;
      const result = parseQueryDirectives(sql);
      expect(result.project).toBe(longId);
    });
  });
});
