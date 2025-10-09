 
 
 
 
 
 
// import type { Tool } from '@modelcontextprotocol/sdk/types.js'; // Rule 15: Import reserved for future implementation
import { z } from 'zod';
import { codebaseService } from '../services/codebase-service.js';

const SuggestRefactoringInputSchema = z.object({
  entity_id: z.string().uuid('Invalid entity ID'),
  refactoring_types: z
    .array(
      z.enum([
        'extract_method',
        'extract_class',
        'rename',
        'move_method',
        'inline',
        'simplify_conditionals',
        'remove_duplicates',
        'improve_naming',
        'reduce_complexity',
        'all',
      ]),
    )
    .default(['all']),
  priority_focus: z
    .enum(['maintainability', 'performance', 'readability', 'testability'])
    .default('maintainability'),
  include_code_examples: z.boolean().default(true),
  include_impact_analysis: z.boolean().default(true),
  max_suggestions: z.number().min(1).max(20).default(10),
});

// Rule 15: Type reserved for future implementation
type SuggestRefactoringInput = z.infer<typeof SuggestRefactoringInputSchema>;

interface RefactoringSuggestions {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  file_path: string;
  current_metrics: CodeMetrics;
  suggestions: RefactoringSuggestion[];
  priority_ranking: PriorityRanking;
  estimated_effort: EffortEstimate;
}

interface RefactoringSuggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  rationale: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimated_effort: 'small' | 'medium' | 'large';
  expected_benefits: string[];
  potential_risks: string[];
  code_example?: CodeExample;
  impact_analysis?: ImpactAnalysis;
  implementation_steps: string[];
}

interface CodeExample {
  before: string;
  after: string;
  explanation: string;
}

interface ImpactAnalysis {
  affected_files: string[];
  breaking_changes: boolean;
  test_updates_required: boolean;
  performance_impact: 'positive' | 'neutral' | 'negative';
  maintainability_improvement: number; // 1-10 scale
}

interface CodeMetrics {
  complexity: number;
  lines_of_code: number;
  maintainability_index: number;
  test_coverage?: number;
  code_smells: string[];
}

interface PriorityRanking {
  highest_impact: string[];
  quick_wins: string[];
  long_term_improvements: string[];
}

interface EffortEstimate {
  total_hours: number;
  complexity_level: 'simple' | 'moderate' | 'complex';
  required_skills: string[];
  dependencies: string[];
}

export class SuggestRefactoringTool {
  name = 'suggest_refactoring';
  description = 'Suggest refactoring improvements for code entities';

  private codebaseService = codebaseService;
  private refactoringService = {
    analyzeMetrics: async (entity: any) => ({ complexity: 5, maintainability: 7 }),
    detectCodeSmells: async (entity: any) => [],
    generateSuggestions: async (entity: any, types: string[], focus: string) => [],
  };

  inputSchema = {
    type: 'object',
    properties: {
      entity_id: {
        type: 'string',
        description: 'UUID of the code entity to analyze for refactoring',
      },
      refactoring_types: {
        type: 'array',
        items: {
          type: 'string',
          enum: [
            'extract_method',
            'extract_class',
            'rename',
            'move_method',
            'inline',
            'simplify_conditionals',
            'remove_duplicates',
            'improve_naming',
            'reduce_complexity',
            'all',
          ],
        },
        description: 'Types of refactoring to suggest',
        default: ['all'],
      },
      priority_focus: {
        type: 'string',
        enum: ['maintainability', 'performance', 'readability', 'testability'],
        description: 'Primary focus for refactoring suggestions',
        default: 'maintainability',
      },
      include_code_examples: {
        type: 'boolean',
        description: 'Include before/after code examples',
        default: true,
      },
      include_impact_analysis: {
        type: 'boolean',
        description: 'Include impact analysis for suggestions',
        default: true,
      },
      max_suggestions: {
        type: 'number',
        minimum: 1,
        maximum: 20,
        description: 'Maximum number of suggestions to return',
        default: 10,
      },
    },
    required: ['entity_id'],
  };

  // Constructor removed - services injected via dependency injection

  async call(args: unknown): Promise<RefactoringSuggestions> {
    try {
      const input = SuggestRefactoringInputSchema.parse(args);

      const entity = await this.codebaseService.getCodeEntity(input.entity_id);
      if (!entity) {
        throw new Error(`Code entity with ID ${input.entity_id} not found`);
      }

      const currentMetrics = await this.analyzeCurrentMetrics(entity);
      const suggestions = await this.generateSuggestions(entity, input, currentMetrics);
      const priorityRanking = this.calculatePriorityRanking(suggestions);
      const effortEstimate = this.calculateEffortEstimate(suggestions);

      return {
        entity_id: (entity).id,
        entity_name: entity.name,
        entity_type: (entity).entity_type,
        file_path: (entity).file_path,
        current_metrics: currentMetrics,
        suggestions: suggestions.slice(0, input.max_suggestions),
        priority_ranking: priorityRanking,
        estimated_effort: effortEstimate,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(
        `Refactoring analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async analyzeCurrentMetrics(entity: unknown): Promise<CodeMetrics> {
    const metrics = await this.refactoringService.analyzeMetrics(entity);
    const codeSmells = await this.refactoringService.detectCodeSmells(entity);

    return {
      complexity: metrics.complexity || 0,
      lines_of_code: 100, // Mock value
      maintainability_index: metrics.maintainability || 0,
      test_coverage: 0.8, // Mock value
      code_smells: codeSmells.map(
        smell => smell.description || smell.type || 'Code smell detected',
      ),
    };
  }

  private async generateSuggestions(
    entity: unknown,
    input: SuggestRefactoringInput,
    metrics: CodeMetrics,
  ): Promise<RefactoringSuggestion[]> {
    const suggestions: RefactoringSuggestion[] = [];
    const refactoringTypes = input.refactoring_types.includes('all')
      ? [
          'extract_method',
          'extract_class',
          'rename',
          'move_method',
          'inline',
          'simplify_conditionals',
          'remove_duplicates',
          'improve_naming',
          'reduce_complexity',
        ]
      : input.refactoring_types;

    for (const type of refactoringTypes) {
      const typeSuggestions = await this.generateSuggestionsForType(entity, type, input, metrics);
      suggestions.push(...typeSuggestions);
    }

    // Sort by priority and focus
    return this.sortSuggestionsByPriority(suggestions, input.priority_focus);
  }

  private async generateSuggestionsForType(
    entity: unknown,
    type: string,
    input: SuggestRefactoringInput,
    metrics: CodeMetrics,
  ): Promise<RefactoringSuggestion[]> {
    const suggestions: RefactoringSuggestion[] = [];

    switch (type) {
      case 'extract_method':
        if (metrics.lines_of_code > 30 || metrics.complexity > 10) {
          suggestions.push(await this.createExtractMethodSuggestion(entity, input, metrics));
        }
        break;

      case 'extract_class':
        if (metrics.lines_of_code > 200 || (entity as any).entity_type === 'class') {
          suggestions.push(await this.createExtractClassSuggestion(entity, input, metrics));
        }
        break;

      case 'rename':
        if (metrics.code_smells.includes('poor_naming')) {
          suggestions.push(await this.createRenameSuggestion(entity, input, metrics));
        }
        break;

      case 'simplify_conditionals':
        if (metrics.complexity > 15 || metrics.code_smells.includes('complex_conditionals')) {
          suggestions.push(await this.createSimplifyConditionalsSuggestion(entity, input, metrics));
        }
        break;

      case 'reduce_complexity':
        if (metrics.complexity > 10) {
          suggestions.push(await this.createReduceComplexitySuggestion(entity, input, metrics));
        }
        break;

      case 'improve_naming':
        if (metrics.code_smells.includes('unclear_naming')) {
          suggestions.push(await this.createImproveNamingSuggestion(entity, input, metrics));
        }
        break;
    }

    return suggestions.filter(s => s !== null);
  }

  private async createExtractMethodSuggestion(
    entity: unknown,
    input: SuggestRefactoringInput,
    metrics: CodeMetrics,
  ): Promise<RefactoringSuggestion> {
    const codeExample = input.include_code_examples
      ? await this.generateExtractMethodExample(entity)
      : undefined;
    const impactAnalysis = input.include_impact_analysis
      ? await this.analyzeExtractMethodImpact(entity)
      : undefined;

    return {
      id: `extract_method_${(entity as any).id}`,
      type: 'extract_method',
      title: 'Extract Method',
      description: 'Break down this large function into smaller, more focused methods',
      rationale: `Function has ${metrics.lines_of_code} lines and complexity of ${metrics.complexity}, making it difficult to understand and maintain`,
      priority: metrics.lines_of_code > 50 ? 'high' : 'medium',
      estimated_effort: metrics.lines_of_code > 100 ? 'large' : 'medium',
      expected_benefits: [
        'Improved readability and maintainability',
        'Better testability of individual components',
        'Reduced cognitive complexity',
        'Enhanced code reusability',
      ],
      potential_risks: [
        'May introduce additional method calls',
        'Requires careful parameter passing',
        'Could affect performance if over-extracted',
      ],
      code_example: codeExample,
      impact_analysis: impactAnalysis,
      implementation_steps: [
        'Identify logical code blocks that can be extracted',
        'Determine appropriate method signatures',
        'Extract methods with descriptive names',
        'Update tests to cover new methods',
        'Verify functionality remains unchanged',
      ],
    };
  }

  private async createReduceComplexitySuggestion(
    entity: unknown,
    input: SuggestRefactoringInput,
    metrics: CodeMetrics,
  ): Promise<RefactoringSuggestion> {
    return {
      id: `reduce_complexity_${(entity as any).id}`,
      type: 'reduce_complexity',
      title: 'Reduce Cyclomatic Complexity',
      description: 'Simplify control flow to reduce complexity',
      rationale: `Current complexity of ${metrics.complexity} exceeds recommended threshold of 10`,
      priority: metrics.complexity > 20 ? 'critical' : 'high',
      estimated_effort: 'medium',
      expected_benefits: [
        'Easier to understand and debug',
        'Reduced likelihood of bugs',
        'Better test coverage',
        'Improved maintainability',
      ],
      potential_risks: [
        'May require significant restructuring',
        'Could introduce new abstractions',
      ],
      implementation_steps: [
        'Identify complex conditional logic',
        'Extract conditions into well-named boolean methods',
        'Consider using strategy pattern for complex branching',
        'Simplify nested loops and conditions',
        'Add comprehensive tests',
      ],
    };
  }

  private async createSimplifyConditionalsSuggestion(
    entity: unknown,
    _input: SuggestRefactoringInput,
    _metrics: CodeMetrics,
  ): Promise<RefactoringSuggestion> {
    return {
      id: `simplify_conditionals_${(entity as any).id}`,
      type: 'simplify_conditionals',
      title: 'Simplify Conditional Logic',
      description: 'Refactor complex conditional statements for better readability',
      rationale: 'Complex conditional logic detected that can be simplified',
      priority: 'medium',
      estimated_effort: 'small',
      expected_benefits: [
        'Improved code readability',
        'Easier debugging',
        'Reduced cognitive load',
      ],
      potential_risks: ['Logic changes require careful testing'],
      implementation_steps: [
        'Extract complex conditions into boolean variables',
        'Use early returns to reduce nesting',
        'Consider guard clauses',
        'Simplify boolean expressions',
      ],
    };
  }

  private async createExtractClassSuggestion(
    entity: unknown,
    input: SuggestRefactoringInput,
    metrics: CodeMetrics,
  ): Promise<RefactoringSuggestion> {
    return {
      id: `extract_class_${(entity as any).id}`,
      type: 'extract_class',
      title: 'Extract Class',
      description: 'Split large class into smaller, more focused classes',
      rationale: `Class has ${metrics.lines_of_code} lines, indicating multiple responsibilities`,
      priority: metrics.lines_of_code > 300 ? 'high' : 'medium',
      estimated_effort: 'large',
      expected_benefits: [
        'Better separation of concerns',
        'Improved testability',
        'Enhanced maintainability',
        'Clearer responsibilities',
      ],
      potential_risks: [
        'May require significant refactoring',
        'Could affect existing dependencies',
        'Requires careful interface design',
      ],
      implementation_steps: [
        'Identify distinct responsibilities',
        'Design new class interfaces',
        'Extract related methods and properties',
        'Update dependencies and tests',
        'Verify functionality preservation',
      ],
    };
  }

  private async createRenameSuggestion(
    entity: unknown,
    _input: SuggestRefactoringInput,
    _metrics: CodeMetrics,
  ): Promise<RefactoringSuggestion> {
    return {
      id: `rename_${(entity as any).id}`,
      type: 'rename',
      title: 'Improve Naming',
      description: 'Rename entity to better reflect its purpose',
      rationale: "Current name does not clearly convey the entity's purpose",
      priority: 'low',
      estimated_effort: 'small',
      expected_benefits: [
        'Improved code readability',
        'Better self-documenting code',
        'Clearer intent',
      ],
      potential_risks: ['Requires updating all references', 'May affect external APIs'],
      implementation_steps: [
        'Choose descriptive, intention-revealing name',
        'Use IDE refactoring tools for safe renaming',
        'Update documentation and comments',
        'Verify all references are updated',
      ],
    };
  }

  private async createImproveNamingSuggestion(
    entity: unknown,
    _input: SuggestRefactoringInput,
    _metrics: CodeMetrics,
  ): Promise<RefactoringSuggestion> {
    return {
      id: `improve_naming_${(entity as any).id}`,
      type: 'improve_naming',
      title: 'Improve Variable and Method Names',
      description: 'Use more descriptive names for better code clarity',
      rationale: 'Unclear or abbreviated names detected',
      priority: 'low',
      estimated_effort: 'small',
      expected_benefits: [
        'Enhanced code readability',
        'Reduced need for comments',
        'Better maintainability',
      ],
      potential_risks: ['Minimal risk with proper IDE support'],
      implementation_steps: [
        'Identify unclear variable and method names',
        'Choose intention-revealing names',
        'Use consistent naming conventions',
        'Update related documentation',
      ],
    };
  }

  private async generateExtractMethodExample(_entity: unknown): Promise<CodeExample> {
    // This would use LLM to generate actual code examples
    return {
      before: '// Original long method with multiple responsibilities',
      after: '// Refactored into smaller, focused methods',
      explanation: 'Method extracted into logical components for better maintainability',
    };
  }

  private async analyzeExtractMethodImpact(entity: unknown): Promise<ImpactAnalysis> {
    return {
      affected_files: [(entity as any).file_path],
      breaking_changes: false,
      test_updates_required: true,
      performance_impact: 'neutral',
      maintainability_improvement: 8,
    };
  }

  private sortSuggestionsByPriority(
    suggestions: RefactoringSuggestion[],
    focus: string,
  ): RefactoringSuggestion[] {
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };

    return suggestions.sort((a, b) => {
      // First sort by priority
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) {return priorityDiff;}

      // Then by focus-specific criteria
      if (focus === 'maintainability') {
        return (
          (b.impact_analysis?.maintainability_improvement ?? 0) -
          (a.impact_analysis?.maintainability_improvement ?? 0)
        );
      }

      return 0;
    });
  }

  private calculatePriorityRanking(suggestions: RefactoringSuggestion[]): PriorityRanking {
    const highestImpact = suggestions
      .filter(s => s.priority === 'critical' || s.priority === 'high')
      .map(s => s.id);

    const quickWins = suggestions
      .filter(s => s.estimated_effort === 'small' && s.priority !== 'low')
      .map(s => s.id);

    const longTermImprovements = suggestions
      .filter(s => s.estimated_effort === 'large')
      .map(s => s.id);

    return {
      highest_impact: highestImpact,
      quick_wins: quickWins,
      long_term_improvements: longTermImprovements,
    };
  }

  private calculateEffortEstimate(suggestions: RefactoringSuggestion[]): EffortEstimate {
    const effortHours = {
      small: 2,
      medium: 8,
      large: 24,
    };

    const totalHours = suggestions.reduce((sum, s) => sum + (effortHours[s.estimated_effort] ?? 0), 0);

    const hasLargeEffort = suggestions.some(s => s.estimated_effort === 'large');
    const complexityLevel = hasLargeEffort ? 'complex' : totalHours > 16 ? 'moderate' : 'simple';

    return {
      total_hours: totalHours,
      complexity_level: complexityLevel,
      required_skills: ['refactoring', 'code_analysis', 'testing'],
      dependencies: ['IDE_refactoring_tools', 'comprehensive_tests'],
    };
  }
}

export default SuggestRefactoringTool;
