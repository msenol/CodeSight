/**
 * Analyze codebase complexity - Batch complexity analysis tool
 * Scans all functions/methods and returns top complex ones sorted by cyclomatic complexity.
 */
import { z } from 'zod';
import Database from 'better-sqlite3';
import * as fs from 'fs/promises';
import * as path from 'path';
import { complexityService } from '../services/complexity-service.js';
import { logger } from '../services/logger.js';

const AnalyzeCodebaseComplexityInputSchema = z.object({
  codebase_id: z.string().min(1, 'Codebase ID is required'),
  limit: z.number().int().min(1).max(100).default(10),
  min_cyclomatic: z.number().int().min(1).default(10),
  min_lines: z.number().int().min(1).default(30),
  entity_type: z.enum(['function', 'method', 'all']).default('all'),
  exclude_patterns: z
    .array(z.string())
    .default(['node_modules', 'dist', 'build', '.next', 'storybook-static', 'coverage', 'out', 'min.js', 'bundle.js']),
});

interface ComplexityItem {
  name: string;
  file_path: string;
  entity_type: string;
  start_line: number;
  end_line: number;
  raw_lines: number;
  cyclomatic_complexity: number;
  cognitive_complexity: number;
  lines_of_code: number;
  maintainability_index: number;
  preview: string;
}

interface ComplexityResult extends ComplexityItem {
  rank: number;
}

interface AnalysisOutput {
  codebase_id: string;
  total_analyzed: number;
  total_entities_scanned: number;
  results: ComplexityResult[];
}

const RESERVED_NAMES = new Set([
  'if', 'for', 'while', 'switch', 'case', 'catch', 'try', 'else', 'do', 'return',
]);

export class AnalyzeCodebaseComplexityTool {
  name = 'analyze_codebase_complexity';
  description =
    'Analyze all functions/methods in a codebase and return the most complex ones sorted by cyclomatic complexity. ' +
    'Use this to find refactoring candidates, detect high-risk areas, and measure code quality.';

  inputSchema = {
    type: 'object',
    properties: {
      codebase_id: {
        type: 'string',
        description: 'Codebase identifier to analyze',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (1-100, default: 10)',
        default: 10,
      },
      min_cyclomatic: {
        type: 'number',
        description: 'Minimum cyclomatic complexity threshold (default: 10)',
        default: 10,
      },
      min_lines: {
        type: 'number',
        description: 'Minimum raw line count to consider (default: 30)',
        default: 30,
      },
      entity_type: {
        type: 'string',
        enum: ['function', 'method', 'all'],
        description: 'Type of entities to analyze (default: all)',
        default: 'all',
      },
      exclude_patterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Path patterns to exclude (default: build artifacts)',
      },
    },
    required: ['codebase_id'],
  };

  async call(args: unknown): Promise<AnalysisOutput> {
    const input = AnalyzeCodebaseComplexityInputSchema.parse(args);

    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'code-intelligence.db');
    const db = new Database(dbPath);

    try {
      // Build SQL query
      let typeFilter: string;
      const queryParams: (string | number)[] = [input.codebase_id, input.min_lines];

      if (input.entity_type === 'function') {
        typeFilter = "AND entity_type = 'function'";
      } else if (input.entity_type === 'method') {
        typeFilter = "AND entity_type = 'method'";
      } else {
        typeFilter = "AND entity_type IN ('function', 'method')";
      }

      // Query entities ordered by size (likely more complex first)
      const rows = db
        .prepare(
          `SELECT id, name, file_path, start_line, end_line, entity_type
           FROM code_entities
           WHERE codebase_id = ?
             AND (end_line - start_line) >= ?
             ${typeFilter}
           ORDER BY (end_line - start_line) DESC
           LIMIT 3000`,
        )
        .all(...queryParams) as Array<{
        id: string;
        name: string;
        file_path: string;
        start_line: number;
        end_line: number;
        entity_type: string;
      }>;

      logger.info(`Found ${rows.length} candidate entities for complexity analysis`);

      // Filter reserved names and excluded paths
      const filtered = rows.filter((r) => {
        if (RESERVED_NAMES.has(r.name)) return false;
        return !input.exclude_patterns.some((p) => r.file_path.includes(p));
      });

      logger.info(`After filtering: ${filtered.length} entities`);

      // Calculate complexity in batches
      const fileCache = new Map<string, string[] | null>();
      const results: ComplexityItem[] = [];

      const getFileLines = async (filePath: string): Promise<string[] | null> => {
        if (fileCache.has(filePath)) return fileCache.get(filePath)!;
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');
          fileCache.set(filePath, lines);
          return lines;
        } catch {
          fileCache.set(filePath, null);
          return null;
        }
      };

      const batchSize = 100;
      for (let i = 0; i < filtered.length; i += batchSize) {
        const batch = filtered.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(async (entity) => {
            const lines = await getFileLines(entity.file_path);
            if (!lines) return null;

            const start = Math.max(0, (entity.start_line || 1) - 1);
            const end = Math.min(lines.length, entity.end_line || lines.length);
            const code = lines.slice(start, end).join('\n');
            if (!code.trim()) return null;

            try {
              const metrics = await complexityService.calculateCodeComplexity(code, 'typescript');
              if (metrics.cyclomaticComplexity < input.min_cyclomatic) return null;

              return {
                name: entity.name,
                file_path: entity.file_path,
                entity_type: entity.entity_type,
                start_line: entity.start_line,
                end_line: entity.end_line,
                raw_lines: end - start,
                cyclomatic_complexity: metrics.cyclomaticComplexity,
                cognitive_complexity: metrics.cognitiveComplexity,
                lines_of_code: metrics.linesOfCode,
                maintainability_index: Math.round(metrics.maintainabilityIndex),
                preview: code.substring(0, 200).replace(/\n/g, ' '),
              };
            } catch {
              return null;
            }
          }),
        );

        for (const r of batchResults) {
          if (r) results.push(r);
        }
      }

      // Sort and limit
      results.sort((a, b) => b.cyclomatic_complexity - a.cyclomatic_complexity);
      const topResults = results.slice(0, input.limit).map((r, idx) => ({ ...r, rank: idx + 1 }));

      logger.info(`Complexity analysis complete. Top ${topResults.length} results returned.`);

      return {
        codebase_id: input.codebase_id,
        total_analyzed: results.length,
        total_entities_scanned: filtered.length,
        results: topResults,
      };
    } finally {
      db.close();
    }
  }
}

export default AnalyzeCodebaseComplexityTool;
