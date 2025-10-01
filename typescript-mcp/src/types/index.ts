/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
// Core types for Code Intelligence MCP Server

export interface CodebaseInfo {
  id: string;
  name: string;
  path: string;
  languages: string[];
  createdAt: string;
  updatedAt: string;
  fileCount: number;
  indexedAt: string | null;
  status: 'active' | 'inactive' | 'indexed' | 'indexing' | 'error';
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  language: string;
  lastModified: string;
}

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  content: string;
  score: number;
}

export interface SecurityIssue {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  file: string;
  line: number;
  column: number;
  code: string;
  suggestion: string;
}

export interface SecurityPattern {
  id: string;
  name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  pattern: RegExp;
  matches?: number;
  files?: string[];
}

export interface SecurityScanOptions {
  minSeverity?: 'low' | 'medium' | 'high' | 'critical';
  includePatterns?: string[];
  excludePatterns?: string[];
  maxResults?: number;
}

export interface CodeSmell {
  type: string;
  severity: 'low' | 'medium' | 'high';
  file: string;
  line: number;
  description: string;
  suggestion: string;
  metrics: Record<string, unknown>;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  maintainabilityIndex: number;
}

export interface ComplexityAnalysis {
  complexity: ComplexityMetrics;
  functionCount: number;
  classCount: number;
  averageFunctionSize: number;
  maxFunctionSize: number;
  duplicateCodePercentage: number;
  technicalDebt: number;
}

export interface FunctionInfo {
  name: string;
  file: string;
  line: number;
  column: number;
  parameters: string[];
  returnType: string;
  complexity: ComplexityMetrics;
}

export interface APIEndpoint {
  id: string;
  method: string;
  path: string;
  file: string;
  line: number;
  handler: string;
  parameters: string[];
  responses: string[];
  authentication_required: boolean;
  handler_function: string;
  file_path: string;
  line_number: number;
  description?: string;
  tags?: string[];
  response_type?: string;
}

export interface DuplicateCode {
  id: string;
  locations: Array<{
    file: string;
    startLine: number;
    endLine: number;
  }>;
  similarity: number;
  linesAffected: number;
  suggestion: string;
}

export interface DuplicationReport {
  totalDuplicates: number;
  duplicatedLines: number;
  duplicatedPercentage: number;
  severityBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
  duplicates: DuplicateCode[];
  recommendations: string[];
}

export interface RefactoringSuggestion {
  id: string;
  type: string;
  priority: 'low' | 'medium' | 'high';
  file: string;
  line: number;
  description: string;
  before: string;
  after: string;
  impact: string;
  confidence: number;
}

export interface RefactoringOptions {
  minComplexity?: number;
  maxSuggestions?: number;
  includeTypes?: string[];
  excludeTypes?: string[];
}

export interface DataFlowNode {
  id: string;
  type: 'variable' | 'function' | 'parameter' | 'return';
  name: string;
  file: string;
  line: number;
  column: number;
}

export interface DataFlowEdge {
  from: string;
  to: string;
  type: 'assignment' | 'call' | 'return' | 'parameter';
  file: string;
  line: number;
}

export interface DataFlowGraph {
  nodes: DataFlowNode[];
  edges: DataFlowEdge[];
}

export interface CodeExplanation {
  summary: string;
  purpose: string;
  complexity: 'low' | 'medium' | 'high';
  suggestions: string[];
  examples: string[];
  relatedConcepts: string[];
}

export interface LLMRequest {
  prompt: string;
  context?: string;
  codeSnippet?: string;
  language?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  finishReason: string;
  responseTime: number;
}

export interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama' | 'mock';
  model: string;
  apiKey?: string;
  endpoint?: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
}

// Database and API types
export interface DatabaseRow {
  [key: string]: string | number | boolean | null;
}

export type DatabaseValue = string | number | boolean | null;
export type DatabaseParams = DatabaseValue[];

export interface QueryResult {
  rows: DatabaseRow[];
  rowCount: number;
  lastInsertRowid?: number;
}

export interface Statistics {
  totalFiles: number;
  totalEntities: number;
  totalLines: number;
  languages: string[];
  filesByLanguage: Record<string, number>;
  entitiesByType: Record<string, number>;
  indexedAt: string;
}

// AST Node types
export interface ASTNode {
  type: string;
  name?: string;
  id?: string;
  start?: number;
  end?: number;
  loc?: {
    start: { line: number; column: number };
    end: { line: number; column: number };
  };
  [key: string]: unknown;
}

export interface FunctionNode extends ASTNode {
  type: 'FunctionDeclaration' | 'FunctionExpression' | 'ArrowFunctionExpression';
  id?: { name: string };
  params: Array<{ name: string }>;
  body?: ASTNode;
}

export interface ClassNode extends ASTNode {
  type: 'ClassDeclaration' | 'ClassExpression';
  id?: { name: string };
  body?: {
    body: Array<{
      type: string;
      key: { name: string };
      kind: string;
    }>;
  };
}

export interface MethodDefinition {
  type: 'MethodDefinition';
  key: { name: string };
  kind: 'method' | 'constructor' | 'get' | 'set';
  static: boolean;
}

// Monitoring and alerting types
export interface MonitoringConfig {
  enabled: boolean;
  endpoint?: string;
  interval?: number;
  thresholds?: Record<string, number>;
  [key: string]: unknown;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

// HTTP Request/Response types
export interface HttpRequest {
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}

export interface HttpResponse<T = unknown> {
  status: number;
  headers?: Record<string, string>;
  body?: T;
}

// Refactoring match types
export interface RefactoringMatch {
  type: string;
  file: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  description: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
  confidence?: number;
}

export interface CodeSmellMatch extends RefactoringMatch {
  metrics?: Record<string, number>;
  impact?: string;
}

// Analysis result types
export interface FunctionAnalysis {
  name: string;
  signature: string;
  parameters: Parameter[];
  returnType: string;
  complexity: ComplexityMetrics;
  description: string;
  usage: string[];
  examples: string[];
}

export interface Parameter {
  name: string;
  type: string;
  optional: boolean;
  defaultValue?: string;
}

export interface SignatureAnalysis {
  name: string;
  parameters: Parameter[];
  returnType: string;
  accessibility?: string;
  isAsync?: boolean;
  isGenerator?: boolean;
}

// LLM and OpenAI types
export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  averageResponseTime: number;
  successRate: number;
  errors: number;
  lastRequest: string;
}

// Test utility types
export interface TestHttpRequest extends HttpRequest {
  headers?: Record<string, string>;
}

export interface MockResponse<T = unknown> {
  status: number;
  json: () => Promise<T>;
  send: (data?: unknown) => void;
  status: (code: number) => MockResponse<T>;
}

export interface TestOperation<T = unknown> {
  (): Promise<T>;
}

// Re-export common types
export type { Tool } from '@modelcontextprotocol/sdk/types.js';
