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
  metrics: any;
}

export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  linesOfCode: number;
  maintainabilityIndex: number;
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

// Re-export common types
export type { Tool } from '@modelcontextprotocol/sdk/types.js';