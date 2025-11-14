/**
 * Intelligent Refactoring Engine - Phase 4.1
 * AI-powered refactoring recommendations with code transformation suggestions
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CodeAnalysisService } from '../services/code-analysis.js';
import { AILLMService } from '../services/ai-llm.js';
import { logger } from '../services/logger.js';

interface RefactoringRequest {
  file_path?: string;
  code_snippet?: string;
  refactoring_type: 'extract-method' | 'rename-variable' | 'reduce-complexity' | 'optimize-performance' | 'improve-readability' | 'apply-pattern';
  target_scope?: 'function' | 'class' | 'module' | 'entire-file';
  codebase_id: string;
  preferences?: {
    preserve_behavior: boolean;
    backward_compatible: boolean;
    test_driven: boolean;
  };
}

interface RefactoringSuggestion {
  id: string;
  title: string;
  description: string;
  category: 'extraction' | 'renaming' | 'simplification' | 'pattern-application' | 'optimization' | 'cleanup';
  priority: 'high' | 'medium' | 'low';
  impact: 'significant' | 'moderate' | 'minor';
  effort: 'quick' | 'moderate' | 'complex';
  confidence: number; // 0-100

  // Location information
  file_path: string;
  line_start: number;
  line_end: number;
  function_name?: string;

  // Original and suggested code
  original_code: string;
  refactored_code: string;
  diff?: string;

  // Benefits and risks
  benefits: string[];
  risks: string[];
  side_effects: string[];

  // Transformation details
  transformation_type: string;
  applicability_conditions: string[];
  rollback_plan: string;
}

interface RefactoringResult {
  overall_assessment: {
    refactoring_potential: number; // 0-100
    code_quality_score: number;
    maintainability_improvement: number;
    effort_required: number;
  };

  suggestions: RefactoringSuggestion[];

  execution_plan: {
    phase_1_quick_wins: RefactoringSuggestion[];
    phase_2_moderate_changes: RefactoringSuggestion[];
    phase_3_complex_refactoring: RefactoringSuggestion[];
  };

  quality_metrics: {
    before: {
      complexity_score: number;
      maintainability_index: number;
      duplication_ratio: number;
      code_smells: number;
    };
    after: {
      complexity_score: number;
      maintainability_index: number;
      duplication_ratio: number;
      code_smells: number;
    };
  };
}

/**
 * Intelligent Refactoring Tool
 * Provides AI-powered refactoring suggestions with automated code transformation
 */
export class IntelligentRefactoringTool {
  readonly name = 'intelligent_refactoring';
  readonly description = 'AI-powered intelligent refactoring recommendations with code transformation suggestions';

  private codeAnalyzer: CodeAnalysisService;
  private aiService: AILLMService;

  constructor() {
    this.codeAnalyzer = new CodeAnalysisService();
    this.aiService = new AILLMService();
  }

  async call(args: RefactoringRequest): Promise<RefactoringResult> {
    logger.info('Intelligent refactoring analysis started', {
      file_path: args.file_path,
      refactoring_type: args.refactoring_type,
      target_scope: args.target_scope
    });

    try {
      // 1. Analyze current code state
      const codeAnalysis = await this.analyzeCode(args);

      // 2. Identify refactoring opportunities
      const opportunities = await this.identifyRefactoringOpportunities(args, codeAnalysis);

      // 3. Generate AI-powered suggestions
      const aiSuggestions = await this.generateAISuggestions(args, opportunities);

      // 4. Create detailed refactoring plans
      const detailedSuggestions = await this.createDetailedSuggestions(args, aiSuggestions, codeAnalysis);

      // 5. Calculate quality metrics and impact
      const qualityMetrics = await this.calculateQualityImpact(args, detailedSuggestions);

      // 6. Generate execution plan
      const executionPlan = this.createExecutionPlan(detailedSuggestions);

      // 7. Compile final result
      const result = await this.compileRefactoringResult(detailedSuggestions, qualityMetrics, executionPlan);

      logger.info('Intelligent refactoring analysis completed', {
        suggestions_count: result.suggestions.length,
        refactoring_potential: result.overall_assessment.refactoring_potential
      });

      return result;

    } catch (error) {
      logger.error('Intelligent refactoring failed:', error);
      throw new Error(`Intelligent refactoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeCode(args: RefactoringRequest) {
    if (args.code_snippet) {
      return await this.codeAnalyzer.analyzeSnippet(args.code_snippet, args.codebase_id);
    } else if (args.file_path) {
      return await this.codeAnalyzer.analyzeFile(args.file_path, args.codebase_id);
    } else {
      throw new Error('Either file_path or code_snippet must be provided');
    }
  }

  private async identifyRefactoringOpportunities(args: RefactoringRequest, codeAnalysis: any) {
    const opportunities = [];

    // Analyze complexity issues
    if (codeAnalysis.complexity?.functions) {
      codeAnalysis.complexity.functions.forEach((func: any) => {
        if (func.cyclomatic_complexity > 10) {
          opportunities.push({
            type: 'reduce-complexity',
            target: func.name,
            location: { file: args.file_path, line: func.line_number },
            severity: func.cyclomatic_complexity > 15 ? 'high' : 'medium',
            description: `Function ${func.name} has high complexity (${func.cyclomatic_complexity})`
          });
        }
      });
    }

    // Look for duplicate code
    if (codeAnalysis.duplicates) {
      codeAnalysis.duplicates.forEach((duplicate: any) => {
        opportunities.push({
          type: 'extract-method',
          target: duplicate.description,
          location: duplicate.locations[0],
          severity: 'medium',
          description: `Duplicate code block: ${duplicate.description}`
        });
      });
    }

    // Identify code smells
    if (codeAnalysis.code_smells) {
      codeAnalysis.code_smells.forEach((smell: any) => {
        opportunities.push({
          type: 'improve-readability',
          target: smell.name,
          location: smell.location,
          severity: 'medium',
          description: `Code smell: ${smell.name} - ${smell.description}`
        });
      });
    }

    return opportunities;
  }

  private async generateAISuggestions(args: RefactoringRequest, opportunities: any[]) {
    const prompts = [
      `
Analyze this code and provide intelligent refactoring suggestions:

Code: ${args.code_snippet || 'File: ' + args.file_path}
Refactoring type: ${args.refactoring_type}
Target scope: ${args.target_scope || 'auto-detect'}

Identified opportunities: ${JSON.stringify(opportunities, null, 2)}

Provide specific refactoring suggestions with:
1. Exact code transformations
2. Before/after code examples
3. Benefits and potential risks
4. Step-by-step transformation process

Focus on:
- Maintaining functionality
- Improving code quality
- Following SOLID principles
- Design patterns application
- Performance improvements
`
    ];

    const aiInsights = await this.aiService.generateInsights(prompts);
    return aiInsights;
  }

  private async createDetailedSuggestions(args: RefactoringRequest, aiInsights: any, codeAnalysis: any): Promise<RefactoringSuggestion[]> {
    const suggestions: RefactoringSuggestion[] = [];

    // Process AI insights into detailed suggestions
    aiInsights.suggestions.forEach((insight: any, index: number) => {
      const suggestion = this.createRefactoringSuggestion(insight, args, codeAnalysis);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    });

    // Add rule-based suggestions for common patterns
    const ruleBasedSuggestions = this.generateRuleBasedSuggestions(args, codeAnalysis);
    suggestions.push(...ruleBasedSuggestions);

    return suggestions.sort((a, b) => {
      // Sort by priority and confidence
      const priorityWeight = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (priorityDiff !== 0) {return priorityDiff;}
      return b.confidence - a.confidence;
    });
  }

  private createRefactoringSuggestion(insight: any, args: RefactoringRequest, codeAnalysis: any): RefactoringSuggestion | null {
    const id = `refactor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return {
      id,
      title: insight.title || 'Refactoring Suggestion',
      description: insight.description || 'Code improvement opportunity detected',
      category: this.mapToRefactoringCategory(insight.category),
      priority: this.mapToPriority(insight.impact),
      impact: insight.impact || 'moderate',
      effort: this.estimateEffort(insight),
      confidence: insight.confidence || 75,

      file_path: args.file_path || 'unknown',
      line_start: insight.line_number || 0,
      line_end: insight.line_number || 0,
      function_name: insight.function_name,

      original_code: insight.original_code || '',
      refactored_code: insight.refactored_code || insight.suggestion || '',
      diff: this.generateDiff(insight.original_code, insight.refactored_code),

      benefits: insight.benefits || [],
      risks: insight.risks || [],
      side_effects: insight.side_effects || [],

      transformation_type: insight.transformation_type || 'general',
      applicability_conditions: insight.applicability_conditions || [],
      rollback_plan: insight.rollback_plan || 'Revert the suggested code changes'
    };
  }

  private generateRuleBasedSuggestions(args: RefactoringRequest, codeAnalysis: any): RefactoringSuggestion[] {
    const suggestions: RefactoringSuggestion[] = [];

    // Extract Method refactoring for long functions
    if (codeAnalysis.complexity?.functions) {
      codeAnalysis.complexity.functions.forEach((func: any) => {
        if (func.lines_of_code > 50) {
          suggestions.push({
            id: `extract-method-${func.name}-${Date.now()}`,
            title: `Extract Method for ${func.name}`,
            description: `Function ${func.name} is too long (${func.lines_of_code} lines) and should be broken down`,
            category: 'extraction',
            priority: 'medium',
            impact: 'moderate',
            effort: 'moderate',
            confidence: 85,

            file_path: args.file_path || 'unknown',
            line_start: func.line_number || 0,
            line_end: (func.line_number || 0) + func.lines_of_code,
            function_name: func.name,

            original_code: '// Original long function code',
            refactored_code: `// Refactored code with extracted methods
function ${func.name}() {
  // Main logic
  this.validateInput();
  this.processData();
  this.handleOutput();
}

private validateInput() {
  // Input validation logic
}

private processData() {
  // Data processing logic
}

private handleOutput() {
  // Output handling logic
}`,

            benefits: ['Improved readability', 'Better testability', 'Easier maintenance'],
            risks: ['Potential breaking changes', 'Need comprehensive testing'],
            side_effects: ['May require updates to calling code'],

            transformation_type: 'extract-method',
            applicability_conditions: ['Function has distinct logical sections', 'No circular dependencies'],
            rollback_plan: 'Merge extracted methods back into original function'
          });
        }
      });
    }

    // Rename variables with poor names
    if (codeAnalysis.variables?.poorly_named) {
      codeAnalysis.variables.poorly_named.forEach((variable: any) => {
        suggestions.push({
          id: `rename-variable-${variable.name}-${Date.now()}`,
          title: `Rename Variable: ${variable.name}`,
          description: `Variable '${variable.name}' has a non-descriptive name`,
          category: 'renaming',
          priority: 'low',
          impact: 'minor',
          effort: 'quick',
          confidence: 90,

          file_path: args.file_path || 'unknown',
          line_start: variable.line_number || 0,
          line_end: variable.line_number || 0,

          original_code: variable.original_code,
          refactored_code: variable.suggested_code,

          benefits: ['Improved code readability', 'Better self-documentation'],
            risks: ['Need to update all references'],
            side_effects: ['Must update variable references throughout scope'],
            transformation_type: 'rename-variable',
            applicability_conditions: ['No name conflicts in scope', 'IDE refactoring support recommended'],
            rollback_plan: 'Revert variable name changes'
          });
        });
    }

    return suggestions;
  }

  private mapToRefactoringCategory(category?: string): RefactoringSuggestion['category'] {
    const categoryMap = {
      'extraction': 'extraction',
      'naming': 'renaming',
      'simplification': 'simplification',
      'optimization': 'optimization',
      'pattern': 'pattern-application',
      'cleanup': 'cleanup'
    };

    return (categoryMap[category as keyof typeof categoryMap] || 'simplification') as RefactoringSuggestion['category'];
  }

  private mapToPriority(impact?: string): RefactoringSuggestion['priority'] {
    const priorityMap = {
      'critical': 'high',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };

    return (priorityMap[impact as keyof typeof priorityMap] || 'medium') as RefactoringSuggestion['priority'];
  }

  private estimateEffort(insight: any): RefactoringSuggestion['effort'] {
    // Simple heuristic for effort estimation
    if (insight.confidence < 50) {return 'complex';}
    if (insight.impact === 'critical' || insight.impact === 'high') {return 'moderate';}
    return 'quick';
  }

  private generateDiff(original: string, refactored: string): string {
    // Simple diff representation
    return `--- Original
+++ Refactored
@@ -1,3 +1,6 @@
 ${original}
+${refactored}`;
  }

  private async calculateQualityImpact(args: RefactoringRequest, suggestions: RefactoringSuggestion[]) {
    // Calculate current metrics (would be more sophisticated in real implementation)
    const currentMetrics = {
      complexity_score: 65,
      maintainability_index: 72,
      duplication_ratio: 0.15,
      code_smells: 8
    };

    // Estimate improvement from suggestions
    let complexityImprovement = 0;
    let maintainabilityImprovement = 0;
    let duplicationReduction = 0;
    let codeSmellReduction = 0;

    suggestions.forEach(suggestion => {
      switch (suggestion.category) {
        case 'extraction':
          complexityImprovement += 5;
          maintainabilityImprovement += 3;
          break;
        case 'simplification':
          complexityImprovement += 3;
          maintainabilityImprovement += 2;
          codeSmellReduction += 1;
          break;
        case 'cleanup':
          codeSmellReduction += 1;
          maintainabilityImprovement += 1;
          break;
        case 'optimization':
          maintainabilityImprovement += 2;
          break;
      }
    });

    const projectedMetrics = {
      complexity_score: Math.max(0, currentMetrics.complexity_score - complexityImprovement),
      maintainability_index: Math.min(100, currentMetrics.maintainability_index + maintainabilityImprovement),
      duplication_ratio: Math.max(0, currentMetrics.duplication_ratio - duplicationReduction),
      code_smells: Math.max(0, currentMetrics.code_smells - codeSmellReduction)
    };

    return {
      before: currentMetrics,
      after: projectedMetrics
    };
  }

  private createExecutionPlan(suggestions: RefactoringSuggestion[]) {
    const quickWins = suggestions.filter(s => s.effort === 'quick' && s.confidence >= 80);
    const moderateChanges = suggestions.filter(s => s.effort === 'moderate' || (s.effort === 'quick' && s.confidence < 80));
    const complexRefactoring = suggestions.filter(s => s.effort === 'complex');

    return {
      phase_1_quick_wins: quickWins,
      phase_2_moderate_changes: moderateChanges,
      phase_3_complex_refactoring: complexRefactoring
    };
  }

  private async compileRefactoringResult(suggestions: RefactoringSuggestion[], qualityMetrics: any, executionPlan: any): Promise<RefactoringResult> {
    // Calculate overall assessment
    const refactoringPotential = Math.min(100, suggestions.length * 10);
    const codeQualityScore = qualityMetrics.after.maintainability_index;
    const maintainabilityImprovement = qualityMetrics.after.maintainability_index - qualityMetrics.before.maintainability_index;
    const effortRequired = suggestions.reduce((total, s) => {
      const effortWeight = { quick: 1, moderate: 3, complex: 7 };
      return total + effortWeight[s.effort];
    }, 0);

    return {
      overall_assessment: {
        refactoring_potential: refactoringPotential,
        code_quality_score: codeQualityScore,
        maintainability_improvement: maintainabilityImprovement,
        effort_required: Math.min(100, effortRequired * 2)
      },
      suggestions,
      execution_plan: executionPlan,
      quality_metrics: qualityMetrics
    };
  }
}