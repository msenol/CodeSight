import type { Request, Response } from 'express';
import { SuggestRefactoringTool } from '../tools/suggest-refactoring.js';
import { z } from 'zod';

const SuggestRefactoringRequestSchema = z.object({
  entity_id: z.string().uuid('Invalid entity ID'),
  refactoring_types: z.array(z.enum([
    'extract_method', 'extract_class', 'rename', 'move_method',
    'inline', 'simplify_conditionals', 'remove_duplicates',
    'improve_naming', 'reduce_complexity', 'all'
  ])).optional(),
  priority_focus: z.enum(['maintainability', 'performance', 'readability', 'testability']).optional(),
  include_code_examples: z.boolean().optional(),
  include_impact_analysis: z.boolean().optional(),
  max_suggestions: z.number().min(1).max(20).optional()
});

const BatchRefactoringRequestSchema = z.object({
  entity_ids: z.array(z.string().uuid()).min(1, 'At least one entity ID is required'),
  refactoring_types: z.array(z.enum([
    'extract_method', 'extract_class', 'rename', 'move_method',
    'inline', 'simplify_conditionals', 'remove_duplicates',
    'improve_naming', 'reduce_complexity', 'all'
  ])).optional(),
  priority_focus: z.enum(['maintainability', 'performance', 'readability', 'testability']).optional(),
  max_suggestions_per_entity: z.number().min(1).max(10).optional()
});

const RefactoringPlanRequestSchema = z.object({
  codebase_id: z.string().uuid('Invalid codebase ID'),
  target_metrics: z.object({
    max_complexity: z.number().min(1).max(50).optional(),
    min_maintainability: z.number().min(0).max(100).optional(),
    max_duplication_percentage: z.number().min(0).max(100).optional()
  }).optional(),
  priority_areas: z.array(z.enum(['high_complexity', 'security_issues', 'duplicates', 'poor_naming'])).optional(),
  effort_budget: z.enum(['small', 'medium', 'large', 'unlimited']).optional(),
  timeline_weeks: z.number().min(1).max(52).optional()
});

const ApplyRefactoringRequestSchema = z.object({
  entity_id: z.string().uuid('Invalid entity ID'),
  refactoring_id: z.string().min(1, 'Refactoring ID is required'),
  auto_apply: z.boolean().default(false),
  create_backup: z.boolean().default(true),
  run_tests: z.boolean().default(true)
});

export class RefactoringController {
  constructor(
    private suggestRefactoringTool: SuggestRefactoringTool
  ) {}

  /**
   * Get refactoring suggestions for a specific code entity
   * POST /api/refactoring/suggest
   */
  async suggestRefactoring(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = SuggestRefactoringRequestSchema.parse(req.body);
      
      const result = await this.suggestRefactoringTool.call(validatedData);
      
      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Refactoring suggestion failed');
    }
  }

  /**
   * Get refactoring suggestions for multiple entities
   * POST /api/refactoring/batch-suggest
   */
  async batchSuggestRefactoring(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = BatchRefactoringRequestSchema.parse(req.body);
      
      const results = await this.performBatchRefactoringSuggestions(validatedData);
      
      res.status(200).json({
        success: true,
        data: results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Batch refactoring suggestion failed');
    }
  }

  /**
   * Generate a comprehensive refactoring plan for a codebase
   * POST /api/refactoring/plan
   */
  async generateRefactoringPlan(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = RefactoringPlanRequestSchema.parse(req.body);
      
      const plan = await this.createRefactoringPlan(validatedData);
      
      res.status(200).json({
        success: true,
        data: plan,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Refactoring plan generation failed');
    }
  }

  /**
   * Apply a specific refactoring suggestion
   * POST /api/refactoring/apply
   */
  async applyRefactoring(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = ApplyRefactoringRequestSchema.parse(req.body);
      
      const result = await this.executeRefactoring(validatedData);
      
      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Refactoring application failed');
    }
  }

  /**
   * Get refactoring history and statistics
   * GET /api/refactoring/history/:codebaseId
   */
  async getRefactoringHistory(req: Request, res: Response): Promise<void> {
    try {
      const { codebaseId } = req.params;
      const { 
        limit = 50, 
        include_statistics = false,
        filter_type,
        date_from,
        date_to
      } = req.query;
      
      if (!codebaseId || !this.isValidUUID(codebaseId)) {
        res.status(400).json({
          success: false,
          error: 'Valid codebase ID is required'
        });
        return;
      }

      const history = await this.getRefactoringHistoryData(
        codebaseId,
        {
          limit: parseInt(limit as string) || 50,
          include_statistics: include_statistics === 'true',
          filter_type: filter_type as string,
          date_from: date_from as string,
          date_to: date_to as string
        }
      );
      
      res.status(200).json({
        success: true,
        data: history,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Refactoring history retrieval failed');
    }
  }

  /**
   * Get refactoring impact analysis
   * POST /api/refactoring/impact-analysis
   */
  async getImpactAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { entity_id, refactoring_type, scope = 'local' } = req.body;
      
      if (!entity_id || !this.isValidUUID(entity_id)) {
        res.status(400).json({
          success: false,
          error: 'Valid entity ID is required'
        });
        return;
      }
      
      if (!refactoring_type) {
        res.status(400).json({
          success: false,
          error: 'Refactoring type is required'
        });
        return;
      }

      const impact = await this.analyzeRefactoringImpact(entity_id, refactoring_type, scope);
      
      res.status(200).json({
        success: true,
        data: impact,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Impact analysis failed');
    }
  }

  /**
   * Get refactoring recommendations based on code quality metrics
   * GET /api/refactoring/recommendations/:codebaseId
   */
  async getRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const { codebaseId } = req.params;
      const { 
        priority = 'high',
        max_recommendations = 20,
        focus_area
      } = req.query;
      
      if (!codebaseId || !this.isValidUUID(codebaseId)) {
        res.status(400).json({
          success: false,
          error: 'Valid codebase ID is required'
        });
        return;
      }

      const recommendations = await this.generateRecommendations(
        codebaseId,
        {
          priority: priority as string,
          max_recommendations: parseInt(max_recommendations as string) || 20,
          focus_area: focus_area as string
        }
      );
      
      res.status(200).json({
        success: true,
        data: recommendations,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Recommendations generation failed');
    }
  }

  /**
   * Validate a refactoring before applying it
   * POST /api/refactoring/validate
   */
  async validateRefactoring(req: Request, res: Response): Promise<void> {
    try {
      const { entity_id, refactoring_type, parameters } = req.body;
      
      if (!entity_id || !this.isValidUUID(entity_id)) {
        res.status(400).json({
          success: false,
          error: 'Valid entity ID is required'
        });
        return;
      }
      
      if (!refactoring_type) {
        res.status(400).json({
          success: false,
          error: 'Refactoring type is required'
        });
        return;
      }

      const validation = await this.validateRefactoringOperation(
        entity_id,
        refactoring_type,
        parameters || {}
      );
      
      res.status(200).json({
        success: true,
        data: validation,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      this.handleError(error, res, 'Refactoring validation failed');
    }
  }

  private async performBatchRefactoringSuggestions(request: any): Promise<any> {
    const { entity_ids, refactoring_types, priority_focus, max_suggestions_per_entity = 5 } = request;
    
    const results: any = {
      total_entities: entity_ids.length,
      refactoring_types,
      priority_focus,
      results: [],
      summary: {
        successful: 0,
        failed: 0,
        total_suggestions: 0,
        high_priority_suggestions: 0
      }
    };

    for (const entityId of entity_ids) {
      try {
        const suggestions = await this.suggestRefactoringTool.call({
          entity_id: entityId,
          refactoring_types,
          priority_focus,
          max_suggestions: max_suggestions_per_entity
        });
        
        results.results.push({
          entity_id: entityId,
          suggestions,
          status: 'success'
        });
        
        results.summary.successful++;
        results.summary.total_suggestions += suggestions.suggestions.length;
        results.summary.high_priority_suggestions += suggestions.suggestions.filter(
          (s: any) => s.priority === 'high' || s.priority === 'critical'
        ).length;
      } catch (error) {
        results.results.push({
          entity_id: entityId,
          error: error instanceof Error ? error.message : 'Unknown error',
          status: 'failed'
        });
        results.summary.failed++;
      }
    }

    return results;
  }

  private async createRefactoringPlan(request: any): Promise<any> {
    const { 
      codebase_id, 
      target_metrics = {}, 
      priority_areas = ['high_complexity'], 
      effort_budget = 'medium',
      timeline_weeks = 8
    } = request;

    // This would typically analyze the codebase and create a comprehensive plan
    // For now, return a mock plan
    return {
      codebase_id,
      plan_id: `plan_${Date.now()}`,
      created_at: new Date().toISOString(),
      target_metrics,
      priority_areas,
      effort_budget,
      timeline_weeks,
      phases: [
        {
          phase: 1,
          name: 'Critical Issues',
          duration_weeks: 2,
          focus: 'Address high-complexity functions and security issues',
          tasks: [
            {
              task_id: 'task_1',
              type: 'reduce_complexity',
              entity_count: 8,
              estimated_hours: 24,
              priority: 'critical'
            },
            {
              task_id: 'task_2',
              type: 'fix_security',
              entity_count: 3,
              estimated_hours: 16,
              priority: 'critical'
            }
          ]
        },
        {
          phase: 2,
          name: 'Code Quality Improvements',
          duration_weeks: 4,
          focus: 'Remove duplicates and improve naming',
          tasks: [
            {
              task_id: 'task_3',
              type: 'remove_duplicates',
              entity_count: 15,
              estimated_hours: 32,
              priority: 'high'
            },
            {
              task_id: 'task_4',
              type: 'improve_naming',
              entity_count: 25,
              estimated_hours: 20,
              priority: 'medium'
            }
          ]
        },
        {
          phase: 3,
          name: 'Structural Improvements',
          duration_weeks: 2,
          focus: 'Extract methods and classes for better organization',
          tasks: [
            {
              task_id: 'task_5',
              type: 'extract_method',
              entity_count: 12,
              estimated_hours: 28,
              priority: 'medium'
            }
          ]
        }
      ],
      estimated_total_hours: 120,
      expected_improvements: {
        complexity_reduction: '25%',
        duplication_reduction: '60%',
        maintainability_increase: '30%'
      },
      success_metrics: [
        'Average complexity below 8',
        'Duplication below 2%',
        'All critical security issues resolved'
      ]
    };
  }

  private async executeRefactoring(request: any): Promise<any> {
    const { entity_id, refactoring_id, auto_apply, create_backup, run_tests } = request;
    
    // This would typically execute the actual refactoring
    // For now, return a mock execution result
    return {
      entity_id,
      refactoring_id,
      execution_id: `exec_${Date.now()}`,
      status: auto_apply ? 'completed' : 'preview',
      timestamp: new Date().toISOString(),
      changes: {
        files_modified: auto_apply ? 3 : 0,
        lines_added: auto_apply ? 15 : 0,
        lines_removed: auto_apply ? 28 : 0,
        backup_created: create_backup
      },
      preview: {
        affected_files: [
          'src/services/user-service.ts',
          'src/controllers/user-controller.ts',
          'tests/user-service.test.ts'
        ],
        estimated_impact: 'low',
        breaking_changes: false
      },
      test_results: run_tests && auto_apply ? {
        total_tests: 45,
        passed: 45,
        failed: 0,
        duration_ms: 2340
      } : null,
      rollback_available: auto_apply && create_backup
    };
  }

  private async getRefactoringHistoryData(codebaseId: string, options: any): Promise<any> {
    // This would typically fetch from a database
    // For now, return mock history data
    const history = {
      codebase_id: codebaseId,
      total_refactorings: 156,
      recent_refactorings: [
        {
          id: 'ref_001',
          type: 'extract_method',
          entity_name: 'processUserData',
          applied_at: new Date(Date.now() - 86400000).toISOString(),
          status: 'completed',
          impact: 'medium'
        },
        {
          id: 'ref_002',
          type: 'reduce_complexity',
          entity_name: 'validateInput',
          applied_at: new Date(Date.now() - 172800000).toISOString(),
          status: 'completed',
          impact: 'high'
        }
      ].slice(0, options.limit)
    };

    if (options.include_statistics) {
      (history as any).statistics = {
        refactorings_by_type: {
          extract_method: 45,
          reduce_complexity: 32,
          improve_naming: 28,
          remove_duplicates: 25,
          extract_class: 15,
          other: 11
        },
        success_rate: 0.94,
        average_impact: 'medium',
        total_lines_improved: 12450
      };
    }

    return history;
  }

  private async analyzeRefactoringImpact(entityId: string, refactoringType: string, scope: string): Promise<any> {
    // This would typically perform detailed impact analysis
    // For now, return mock impact data
    return {
      entity_id: entityId,
      refactoring_type: refactoringType,
      scope,
      impact_analysis: {
        affected_files: [
          'src/services/user-service.ts',
          'src/controllers/user-controller.ts'
        ],
        affected_functions: 8,
        affected_tests: 12,
        breaking_changes: false,
        performance_impact: 'neutral',
        maintainability_improvement: 7.5,
        complexity_reduction: 3.2,
        estimated_effort_hours: 4,
        risk_level: 'low',
        dependencies: [
          'user-validation.ts',
          'auth-service.ts'
        ],
        recommendations: [
          'Update related unit tests',
          'Review integration tests',
          'Update documentation'
        ]
      }
    };
  }

  private async generateRecommendations(codebaseId: string, options: any): Promise<any> {
    // This would typically analyze the codebase and generate recommendations
    // For now, return mock recommendations
    return {
      codebase_id: codebaseId,
      priority: options.priority,
      focus_area: options.focus_area,
      recommendations: [
        {
          id: 'rec_001',
          type: 'reduce_complexity',
          title: 'Reduce complexity in authentication module',
          description: 'Several functions exceed complexity threshold',
          priority: 'high',
          estimated_effort: 'medium',
          affected_entities: 5,
          potential_impact: 'high'
        },
        {
          id: 'rec_002',
          type: 'remove_duplicates',
          title: 'Remove duplicate validation logic',
          description: 'Similar validation patterns found across multiple files',
          priority: 'medium',
          estimated_effort: 'small',
          affected_entities: 8,
          potential_impact: 'medium'
        }
      ].slice(0, options.max_recommendations),
      summary: {
        total_recommendations: 15,
        high_priority: 3,
        medium_priority: 7,
        low_priority: 5,
        estimated_total_effort: '2-3 weeks'
      }
    };
  }

  private async validateRefactoringOperation(entityId: string, refactoringType: string, parameters: any): Promise<any> {
    // This would typically validate the refactoring operation
    // For now, return mock validation result
    return {
      entity_id: entityId,
      refactoring_type: refactoringType,
      parameters,
      validation_result: {
        is_valid: true,
        can_apply: true,
        warnings: [],
        errors: [],
        prerequisites: [
          'Ensure all tests pass',
          'Create backup before applying'
        ],
        estimated_duration: '15-30 minutes',
        confidence_score: 0.92
      }
    };
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  private handleError(error: unknown, res: Response, defaultMessage: string): void {
    console.error('RefactoringController Error:', error);
    
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        })),
        timestamp: new Date().toISOString()
      });
      return;
    }

    const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    const message = error instanceof Error ? error.message : defaultMessage;

    res.status(statusCode).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }
}

export default RefactoringController;