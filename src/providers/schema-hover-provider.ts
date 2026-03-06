import * as vscode from 'vscode';
import { BigQueryClient } from '../services/bigquery-client';
import { TableField } from '@google-cloud/bigquery';

/** Cache for schema lookups to avoid repeated API calls */
const schemaCache = new Map<string, { fields: TableField[]; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 200; // prevent unbounded growth

/** Provides hover information for backtick-quoted table references in .bqsql files */
export class SchemaHoverProvider implements vscode.HoverProvider {
  constructor(private bqClient: BigQueryClient) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Hover | null> {
    const range = this.getBacktickRange(document, position);
    if (!range) return null;

    const ref = document.getText(range).replace(/`/g, '');
    const parts = ref.split('.');
    if (parts.length !== 3) return null;

    const [projectId, datasetId, tableId] = parts;
    const cacheKey = `${projectId}.${datasetId}.${tableId}`;

    let fields: TableField[];
    const cached = schemaCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      fields = cached.fields;
    } else {
      try {
        fields = await this.bqClient.getTableSchema(projectId, datasetId, tableId);
        // Evict oldest entries if cache exceeds max size
        if (schemaCache.size >= CACHE_MAX_SIZE) {
          const firstKey = schemaCache.keys().next().value;
          if (firstKey) schemaCache.delete(firstKey);
        }
        schemaCache.set(cacheKey, { fields, timestamp: Date.now() });
      } catch {
        return null;
      }
    }

    if (fields.length === 0) return null;

    const markdown = new vscode.MarkdownString();
    markdown.appendMarkdown(`**${cacheKey}**\n\n`);
    markdown.appendMarkdown('| Column | Type | Mode |\n|--------|------|------|\n');
    for (const f of fields.slice(0, 20)) {
      markdown.appendMarkdown(
        `| ${f.name} | \`${f.type}\` | ${f.mode || 'NULLABLE'} |\n`,
      );
    }
    if (fields.length > 20) {
      markdown.appendMarkdown(`\n*...and ${fields.length - 20} more columns*\n`);
    }

    return new vscode.Hover(markdown, range);
  }

  /** Find backtick-quoted range at cursor position */
  private getBacktickRange(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Range | null {
    const line = document.lineAt(position.line).text;
    let start = -1;
    let end = -1;

    // Find backtick pair containing the cursor
    for (let i = position.character; i >= 0; i--) {
      if (line[i] === '`') { start = i; break; }
    }
    for (let i = position.character; i < line.length; i++) {
      if (line[i] === '`' && i !== start) { end = i; break; }
    }

    if (start === -1 || end === -1 || start >= end) return null;

    return new vscode.Range(
      new vscode.Position(position.line, start),
      new vscode.Position(position.line, end + 1),
    );
  }
}
