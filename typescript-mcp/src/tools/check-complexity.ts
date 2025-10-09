 
 
// import type { Tool } from '@modelcontextprotocol/sdk/types.js'; // Rule 15: Import reserved for future implementation
// import type { AnalysisService } from '../services/analysis-service.js'; // Rule 15: Import reserved for future implementation
 
import { complexityService } from '../services/complexity-service.js';
 
import { codebaseService } from '../services/codebase-service.js';
import { z } from 'zod';

const CheckComplexityInputSchema = z.object({
  entity_id: z.string().uuid('Invalid entity ID'),
  metric_types: z
    .array(z.enum(['cyclomatic', 'cognitive', 'lines_of_code', 'maintainability', 'all']))
    .default(['all']),
  include_suggestions: z.boolean().default(true),
  include_comparisons: z.boolean().default(false),
});

// Rule 15: Type reserved for future implementation
// type CheckComplexityInput = z.infer<typeof CheckComplexityInputSchema>;

interface ComplexityMetrics {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  file_path: string;
  cyclomatic_complexity?: number;
  cognitive_complexity?: number;
  lines_of_code?: number;
  maintainability_index?: number;
  complexity_rating: 'low' | 'medium' | 'high' | 'very_high';
  metrics_details: MetricDetail[];
  suggestions: string[];
  benchmark_comparison?: BenchmarkComparison;
}

interface MetricDetail {
  metric_name: string;
  value: number;
  threshold: number;
  status: 'good' | 'warning' | 'critical';
  description: string;
}

interface BenchmarkComparison {
  percentile: number;
  similar_functions: number;
  better_than_percent: number;
}

export class CheckComplexityTool {
  name = 'check_complexity';
  description = 'Check code complexity metrics for functions, classes, and methods';

  inputSchema = {
    type: 'object',
    properties: {
      entity_id: {
        type: 'string',
        description: 'UUID of the code entity to analyze',
      },
      metric_types: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['cyclomatic', 'cognitive', 'lines_of_code', 'maintainability', 'all'],
        },
        description: 'Types of complexity metrics to calculate',
        default: ['all'],
      },
      include_suggestions: {
        type: 'boolean',
        description: 'Include improvement suggestions',
        default: true,
      },
      include_comparisons: {
        type: 'boolean',
        description: 'Include benchmark comparisons',
        default: false,
      },
    },
    required: ['entity_id'],
  };

  // Constructor removed - services injected via dependency injection

  async call(args: unknown): Promise<ComplexityMetrics> {
    try {
      const input = CheckComplexityInputSchema.parse(args);

      const entity = await codebaseService.getCodeEntity(input.entity_id);
      if (!entity) {
        throw new Error(`Code entity with ID ${input.entity_id} not found`);
      }

      const metrics = await complexityService.calculateMetrics(entity, input.metric_types);
      const rating = this.calculateComplexityRating(metrics);
      const suggestions = input.include_suggestions
        ? this.generateSuggestions(metrics, rating)
        : [];
      const comparison = input.include_comparisons
        ? await this.getBenchmarkComparison(entity, metrics)
        : undefined;

      return {
        entity_id: entity.id,
        entity_name: entity.name,
        entity_type: entity.entity_type,
        file_path: entity.file_path,
        cyclomatic_complexity: metrics.cyclomatic_complexity,
        cognitive_complexity: metrics.cognitive_complexity,
        lines_of_code: metrics.lines_of_code,
        maintainability_index: metrics.maintainability_index,
        complexity_rating: rating,
        metrics_details: this.buildMetricsDetails(metrics),
        suggestions,
        benchmark_comparison: comparison,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(
        `Complexity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private calculateComplexityRating(metrics: Record<string, number>): 'low' | 'medium' | 'high' | 'very_high' {
    let score = 0;

    if (metrics.cyclomatic_complexity > 20) {score += 3;} else if (metrics.cyclomatic_complexity > 10) {score += 2;} else if (metrics.cyclomatic_complexity > 5) {score += 1;}

    if (metrics.cognitive_complexity > 25) {score += 3;} else if (metrics.cognitive_complexity > 15) {score += 2;} else if (metrics.cognitive_complexity > 7) {score += 1;}

    if (metrics.lines_of_code > 100) {score += 2;} else if (metrics.lines_of_code > 50) {score += 1;}

    if (metrics.maintainability_index < 20) {score += 3;} else if (metrics.maintainability_index < 40) {score += 2;} else if (metrics.maintainability_index < 60) {score += 1;}

    if (score >= 8) {return 'very_high';}
    if (score >= 5) {return 'high';}
    if (score >= 2) {return 'medium';}
    return 'low';
  }

  private buildMetricsDetails(metrics: Record<string, number>): MetricDetail[] {
    const details: MetricDetail[] = [];

    if (metrics.cyclomatic_complexity !== undefined) {
      details.push({
        metric_name: 'Cyclomatic Complexity',
        value: metrics.cyclomatic_complexity,
        threshold: 10,
        status:
          metrics.cyclomatic_complexity > 10
            ? 'critical'
            : metrics.cyclomatic_complexity > 5
              ? 'warning'
              : 'good',
        description: 'Measures the number of linearly independent paths through code',
      });
    }

    if (metrics.cognitive_complexity !== undefined) {
      details.push({
        metric_name: 'Cognitive Complexity',
        value: metrics.cognitive_complexity,
        threshold: 15,
        status:
          metrics.cognitive_complexity > 15
            ? 'critical'
            : metrics.cognitive_complexity > 7
              ? 'warning'
              : 'good',
        description: 'Measures how difficult code is to understand',
      });
    }

    if (metrics.lines_of_code !== undefined) {
      details.push({
        metric_name: 'Lines of Code',
        value: metrics.lines_of_code,
        threshold: 50,
        status:
          metrics.lines_of_code > 100
            ? 'critical'
            : metrics.lines_of_code > 50
              ? 'warning'
              : 'good',
        description: 'Total number of lines of code',
      });
    }

    if (metrics.maintainability_index !== undefined) {
      details.push({
        metric_name: 'Maintainability Index',
        value: metrics.maintainability_index,
        threshold: 60,
        status:
          metrics.maintainability_index < 40
            ? 'critical'
            : metrics.maintainability_index < 60
              ? 'warning'
              : 'good',
        description: 'Composite metric indicating how maintainable the code is',
      });
    }

    return details;
  }

  private generateSuggestions(metrics: Record<string, number>, rating: string): string[] {
    const suggestions: string[] = [];

    if (metrics.cyclomatic_complexity > 10) {
      suggestions.push('Consider breaking down this function into smaller, more focused functions');
      suggestions.push('Reduce the number of conditional statements and loops');
    }

    if (metrics.cognitive_complexity > 15) {
      suggestions.push('Simplify nested logic and reduce cognitive load');
      suggestions.push('Extract complex conditions into well-named boolean variables');
    }

    if (metrics.lines_of_code > 50) {
      suggestions.push('Consider splitting this function into smaller functions');
      suggestions.push('Extract reusable code blocks into separate methods');
    }

    if (metrics.maintainability_index < 60) {
      suggestions.push('Improve code readability with better variable names and comments');
      suggestions.push('Reduce code duplication and improve structure');
    }

    if (rating === 'very_high') {
      suggestions.push('This code requires immediate refactoring due to high complexity');
    }

    return suggestions;
  }

  private async getBenchmarkComparison(_entity: unknown, _metrics: unknown): Promise<BenchmarkComparison> {
    // This would compare against similar functions in the codebase
    // For now, return mock data
    return {
      percentile: 75,
      similar_functions: 42,
      better_than_percent: 60,
    };
  }
}

export default CheckComplexityTool;
