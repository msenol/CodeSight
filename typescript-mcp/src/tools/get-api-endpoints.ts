/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import type { APIEndpoint } from '../types/index.js';
import { z } from 'zod';

const GetApiEndpointsInputSchema = z.object({
  codebase_id: z.string().uuid('Invalid codebase ID'),
  filter_method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'all']).default('all'),
  include_schemas: z.boolean().default(true),
  include_middleware: z.boolean().default(false),
  include_deprecated: z.boolean().default(false),
});

// Rule 15: Type reserved for future implementation
// type GetApiEndpointsInput = z.infer<typeof GetApiEndpointsInputSchema>;

// Rule 15: Interface reserved for future implementation
// interface Parameter {
//   name: string;
//   type: 'path' | 'query' | 'body' | 'header';
//   data_type: string;
//   required: boolean;
//   description?: string;
// }

interface GetApiEndpointsResult {
  codebase_id: string;
  total_count: number;
  endpoints: APIEndpoint[];
  methods_summary: Record<string, number>;
  authentication_summary: {
    protected: number;
    public: number;
  };
  frameworks_detected: string[];
}

export class GetApiEndpointsTool {
  name = 'get_api_endpoints';
  description = 'Discover and analyze REST and GraphQL API endpoints in the codebase';

  inputSchema = {
    type: 'object',
    properties: {
      codebase_id: {
        type: 'string',
        description: 'UUID of the codebase to analyze',
      },
      filter_method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'all'],
        description: 'Filter endpoints by HTTP method',
        default: 'all',
      },
      include_schemas: {
        type: 'boolean',
        description: 'Include request/response schemas',
        default: true,
      },
      include_middleware: {
        type: 'boolean',
        description: 'Include middleware information',
        default: false,
      },
      include_deprecated: {
        type: 'boolean',
        description: 'Include deprecated endpoints',
        default: false,
      },
    },
    required: ['codebase_id'],
  };

  // Constructor removed - services injected via dependency injection

  async call(args: unknown): Promise<GetApiEndpointsResult> {
    try {
      const input = GetApiEndpointsInputSchema.parse(args);

      const codebase = await this.codebaseService.getCodebase(input.codebase_id);
      if (!codebase) {
        throw new Error(`Codebase with ID ${input.codebase_id} not found`);
      }

      const endpoints = await this.apiDiscoveryService.findApiEndpoints(input.codebase_id);
      const methodsSummary = this.calculateMethodsSummary(endpoints);
      const authSummary = this.calculateAuthSummary(endpoints);
      const frameworks = await this.apiDiscoveryService.detectFrameworks(input.codebase_id);

      return {
        codebase_id: input.codebase_id,
        total_count: endpoints.length,
        endpoints,
        methods_summary: methodsSummary,
        authentication_summary: authSummary,
        frameworks_detected: frameworks,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      throw new Error(
        `API endpoint discovery failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private calculateMethodsSummary(endpoints: APIEndpoint[]): Record<string, number> {
    const summary: Record<string, number> = {};
    endpoints.forEach(endpoint => {
      summary[endpoint.method] = (summary[endpoint.method] || 0) + 1;
    });
    return summary;
  }

  private calculateAuthSummary(endpoints: APIEndpoint[]) {
    return {
      protected: endpoints.filter(e => e.authentication_required).length,
      public: endpoints.filter(e => !e.authentication_required).length,
    };
  }
}

export default GetApiEndpointsTool;
