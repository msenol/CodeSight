/**
 * Technical Debt Analysis - Phase 4.1
 * Comprehensive technical debt assessment and prioritization
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CodeAnalysisService } from '../services/code-analysis.js';
import { AILLMService } from '../services/ai-llm.js';
import { logger } from '../services/logger.js';

interface TechnicalDebtRequest {
  file_path?: string;
  scope: 'function' | 'class' | 'module' | 'system';
  analysis_depth: 'basic' | 'comprehensive' | 'deep';
  include_recommendations: boolean;
  codebase_id: string;
  historical_data?: {
    previous_debt_score?: number;
    refactoring_history?: Array<{
      date: string;
      changes: string;
      impact: string;
    }>;
    bug_history?: Array<{
      date: string;
      module: string;
      severity: string;
      root_cause: string;
    }>;
  };
}

interface TechnicalDebtItem {
  id: string;
  title: string;
  description: string;
  category: 'code-quality' | 'architecture' | 'testing' | 'documentation' | 'performance' | 'security' | 'maintainability';
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact_score: number; // 0-100
  effort_score: number; // 0-100

  location: {
    file_path: string;
    line_start: number;
    line_end: number;
    function_name?: string;
    class_name?: string;
  };

  debt_metrics: {
    complexity_contribution: number;
    maintainability_impact: number;
    coupling_increase: number;
    test_coverage_gap: number;
    documentation_deficit: number;
  };

  business_impact: {
    development_speed_impact: number; // 0-100
    bug_likelihood_increase: number; // 0-100
    onboarding_difficulty: number; // 0-100
    feature_addition_complexity: number; // 0-100
  };

  remediation: {
    strategy: 'refactor' | 'rewrite' | 'document' | 'test' | 'optimize' | 'architectural-change';
    estimated_effort: 'hours' | 'days' | 'weeks' | 'months';
    estimated_cost: number; // Relative cost units
    risk_level: 'low' | 'medium' | 'high';
    dependencies: string[];
    rollback_complexity: 'simple' | 'moderate' | 'complex';
  };

  urgency_factors: Array<{
    factor: string;
    weight: number;
    explanation: string;
  }>;
}

interface TechnicalDebtResult {
  overall_assessment: {
    total_debt_score: number; // 0-100
    debt_category: 'low' | 'moderate' | 'high' | 'critical';
    interest_rate: number; // How fast debt grows
    principal: number; // Current debt amount
    estimated_interest: number; // Future debt growth
  };

  debt_breakdown: {
    by_category: { [category: string]: TechnicalDebtItem[] };
    by_severity: { [severity: string]: TechnicalDebtItem[] };
    by_effort: { [effort: string]: TechnicalDebtItem[] };
  };

  hotspots: Array<{
    location: string;
    debt_concentration: number;
    primary_issues: string[];
    recommended_actions: string[];
  }>;

  priority_matrix: {
    quick_wins: TechnicalDebtItem[]; // High impact, low effort
    strategic_investments: TechnicalDebtItem[]; // High impact, high effort
    housekeeping: TechnicalDebtItem[]; // Low impact, low effort
    reconsider: TechnicalDebtItem[]; // Low impact, high effort
  };

  financial_impact: {
    current_cost_per_month: number;
    projected_cost_6_months: number;
    projected_cost_12_months: number;
    roi_potential: number; // Return on investment for paying down debt
  };

  actionable_plan: {
    immediate_actions: Array<{
      action: string;
      items: TechnicalDebtItem[];
      estimated_timeframe: string;
      success_metrics: string[];
    }>;
    short_term_goals: Array<{
      goal: string;
      items: TechnicalDebtItem[];
      timeframe: string;
      resources_needed: string[];
    }>;
    long_term_strategy: Array<{
      strategy: string;
      description: string;
      benefits: string[];
      implementation_steps: string[];
    }>;
  };

  monitoring: {
    metrics_to_track: string[];
    alert_thresholds: Array<{
      metric: string;
      threshold: number;
      action: string;
    }>;
    review_schedule: string;
    quality_gates: string[];
  };
}

/**
 * Technical Debt Analysis Tool
 * Provides comprehensive technical debt assessment with business impact analysis
 */
export class TechnicalDebtAnalysisTool {
  readonly name = 'technical_debt_analysis';
  readonly description = 'Comprehensive technical debt assessment and prioritization with business impact analysis';

  private codeAnalyzer: CodeAnalysisService;
  private aiService: AILLMService;

  constructor() {
    this.codeAnalyzer = new CodeAnalysisService();
    this.aiService = new AILLMService();
  }

  async call(args: TechnicalDebtRequest): Promise<TechnicalDebtResult> {
    logger.info('Technical debt analysis started', {
      file_path: args.file_path,
      scope: args.scope,
      analysis_depth: args.analysis_depth
    });

    try {
      // 1. Comprehensive code analysis
      const codeAnalysis = await this.analyzeCode(args);

      // 2. Detect technical debt items
      const debtItems = await this.detectTechnicalDebt(args, codeAnalysis);

      // 3. AI-powered debt analysis
      const aiDebtAnalysis = await this.generateAIDebtAnalysis(args, codeAnalysis, args.historical_data);

      // 4. Combine and deduplicate debt items
      const allDebtItems = this.consolidateDebtItems([debtItems, aiDebtAnalysis]);

      // 5. Calculate business impact for each item
      const itemsWithImpact = await this.calculateBusinessImpact(allDebtItems, codeAnalysis);

      // 6. Generate priority matrix
      const priorityMatrix = this.createPriorityMatrix(itemsWithImpact);

      // 7. Identify debt hotspots
      const hotspots = this.identifyDebtHotspots(itemsWithImpact);

      // 8. Calculate overall assessment
      const overallAssessment = this.calculateOverallAssessment(itemsWithImpact, args.historical_data);

      // 9. Generate financial impact analysis
      const financialImpact = this.calculateFinancialImpact(itemsWithImpact, overallAssessment);

      // 10. Create actionable plan
      const actionablePlan = this.createActionablePlan(itemsWithImpact, priorityMatrix);

      // 11. Setup monitoring strategy
      const monitoring = this.createMonitoringStrategy(itemsWithImpact);

      const result: TechnicalDebtResult = {
        overall_assessment: overallAssessment,
        debt_breakdown: {
          by_category: this.groupByCategory(itemsWithImpact),
          by_severity: this.groupBySeverity(itemsWithImpact),
          by_effort: this.groupByEffort(itemsWithImpact)
        },
        hotspots,
        priority_matrix: priorityMatrix,
        financial_impact: financialImpact,
        actionable_plan: actionablePlan,
        monitoring
      };

      logger.info('Technical debt analysis completed', {
        total_debt_score: result.overall_assessment.total_debt_score,
        debt_items_count: itemsWithImpact.length,
        hotspots_count: result.hotspots.length
      });

      return result;

    } catch (error) {
      logger.error('Technical debt analysis failed:', error);
      throw new Error(`Technical debt analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeCode(args: TechnicalDebtRequest) {
    if (args.file_path) {
      return await this.codeAnalyzer.analyzeFile(args.file_path, args.codebase_id);
    } else {
      // Analyze entire codebase for system-wide debt
      return await this.codeAnalyzer.analyzeCodebase(args.codebase_id);
    }
  }

  private async detectTechnicalDebt(args: TechnicalDebtRequest, codeAnalysis: any): Promise<TechnicalDebtItem[]> {
    const debtItems: TechnicalDebtItem[] = [];

    // Code Quality Debt
    const codeQualityDebt = this.detectCodeQualityDebt(args, codeAnalysis);
    debtItems.push(...codeQualityDebt);

    // Architecture Debt
    const architectureDebt = this.detectArchitectureDebt(args, codeAnalysis);
    debtItems.push(...architectureDebt);

    // Testing Debt
    const testingDebt = this.detectTestingDebt(args, codeAnalysis);
    debtItems.push(...testingDebt);

    // Documentation Debt
    const documentationDebt = this.detectDocumentationDebt(args, codeAnalysis);
    debtItems.push(...documentationDebt);

    // Performance Debt
    const performanceDebt = this.detectPerformanceDebt(args, codeAnalysis);
    debtItems.push(...performanceDebt);

    return debtItems;
  }

  private detectCodeQualityDebt(args: TechnicalDebtRequest, codeAnalysis: any): TechnicalDebtItem[] {
    const debtItems: TechnicalDebtItem[] = [];

    // High complexity debt
    if (codeAnalysis.complexity?.functions) {
      codeAnalysis.complexity.functions.forEach((func: any) => {
        if (func.cyclomatic_complexity > 12) {
          debtItems.push({
            id: `complexity-debt-${func.name}`,
            title: `High Complexity in ${func.name}`,
            description: `Function ${func.name} has cyclomatic complexity of ${func.cyclomatic_complexity}, indicating high technical debt`,
            category: 'code-quality',
            severity: func.cyclomatic_complexity > 20 ? 'critical' : func.cyclomatic_complexity > 15 ? 'high' : 'medium',
            impact_score: Math.min(100, func.cyclomatic_complexity * 3),
            effort_score: Math.min(100, func.cyclomatic_complexity * 4),
            location: {
              file_path: args.file_path || 'unknown',
              line_start: func.line_number || 0,
              line_end: func.line_number || 0,
              function_name: func.name
            },
            debt_metrics: {
              complexity_contribution: func.cyclomatic_complexity * 5,
              maintainability_impact: func.cyclomatic_complexity * 3,
              coupling_increase: func.cyclomatic_complexity,
              test_coverage_gap: func.test_coverage ? (100 - func.test_coverage) : 50,
              documentation_deficit: func.has_documentation ? 10 : 60
            },
            business_impact: {
              development_speed_impact: Math.min(80, func.cyclomatic_complexity * 4),
              bug_likelihood_increase: Math.min(90, func.cyclomatic_complexity * 5),
              onboarding_difficulty: Math.min(70, func.cyclomatic_complexity * 3),
              feature_addition_complexity: Math.min(85, func.cyclomatic_complexity * 4)
            },
            remediation: {
              strategy: 'refactor',
              estimated_effort: func.cyclomatic_complexity > 20 ? 'weeks' : func.cyclomatic_complexity > 15 ? 'days' : 'hours',
              estimated_cost: func.cyclomatic_complexity * 2,
              risk_level: 'medium',
              dependencies: [],
              rollback_complexity: func.cyclomatic_complexity > 15 ? 'complex' : 'moderate'
            },
            urgency_factors: [
              { factor: 'Complexity', weight: 0.4, explanation: 'High complexity increases bug risk and maintenance cost' },
              { factor: 'Change frequency', weight: 0.3, explanation: 'Complex code is harder to modify safely' },
              { factor: 'Team experience', weight: 0.2, explanation: 'Complex code requires senior developers' },
              { factor: 'Business criticality', weight: 0.1, explanation: 'Critical business logic should be maintainable' }
            ]
          });
        }
      });
    }

    // Code duplication debt
    if (codeAnalysis.duplicates) {
      codeAnalysis.duplicates.forEach((duplicate: any, index: number) => {
        debtItems.push({
          id: `duplication-debt-${index}`,
          title: `Code Duplication: ${duplicate.description}`,
          description: `Duplicate code block found in ${duplicate.locations.length} locations, violating DRY principle`,
          category: 'code-quality',
          severity: duplicate.similarity > 90 ? 'high' : 'medium',
          impact_score: duplicate.duplicate_lines * 2,
          effort_score: duplicate.duplicate_lines,
          location: {
            file_path: duplicate.locations[0]?.file || 'unknown',
            line_start: duplicate.locations[0]?.line || 0,
            line_end: duplicate.locations[0]?.line || 0
          },
          debt_metrics: {
            complexity_contribution: duplicate.duplicate_lines,
            maintainability_impact: duplicate.duplicate_lines * 3,
            coupling_increase: duplicate.duplicate_lines * 2,
            test_coverage_gap: 20,
            documentation_deficit: 30
          },
          business_impact: {
            development_speed_impact: duplicate.duplicate_lines * 2,
            bug_likelihood_increase: duplicate.duplicate_lines * 3,
            onboarding_difficulty: duplicate.duplicate_lines,
            feature_addition_complexity: duplicate.duplicate_lines * 4
          },
          remediation: {
            strategy: 'refactor',
            estimated_effort: 'days',
            estimated_cost: duplicate.duplicate_lines * 1.5,
            risk_level: 'low',
            dependencies: duplicate.locations.map((loc: any) => loc.file),
            rollback_complexity: 'simple'
          },
          urgency_factors: [
            { factor: 'DRY principle violation', weight: 0.5, explanation: 'Code duplication increases maintenance burden' },
            { factor: 'Bug propagation risk', weight: 0.3, explanation: 'Bugs in duplicated code appear in multiple places' },
            { factor: 'Inconsistency risk', weight: 0.2, explanation: 'Duplicated code may diverge over time' }
          ]
        });
      });
    }

    return debtItems;
  }

  private detectArchitectureDebt(args: TechnicalDebtRequest, codeAnalysis: any): TechnicalDebtItem[] {
    const debtItems: TechnicalDebtItem[] = [];

    // Large class debt
    if (codeAnalysis.classes) {
      codeAnalysis.classes.forEach((cls: any) => {
        if (cls.lines_of_code > 300) {
          debtItems.push({
            id: `large-class-debt-${cls.name}`,
            title: `Large Class: ${cls.name}`,
            description: `Class ${cls.name} is too large (${cls.lines_of_code} lines) with ${cls.method_count} methods`,
            category: 'architecture',
            severity: cls.lines_of_code > 500 ? 'critical' : cls.lines_of_code > 400 ? 'high' : 'medium',
            impact_score: Math.min(100, cls.lines_of_code / 5),
            effort_score: Math.min(100, cls.lines_of_code / 3),
            location: {
              file_path: cls.file_path || args.file_path || 'unknown',
              line_start: cls.line_number || 0,
              line_end: cls.line_number || 0,
              class_name: cls.name
            },
            debt_metrics: {
              complexity_contribution: cls.method_count * 2,
              maintainability_impact: cls.lines_of_code / 4,
              coupling_increase: cls.dependency_count * 5,
              test_coverage_gap: 30,
              documentation_deficit: 40
            },
            business_impact: {
              development_speed_impact: Math.min(80, cls.lines_of_code / 6),
              bug_likelihood_increase: Math.min(70, cls.method_count * 3),
              onboarding_difficulty: Math.min(90, cls.lines_of_code / 5),
              feature_addition_complexity: Math.min(85, cls.lines_of_code / 4)
            },
            remediation: {
              strategy: 'architectural-change',
              estimated_effort: cls.lines_of_code > 500 ? 'weeks' : 'days',
              estimated_cost: cls.lines_of_code / 2,
              risk_level: 'high',
              dependencies: [],
              rollback_complexity: 'complex'
            },
            urgency_factors: [
              { factor: 'Single Responsibility Principle', weight: 0.5, explanation: 'Large classes violate SRP' },
              { factor: 'Testability', weight: 0.3, explanation: 'Large classes are hard to test comprehensively' },
              { factor: 'Coupling', weight: 0.2, explanation: 'Large classes often have high coupling' }
            ]
          });
        }
      });
    }

    // Deep nesting debt
    if (codeAnalysis.nesting) {
      codeAnalysis.nesting.forEach((nest: any, index: number) => {
        if (nest.depth > 4) {
          debtItems.push({
            id: `deep-nesting-debt-${index}`,
            title: `Deep Nesting at Line ${nest.line}`,
            description: `Code nesting depth of ${nest.depth} detected, reducing readability`,
            category: 'architecture',
            severity: nest.depth > 6 ? 'high' : 'medium',
            impact_score: nest.depth * 10,
            effort_score: nest.depth * 5,
            location: {
              file_path: args.file_path || 'unknown',
              line_start: nest.line,
              line_end: nest.line
            },
            debt_metrics: {
              complexity_contribution: nest.depth * 5,
              maintainability_impact: nest.depth * 8,
              coupling_increase: nest.depth * 2,
              test_coverage_gap: 20,
              documentation_deficit: 25
            },
            business_impact: {
              development_speed_impact: nest.depth * 8,
              bug_likelihood_increase: nest.depth * 6,
              onboarding_difficulty: nest.depth * 7,
              feature_addition_complexity: nest.depth * 9
            },
            remediation: {
              strategy: 'refactor',
              estimated_effort: 'hours',
              estimated_cost: nest.depth * 2,
              risk_level: 'low',
              dependencies: [],
              rollback_complexity: 'simple'
            },
            urgency_factors: [
              { factor: 'Readability', weight: 0.4, explanation: 'Deep nesting reduces code readability' },
              { factor: 'Cognitive load', weight: 0.3, explanation: 'Increases mental effort for developers' },
              { factor: 'Test complexity', weight: 0.2, explanation: 'Nested code is harder to test' },
              { factor: 'Debugging difficulty', weight: 0.1, explanation: 'Makes debugging more challenging' }
            ]
          });
        }
      });
    }

    return debtItems;
  }

  private detectTestingDebt(args: TechnicalDebtRequest, codeAnalysis: any): TechnicalDebtItem[] {
    const debtItems: TechnicalDebtItem[] = [];

    // Low test coverage debt
    if (codeAnalysis.testing?.coverage_percentage) {
      const coverage = codeAnalysis.testing.coverage_percentage;
      if (coverage < 80) {
        debtItems.push({
          id: 'test-coverage-debt',
          title: 'Insufficient Test Coverage',
          description: `Test coverage is only ${coverage}%, below recommended 80% threshold`,
          category: 'testing',
          severity: coverage < 50 ? 'critical' : coverage < 65 ? 'high' : 'medium',
          impact_score: (80 - coverage) * 2,
          effort_score: (80 - coverage) * 1.5,
          location: {
            file_path: args.file_path || 'unknown',
            line_start: 0,
            line_end: 0
          },
          debt_metrics: {
            complexity_contribution: (80 - coverage) * 2,
            maintainability_impact: (80 - coverage) * 3,
            coupling_increase: (80 - coverage),
            test_coverage_gap: (80 - coverage),
            documentation_deficit: 20
          },
          business_impact: {
            development_speed_impact: (80 - coverage) * 3,
            bug_likelihood_increase: (80 - coverage) * 4,
            onboarding_difficulty: (80 - coverage) * 2,
            feature_addition_complexity: (80 - coverage) * 3
          },
          remediation: {
            strategy: 'test',
            estimated_effort: 'weeks',
            estimated_cost: (80 - coverage) * 5,
            risk_level: 'low',
            dependencies: [],
            rollback_complexity: 'simple'
          },
          urgency_factors: [
            { factor: 'Quality assurance', weight: 0.5, explanation: 'Insufficient testing reduces confidence in changes' },
            { factor: 'Bug detection', weight: 0.3, explanation: 'Low coverage means bugs go undetected' },
            { factor: 'Refactoring safety', weight: 0.2, explanation: 'Tests provide safety net for refactoring' }
          ]
        });
      }
    }

    return debtItems;
  }

  private detectDocumentationDebt(args: TechnicalDebtRequest, codeAnalysis: any): TechnicalDebtItem[] {
    const debtItems: TechnicalDebtItem[] = [];

    // Missing documentation
    if (codeAnalysis.functions) {
      codeAnalysis.functions.forEach((func: any) => {
        if (!func.has_documentation && func.is_public) {
          debtItems.push({
            id: `documentation-debt-${func.name}`,
            title: `Missing Documentation for ${func.name}`,
            description: `Public function ${func.name} lacks proper documentation`,
            category: 'documentation',
            severity: 'medium',
            impact_score: 25,
            effort_score: 15,
            location: {
              file_path: args.file_path || 'unknown',
              line_start: func.line_number || 0,
              line_end: func.line_number || 0,
              function_name: func.name
            },
            debt_metrics: {
              complexity_contribution: 5,
              maintainability_impact: 20,
              coupling_increase: 2,
              test_coverage_gap: 0,
              documentation_deficit: 50
            },
            business_impact: {
              development_speed_impact: 30,
              bug_likelihood_increase: 15,
              onboarding_difficulty: 40,
              feature_addition_complexity: 25
            },
            remediation: {
              strategy: 'document',
              estimated_effort: 'hours',
              estimated_cost: 10,
              risk_level: 'low',
              dependencies: [],
              rollback_complexity: 'simple'
            },
            urgency_factors: [
              { factor: 'API usability', weight: 0.4, explanation: 'Documentation improves API usability' },
              { factor: 'Onboarding', weight: 0.3, explanation: 'New developers need documentation' },
              { factor: 'Knowledge transfer', weight: 0.2, explanation: 'Documentation preserves knowledge' },
              { factor: 'Maintenance', weight: 0.1, explanation: 'Documentation aids maintenance' }
            ]
          });
        }
      });
    }

    return debtItems;
  }

  private detectPerformanceDebt(args: TechnicalDebtRequest, codeAnalysis: any): TechnicalDebtItem[] {
    const debtItems: TechnicalDebtItem[] = [];

    // Performance anti-patterns
    if (codeAnalysis.performance_issues) {
      codeAnalysis.performance_issues.forEach((issue: any, index: number) => {
        debtItems.push({
          id: `performance-debt-${index}`,
          title: `Performance Issue: ${issue.type}`,
          description: `Performance anti-pattern detected: ${issue.description}`,
          category: 'performance',
          severity: issue.impact === 'critical' ? 'high' : 'medium',
          impact_score: issue.impact_score || 30,
          effort_score: issue.effort_score || 40,
          location: {
            file_path: issue.file_path || args.file_path || 'unknown',
            line_start: issue.line_number || 0,
            line_end: issue.line_number || 0
          },
          debt_metrics: {
            complexity_contribution: 10,
            maintainability_impact: 15,
            coupling_increase: 5,
            test_coverage_gap: 10,
            documentation_deficit: 20
          },
          business_impact: {
            development_speed_impact: 20,
            bug_likelihood_increase: 15,
            onboarding_difficulty: 10,
            feature_addition_complexity: 25
          },
          remediation: {
            strategy: 'optimize',
            estimated_effort: 'days',
            estimated_cost: issue.optimization_cost || 50,
            risk_level: 'medium',
            dependencies: [],
            rollback_complexity: 'moderate'
          },
          urgency_factors: [
            { factor: 'User experience', weight: 0.5, explanation: 'Performance affects user satisfaction' },
            { factor: 'Resource costs', weight: 0.3, explanation: 'Poor performance increases infrastructure costs' },
            { factor: 'Scalability', weight: 0.2, explanation: 'Performance issues limit scalability' }
          ]
        });
      });
    }

    return debtItems;
  }

  private async generateAIDebtAnalysis(args: TechnicalDebtRequest, codeAnalysis: any, historicalData?: any): Promise<TechnicalDebtItem[]> {
    try {
      const prompts = [
        `
Analyze this code for technical debt and quality issues:

Code Analysis: ${JSON.stringify(codeAnalysis, null, 2)}
Historical Data: ${JSON.stringify(historicalData, null, 2)}

Look for technical debt in these areas:
- Code quality issues (complexity, duplication, smells)
- Architectural problems (coupling, cohesion, design patterns)
- Testing gaps (coverage, quality, maintenance)
- Documentation deficiencies
- Performance bottlenecks
- Security concerns
- Maintainability issues

For each issue found, provide:
1. Debt category and severity
2. Business impact assessment
3. Technical impact on development
4. Recommended remediation strategy
5. Effort and risk assessment
6. Priority factors

Focus on actionable insights that can help reduce technical debt and improve code quality.
`
      ];

      const aiInsights = await this.aiService.generateInsights(prompts);

      return aiInsights.suggestions.map((suggestion, index) => ({
        id: `ai-debt-${index}`,
        title: suggestion.title || 'AI-Identified Technical Debt',
        description: suggestion.description || 'Technical debt identified by AI analysis',
        category: this.mapToDebtCategory(suggestion.category),
        severity: this.mapToSeverity(suggestion.impact),
        impact_score: suggestion.confidence || 50,
        effort_score: 60,
        location: {
          file_path: args.file_path || 'unknown',
          line_start: suggestion.line_number || 0,
          line_end: suggestion.line_number || 0
        },
        debt_metrics: {
          complexity_contribution: 20,
          maintainability_impact: 25,
          coupling_increase: 15,
          test_coverage_gap: 20,
          documentation_deficit: 20
        },
        business_impact: {
          development_speed_impact: 30,
          bug_likelihood_increase: 25,
          onboarding_difficulty: 20,
          feature_addition_complexity: 35
        },
        remediation: {
          strategy: 'refactor',
          estimated_effort: 'days',
          estimated_cost: 50,
          risk_level: 'medium',
          dependencies: [],
          rollback_complexity: 'moderate'
        },
        urgency_factors: [
          { factor: 'AI analysis', weight: 0.8, explanation: 'Identified through AI pattern analysis' }
        ]
      }));

    } catch (error) {
      logger.warn('AI technical debt analysis failed:', error);
      return [];
    }
  }

  private consolidateDebtItems(debtArrays: TechnicalDebtItem[][]): TechnicalDebtItem[] {
    const allDebtItems = debtArrays.flat();

    // Remove duplicates based on title and location
    const deduplicated = allDebtItems.filter((item, index, self) =>
      index === self.findIndex(i =>
        i.title === item.title &&
        i.location.file_path === item.location.file_path &&
        i.location.line_start === item.location.line_start
      )
    );

    return deduplicated;
  }

  private async calculateBusinessImpact(items: TechnicalDebtItem[], codeAnalysis: any): Promise<TechnicalDebtItem[]> {
    return items.map(item => ({
      ...item,
      business_impact: {
        development_speed_impact: Math.min(100, item.impact_score * 0.8),
        bug_likelihood_increase: Math.min(100, item.impact_score * 0.9),
        onboarding_difficulty: Math.min(100, item.impact_score * 0.6),
        feature_addition_complexity: Math.min(100, item.impact_score * 0.7)
      }
    }));
  }

  private createPriorityMatrix(items: TechnicalDebtItem[]) {
    const quick_wins = items.filter(item => item.impact_score > 60 && item.effort_score < 40);
    const strategic_investments = items.filter(item => item.impact_score > 60 && item.effort_score >= 60);
    const housekeeping = items.filter(item => item.impact_score <= 60 && item.effort_score < 40);
    const reconsider = items.filter(item => item.impact_score <= 60 && item.effort_score >= 60);

    return {
      quick_wins,
      strategic_investments,
      housekeeping,
      reconsider
    };
  }

  private identifyDebtHotspots(items: TechnicalDebtItem[]) {
    const hotspots: { [key: string]: any } = {};

    items.forEach(item => {
      const location = `${item.location.file_path}:${item.location.line_start}-${item.location.line_end}`;

      if (!hotspots[location]) {
        hotspots[location] = {
          location,
          debt_concentration: 0,
          primary_issues: [],
          recommended_actions: []
        };
      }

      hotspots[location].debt_concentration += item.impact_score;
      hotspots[location].primary_issues.push(item.category);
      hotspots[location].recommended_actions.push(item.remediation.strategy);
    });

    return Object.values(hotspots)
      .filter(hotspot => hotspot.debt_concentration > 100)
      .map(hotspot => ({
        ...hotspot,
        primary_issues: [...new Set(hotspot.primary_issues)],
        recommended_actions: [...new Set(hotspot.recommended_actions)]
      }));
  }

  private calculateOverallAssessment(items: TechnicalDebtItem[], historicalData?: any) {
    const totalImpact = items.reduce((sum, item) => sum + item.impact_score, 0);
    const maxPossibleImpact = items.length * 100;
    const totalDebtScore = maxPossibleImpact > 0 ? (totalImpact / maxPossibleImpact) * 100 : 0;

    let debtCategory: 'low' | 'moderate' | 'high' | 'critical';
    if (totalDebtScore >= 75) {debtCategory = 'critical';}
    else if (totalDebtScore >= 50) {debtCategory = 'high';}
    else if (totalDebtScore >= 25) {debtCategory = 'moderate';}
    else {debtCategory = 'low';}

    const interestRate = Math.min(20, totalDebtScore * 0.2); // Technical debt grows over time
    const principal = totalDebtScore;
    const estimatedInterest = principal * (interestRate / 100);

    return {
      total_debt_score: Math.round(totalDebtScore),
      debt_category: debtCategory,
      interest_rate: Math.round(interestRate),
      principal: Math.round(principal),
      estimated_interest: Math.round(estimatedInterest)
    };
  }

  private calculateFinancialImpact(items: TechnicalDebtItem[], assessment: any) {
    const currentCostPerMonth = items.reduce((sum, item) => sum + (item.impact_score * 2), 0);
    const growthRate = assessment.interest_rate / 100;

    return {
      current_cost_per_month: currentCostPerMonth,
      projected_cost_6_months: Math.round(currentCostPerMonth * Math.pow(1 + growthRate, 6)),
      projected_cost_12_months: Math.round(currentCostPerMonth * Math.pow(1 + growthRate, 12)),
      roi_potential: Math.round(assessment.estimated_interest * 5) // 5x ROI on debt reduction
    };
  }

  private createActionablePlan(items: TechnicalDebtItem[], priorityMatrix: any) {
    const immediateActions = [
      {
        action: 'Address Quick Wins',
        items: priorityMatrix.quick_wins,
        estimated_timeframe: '1-2 weeks',
        success_metrics: ['Reduced bug count', 'Improved developer satisfaction']
      }
    ];

    const shortTermGoals = [
      {
        goal: 'Tackle Strategic Investments',
        items: priorityMatrix.strategic_investments,
        timeframe: '1-3 months',
        resources_needed: ['Senior developers', 'Code review time']
      }
    ];

    const longTermStrategy = [
      {
        strategy: 'Continuous Debt Management',
        description: 'Implement processes to prevent new technical debt',
        benefits: ['Sustainable code quality', 'Predictable delivery timelines'],
        implementation_steps: ['Automated quality gates', 'Regular debt reviews', 'Team training']
      }
    ];

    return {
      immediate_actions: immediateActions,
      short_term_goals: shortTermGoals,
      long_term_strategy: longTermStrategy
    };
  }

  private createMonitoringStrategy(items: TechnicalDebtItem[]) {
    return {
      metrics_to_track: [
        'Code coverage percentage',
        'Cyclomatic complexity',
        'Code duplication ratio',
        'Test failure rate',
        'Code review findings'
      ],
      alert_thresholds: [
        { metric: 'Code coverage', threshold: 70, action: 'Schedule focused testing effort' },
        { metric: 'Complexity score', threshold: 15, action: 'Plan refactoring sprint' },
        { metric: 'Debt score', threshold: 60, action: 'Increase debt reduction effort' }
      ],
      review_schedule: 'Monthly for critical modules, quarterly for stable modules',
      quality_gates: [
        'Minimum 80% test coverage for new code',
        'Maximum cyclomatic complexity of 10',
        'Zero critical security vulnerabilities',
        'Code review approval required for all changes'
      ]
    };
  }

  private groupByCategory(items: TechnicalDebtItem[]): { [category: string]: TechnicalDebtItem[] } {
    const grouped: { [category: string]: TechnicalDebtItem[] } = {};
    items.forEach(item => {
      if (!grouped[item.category]) {grouped[item.category] = [];}
      grouped[item.category].push(item);
    });
    return grouped;
  }

  private groupBySeverity(items: TechnicalDebtItem[]): { [severity: string]: TechnicalDebtItem[] } {
    const grouped: { [severity: string]: TechnicalDebtItem[] } = {};
    items.forEach(item => {
      if (!grouped[item.severity]) {grouped[item.severity] = [];}
      grouped[item.severity].push(item);
    });
    return grouped;
  }

  private groupByEffort(items: TechnicalDebtItem[]): { [effort: string]: TechnicalDebtItem[] } {
    const grouped: { [effort: string]: TechnicalDebtItem[] } = {};
    items.forEach(item => {
      const effort = item.remediation.estimated_effort;
      if (!grouped[effort]) {grouped[effort] = [];}
      grouped[effort].push(item);
    });
    return grouped;
  }

  private mapToDebtCategory(category?: string): TechnicalDebtItem['category'] {
    const categoryMap = {
      'code-quality': 'code-quality',
      'architecture': 'architecture',
      'testing': 'testing',
      'performance': 'performance',
      'security': 'code-quality',
      'maintainability': 'maintainability'
    };

    return (categoryMap[category as keyof typeof categoryMap] || 'code-quality') as TechnicalDebtItem['category'];
  }

  private mapToSeverity(impact?: string): TechnicalDebtItem['severity'] {
    const severityMap = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };

    return (severityMap[impact as keyof typeof severityMap] || 'medium') as TechnicalDebtItem['severity'];
  }
}