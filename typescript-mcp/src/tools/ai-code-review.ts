/**
 * AI-Powered Code Review Assistant - Phase 4.1
 * Implements intelligent code review with context-aware suggestions
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CodeAnalysisService } from '../services/code-analysis.js';
import { AILLMService } from '../services/ai-llm.js';
import { SecurityAnalyzer } from '../services/security-analyzer.js';
import { logger } from '../services/logger.js';
import { deduplicateSuggestions } from '../utils/ai-helpers.js';

interface CodeReviewRequest {
  file_path?: string;
  code_snippet?: string;
  review_type: 'basic' | 'comprehensive' | 'security-focused' | 'performance-focused';
  codebase_id: string;
  context?: {
    pr_description?: string;
    changed_files?: string[];
    target_branch?: string;
  };
}

interface CodeReviewResult {
  overall_score: number; // 0-100
  issues: Array<{
    type: 'error' | 'warning' | 'suggestion' | 'info';
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: 'security' | 'performance' | 'maintainability' | 'readability' | 'best-practices';
    title: string;
    description: string;
    suggestion?: string;
    line_number?: number;
    confidence: number; // 0-100
  }>;
  metrics: {
    complexity_score: number;
    maintainability_index: number;
    test_coverage?: number;
    duplication_ratio?: number;
    security_score: number;
  };
  summary: {
    strengths: string[];
    improvements: string[];
    blocking_issues: string[];
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    action: string;
    rationale: string;
    effort_estimate: 'quick' | 'moderate' | 'significant';
  }>;
}

/**
 * AI-Powered Code Review Tool
 * Provides intelligent, context-aware code review suggestions
 */
export class AICodeReviewTool {
  readonly name = 'ai_code_review';
  readonly description = 'AI-powered comprehensive code review with intelligent suggestions and analysis';

  private codeAnalyzer: CodeAnalysisService;
  private llmService: AILLMService;
  private securityAnalyzer: SecurityAnalyzer;

  constructor() {
    this.codeAnalyzer = new CodeAnalysisService();
    this.llmService = new AILLMService();
    this.securityAnalyzer = new SecurityAnalyzer();
  }

  async call(args: CodeReviewRequest): Promise<CodeReviewResult> {
    logger.info('AI Code Review started', {
      file_path: args.file_path,
      review_type: args.review_type,
      codebase_id: args.codebase_id
    });

    try {
      // 1. Code Analysis
      const codeAnalysis = await this.analyzeCode(args);

      // 2. Security Analysis
      const securityAnalysis = await this.analyzeSecurity(args);

      // 3. AI-Powered Insights
      const aiInsights = await this.generateAIInsights(args, codeAnalysis, securityAnalysis);

      // 4. Comprehensive Review
      const reviewResult = await this.compileReview(codeAnalysis, securityAnalysis, aiInsights);

      logger.info('AI Code Review completed', {
        overall_score: reviewResult.overall_score,
        issues_count: reviewResult.issues.length
      });

      return reviewResult;

    } catch (error) {
      logger.error('AI Code Review failed:', error);
      throw new Error(`AI Code Review failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeCode(args: CodeReviewRequest) {
    if (args.code_snippet) {
      return await this.codeAnalyzer.analyzeSnippet(args.code_snippet, args.codebase_id);
    } else if (args.file_path) {
      return await this.codeAnalyzer.analyzeFile(args.file_path, args.codebase_id);
    } else {
      throw new Error('Either file_path or code_snippet must be provided');
    }
  }

  private async analyzeSecurity(args: CodeReviewRequest) {
    const securityResults = await this.securityAnalyzer.analyze({
      file_path: args.file_path,
      code_snippet: args.code_snippet,
      codebase_id: args.codebase_id,
      depth: args.review_type === 'security-focused' ? 'deep' : 'standard'
    });

    return securityResults;
  }

  private async generateAIInsights(args: CodeReviewRequest, codeAnalysis: any, securityAnalysis: any) {
    const context = {
      code_analysis: codeAnalysis,
      security_analysis: securityAnalysis,
      review_type: args.review_type,
      additional_context: args.context
    };

    const prompts = this.buildAIPrompts(args, context);
    const insights = await this.llmService.generateInsights(prompts);

    return insights;
  }

  private buildAIPrompts(args: CodeReviewRequest, context: any): string[] {
    const basePrompt = `
As an expert software engineer, perform a comprehensive code review focusing on:
- Code quality and best practices
- Potential bugs and edge cases
- Performance considerations
- Security implications
- Maintainability and readability

Code context: ${JSON.stringify(context, null, 2)}
Review type: ${args.review_type}
`;

    const specializedPrompts = [];

    switch (args.review_type) {
      case 'security-focused':
        specializedPrompts.push(`
${basePrompt}

Focus specifically on:
- Input validation and sanitization
- Authentication and authorization flaws
- Data exposure risks
- Cryptographic weaknesses
- Injection vulnerabilities
- Cross-site scripting (XSS) risks
- Security misconfigurations
`);
        break;

      case 'performance-focused':
        specializedPrompts.push(`
${basePrompt}

Focus specifically on:
- Algorithmic complexity
- Memory usage patterns
- Database query optimization
- Caching strategies
- Async/await patterns
- Resource management
- Potential bottlenecks
`);
        break;

      case 'comprehensive':
        specializedPrompts.push(`
${basePrompt}

Provide detailed analysis covering all aspects:
- Architecture and design patterns
- Error handling strategies
- Testing considerations
- Documentation quality
- Code organization
- Dependency management
- Scalability concerns
`);
        break;
    }

    if (args.context?.pr_description) {
      specializedPrompts.push(`
PR Description: ${args.context.pr_description}

Consider the changes in the context of this pull request and provide feedback specific to the changes being made.
`);
    }

    return specializedPrompts.length > 0 ? specializedPrompts : [basePrompt];
  }

  private async compileReview(codeAnalysis: any, securityAnalysis: any, aiInsights: any): Promise<CodeReviewResult> {
    // Aggregate all findings
    const issues = this.aggregateIssues(codeAnalysis, securityAnalysis, aiInsights);

    // Calculate metrics
    const metrics = this.calculateMetrics(codeAnalysis, securityAnalysis);

    // Generate summary
    const summary = this.generateSummary(issues, metrics);

    // Create recommendations
    const recommendations = this.generateRecommendations(issues, metrics);

    // Calculate overall score
    const overallScore = this.calculateOverallScore(metrics, issues);

    return {
      overall_score: overallScore,
      issues,
      metrics,
      summary,
      recommendations
    };
  }

  private aggregateIssues(codeAnalysis: any, securityAnalysis: any, aiInsights: any) {
    const issues = [];

    // Code complexity issues
    if (codeAnalysis.complexity?.functions) {
      codeAnalysis.complexity.functions.forEach((func: any) => {
        if (func.cyclomatic_complexity > 10) {
          issues.push({
            type: 'warning' as const,
            severity: func.cyclomatic_complexity > 15 ? 'high' as const : 'medium' as const,
            category: 'maintainability' as const,
            title: 'High Cyclomatic Complexity',
            description: `Function "${func.name}" has cyclomatic complexity of ${func.cyclomatic_complexity}`,
            suggestion: 'Consider breaking this function into smaller, more focused functions',
            line_number: func.line_number,
            confidence: 95
          });
        }
      });
    }

    // Security issues
    if (securityAnalysis.vulnerabilities) {
      securityAnalysis.vulnerabilities.forEach((vuln: any) => {
        issues.push({
          type: vuln.severity === 'critical' ? 'error' as const : 'warning' as const,
          severity: vuln.severity,
          category: 'security' as const,
          title: vuln.title,
          description: vuln.description,
          suggestion: vuln.remediation,
          line_number: vuln.line_number,
          confidence: vuln.confidence || 80
        });
      });
    }

    // AI-generated insights with deduplication
    if (aiInsights.suggestions) {
      // Deduplicate suggestions to avoid duplicate issues
      const deduplicatedSuggestions = deduplicateSuggestions(aiInsights.suggestions);

      deduplicatedSuggestions.forEach((insight: any) => {
        issues.push({
          type: insight.impact === 'critical' ? 'error' :
                insight.impact === 'high' ? 'warning' : 'suggestion',
          severity: insight.impact || 'medium',
          category: insight.category || 'best-practices',
          title: insight.title,
          description: insight.description,
          suggestion: insight.suggestion,
          line_number: insight.line_number,
          confidence: insight.confidence || 75
        });
      });
    }

    // Sort by severity and confidence
    return issues.sort((a, b) => {
      const severityWeight = { critical: 4, high: 3, medium: 2, low: 1 };
      const severityDiff = severityWeight[b.severity] - severityWeight[a.severity];
      if (severityDiff !== 0) {return severityDiff;}
      return b.confidence - a.confidence;
    });
  }

  private calculateMetrics(codeAnalysis: any, securityAnalysis: any) {
    return {
      complexity_score: codeAnalysis.complexity?.overall_score || 0,
      maintainability_index: codeAnalysis.maintainability?.index || 100,
      test_coverage: codeAnalysis.testing?.coverage_percentage,
      duplication_ratio: codeAnalysis.duplication?.ratio || 0,
      security_score: this.calculateSecurityScore(securityAnalysis)
    };
  }

  private calculateSecurityScore(securityAnalysis: any): number {
    if (!securityAnalysis.vulnerabilities) {return 100;}

    const vulnWeights = { critical: 40, high: 20, medium: 10, low: 5 };
    let totalDeduction = 0;

    securityAnalysis.vulnerabilities.forEach((vuln: any) => {
      totalDeduction += vulnWeights[vuln.severity] || 5;
    });

    return Math.max(0, 100 - totalDeduction);
  }

  private generateSummary(issues: any[], metrics: any) {
    const strengths = [];
    const improvements = [];
    const blocking_issues = [];

    // Analyze strengths
    if (metrics.security_score >= 90) {strengths.push('Excellent security practices');}
    if (metrics.maintainability_index >= 80) {strengths.push('High maintainability index');}
    if (metrics.complexity_score <= 30) {strengths.push('Good code complexity');}
    if (metrics.test_coverage && metrics.test_coverage >= 80) {strengths.push('Good test coverage');}

    // Analyze improvements needed
    const criticalIssues = issues.filter(i => i.severity === 'critical');
    const highIssues = issues.filter(i => i.severity === 'high');

    if (criticalIssues.length > 0) {
      blocking_issues.push(`${criticalIssues.length} critical issues must be addressed`);
    }
    if (highIssues.length > 0) {
      improvements.push(`${highIssues.length} high-priority issues should be addressed`);
    }
    if (metrics.security_score < 70) {
      improvements.push('Security practices need improvement');
    }
    if (metrics.maintainability_index < 60) {
      improvements.push('Code maintainability could be improved');
    }

    return { strengths, improvements, blocking_issues };
  }

  private generateRecommendations(issues: any[], metrics: any) {
    const recommendations = [];

    // Security recommendations
    const securityIssues = issues.filter(i => i.category === 'security');
    if (securityIssues.length > 0) {
      recommendations.push({
        priority: 'high' as const,
        action: 'Address security vulnerabilities',
        rationale: `Found ${securityIssues.length} security issues that could expose the application to attacks`,
        effort_estimate: 'moderate' as const
      });
    }

    // Complexity recommendations
    if (metrics.complexity_score > 50) {
      recommendations.push({
        priority: 'medium' as const,
        action: 'Reduce code complexity',
        rationale: 'High complexity makes the code difficult to maintain and test',
        effort_estimate: 'significant' as const
      });
    }

    // Testing recommendations
    if (!metrics.test_coverage || metrics.test_coverage < 80) {
      recommendations.push({
        priority: 'medium' as const,
        action: 'Improve test coverage',
        rationale: 'Better test coverage improves reliability and makes refactoring safer',
        effort_estimate: 'moderate' as const
      });
    }

    return recommendations;
  }

  private calculateOverallScore(metrics: any, issues: any[]): number {
    let score = 100;

    // Deduct points for issues
    issues.forEach(issue => {
      const deduction = {
        critical: 20,
        high: 10,
        medium: 5,
        low: 2
      }[issue.severity] || 2;

      score -= deduction * (issue.confidence / 100);
    });

    // Factor in metrics
    score = Math.min(score, metrics.security_score);
    score = Math.min(score, metrics.maintainability_index);

    if (metrics.complexity_score > 50) {
      score = Math.max(0, score - (metrics.complexity_score - 50) / 2);
    }

    return Math.max(0, Math.round(score));
  }
}