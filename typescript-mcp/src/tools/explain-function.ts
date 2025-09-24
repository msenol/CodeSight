import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { AnalysisService } from '../services/analysis-service.js';
import type { CodebaseService } from '../services/codebase-service.js';
import type { LLMService } from '../services/llm-service.js';
import { z } from 'zod';

// Input validation schema
const ExplainFunctionInputSchema = z.object({
  entity_id: z.string().uuid('Invalid entity ID'),
  include_callers: z.boolean().default(true),
  include_callees: z.boolean().default(true),
  include_complexity: z.boolean().default(true),
  include_dependencies: z.boolean().default(true),
  explanation_depth: z.enum(['basic', 'detailed', 'comprehensive']).default('detailed'),
  include_examples: z.boolean().default(false)
});

type ExplainFunctionInput = z.infer<typeof ExplainFunctionInputSchema>;

interface Parameter {
  name: string;
  type: string;
  description: string;
  optional: boolean;
  default_value?: string;
}

interface ReturnInfo {
  type: string;
  description: string;
  possible_values?: string[];
}

interface ComplexityMetrics {
  cyclomatic_complexity: number;
  cognitive_complexity: number;
  lines_of_code: number;
  maintainability_index: number;
  complexity_rating: 'low' | 'medium' | 'high' | 'very_high';
}

interface CodeRelationship {
  entity_id: string;
  name: string;
  qualified_name: string;
  relationship_type: string;
  file_path: string;
  line_number: number;
  confidence: number;
}

interface FunctionExplanation {
  entity_id: string;
  name: string;
  qualified_name: string;
  file_path: string;
  start_line: number;
  end_line: number;
  language: string;
  signature: string;
  description: string;
  purpose: string;
  parameters: Parameter[];
  return_info: ReturnInfo;
  complexity_metrics?: ComplexityMetrics;
  callers?: CodeRelationship[];
  callees?: CodeRelationship[];
  dependencies?: CodeRelationship[];
  side_effects: string[];
  error_handling: string[];
  performance_notes: string[];
  security_considerations: string[];
  usage_examples?: string[];
  related_functions: CodeRelationship[];
  documentation: string;
  code_snippet: string;
  ai_explanation: string;
}

/**
 * Provide detailed analysis and explanation of a function or method
 * Uses static analysis combined with LLM-powered explanations
 */
export class ExplainFunctionTool {
  name = 'explain_function';
  description = 'Provide detailed analysis and explanation of a function or method';
  
  inputSchema = {
    type: 'object',
    properties: {
      entity_id: {
        type: 'string',
        description: 'UUID of the code entity (function/method) to explain'
      },
      include_callers: {
        type: 'boolean',
        description: 'Include functions that call this function',
        default: true
      },
      include_callees: {
        type: 'boolean',
        description: 'Include functions called by this function',
        default: true
      },
      include_complexity: {
        type: 'boolean',
        description: 'Include complexity metrics analysis',
        default: true
      },
      include_dependencies: {
        type: 'boolean',
        description: 'Include dependency analysis',
        default: true
      },
      explanation_depth: {
        type: 'string',
        enum: ['basic', 'detailed', 'comprehensive'],
        description: 'Depth of explanation to provide',
        default: 'detailed'
      },
      include_examples: {
        type: 'boolean',
        description: 'Include usage examples',
        default: false
      }
    },
    required: ['entity_id']
  };

  constructor(
    private codebaseService: CodebaseService,
    private analysisService: AnalysisService,
    private llmService: LLMService
  ) {}

  async call(args: unknown): Promise<FunctionExplanation> {
    try {
      // Validate input
      const input = ExplainFunctionInputSchema.parse(args);
      
      // Get the code entity
      const entity = await this.codebaseService.getCodeEntity(input.entity_id);
      if (!entity) {
        throw new Error(`Code entity with ID ${input.entity_id} not found`);
      }
      
      // Verify it's a function or method
      if (!['function', 'method', 'constructor', 'arrow_function'].includes(entity.entity_type)) {
        throw new Error(`Entity ${entity.name} is not a function or method (type: ${entity.entity_type})`);
      }

      // Get code snippet
      const codeSnippet = await this.codebaseService.getCodeSnippet(
        entity.file_path,
        entity.start_line,
        entity.end_line
      );

      // Analyze function signature and parameters
      const signatureAnalysis = await this.analysisService.analyzeFunctionSignature(
        input.entity_id
      );

      // Get complexity metrics if requested
      let complexityMetrics: ComplexityMetrics | undefined;
      if (input.include_complexity) {
        complexityMetrics = await this.analysisService.calculateComplexityMetrics(input.entity_id);
      }

      // Get relationships if requested
      let callers: CodeRelationship[] = [];
      let callees: CodeRelationship[] = [];
      let dependencies: CodeRelationship[] = [];

      if (input.include_callers) {
        callers = await this.analysisService.findCallers(input.entity_id);
      }

      if (input.include_callees) {
        callees = await this.analysisService.findCallees(input.entity_id);
      }

      if (input.include_dependencies) {
        dependencies = await this.analysisService.findDependencies(input.entity_id);
      }

      // Analyze side effects and behavior
      const behaviorAnalysis = await this.analysisService.analyzeFunctionBehavior(
        input.entity_id,
        {
          include_side_effects: true,
          include_performance: true
        }
      );

      // Get AI-powered explanation
      const aiExplanation = await this.generateAIExplanation(
        entity,
        codeSnippet,
        signatureAnalysis,
        complexityMetrics,
        input.explanation_depth
      );

      // Generate usage examples if requested
      let usageExamples: string[] = [];
      if (input.include_examples) {
        usageExamples = await this.generateUsageExamples(
          entity,
          signatureAnalysis,
          callees
        );
      }

      // Find related functions
      const relatedFunctions = await this.findRelatedFunctions(entity, dependencies, callees);

      return {
        entity_id: entity.id,
        name: entity.name,
        qualified_name: entity.qualified_name,
        file_path: entity.file_path,
        start_line: entity.start_line,
        end_line: entity.end_line,
        language: entity.language,
        signature: entity.signature || this.extractSignature(codeSnippet, entity.language),
        description: this.generateDescription(entity, signatureAnalysis),
        purpose: this.inferPurpose(entity.name, codeSnippet, aiExplanation),
        parameters: signatureAnalysis.parameters,
        return_info: signatureAnalysis.return_info,
        complexity_metrics: complexityMetrics,
        callers: input.include_callers ? callers : undefined,
        callees: input.include_callees ? callees : undefined,
        dependencies: input.include_dependencies ? dependencies : undefined,
        side_effects: behaviorAnalysis.side_effects,
        error_handling: behaviorAnalysis.error_handling,
        performance_notes: behaviorAnalysis.performance_notes,
        security_considerations: behaviorAnalysis.security_considerations,
        usage_examples: input.include_examples ? usageExamples : undefined,
        related_functions: relatedFunctions,
        documentation: entity.documentation || '',
        code_snippet: codeSnippet,
        ai_explanation: aiExplanation
      };
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }
      
      throw new Error(`Function explanation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate AI-powered explanation of the function
   */
  private async generateAIExplanation(
    entity: any,
    codeSnippet: string,
    signatureAnalysis: any,
    complexityMetrics?: ComplexityMetrics,
    depth: string = 'detailed'
  ): Promise<string> {
    const prompt = this.buildExplanationPrompt(
      entity,
      codeSnippet,
      signatureAnalysis,
      complexityMetrics,
      depth
    );

    try {
      return await this.llmService.generateExplanation(prompt);
    } catch (error) {
      // Fallback to static analysis if LLM fails
      return this.generateStaticExplanation(entity, codeSnippet, signatureAnalysis);
    }
  }

  /**
   * Build prompt for LLM explanation
   */
  private buildExplanationPrompt(
    entity: any,
    codeSnippet: string,
    signatureAnalysis: any,
    complexityMetrics?: ComplexityMetrics,
    depth: string = 'detailed'
  ): string {
    let prompt = `Explain this ${entity.language} ${entity.entity_type}:\n\n`;
    prompt += `Function: ${entity.qualified_name}\n`;
    prompt += `File: ${entity.file_path}\n\n`;
    prompt += `Code:\n\`\`\`${entity.language}\n${codeSnippet}\n\`\`\`\n\n`;
    
    if (depth === 'comprehensive') {
      prompt += 'Provide a comprehensive explanation including:\n';
      prompt += '- Purpose and functionality\n';
      prompt += '- Parameter details and validation\n';
      prompt += '- Return value and possible outcomes\n';
      prompt += '- Algorithm and logic flow\n';
      prompt += '- Error handling and edge cases\n';
      prompt += '- Performance characteristics\n';
      prompt += '- Security considerations\n';
      prompt += '- Best practices and potential improvements\n';
    } else if (depth === 'detailed') {
      prompt += 'Provide a detailed explanation including:\n';
      prompt += '- What the function does\n';
      prompt += '- How it works\n';
      prompt += '- Key parameters and return value\n';
      prompt += '- Important behavior and side effects\n';
    } else {
      prompt += 'Provide a basic explanation of what this function does and how to use it.\n';
    }

    if (complexityMetrics) {
      prompt += `\nComplexity: ${complexityMetrics.complexity_rating} (Cyclomatic: ${complexityMetrics.cyclomatic_complexity})\n`;
    }

    return prompt;
  }

  /**
   * Generate static explanation as fallback
   */
  private generateStaticExplanation(
    entity: any,
    codeSnippet: string,
    signatureAnalysis: any
  ): string {
    let explanation = `This is a ${entity.entity_type} named '${entity.name}'`;
    
    if (signatureAnalysis.parameters.length > 0) {
      explanation += ` that takes ${signatureAnalysis.parameters.length} parameter(s)`;
    }
    
    if (signatureAnalysis.return_info.type !== 'void') {
      explanation += ` and returns ${signatureAnalysis.return_info.type}`;
    }
    
    explanation += '. ';
    
    // Add basic analysis based on code patterns
    if (codeSnippet.includes('async') || codeSnippet.includes('await')) {
      explanation += 'This is an asynchronous function. ';
    }
    
    if (codeSnippet.includes('throw') || codeSnippet.includes('error')) {
      explanation += 'This function includes error handling. ';
    }
    
    if (codeSnippet.includes('console.log') || codeSnippet.includes('print')) {
      explanation += 'This function includes logging or output statements. ';
    }
    
    return explanation;
  }

  /**
   * Generate usage examples
   */
  private async generateUsageExamples(
    entity: any,
    signatureAnalysis: any,
    callees: CodeRelationship[]
  ): Promise<string[]> {
    const examples: string[] = [];
    
    // Generate basic usage example
    const basicExample = this.generateBasicUsageExample(entity, signatureAnalysis);
    examples.push(basicExample);
    
    // Generate examples based on actual usage in codebase
    if (callees.length > 0) {
      const realUsageExample = await this.generateRealUsageExample(entity, callees[0]);
      if (realUsageExample) {
        examples.push(realUsageExample);
      }
    }
    
    return examples;
  }

  /**
   * Generate basic usage example
   */
  private generateBasicUsageExample(entity: any, signatureAnalysis: any): string {
    const params = signatureAnalysis.parameters
      .map((p: Parameter) => p.optional ? `${p.name}?` : p.name)
      .join(', ');
    
    let example = `// Basic usage\n`;
    
    if (signatureAnalysis.return_info.type !== 'void') {
      example += `const result = `;
    }
    
    if (entity.entity_type === 'method') {
      example += `instance.${entity.name}(${params});`;
    } else {
      example += `${entity.name}(${params});`;
    }
    
    return example;
  }

  /**
   * Generate real usage example from codebase
   */
  private async generateRealUsageExample(
    entity: any,
    caller: CodeRelationship
  ): Promise<string | null> {
    try {
      const callerCode = await this.codebaseService.getCodeSnippet(
        caller.file_path,
        Math.max(1, caller.line_number - 2),
        caller.line_number + 2
      );
      
      return `// Real usage from ${caller.file_path}\n${callerCode}`;
    } catch (error) {
      return null;
    }
  }

  /**
   * Find related functions
   */
  private async findRelatedFunctions(
    entity: any,
    dependencies: CodeRelationship[],
    callees: CodeRelationship[]
  ): Promise<CodeRelationship[]> {
    const related = [...dependencies, ...callees];
    
    // Remove duplicates and limit to most relevant
    const unique = related.filter((item, index, self) => 
      index === self.findIndex(t => t.entity_id === item.entity_id)
    );
    
    return unique.slice(0, 5); // Limit to top 5 related functions
  }

  /**
   * Extract function signature from code
   */
  private extractSignature(codeSnippet: string, language: string): string {
    const lines = codeSnippet.split('\n');
    
    // Find the function declaration line
    for (const line of lines) {
      const trimmed = line.trim();
      if (this.isFunctionDeclaration(trimmed, language)) {
        return trimmed;
      }
    }
    
    return lines[0]?.trim() || '';
  }

  /**
   * Check if line is a function declaration
   */
  private isFunctionDeclaration(line: string, language: string): boolean {
    const patterns: Record<string, RegExp[]> = {
      typescript: [/^(export\s+)?(async\s+)?function\s+/, /^(export\s+)?(async\s+)?\w+\s*\(/],
      javascript: [/^(export\s+)?(async\s+)?function\s+/, /^(async\s+)?\w+\s*\(/],
      python: [/^(async\s+)?def\s+/],
      rust: [/^(pub\s+)?(async\s+)?fn\s+/],
      go: [/^func\s+/],
      java: [/^(public|private|protected).*\w+\s*\(/],
      csharp: [/^(public|private|protected).*\w+\s*\(/]
    };
    
    const langPatterns = patterns[language] || patterns.typescript;
    return langPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Generate description from entity and analysis
   */
  private generateDescription(entity: any, signatureAnalysis: any): string {
    if (entity.documentation) {
      return entity.documentation;
    }
    
    let description = `A ${entity.entity_type} that`;
    
    // Infer description from name
    const name = entity.name.toLowerCase();
    if (name.startsWith('get')) {
      description += ' retrieves';
    } else if (name.startsWith('set')) {
      description += ' sets or updates';
    } else if (name.startsWith('create') || name.startsWith('make')) {
      description += ' creates';
    } else if (name.startsWith('delete') || name.startsWith('remove')) {
      description += ' deletes or removes';
    } else if (name.startsWith('validate') || name.startsWith('check')) {
      description += ' validates or checks';
    } else if (name.startsWith('process') || name.startsWith('handle')) {
      description += ' processes or handles';
    } else {
      description += ' performs operations on';
    }
    
    description += ' data or performs specific functionality.';
    
    return description;
  }

  /**
   * Infer purpose from function name and code
   */
  private inferPurpose(name: string, code: string, aiExplanation: string): string {
    // Extract purpose from AI explanation if available
    if (aiExplanation) {
      const sentences = aiExplanation.split('.');
      if (sentences.length > 0) {
        return sentences[0].trim() + '.';
      }
    }
    
    // Fallback to name-based inference
    const lowerName = name.toLowerCase();
    
    if (lowerName.includes('auth')) return 'Handles authentication or authorization';
    if (lowerName.includes('valid')) return 'Validates input data or conditions';
    if (lowerName.includes('parse')) return 'Parses or processes data format';
    if (lowerName.includes('format')) return 'Formats data for display or output';
    if (lowerName.includes('convert')) return 'Converts data between formats';
    if (lowerName.includes('calculate')) return 'Performs calculations or computations';
    if (lowerName.includes('fetch') || lowerName.includes('load')) return 'Retrieves data from external source';
    if (lowerName.includes('save') || lowerName.includes('store')) return 'Saves or stores data';
    
    return 'Performs specific functionality as part of the application logic';
  }
}

export default ExplainFunctionTool;