 
import type { Request, Response } from 'express';
import { z } from 'zod';

// Rule 15: Global declarations for Node.js environment

declare const console: {
  message: (...args: unknown[]) => void;
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

// Rule 15: Proper TypeScript interfaces instead of 'any' types
interface CodebaseOptions {
  page?: number;
  limit?: number;
  status?: string;
  language?: string;
  include_stats?: boolean;
  search?: string;
  include_entities?: boolean;
  include_trends?: boolean;
  type?: string;
  recent_entities?: Record<string, unknown>[];
  sort_by?: string;
  sort_order?: string;
  period?: string;
}

interface CodebaseData {
  id: string;
  name: string;
  description?: string;
  language: string;
  framework?: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_indexed?: string;
  entity_count?: number;
  file_count?: number;
  tags?: string[];
  repository_url?: string;
  local_path?: string;
  indexing_status?: string;
  statistics?: {
    total_files: number;
    total_lines: number;
    total_functions: number;
    total_classes: number;
    complexity_average: number;
    test_coverage: number;
    last_analysis: string;
  };
  recent_entities?: Array<{
    id: string;
    name: string;
    type: string;
    file_path: string;
    complexity: number;
    last_modified: string;
  }>;
}

interface IndexingOptions {
  force_reindex?: boolean;
  include_tests?: boolean;
  include_dependencies?: boolean;
  file_patterns?: string[];
  exclude_patterns?: string[];
}

interface SyncOptions {
  sync_type?: 'git_pull' | 'file_system' | 'full';
  auto_reindex?: boolean;
  notify_changes?: boolean;
}

interface ExportOptions {
  format?: 'json' | 'csv' | 'xml';
  include_entities?: boolean;
  include_analysis?: boolean;
  include_history?: boolean;
}

const CreateCodebaseRequestSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  repository_url: z.string().url().optional(),
  local_path: z.string().min(1, 'Local path is required'),
  language: z.string().min(1, 'Programming language is required'),
  framework: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const UpdateCodebaseRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  repository_url: z.string().url().optional(),
  local_path: z.string().min(1).optional(),
  language: z.string().min(1).optional(),
  framework: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
});

const IndexCodebaseRequestSchema = z.object({
  force_reindex: z.boolean().default(false),
  include_tests: z.boolean().default(true),
  include_dependencies: z.boolean().default(false),
  file_patterns: z.array(z.string()).optional(),
  exclude_patterns: z.array(z.string()).optional(),
});

const SyncCodebaseRequestSchema = z.object({
  sync_type: z.enum(['git_pull', 'file_system', 'full']).default('file_system'),
  auto_reindex: z.boolean().default(true),
  notify_changes: z.boolean().default(false),
});

export class CodebaseController {
  /**
   * Get all codebases
   * GET /api/codebase
   */
  async getCodebases(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        language,
        search,
        sort_by = 'updated_at',
        sort_order = 'desc',
      } = req.query;

      const codebases = await this.fetchCodebases({
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        status: status as string,
        language: language as string,
        search: search as string,
        sort_by: sort_by as string,
        sort_order: sort_order as string,
      });

      res.status(200).json({
        success: true,
        data: codebases,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to fetch codebases');
    }
  }

  /**
   * Get a specific codebase by ID
   * GET /api/codebase/:id
   */
  async getCodebase(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { include_stats = false, include_entities = false } = req.query;

      if (!id || !this.isValidUUID(id)) {
        res.status(400).json({
          success: false,
          message: 'Valid codebase ID is required',
        });
        return;
      }

      const codebase = await this.fetchCodebaseById(id, {
        include_stats: include_stats === 'true',
        include_entities: include_entities === 'true',
      });

      res.status(200).json({
        success: true,
        data: codebase,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to fetch codebase');
    }
  }

  /**
   * Create a new codebase
   * POST /api/codebase
   */
  async createCodebase(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = CreateCodebaseRequestSchema.parse(req.body);

      const codebase = await this.createNewCodebase(validatedData);

      res.status(201).json({
        success: true,
        data: codebase,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to create codebase');
    }
  }

  /**
   * Update an existing codebase
   * PUT /api/codebase/:id
   */
  async updateCodebase(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || !this.isValidUUID(id)) {
        res.status(400).json({
          success: false,
          message: 'Valid codebase ID is required',
        });
        return;
      }

      const validatedData = UpdateCodebaseRequestSchema.parse(req.body);

      const codebase = await this.updateExistingCodebase(id, validatedData);

      res.status(200).json({
        success: true,
        data: codebase,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to update codebase');
    }
  }

  /**
   * Delete a codebase
   * DELETE /api/codebase/:id
   */
  async deleteCodebase(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { force = false } = req.query;

      if (!id || !this.isValidUUID(id)) {
        res.status(400).json({
          success: false,
          message: 'Valid codebase ID is required',
        });
        return;
      }

      const result = await this.removeCodebase(id, force === 'true');

      if (!result.success) {
        res.status(404).json({
          success: false,
          message: result.error || 'Codebase not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: { message: 'Codebase deleted successfully' },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to delete codebase');
    }
  }

  /**
   * Index or reindex a codebase
   * POST /api/codebase/:id/index
   */
  async indexCodebase(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || !this.isValidUUID(id)) {
        res.status(400).json({
          success: false,
          message: 'Valid codebase ID is required',
        });
        return;
      }

      const validatedData = IndexCodebaseRequestSchema.parse(req.body);

      const indexingResult = await this.performCodebaseIndexing(id, validatedData);

      res.status(200).json({
        success: true,
        data: indexingResult,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to index codebase');
    }
  }

  /**
   * Get indexing status for a codebase
   * GET /api/codebase/:id/index/status
   */
  async getIndexingStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || !this.isValidUUID(id)) {
        res.status(400).json({
          success: false,
          message: 'Valid codebase ID is required',
        });
        return;
      }

      const status = await this.getCodebaseIndexingStatus(id);

      res.status(200).json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to get indexing status');
    }
  }

  /**
   * Sync codebase with external source
   * POST /api/codebase/:id/sync
   */
  async syncCodebase(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || !this.isValidUUID(id)) {
        res.status(400).json({
          success: false,
          message: 'Valid codebase ID is required',
        });
        return;
      }

      const validatedData = SyncCodebaseRequestSchema.parse(req.body);

      const syncResult = await this.performCodebaseSync(id, validatedData);

      res.status(200).json({
        success: true,
        data: syncResult,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to sync codebase');
    }
  }

  /**
   * Get codebase statistics
   * GET /api/codebase/:id/stats
   */
  async getCodebaseStats(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { include_trends = false, period = '30d', granularity: _granularity = 'daily' } = req.query;

      if (!id || !this.isValidUUID(id)) {
        res.status(400).json({
          success: false,
          message: 'Valid codebase ID is required',
        });
        return;
      }

      const stats = await this.getCodebaseStatistics(id, {
        include_trends: include_trends === 'true',
        period: period as string,
      });

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to get codebase statistics');
    }
  }

  /**
   * Get codebase entities (files, functions, classes)
   * GET /api/codebase/:id/entities
   */
  async getCodebaseEntities(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        type,
        page = 1,
        limit = 50,
        search,
        sort_by = 'name',
        sort_order = 'asc',
      } = req.query;

      if (!id || !this.isValidUUID(id)) {
        res.status(400).json({
          success: false,
          message: 'Valid codebase ID is required',
        });
        return;
      }

      const entities = await this.fetchCodebaseEntities(id, {
        type: type as string,
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
        search: search as string,
        sort_by: sort_by as string,
        sort_order: sort_order as string,
      });

      res.status(200).json({
        success: true,
        data: entities,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, res, 'Failed to get codebase entities');
    }
  }

  /**
   * Export codebase data
   * GET /api/codebase/:id/export
   */
  async exportCodebase(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        format = 'json' as 'json' | 'csv' | 'xml',
        include_entities = true,
        include_analysis = false,
        compress: _compress = false,
      } = req.query;

      if (!id || !this.isValidUUID(id)) {
        res.status(400).json({
          success: false,
          message: 'Valid codebase ID is required',
        });
        return;
      }

      const exportData = await this.exportCodebaseData(id, {
        format: format as 'json' | 'csv' | 'xml',
        include_entities: include_entities === 'true',
        include_analysis: include_analysis === 'true',
      });

      if (format === 'json') {
        res.status(200).json({
          success: true,
          data: exportData,
          timestamp: new Date().toISOString(),
        });
      } else {
        // For other formats, set appropriate headers and send file
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="codebase_${id}.${format}"`);
        res.send(exportData);
      }
    } catch (error) {
      this.handleError(error, res, 'Failed to export codebase');
    }
  }

  private async fetchCodebases(options: CodebaseOptions): Promise<CodebaseData[]> {
    // This would typically fetch from a database
    // For now, return mock data
    const mockCodebases = [
      {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'E-commerce Platform',
        description: 'Main e-commerce application',
        language: 'TypeScript',
        framework: 'React',
        status: 'active',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-20T15:30:00Z',
        last_indexed: '2024-01-20T14:00:00Z',
        entity_count: 1245,
        file_count: 156,
        tags: ['frontend', 'web', 'production'],
      },
      {
        id: '123e4567-e89b-12d3-a456-426614174001',
        name: 'API Gateway',
        description: 'Microservices API gateway',
        language: 'Node.js',
        framework: 'Express',
        status: 'active',
        created_at: '2024-01-10T09:00:00Z',
        updated_at: '2024-01-19T11:20:00Z',
        last_indexed: '2024-01-19T10:45:00Z',
        entity_count: 567,
        file_count: 89,
        tags: ['backend', 'api', 'microservices'],
      },
    ];

    // Apply filtering and pagination
    let filtered = mockCodebases;

    if (options.status) {
      filtered = filtered.filter(cb => cb.status === options.status);
    }

    if (options.language) {
      filtered = filtered.filter(cb =>
        cb.language.toLowerCase().includes(options.language.toLowerCase()),
      );
    }

    if (options.search) {
      filtered = filtered.filter(
        cb =>
          cb.name.toLowerCase().includes(options.search.toLowerCase()) ||
          cb.description.toLowerCase().includes(options.search.toLowerCase()),
      );
    }

    const _total = filtered.length;
    const startIndex = (options.page - 1) * options.limit;
    const endIndex = startIndex + options.limit;
    const paginatedResults = filtered.slice(startIndex, endIndex);

    return paginatedResults;
  }

  private async fetchCodebaseById(id: string, options: CodebaseOptions): Promise<CodebaseData> {
    // This would typically fetch from a database
    // For now, return mock data
    const mockCodebase: CodebaseData = {
      id,
      name: 'E-commerce Platform',
      description: 'Main e-commerce application with user management and payment processing',
      repository_url: 'https://github.com/company/ecommerce-platform',
      local_path: '/projects/ecommerce-platform',
      language: 'TypeScript',
      framework: 'React',
      status: 'active',
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-20T15:30:00Z',
      last_indexed: '2024-01-20T14:00:00Z',
      tags: ['frontend', 'web', 'production'],
      indexing_status: 'completed',
    };

    if (options.include_stats) {
      mockCodebase.statistics = {
        total_files: 156,
        total_lines: 45678,
        total_functions: 1234,
        total_classes: 89,
        complexity_average: 7.2,
        test_coverage: 78.5,
        last_analysis: '2024-01-20T14:00:00Z',
      };
    }

    if (options.include_entities) {
      mockCodebase.recent_entities = [
        {
          id: 'entity_001',
          name: 'UserService',
          type: 'class',
          file_path: 'src/services/user-service.ts',
          complexity: 8,
          last_modified: '2024-01-20T10:30:00Z',
        },
        {
          id: 'entity_002',
          name: 'validatePayment',
          type: 'function',
          file_path: 'src/utils/payment-validator.ts',
          complexity: 5,
          last_modified: '2024-01-19T14:15:00Z',
        },
      ];
    }

    return mockCodebase;
  }

  private async createNewCodebase(data: z.infer<typeof CreateCodebaseRequestSchema>): Promise<CodebaseData> {
    // This would typically create in a database
    // For now, return mock created codebase
    const newCodebase: CodebaseData = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: data.name || 'Untitled Codebase',
      description: data.description,
      language: data.language || 'typescript',
      framework: data.framework,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_indexed: null,
      entity_count: 0,
      file_count: 0,
      indexing_status: 'pending',
    };

    return newCodebase;
  }

  private async updateExistingCodebase(id: string, data: z.infer<typeof UpdateCodebaseRequestSchema>): Promise<CodebaseData> {
    // This would typically update in a database
    // For now, return mock updated codebase
    const existingCodebase = await this.fetchCodebaseById(id, {});

    return {
      ...existingCodebase,
      ...data,
      updated_at: new Date().toISOString(),
    };
  }

  private async removeCodebase(id: string, force: boolean): Promise<{ success: boolean; message: string; error?: string }> {
    // This would typically delete from a database
    // For now, return mock result
    const codebase = await this.fetchCodebaseById(id, {});

    if (!force && codebase.status === 'active') {
      return { success: false, message: 'Cannot delete active codebase without force flag' };
    }

    return { success: true, message: 'Codebase removed successfully' };
  }

  private async performCodebaseIndexing(id: string, _options: IndexingOptions): Promise<{ success: boolean; job_id: string; message: string }> {
    // This would typically trigger the actual indexing process
    // For now, return mock indexing result
    const jobId = `idx_${Date.now()}`;
    return {
      success: true,
      job_id: jobId,
      message: `Indexing job ${jobId} started for codebase ${id}`,
    };
  }

  private async getCodebaseIndexingStatus(_id: string): Promise<{ status: string; progress?: number; message?: string }> {
    // This would typically fetch current indexing status
    // For now, return mock status
    return {
      status: 'completed',
      progress: 100,
      message: 'Indexing completed successfully',
    };
  }

  private async performCodebaseSync(id: string, _options: SyncOptions): Promise<{ success: boolean; changes_detected?: number; message: string }> {
    // This would typically perform the actual sync
    // For now, return mock sync result
    return {
      success: true,
      changes_detected: 11,
      message: `Sync completed for codebase ${id}`,
    };
  }

  private async getCodebaseStatistics(id: string, options: CodebaseOptions): Promise<Record<string, unknown>> {
    // This would typically calculate actual statistics
    // For now, return mock statistics
    const stats: Record<string, unknown> = {
      codebase_id: id,
      overview: {
        total_files: 156,
        total_lines: 45678,
        total_functions: 1234,
        total_classes: 89,
        total_interfaces: 45,
        total_variables: 2345,
      },
      complexity: {
        average_complexity: 7.2,
        max_complexity: 25,
        high_complexity_count: 23,
        complexity_distribution: {
          low: 1089,
          medium: 122,
          high: 23,
        },
      },
      quality: {
        test_coverage: 78.5,
        documentation_coverage: 65.2,
        code_duplication: 2.1,
        maintainability_index: 72.8,
      },
      languages: {
        TypeScript: 89.5,
        JavaScript: 8.2,
        CSS: 1.8,
        HTML: 0.5,
      },
      last_updated: new Date().toISOString(),
    };

    if (options.include_trends) {
      stats.trends = {
        complexity_trend: 'stable',
        test_coverage_trend: 'improving',
        code_quality_trend: 'improving',
        historical_data: [
          {
            date: '2024-01-15',
            complexity: 7.5,
            test_coverage: 75.2,
            maintainability: 70.1,
          },
          {
            date: '2024-01-20',
            complexity: 7.2,
            test_coverage: 78.5,
            maintainability: 72.8,
          },
        ],
      };
    }

    return stats;
  }

  private async fetchCodebaseEntities(id: string, options: CodebaseOptions): Promise<Record<string, unknown>[]> {
    // This would typically fetch from a database
    // For now, return mock entities
    const mockEntities = [
      {
        id: 'entity_001',
        name: 'UserService',
        type: 'class',
        file_path: 'src/services/user-service.ts',
        line_start: 15,
        line_end: 145,
        complexity: 8,
        last_modified: '2024-01-20T10:30:00Z',
      },
      {
        id: 'entity_002',
        name: 'validatePayment',
        type: 'function',
        file_path: 'src/utils/payment-validator.ts',
        line_start: 25,
        line_end: 67,
        complexity: 5,
        last_modified: '2024-01-19T14:20:00Z',
      },
    ];

    // Apply filtering
    let filtered = mockEntities;

    if (options.type) {
      filtered = filtered.filter(entity => entity.type === options.type);
    }

    if (options.search) {
      filtered = filtered.filter(entity =>
        entity.name.toLowerCase().includes(options.search.toLowerCase()),
      );
    }

    const _total = filtered.length;
    const startIndex = (options.page - 1) * options.limit;
    const endIndex = startIndex + options.limit;
    const paginatedResults = filtered.slice(startIndex, endIndex);

    return paginatedResults;
  }

  private async exportCodebaseData(id: string, options: ExportOptions): Promise<Record<string, unknown>> {
    // This would typically generate export data
    // For now, return mock export data
    const exportData: Record<string, unknown> = {
      codebase_id: id,
      export_timestamp: new Date().toISOString(),
      format: options.format,
      metadata: {
        name: 'E-commerce Platform',
        language: 'TypeScript',
        total_files: 156,
        total_entities: 1234,
      },
    };

    if (options.include_entities) {
      exportData.entities = await this.fetchCodebaseEntities(id, { page: 1, limit: 1000 });
    }

    if (options.include_analysis) {
      exportData.analysis = {
        complexity_analysis: 'included',
        security_analysis: 'included',
        quality_metrics: 'included',
      };
    }

    return exportData;
  }

  private isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  private handleError(error: unknown, res: Response, defaultMessage: string): void {
    console.error('CodebaseController Error:', error);

    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        details: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
        })),
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    const message = error instanceof Error ? error.message : defaultMessage;

    res.status(statusCode).json({
      success: false,
      message: message,
      timestamp: new Date().toISOString(),
    });
  }
}

export default CodebaseController;
