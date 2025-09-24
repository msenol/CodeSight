import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CodebaseService } from '../services/codebase-service.js';
import type { AnalysisService } from '../services/analysis-service.js';
import { z } from 'zod';

// Input validation schema
const TraceDataFlowInputSchema = z.object({
  start_point: z.string().min(1, 'Start point cannot be empty'),
  end_point: z.string().min(1, 'End point cannot be empty'),
  codebase_id: z.string().uuid('Invalid codebase ID'),
  max_depth: z.number().int().min(1).max(20).default(10),
  include_external: z.boolean().default(false),
  trace_direction: z.enum(['forward', 'backward', 'bidirectional']).default('forward'),
  include_data_transformations: z.boolean().default(true),
  include_side_effects: z.boolean().default(true)
});

type TraceDataFlowInput = z.infer<typeof TraceDataFlowInputSchema>;

interface DataFlowNode {
  id: string;
  name: string;
  type: 'api_endpoint' | 'function' | 'database' | 'service' | 'variable' | 'parameter' | 'return_value' | 'external_service';
  file_path?: string;
  line_number?: number;
  description: string;
  data_format?: string;
  transformations: string[];
  side_effects: string[];
  security_implications: string[];
}

interface DataFlowEdge {
  from: string;
  to: string;
  relationship_type: 'calls' | 'passes_data' | 'transforms' | 'stores' | 'retrieves' | 'validates' | 'processes';
  data_description: string;
  transformation_details?: string;
  confidence: number;
  conditions?: string[];
}

interface DataFlowTrace {
  start_point: string;
  end_point: string;
  trace_direction: string;
  total_steps: number;
  max_depth_reached: number;
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
  paths: DataFlowPath[];
  data_transformations: DataTransformation[];
  security_checkpoints: SecurityCheckpoint[];
  performance_bottlenecks: string[];
  external_dependencies: string[];
}

interface DataFlowPath {
  id: string;
  nodes: string[];
  description: string;
  data_flow_description: string;
  estimated_latency?: number;
  error_handling: string[];
  validation_steps: string[];
}

interface DataTransformation {
  location: string;
  input_format: string;
  output_format: string;
  transformation_type: 'validation' | 'formatting' | 'filtering' | 'aggregation' | 'encryption' | 'serialization' | 'other';
  description: string;
  potential_data_loss: boolean;
}

interface SecurityCheckpoint {
  location: string;
  checkpoint_type: 'authentication' | 'authorization' | 'validation' | 'sanitization' | 'encryption' | 'audit';
  description: string;
  security_level: 'low' | 'medium' | 'high';
}

/**
 * Trace data flow through the codebase from start point to end point
 * Analyzes how data moves, transforms, and is processed across the system
 */
export class TraceDataFlowTool {
  name = 'trace_data_flow';
  description = 'Trace data flow through the codebase with detailed analysis of transformations and security';
  
  inputSchema = {
    type: 'object',
    properties: {
      start_point: {
        type: 'string',
        description: 'Starting point for data flow trace (e.g., "REST API /users", "function getUserData")'
      },
      end_point: {
        type: 'string',
        description: 'End point for data flow trace (e.g., "database table users", "function saveUser")'
      },
      codebase_id: {
        type: 'string',
        description: 'UUID of the codebase to trace within'
      },
      max_depth: {
        type: 'number',
        description: 'Maximum depth of trace to prevent infinite loops',
        default: 10
      },
      include_external: {
        type: 'boolean',
        description: 'Include external services and APIs in trace',
        default: false
      },
      trace_direction: {
        type: 'string',
        enum: ['forward', 'backward', 'bidirectional'],
        description: 'Direction of data flow trace',
        default: 'forward'
      },
      include_data_transformations: {
        type: 'boolean',
        description: 'Include detailed data transformation analysis',
        default: true
      },
      include_side_effects: {
        type: 'boolean',
        description: 'Include side effects and state changes',
        default: true
      }
    },
    required: ['start_point', 'end_point', 'codebase_id']
  };

  constructor(
    private codebaseService: CodebaseService,
    private analysisService: AnalysisService
  ) {}

  async call(args: unknown): Promise<DataFlowTrace> {
    try {
      // Validate input
      const input = TraceDataFlowInputSchema.parse(args);
      
      // Verify codebase exists
      const codebase = await this.codebaseService.getCodebase(input.codebase_id);
      if (!codebase) {
        throw new Error(`Codebase with ID ${input.codebase_id} not found`);
      }

      // Parse start and end points
      const startNode = await this.parseDataFlowPoint(input.start_point, input.codebase_id);
      const endNode = await this.parseDataFlowPoint(input.end_point, input.codebase_id);
      
      if (!startNode) {
        throw new Error(`Could not find or parse start point: ${input.start_point}`);
      }
      
      if (!endNode) {
        throw new Error(`Could not find or parse end point: ${input.end_point}`);
      }

      // Perform data flow trace
      const traceResult = await this.performDataFlowTrace(
        startNode,
        endNode,
        input
      );
      
      // Analyze data transformations
      const transformations = input.include_data_transformations 
        ? await this.analyzeDataTransformations(traceResult.nodes, traceResult.edges)
        : [];
      
      // Identify security checkpoints
      const securityCheckpoints = await this.identifySecurityCheckpoints(
        traceResult.nodes,
        traceResult.edges
      );
      
      // Identify performance bottlenecks
      const bottlenecks = await this.identifyPerformanceBottlenecks(
        traceResult.nodes,
        traceResult.edges
      );
      
      // Find external dependencies
      const externalDeps = input.include_external 
        ? await this.findExternalDependencies(traceResult.nodes)
        : [];
      
      return {
        start_point: input.start_point,
        end_point: input.end_point,
        trace_direction: input.trace_direction,
        total_steps: traceResult.nodes.length,
        max_depth_reached: traceResult.maxDepth,
        nodes: traceResult.nodes,
        edges: traceResult.edges,
        paths: traceResult.paths,
        data_transformations: transformations,
        security_checkpoints: securityCheckpoints,
        performance_bottlenecks: bottlenecks,
        external_dependencies: externalDeps
      };
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      
      throw new Error(`Data flow trace failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse a data flow point (start or end) into a node
   */
  private async parseDataFlowPoint(point: string, codebaseId: string): Promise<DataFlowNode | null> {
    const lowerPoint = point.toLowerCase();
    
    // API endpoint pattern
    if (lowerPoint.includes('api') || lowerPoint.includes('endpoint') || lowerPoint.startsWith('/')) {
      return await this.parseApiEndpoint(point, codebaseId);
    }
    
    // Database pattern
    if (lowerPoint.includes('database') || lowerPoint.includes('table') || lowerPoint.includes('collection')) {
      return await this.parseDatabasePoint(point, codebaseId);
    }
    
    // Function pattern
    if (lowerPoint.includes('function') || lowerPoint.includes('method')) {
      return await this.parseFunctionPoint(point, codebaseId);
    }
    
    // Service pattern
    if (lowerPoint.includes('service')) {
      return await this.parseServicePoint(point, codebaseId);
    }
    
    // Try to find as entity name
    return await this.parseEntityPoint(point, codebaseId);
  }

  /**
   * Parse API endpoint
   */
  private async parseApiEndpoint(point: string, codebaseId: string): Promise<DataFlowNode | null> {
    // Extract endpoint path
    const pathMatch = point.match(/\/[\w\/-]+/);
    const path = pathMatch ? pathMatch[0] : point;
    
    // Find API endpoint in codebase
    const endpoints = await this.analysisService.findApiEndpoints(codebaseId, { path });
    
    if (endpoints.length > 0) {
      const endpoint = endpoints[0];
      return {
        id: `api_${endpoint.id}`,
        name: `${endpoint.method} ${endpoint.path}`,
        type: 'api_endpoint',
        file_path: endpoint.file_path,
        line_number: endpoint.line_number,
        description: `REST API endpoint ${endpoint.method} ${endpoint.path}`,
        data_format: endpoint.request_schema ? 'JSON' : 'unknown',
        transformations: [],
        side_effects: [],
        security_implications: endpoint.authentication_required ? ['requires_authentication'] : []
      };
    }
    
    // Create generic API node if not found
    return {
      id: `api_${path.replace(/\//g, '_')}`,
      name: point,
      type: 'api_endpoint',
      description: `API endpoint: ${point}`,
      data_format: 'JSON',
      transformations: [],
      side_effects: [],
      security_implications: []
    };
  }

  /**
   * Parse database point
   */
  private async parseDatabasePoint(point: string, codebaseId: string): Promise<DataFlowNode | null> {
    // Extract table/collection name
    const tableMatch = point.match(/table\s+(\w+)|collection\s+(\w+)|(\w+)\s+table/);
    const tableName = tableMatch ? (tableMatch[1] || tableMatch[2] || tableMatch[3]) : point;
    
    return {
      id: `db_${tableName}`,
      name: tableName,
      type: 'database',
      description: `Database table/collection: ${tableName}`,
      data_format: 'structured',
      transformations: [],
      side_effects: ['data_persistence'],
      security_implications: ['data_access_control']
    };
  }

  /**
   * Parse function point
   */
  private async parseFunctionPoint(point: string, codebaseId: string): Promise<DataFlowNode | null> {
    // Extract function name
    const funcMatch = point.match(/function\s+(\w+)|method\s+(\w+)|(\w+)\s*\(/);
    const funcName = funcMatch ? (funcMatch[1] || funcMatch[2] || funcMatch[3]) : point;
    
    // Search for function in codebase
    const entities = await this.analysisService.searchEntities(codebaseId, {
      name: funcName,
      entity_types: ['function', 'method']
    });
    
    if (entities.length > 0) {
      const entity = entities[0];
      return {
        id: `func_${entity.id}`,
        name: entity.name,
        type: 'function',
        file_path: entity.file_path,
        line_number: entity.start_line,
        description: `Function: ${entity.qualified_name}`,
        data_format: 'parameters',
        transformations: [],
        side_effects: [],
        security_implications: []
      };
    }
    
    return null;
  }

  /**
   * Parse service point
   */
  private async parseServicePoint(point: string, codebaseId: string): Promise<DataFlowNode | null> {
    const serviceMatch = point.match(/service\s+(\w+)|(\w+)\s+service/);
    const serviceName = serviceMatch ? (serviceMatch[1] || serviceMatch[2]) : point;
    
    return {
      id: `service_${serviceName}`,
      name: serviceName,
      type: 'service',
      description: `Service: ${serviceName}`,
      data_format: 'service_calls',
      transformations: [],
      side_effects: [],
      security_implications: []
    };
  }

  /**
   * Parse entity point
   */
  private async parseEntityPoint(point: string, codebaseId: string): Promise<DataFlowNode | null> {
    const entities = await this.analysisService.searchEntities(codebaseId, {
      name: point
    });
    
    if (entities.length > 0) {
      const entity = entities[0];
      return {
        id: `entity_${entity.id}`,
        name: entity.name,
        type: this.mapEntityTypeToNodeType(entity.entity_type),
        file_path: entity.file_path,
        line_number: entity.start_line,
        description: `${entity.entity_type}: ${entity.qualified_name}`,
        data_format: 'code',
        transformations: [],
        side_effects: [],
        security_implications: []
      };
    }
    
    return null;
  }

  /**
   * Perform the actual data flow trace
   */
  private async performDataFlowTrace(
    startNode: DataFlowNode,
    endNode: DataFlowNode,
    input: TraceDataFlowInput
  ): Promise<{ nodes: DataFlowNode[], edges: DataFlowEdge[], paths: DataFlowPath[], maxDepth: number }> {
    const nodes: DataFlowNode[] = [startNode];
    const edges: DataFlowEdge[] = [];
    const paths: DataFlowPath[] = [];
    const visited = new Set<string>();
    const queue: { node: DataFlowNode, depth: number, path: string[] }[] = [
      { node: startNode, depth: 0, path: [startNode.id] }
    ];
    
    let maxDepthReached = 0;
    
    while (queue.length > 0 && maxDepthReached < input.max_depth) {
      const { node: currentNode, depth, path } = queue.shift()!;
      
      if (visited.has(currentNode.id)) {
        continue;
      }
      
      visited.add(currentNode.id);
      maxDepthReached = Math.max(maxDepthReached, depth);
      
      // Check if we reached the end point
      if (currentNode.id === endNode.id || this.nodesMatch(currentNode, endNode)) {
        paths.push({
          id: `path_${paths.length}`,
          nodes: [...path, endNode.id],
          description: `Data flow from ${startNode.name} to ${endNode.name}`,
          data_flow_description: this.generateDataFlowDescription(path, nodes),
          error_handling: [],
          validation_steps: []
        });
        
        if (!nodes.find(n => n.id === endNode.id)) {
          nodes.push(endNode);
        }
        continue;
      }
      
      // Find connected nodes
      const connectedNodes = await this.findConnectedNodes(currentNode, input);
      
      for (const { node: nextNode, edge } of connectedNodes) {
        if (!visited.has(nextNode.id) && depth < input.max_depth) {
          // Add node if not already present
          if (!nodes.find(n => n.id === nextNode.id)) {
            nodes.push(nextNode);
          }
          
          // Add edge
          edges.push(edge);
          
          // Add to queue for further exploration
          queue.push({
            node: nextNode,
            depth: depth + 1,
            path: [...path, nextNode.id]
          });
        }
      }
    }
    
    return { nodes, edges, paths, maxDepth: maxDepthReached };
  }

  /**
   * Find nodes connected to the current node
   */
  private async findConnectedNodes(
    currentNode: DataFlowNode,
    input: TraceDataFlowInput
  ): Promise<{ node: DataFlowNode, edge: DataFlowEdge }[]> {
    const connected: { node: DataFlowNode, edge: DataFlowEdge }[] = [];
    
    // Find function calls and data dependencies
    if (currentNode.type === 'function' && currentNode.file_path) {
      const callees = await this.analysisService.findCallees(currentNode.id.replace('func_', ''));
      
      for (const callee of callees) {
        const calleeNode: DataFlowNode = {
          id: `func_${callee.entity_id}`,
          name: callee.name,
          type: 'function',
          file_path: callee.file_path,
          line_number: callee.line_number,
          description: `Function: ${callee.qualified_name}`,
          data_format: 'parameters',
          transformations: [],
          side_effects: [],
          security_implications: []
        };
        
        const edge: DataFlowEdge = {
          from: currentNode.id,
          to: calleeNode.id,
          relationship_type: 'calls',
          data_description: 'Function call with parameters',
          confidence: callee.confidence || 0.8
        };
        
        connected.push({ node: calleeNode, edge });
      }
    }
    
    // Find API endpoint handlers
    if (currentNode.type === 'api_endpoint') {
      const handlers = await this.findApiHandlers(currentNode, input.codebase_id);
      connected.push(...handlers);
    }
    
    // Find database operations
    if (currentNode.type === 'function') {
      const dbOps = await this.findDatabaseOperations(currentNode, input.codebase_id);
      connected.push(...dbOps);
    }
    
    return connected;
  }

  /**
   * Find API handlers for an endpoint
   */
  private async findApiHandlers(
    apiNode: DataFlowNode,
    codebaseId: string
  ): Promise<{ node: DataFlowNode, edge: DataFlowEdge }[]> {
    // This would typically involve finding the controller/handler function
    // For now, return empty array as this requires more complex analysis
    return [];
  }

  /**
   * Find database operations in a function
   */
  private async findDatabaseOperations(
    funcNode: DataFlowNode,
    codebaseId: string
  ): Promise<{ node: DataFlowNode, edge: DataFlowEdge }[]> {
    // This would involve analyzing the function code for database calls
    // For now, return empty array as this requires more complex analysis
    return [];
  }

  /**
   * Check if two nodes match (same entity)
   */
  private nodesMatch(node1: DataFlowNode, node2: DataFlowNode): boolean {
    return node1.name === node2.name && node1.type === node2.type;
  }

  /**
   * Generate data flow description for a path
   */
  private generateDataFlowDescription(path: string[], nodes: DataFlowNode[]): string {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const descriptions: string[] = [];
    
    for (let i = 0; i < path.length - 1; i++) {
      const fromNode = nodeMap.get(path[i]);
      const toNode = nodeMap.get(path[i + 1]);
      
      if (fromNode && toNode) {
        descriptions.push(`${fromNode.name} → ${toNode.name}`);
      }
    }
    
    return descriptions.join(' → ');
  }

  /**
   * Analyze data transformations in the flow
   */
  private async analyzeDataTransformations(
    nodes: DataFlowNode[],
    edges: DataFlowEdge[]
  ): Promise<DataTransformation[]> {
    const transformations: DataTransformation[] = [];
    
    for (const node of nodes) {
      if (node.type === 'function' && node.file_path) {
        // Analyze function for data transformations
        const funcTransformations = await this.analyzeFunctionTransformations(node);
        transformations.push(...funcTransformations);
      }
    }
    
    return transformations;
  }

  /**
   * Analyze transformations in a function
   */
  private async analyzeFunctionTransformations(node: DataFlowNode): Promise<DataTransformation[]> {
    // This would involve analyzing the function code for data transformations
    // For now, return basic transformation based on function name
    const transformations: DataTransformation[] = [];
    
    const name = node.name.toLowerCase();
    
    if (name.includes('validate')) {
      transformations.push({
        location: node.name,
        input_format: 'raw_data',
        output_format: 'validated_data',
        transformation_type: 'validation',
        description: 'Data validation and sanitization',
        potential_data_loss: false
      });
    }
    
    if (name.includes('format') || name.includes('serialize')) {
      transformations.push({
        location: node.name,
        input_format: 'object',
        output_format: 'string',
        transformation_type: 'serialization',
        description: 'Data serialization/formatting',
        potential_data_loss: false
      });
    }
    
    return transformations;
  }

  /**
   * Identify security checkpoints
   */
  private async identifySecurityCheckpoints(
    nodes: DataFlowNode[],
    edges: DataFlowEdge[]
  ): Promise<SecurityCheckpoint[]> {
    const checkpoints: SecurityCheckpoint[] = [];
    
    for (const node of nodes) {
      const name = node.name.toLowerCase();
      
      if (name.includes('auth') || name.includes('login')) {
        checkpoints.push({
          location: node.name,
          checkpoint_type: 'authentication',
          description: 'User authentication checkpoint',
          security_level: 'high'
        });
      }
      
      if (name.includes('validate') || name.includes('sanitize')) {
        checkpoints.push({
          location: node.name,
          checkpoint_type: 'validation',
          description: 'Data validation and sanitization',
          security_level: 'medium'
        });
      }
      
      if (name.includes('encrypt') || name.includes('hash')) {
        checkpoints.push({
          location: node.name,
          checkpoint_type: 'encryption',
          description: 'Data encryption/hashing',
          security_level: 'high'
        });
      }
    }
    
    return checkpoints;
  }

  /**
   * Identify performance bottlenecks
   */
  private async identifyPerformanceBottlenecks(
    nodes: DataFlowNode[],
    edges: DataFlowEdge[]
  ): Promise<string[]> {
    const bottlenecks: string[] = [];
    
    // Identify database operations
    const dbNodes = nodes.filter(n => n.type === 'database');
    if (dbNodes.length > 3) {
      bottlenecks.push('Multiple database operations detected');
    }
    
    // Identify external service calls
    const externalNodes = nodes.filter(n => n.type === 'external_service');
    if (externalNodes.length > 0) {
      bottlenecks.push('External service dependencies detected');
    }
    
    // Identify complex transformations
    const complexNodes = nodes.filter(n => 
      n.name.toLowerCase().includes('process') || 
      n.name.toLowerCase().includes('transform') ||
      n.name.toLowerCase().includes('calculate')
    );
    
    if (complexNodes.length > 2) {
      bottlenecks.push('Multiple data processing steps detected');
    }
    
    return bottlenecks;
  }

  /**
   * Find external dependencies
   */
  private async findExternalDependencies(nodes: DataFlowNode[]): Promise<string[]> {
    const external: string[] = [];
    
    for (const node of nodes) {
      if (node.type === 'external_service') {
        external.push(node.name);
      }
      
      // Check for external API calls in function names
      if (node.type === 'function') {
        const name = node.name.toLowerCase();
        if (name.includes('api') || name.includes('http') || name.includes('fetch')) {
          external.push(`External API call in ${node.name}`);
        }
      }
    }
    
    return external;
  }

  /**
   * Map entity type to node type
   */
  private mapEntityTypeToNodeType(entityType: string): DataFlowNode['type'] {
    switch (entityType) {
      case 'function':
      case 'method':
        return 'function';
      case 'variable':
        return 'variable';
      case 'class':
        return 'service';
      default:
        return 'function';
    }
  }
}

export default TraceDataFlowTool;