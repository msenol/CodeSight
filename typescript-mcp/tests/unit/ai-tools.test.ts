/**
 * Unit Tests for Phase 4.1 AI Tools
 *
 * Tests for AI-powered code analysis tools implemented in Phase 4.1
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AICodeReviewTool } from '../../src/tools/ai-code-review.js';
import { BugPredictionTool } from '../../src/tools/bug-prediction.js';
import { ContextAwareCodegenTool } from '../../src/tools/context-aware-codegen.js';
import { IntelligentRefactoringTool } from '../../src/tools/intelligent-refactoring.js';
import { TechnicalDebtAnalysisTool } from '../../src/tools/technical-debt-analysis.js';

// Mock dependencies
vi.mock('../../src/services/code-analysis.js', () => ({
  CodeAnalysisService: vi.fn().mockImplementation(() => ({
    analyzeSnippet: vi.fn().mockResolvedValue({
      complexity: { overall_score: 50, functions: [] },
      testing: { coverage_percentage: 75, test_count: 10 }
    }),
    analyzeFile: vi.fn().mockResolvedValue({
      complexity: { overall_score: 60, functions: [] },
      testing: { coverage_percentage: 80, test_count: 15 }
    })
  }))
}));

vi.mock('../../src/services/ai-llm.js', () => ({
  AILLMService: vi.fn().mockImplementation(() => ({
    generateInsights: vi.fn().mockResolvedValue({
      suggestions: [
        {
          title: 'Test suggestion',
          description: 'Test description',
          impact: 'medium',
          confidence: 80,
          category: 'best-practices'
        }
      ]
    })
  }))
}));

vi.mock('../../src/services/security-analyzer.js', () => ({
  SecurityAnalyzer: vi.fn().mockImplementation(() => ({
    analyze: vi.fn().mockResolvedValue({
      overall_score: 85,
      vulnerabilities: [],
      risk_assessment: {
        critical_issues: 0,
        high_issues: 1,
        medium_issues: 2,
        low_issues: 3
      },
      security_posture: 'good',
      recommendations: [],
      compliance: {
        standards_checked: ['OWASP Top 10'],
        compliance_score: 90,
        gaps: []
      }
    })
  }))
}));

describe('Phase 4.1 AI Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AICodeReviewTool', () => {
    let tool: AICodeReviewTool;

    beforeEach(() => {
      tool = new AICodeReviewTool();
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('ai_code_review');
      expect(tool.description).toBe('AI-powered comprehensive code review with intelligent suggestions and analysis');
    });

    it('should perform basic code review', async () => {
      const request = {
        code_snippet: 'function test() { return true; }',
        review_type: 'basic' as const,
        codebase_id: 'test-codebase'
      };

      const result = await tool.call(request);

      expect(result).toHaveProperty('overall_score');
      expect(result).toHaveProperty('issues');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('recommendations');
      expect(typeof result.overall_score).toBe('number');
      expect(Array.isArray(result.issues)).toBe(true);
    });

    it('should perform comprehensive code review', async () => {
      const request = {
        file_path: '/test/file.js',
        review_type: 'comprehensive' as const,
        codebase_id: 'test-codebase'
      };

      const result = await tool.call(request);

      expect(result.metrics).toHaveProperty('complexity_score');
      expect(result.metrics).toHaveProperty('maintainability_index');
      expect(result.metrics).toHaveProperty('security_score');
    });

    it('should perform security-focused review', async () => {
      const request = {
        code_snippet: 'const sql = "SELECT * FROM users WHERE id = " + userId;',
        review_type: 'security-focused' as const,
        codebase_id: 'test-codebase'
      };

      const result = await tool.call(request);

      expect(result.metrics.security_score).toBeDefined();
      expect(Array.isArray(result.issues.filter(i => i.category === 'security'))).toBe(true);
    });

    it('should handle performance-focused review', async () => {
      const request = {
        code_snippet: 'for(let i = 0; i < 1000000; i++) { array.push(i); }',
        review_type: 'performance-focused' as const,
        codebase_id: 'test-codebase'
      };

      const result = await tool.call(request);

      expect(result).toHaveProperty('overall_score');
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });

  describe('BugPredictionTool', () => {
    let tool: BugPredictionTool;

    beforeEach(() => {
      tool = new BugPredictionTool();
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('bug_prediction');
      expect(tool.description).toBe('AI-powered bug prediction and proactive risk assessment');
    });

    it('should predict bugs for code snippet', async () => {
      const request = {
        code_snippet: 'function divide(a, b) { return a / b; }',
        codebase_id: 'test-codebase',
        analysis_depth: 'standard' as const
      };

      const result = await tool.call(request);

      expect(result).toHaveProperty('overall_risk_score');
      expect(result).toHaveProperty('predicted_bugs');
      expect(result).toHaveProperty('risk_factors');
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.predicted_bugs)).toBe(true);
    });

    it('should analyze file for bugs', async () => {
      const request = {
        file_path: '/test/complex-file.js',
        codebase_id: 'test-codebase',
        analysis_depth: 'deep' as const
      };

      const result = await tool.call(request);

      expect(result.overall_risk_score).toBeGreaterThanOrEqual(0);
      expect(result.overall_risk_score).toBeLessThanOrEqual(100);
      expect(Array.isArray(result.risk_factors)).toBe(true);
    });

    it('should provide mitigation strategies', async () => {
      const request = {
        code_snippet: 'try { dangerousOperation(); } catch(e) { /* ignore */ }',
        codebase_id: 'test-codebase',
        analysis_depth: 'standard' as const
      };

      const result = await tool.call(request);

      expect(Array.isArray(result.recommendations)).toBe(true);
      if (result.recommendations.length > 0) {
        expect(result.recommendations[0]).toHaveProperty('strategy');
        expect(result.recommendations[0]).toHaveProperty('priority');
      }
    });
  });

  describe('ContextAwareCodegenTool', () => {
    let tool: ContextAwareCodegenTool;

    beforeEach(() => {
      tool = new ContextAwareCodegenTool();
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('context_aware_code_generation');
      expect(tool.description).toBe('AI-powered context-aware code generation with project understanding');
    });

    it('should generate code based on requirements', async () => {
      const request = {
        requirement: 'Create a function to validate email addresses',
        context: {
          language: 'typescript',
          style: 'functional',
          libraries: ['regex']
        },
        codebase_id: 'test-codebase'
      };

      const result = await tool.call(request);

      expect(result).toHaveProperty('generated_code');
      expect(result).toHaveProperty('confidence_score');
      expect(result).toHaveProperty('suggestions');
      expect(typeof result.generated_code).toBe('string');
      expect(result.generated_code.length).toBeGreaterThan(0);
    });

    it('should provide integration guidance', async () => {
      const request = {
        requirement: 'Add logging to existing function',
        file_path: '/test/service.js',
        codebase_id: 'test-codebase'
      };

      const result = await tool.call(request);

      expect(result).toHaveProperty('integration_plan');
      expect(result).toHaveProperty('validation_results');
      expect(Array.isArray(result.alternatives)).toBe(true);
    });

    it('should adapt to project context', async () => {
      const request = {
        requirement: 'Create API endpoint',
        context: {
          framework: 'express',
          patterns: ['mvc', 'rest'],
          conventions: ['camelCase', 'async/await']
        },
        codebase_id: 'test-codebase'
      };

      const result = await tool.call(request);

      expect(result.context_analysis).toBeDefined();
      expect(typeof result.confidence_score).toBe('number');
      expect(result.confidence_score).toBeGreaterThanOrEqual(0);
      expect(result.confidence_score).toBeLessThanOrEqual(100);
    });
  });

  describe('IntelligentRefactoringTool', () => {
    let tool: IntelligentRefactoringTool;

    beforeEach(() => {
      tool = new IntelligentRefactoringTool();
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('intelligent_refactoring');
      expect(tool.description).toBe('AI-powered intelligent refactoring recommendations with code transformation suggestions');
    });

    it('should suggest refactoring opportunities', async () => {
      const request = {
        code_snippet: `
          function process(data) {
            if (data.type === 'user') {
              return data.name + ' is a user';
            } else if (data.type === 'admin') {
              return data.name + ' is an admin';
            } else {
              return data.name + ' is unknown';
            }
          }
        `,
        refactoring_type: 'extract-method' as const,
        codebase_id: 'test-codebase'
      };

      const result = await tool.call(request);

      expect(result).toHaveProperty('refactoring_opportunities');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('quality_metrics');
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it('should provide transformation suggestions', async () => {
      const request = {
        code_snippet: 'var x = 1; var y = 2; var z = x + y;',
        refactoring_type: 'modernize' as const,
        codebase_id: 'test-codebase'
      };

      const result = await tool.call(request);

      expect(Array.isArray(result.suggestions)).toBe(true);
      if (result.suggestions.length > 0) {
        expect(result.suggestions[0]).toHaveProperty('type');
        expect(result.suggestions[0]).toHaveProperty('description');
        expect(result.suggestions[0]).toHaveProperty('transformed_code');
      }
    });

    it('should estimate refactoring effort', async () => {
      const request = {
        file_path: '/test/large-file.js',
        refactoring_type: 'reduce-complexity' as const,
        codebase_id: 'test-codebase'
      };

      const result = await tool.call(request);

      expect(result).toHaveProperty('effort_estimation');
      if (result.effort_estimation) {
        expect(result.effort_estimation).toHaveProperty('complexity_score');
        expect(result.effort_estimation).toHaveProperty('maintainability_improvement');
        expect(result.effort_estimation).toHaveProperty('effort_required');
      }
    });
  });

  describe('TechnicalDebtAnalysisTool', () => {
    let tool: TechnicalDebtAnalysisTool;

    beforeEach(() => {
      tool = new TechnicalDebtAnalysisTool();
    });

    it('should have correct name and description', () => {
      expect(tool.name).toBe('technical_debt_analysis');
      expect(tool.description).toBe('Comprehensive technical debt assessment and prioritization with business impact analysis');
    });

    it('should analyze technical debt', async () => {
      const request = {
        file_path: '/test/legacy-code.js',
        scope: 'file' as const,
        codebase_id: 'test-codebase'
      };

      const result = await tool.call(request);

      expect(result).toHaveProperty('debt_summary');
      expect(result).toHaveProperty('debt_items');
      expect(result).toHaveProperty('priority_matrix');
      expect(result).toHaveProperty('financial_impact');
      expect(Array.isArray(result.debt_items)).toBe(true);
    });

    it('should provide business impact analysis', async () => {
      const request = {
        file_path: '/test/critical-module.js',
        scope: 'file' as const,
        codebase_id: 'test-codebase',
        business_context: {
          criticality: 'high',
          team_velocity: 'medium',
          time_to_market: 'urgent'
        }
      };

      const result = await tool.call(request);

      expect(result.financial_impact).toBeDefined();
      expect(result.actionable_plan).toBeDefined();
      if (result.financial_impact) {
        expect(result.financial_impact).toHaveProperty('current_cost_per_month');
        expect(result.financial_impact).toHaveProperty('roi_potential');
      }
    });

    it('should suggest debt reduction strategies', async () => {
      const request = {
        scope: 'codebase' as const,
        codebase_id: 'test-codebase'
      };

      const result = await tool.call(request);

      expect(result.actionable_plan).toBeDefined();
      expect(result.monitoring).toBeDefined();
      if (result.actionable_plan) {
        expect(result.actionable_plan).toHaveProperty('immediate_actions');
        expect(result.actionable_plan).toHaveProperty('short_term_goals');
      }
    });
  });
});