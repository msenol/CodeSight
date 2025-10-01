/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable no-undef */
/* eslint-disable no-useless-escape */
// import type { Tool } from '@modelcontextprotocol/sdk/types.js'; // Rule 15: Import reserved for future implementation
import type { CodebaseService } from '../services/codebase-service.js';
import type { DuplicationService } from '../services/duplication-service.js';
import { z } from 'zod';

const FindDuplicatesInputSchema = z.object({
  codebase_id: z.string().uuid('Invalid codebase ID'),
  similarity_threshold: z.number().min(0.1).max(1.0).default(0.8),
  min_lines: z.number().min(3).max(100).default(5),
  include_tests: z.boolean().default(false),
  file_types: z.array(z.string()).optional(),
  exclude_patterns: z.array(z.string()).optional(),
  detection_types: z.array(z.enum(['exact', 'structural', 'semantic', 'all'])).default(['all']),
  group_by_similarity: z.boolean().default(true),
});

type FindDuplicatesInput = z.infer<typeof FindDuplicatesInputSchema>;

interface DuplicationResult {
  codebase_id: string;
  total_duplicates: number;
  duplicate_groups: DuplicateGroup[];
  summary: DuplicationSummary;
  recommendations: string[];
}

interface DuplicateGroup {
  group_id: string;
  similarity_score: number;
  detection_type: 'exact' | 'structural' | 'semantic';
  instances: DuplicateInstance[];
  common_pattern: string;
  refactoring_suggestion: string;
  estimated_savings: {
    lines_of_code: number;
    maintenance_effort: 'low' | 'medium' | 'high';
  };
}

interface DuplicateInstance {
  file_path: string;
  start_line: number;
  end_line: number;
  code_snippet: string;
  context: string;
  entity_id?: string;
  entity_name?: string;
}

interface DuplicationSummary {
  total_files_analyzed: number;
  files_with_duplicates: number;
  duplication_percentage: number;
  most_duplicated_patterns: string[];
  largest_duplicate_size: number;
  potential_code_reduction: number;
}

export class FindDuplicatesTool {
  name = 'find_duplicates';
  description = 'Find code duplications and similar patterns in the codebase';

  inputSchema = {
    type: 'object',
    properties: {
      codebase_id: {
        type: 'string',
        description: 'UUID of the codebase to analyze',
      },
      similarity_threshold: {
        type: 'number',
        minimum: 0.1,
        maximum: 1.0,
        description: 'Similarity threshold for detecting duplicates (0.1-1.0)',
        default: 0.8,
      },
      min_lines: {
        type: 'number',
        minimum: 3,
        maximum: 100,
        description: 'Minimum number of lines to consider as duplicate',
        default: 5,
      },
      include_tests: {
        type: 'boolean',
        description: 'Include test files in analysis',
        default: false,
      },
      file_types: {
        type: 'array',
        items: { type: 'string' },
        description: 'File extensions to include (e.g., [".ts", ".js"])',
      },
      exclude_patterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Patterns to exclude from analysis',
      },
      detection_types: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['exact', 'structural', 'semantic', 'all'],
        },
        description: 'Types of duplication detection to perform',
        default: ['all'],
      },
      group_by_similarity: {
        type: 'boolean',
        description: 'Group similar duplicates together',
        default: true,
      },
    },
    required: ['codebase_id'],
  };

  // Constructor removed - services injected via dependency injection

  async call(args: unknown): Promise<DuplicationResult> {
    try {
      const input = FindDuplicatesInputSchema.parse(args);

      const codebase = await this.codebaseService.getCodebase(input.codebase_id);
      if (!codebase) {
        throw new Error(`Codebase with ID ${input.codebase_id} not found`);
      }

      const files = await this.getFilesToAnalyze(input);
      const duplicateGroups = await this.findDuplicateGroups(files, input);
      const summary = this.calculateSummary(files, duplicateGroups);
      const recommendations = this.generateRecommendations(duplicateGroups, summary);

      return {
        codebase_id: input.codebase_id,
        total_duplicates: duplicateGroups.reduce((sum, group) => sum + group.instances.length, 0),
        duplicate_groups: duplicateGroups,
        summary,
        recommendations,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(
        `Duplicate detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async getFilesToAnalyze(input: FindDuplicatesInput): Promise<string[]> {
    let files = await this.codebaseService.getFiles(input.codebase_id);

    // Filter by file types
    if (input.file_types && input.file_types.length > 0) {
      files = files.filter(file => input.file_types!.some(ext => file.endsWith(ext)));
    }

    // Exclude test files if requested
    if (!input.include_tests) {
      files = files.filter(
        file =>
          !file.includes('/test/') &&
          !file.includes('/tests/') &&
          !file.includes('/__tests__/') &&
          !file.includes('.test.') &&
          !file.includes('.spec.'),
      );
    }

    // Apply exclude patterns
    if (input.exclude_patterns && input.exclude_patterns.length > 0) {
      files = files.filter(
        file => !input.exclude_patterns!.some(pattern => new RegExp(pattern).test(file)),
      );
    }

    return files;
  }

  private async findDuplicateGroups(
    files: string[],
    input: FindDuplicatesInput,
  ): Promise<DuplicateGroup[]> {
    const groups: DuplicateGroup[] = [];
    const detectionTypes = input.detection_types.includes('all')
      ? (['exact', 'structural', 'semantic'] as const)
      : (input.detection_types as ('exact' | 'structural' | 'semantic')[]);

    for (const detectionType of detectionTypes) {
      const duplicates = await this.duplicationService.findDuplicates(files, {
        detection_type: detectionType,
        similarity_threshold: input.similarity_threshold,
        min_lines: input.min_lines,
      });

      for (const duplicate of duplicates) {
        const group: DuplicateGroup = {
          group_id: this.generateGroupId(),
          similarity_score: duplicate.similarity_score,
          detection_type: detectionType,
          instances: duplicate.instances.map(instance => ({
            file_path: instance.file_path,
            start_line: instance.start_line,
            end_line: instance.end_line,
            code_snippet: instance.code_snippet,
            context: instance.context,
            entity_id: instance.entity_id,
            entity_name: instance.entity_name,
          })),
          common_pattern: duplicate.common_pattern,
          refactoring_suggestion: this.generateRefactoringSuggestion(duplicate),
          estimated_savings: this.calculateSavings(duplicate),
        };
        groups.push(group);
      }
    }

    return input.group_by_similarity ? this.groupBySimilarity(groups) : groups;
  }

  private generateGroupId(): string {
    return `dup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRefactoringSuggestion(duplicate: unknown): string {
    const instanceCount = duplicate.instances.length;
    const linesCount = duplicate.instances[0].end_line - duplicate.instances[0].start_line + 1;

    if (linesCount < 10) {
      return `Extract ${instanceCount} similar code blocks into a shared utility function`;
    } else if (linesCount < 30) {
      return `Consider creating a reusable component or module for this ${linesCount}-line pattern`;
    } else {
      return `Large duplicate detected (${linesCount} lines). Consider architectural refactoring`;
    }
  }

  private calculateSavings(duplicate: unknown): {
    lines_of_code: number;
    maintenance_effort: 'low' | 'medium' | 'high';
  } {
    const instanceCount = duplicate.instances.length;
    const linesPerInstance =
      duplicate.instances[0].end_line - duplicate.instances[0].start_line + 1;
    const totalDuplicateLines = (instanceCount - 1) * linesPerInstance;

    let maintenanceEffort: 'low' | 'medium' | 'high' = 'low';
    if (totalDuplicateLines > 100) {maintenanceEffort = 'high';} else if (totalDuplicateLines > 30) {maintenanceEffort = 'medium';}

    return {
      lines_of_code: totalDuplicateLines,
      maintenance_effort: maintenanceEffort,
    };
  }

  private groupBySimilarity(groups: DuplicateGroup[]): DuplicateGroup[] {
    // Simple grouping by similarity score ranges
    const grouped = new Map<string, DuplicateGroup[]>();

    for (const group of groups) {
      const key = this.getSimilarityKey(group.similarity_score);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(group);
    }

    // Merge similar groups
    const result: DuplicateGroup[] = [];
    for (const [, similarGroups] of grouped) {
      if (similarGroups.length === 1) {
        result.push(similarGroups[0]);
      } else {
        // Merge groups with similar patterns
        const merged = this.mergeGroups(similarGroups);
        result.push(merged);
      }
    }

    return result.sort((a, b) => b.similarity_score - a.similarity_score);
  }

  private getSimilarityKey(score: number): string {
    if (score >= 0.95) {return 'exact';}
    if (score >= 0.85) {return 'very_high';}
    if (score >= 0.7) {return 'high';}
    return 'medium';
  }

  private mergeGroups(groups: DuplicateGroup[]): DuplicateGroup {
    const allInstances = groups.flatMap(g => g.instances);
    const avgSimilarity = groups.reduce((sum, g) => sum + g.similarity_score, 0) / groups.length;

    return {
      group_id: this.generateGroupId(),
      similarity_score: avgSimilarity,
      detection_type: groups[0].detection_type,
      instances: allInstances,
      common_pattern: groups[0].common_pattern,
      refactoring_suggestion: 'Multiple similar patterns detected. Consider unified refactoring approach.',
      estimated_savings: {
        lines_of_code: groups.reduce((sum, g) => sum + g.estimated_savings.lines_of_code, 0),
        maintenance_effort: 'high',
      },
    };
  }

  private calculateSummary(files: string[], groups: DuplicateGroup[]): DuplicationSummary {
    const filesWithDuplicates = new Set(groups.flatMap(g => g.instances.map(i => i.file_path)))
      .size;

    const totalDuplicateLines = groups.reduce(
      (sum, g) => sum + g.estimated_savings.lines_of_code,
      0,
    );

    const totalLines = files.length * 100; // Rough estimate
    const duplicationPercentage = (totalDuplicateLines / totalLines) * 100;

    const patternCounts = new Map<string, number>();
    groups.forEach(g => {
      const count = patternCounts.get(g.common_pattern) || 0;
      patternCounts.set(g.common_pattern, count + 1);
    });

    const mostDuplicatedPatterns = Array.from(patternCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pattern]) => pattern);

    const largestDuplicate = Math.max(...groups.map(g => g.estimated_savings.lines_of_code), 0);

    return {
      total_files_analyzed: files.length,
      files_with_duplicates: filesWithDuplicates,
      duplication_percentage: Math.round(duplicationPercentage * 100) / 100,
      most_duplicated_patterns: mostDuplicatedPatterns,
      largest_duplicate_size: largestDuplicate,
      potential_code_reduction: totalDuplicateLines,
    };
  }

  private generateRecommendations(groups: DuplicateGroup[], summary: DuplicationSummary): string[] {
    const recommendations: string[] = [];

    if (summary.duplication_percentage > 15) {
      recommendations.push(
        'High duplication detected. Consider implementing a comprehensive refactoring strategy.',
      );
    }

    if (summary.largest_duplicate_size > 50) {
      recommendations.push(
        'Large duplicates found. Prioritize extracting these into reusable components.',
      );
    }

    const highPriorityGroups = groups.filter(
      g => g.estimated_savings.maintenance_effort === 'high',
    );
    if (highPriorityGroups.length > 0) {
      recommendations.push(
        `${highPriorityGroups.length} high-impact duplicates identified. Address these first.`,
      );
    }

    if (summary.potential_code_reduction > 200) {
      recommendations.push(
        `Potential to reduce codebase by ${summary.potential_code_reduction} lines through deduplication.`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'Low duplication levels detected. Maintain current code quality practices.',
      );
    }

    return recommendations;
  }
}

export default FindDuplicatesTool;
