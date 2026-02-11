// import type { Tool } from '@modelcontextprotocol/sdk/types.js'; // Rule 15: Import reserved for future implementation
import path from 'path';
import type { DatabaseRow, SignatureAnalysis } from '../types/index.js';
import { codebaseService } from '../services/codebase-service.js';
import { analysisService } from '../services/analysis-service.js';
import { llmService } from '../services/llm-service.js';
import { getIndexingService } from '../services/indexing-service.js';
import { astParserService, type ASTParseResult } from '../services/ast-parser-service.js';
import { z } from 'zod';

// Input validation schema - simplified for MCP use
const ExplainFunctionInputSchema = z.object({
  function_name: z.string().min(1, 'Function name is required'),
  codebase_id: z.string().min(1, 'Codebase ID is required'),
  explanation_depth: z.enum(['basic', 'detailed', 'comprehensive']).default('detailed'),
});

// Rule 15: Type reserved for future implementation
// type ExplainFunctionInput = z.infer<typeof ExplainFunctionInputSchema>;

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
      function_name: {
        type: 'string',
        description: 'Name of the function to explain',
      },
      codebase_id: {
        type: 'string',
        description: 'Codebase ID or path to search in',
      },
      explanation_depth: {
        type: 'string',
        enum: ['basic', 'detailed', 'comprehensive'],
        description: 'Depth of explanation to provide',
        default: 'detailed',
      },
    },
    required: ['function_name', 'codebase_id'],
  };

  // Constructor removed - services injected via dependency injection

  async call(args: unknown): Promise<FunctionExplanation> {
    try {
      // Validate input
      const input = ExplainFunctionInputSchema.parse(args);

      // Get codebase info
      const codebase = await codebaseService.getCodebase(input.codebase_id);
      if (!codebase) {
        throw new Error(`Codebase with ID ${input.codebase_id} not found`);
      }

      // Search for the function by name in the indexed database
      const indexingService = getIndexingService();
      const searchResults = indexingService.search(input.function_name, { limit: 10 });

      if (searchResults.length === 0) {
        return {
          entity_id: 'not_found',
          name: input.function_name,
          qualified_name: input.function_name,
          file_path: 'N/A',
          start_line: 0,
          end_line: 0,
          language: 'unknown',
          signature: 'N/A',
          description: `Function "${input.function_name}" not found in codebase "${codebase.name}"`,
          purpose: `No function named "${input.function_name}" was found in the indexed code. The function may not exist or may not have been indexed.`,
          parameters: [],
          return_info: { type: 'unknown', description: 'Unknown - function not found' },
          complexity_metrics: undefined,
          callers: [],
          callees: [],
          dependencies: [],
          side_effects: [],
          error_handling: [],
          performance_notes: [`Function "${input.function_name}" not found in codebase`],
          security_considerations: [],
          usage_examples: [],
          related_functions: [],
          documentation: `Function "${input.function_name}" was not found in the codebase "${codebase.name}". Make sure the codebase has been indexed and the function name is correct.`,
          code_snippet: '',
          ai_explanation: 'Function not found in the indexed codebase.',
        } as FunctionExplanation;
      }

      // Use the first search result
      const firstResult = searchResults[0];

      // Read the file to get the function content
      const fs = await import('fs/promises');
      let codeSnippet = '';
      try {
        const fileContent = await fs.readFile(firstResult.file, 'utf-8');
        const lines = fileContent.split('\n');
        const startLine = Math.max(0, firstResult.line - 5);
        const endLine = Math.min(lines.length, firstResult.line + 10);
        codeSnippet = lines.slice(startLine, endLine).join('\n');
      } catch (fileError) {
        codeSnippet = firstResult.content || '// Could not read file content';
      }

      // DRY: Use AST parser for accurate signature and parameter extraction
      const astResult = await this.parseFunctionWithAST(
        firstResult.name,
        firstResult.file,
        firstResult.line
      );

      // Generate explanation based on the indexed data
      const explanation = this.generateExplanationFromSearch(
        firstResult,
        codeSnippet,
        input.explanation_depth,
      );

      return {
        entity_id: `${firstResult.file}:${firstResult.line}:${firstResult.name}`,
        name: firstResult.name,
        qualified_name: firstResult.name,
        file_path: firstResult.file,
        start_line: firstResult.line,
        end_line: astResult?.bodyEnd || firstResult.line + 10, // Use AST result if available
        language: 'typescript', // Default to TypeScript
        signature: astResult?.signature || this.extractSignature(codeSnippet, 'typescript'), // AST or fallback
        description: explanation.short,
        purpose: explanation.purpose,
        parameters: this.getParametersFromAST(astResult, codeSnippet), // DRY: Use AST result or fallback
        return_info: { type: astResult?.returnType || 'unknown', description: `Returns ${astResult?.returnType || 'a value'}` },
        complexity_metrics: undefined,
        callers: [],
        callees: [],
        dependencies: [],
        side_effects: [],
        error_handling: [],
        performance_notes: [],
        security_considerations: [],
        usage_examples: [],
        related_functions: searchResults.slice(1, 4).map(r => ({
          entity_id: `${r.file}:${r.line}:${r.name}`,
          name: r.name,
          qualified_name: r.name,
          relationship_type: 'similar',
          file_path: r.file,
          line_number: r.line,
          confidence: 0.8,
        })),
        documentation: explanation.detailed,
        code_snippet: codeSnippet,
        ai_explanation: explanation.purpose,
      } as FunctionExplanation;

    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }

      throw new Error(
        `Function explanation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Generate explanation from search results with actual code analysis
   */
  private generateExplanationFromSearch(
    result: any,
    codeSnippet: string,
    depth: string,
  ): { short: string; detailed: string; purpose: string } {
    const functionName = result.name || 'Unknown';
    const location = `${result.file}:${result.line}`;

    // Extract meaningful information from the code snippet
    const hasAsync = codeSnippet.includes('async');
    const hasTryCatch = codeSnippet.includes('try') || codeSnippet.includes('catch');
    const hasReturn = codeSnippet.includes('return');
    const hasParams = codeSnippet.match(/\(([^)]*)\)/)?.[1];
    const isArrowFunction = codeSnippet.includes('=>');
    const isExported = codeSnippet.includes('export');

    // Build actual explanation from code
    let purpose = `This function is defined at ${location}.`;

    if (hasAsync) {
      purpose += ' It is an async function that performs asynchronous operations.';
    }

    if (hasTryCatch) {
      purpose += ' It includes error handling with try-catch blocks.';
    }

    if (hasReturn) {
      purpose += ' It returns a value based on its operations.';
    }

    if (isExported) {
      purpose += ' It is exported from the module for use in other parts of the application.';
    }

    const short = `${functionName} - ${location}`;

    let detailed = `# Function: ${functionName}\n\n`;
    detailed += `**Location**: \`${location}\`\n\n`;

    // Add code snippet
    const snippetLines = codeSnippet.split('\n').slice(0, 15);
    detailed += `## Code:\n\`\`\`typescript\n${snippetLines.join('\n')}\n\`\`\`\n\n`;

    // Add signature analysis
    if (hasParams && hasParams.trim()) {
      detailed += `## Parameters:\n\`${hasParams.trim()}\`\n\n`;
    }

    detailed += `## Purpose:\n${purpose}\n\n`;

    // Add additional analysis based on depth
    if (depth === 'detailed' || depth === 'comprehensive') {
      detailed += '## Characteristics:\n';
      if (hasAsync) {detailed += '- Async function (returns Promise)\n';}
      if (hasTryCatch) {detailed += '- Has error handling (try-catch)\n';}
      if (hasReturn) {detailed += '- Returns a value\n';}
      if (isArrowFunction) {detailed += '- Arrow function syntax\n';}
      if (isExported) {detailed += '- Exported from module\n';}
      detailed += '\n';

      detailed += '## Notes:\n';
      detailed += `- This function is part of the \`${path.basename(result.file)}\` file\n`;
      detailed += '- For more detailed analysis, consider using the `ai_code_review` tool with the full code snippet\n';
    }

    return { short, detailed, purpose };
  }

  /**
   * Generate AI-powered explanation of the function
   */
  private async generateAIExplanation(
    entity: DatabaseRow,
    codeSnippet: string,
    signatureAnalysis: SignatureAnalysis,
    complexityMetrics?: ComplexityMetrics,
    depth: string = 'detailed',
  ): Promise<string> {
    const prompt = this.buildExplanationPrompt(
      entity,
      codeSnippet,
      signatureAnalysis,
      complexityMetrics,
      depth,
    );

    try {
      return await llmService.generateExplanation(prompt);
    } catch (error) {
      // Fallback to static analysis if LLM fails
      return this.generateStaticExplanation(entity, codeSnippet, signatureAnalysis);
    }
  }

  /**
   * Build prompt for LLM explanation
   */
  private buildExplanationPrompt(
    entity: DatabaseRow,
    codeSnippet: string,
    signatureAnalysis: SignatureAnalysis,
    complexityMetrics?: ComplexityMetrics,
    depth: string = 'detailed',
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
    entity: DatabaseRow,
    codeSnippet: string,
    signatureAnalysis: SignatureAnalysis,
  ): string {
    let explanation = `This is a ${entity.entity_type} named '${entity.name}'`;

    if (signatureAnalysis.parameters.length > 0) {
      explanation += ` that takes ${signatureAnalysis.parameters.length} parameter(s)`;
    }

    if ((signatureAnalysis as any).return_info.type !== 'void') {
      explanation += ` and returns ${(signatureAnalysis as any).return_info.type}`;
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
    entity: DatabaseRow,
    signatureAnalysis: SignatureAnalysis,
    callees: CodeRelationship[],
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
  private generateBasicUsageExample(entity: DatabaseRow, signatureAnalysis: SignatureAnalysis): string {
    const params = signatureAnalysis.parameters
      .map((p: Parameter) => (p.optional ? `${p.name}?` : p.name))
      .join(', ');

    let example = '// Basic usage\n';

    if ((signatureAnalysis as any).return_info.type !== 'void') {
      example += 'const result = ';
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
    entity: DatabaseRow,
    caller: CodeRelationship,
  ): Promise<string | null> {
    try {
      const callerCode = await codebaseService.getCodeSnippet(
        caller.file_path,
        Math.max(1, caller.line_number - 2),
        caller.line_number + 2,
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
    entity: DatabaseRow,
    dependencies: CodeRelationship[],
    callees: CodeRelationship[],
  ): Promise<CodeRelationship[]> {
    const related = [...dependencies, ...callees];

    // Remove duplicates and limit to most relevant
    const unique = related.filter(
      (item, index, self) => index === self.findIndex(t => t.entity_id === item.entity_id),
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
      typescript: [/^(export]+)?(async]+)?function]+/, /^(export]+)?(async]+)?\w+]*\(/],
      javascript: [/^(export]+)?(async]+)?function]+/, /^(async]+)?\w+]*\(/],
      python: [/^(async]+)?def]+/],
      rust: [/^(pub]+)?(async]+)?fn]+/],
      go: [/^func]+/],
      java: [/^(public|private|protected).*\w+]*\(/],
      csharp: [/^(public|private|protected).*\w+]*\(/],
    };

    const langPatterns = patterns[language] || patterns.typescript;
    return langPatterns.some(pattern => pattern.test(line));
  }

  /**
   * Generate description from entity and analysis
   */
  private generateDescription(entity: DatabaseRow, _signatureAnalysis: SignatureAnalysis): string {
    if (entity.documentation) {
      return String(entity.documentation);
    }

    let description = `A ${String(entity.entity_type)} that`;

    // Infer description from name
    const name = String(entity.name).toLowerCase();
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
        return `${sentences[0].trim()  }.`;
      }
    }

    // Fallback to name-based inference
    const lowerName = name.toLowerCase();

    if (lowerName.includes('auth')) {return 'Handles authentication or authorization';}
    if (lowerName.includes('valid')) {return 'Validates input data or conditions';}
    if (lowerName.includes('parse')) {return 'Parses or processes data format';}
    if (lowerName.includes('format')) {return 'Formats data for display or output';}
    if (lowerName.includes('convert')) {return 'Converts data between formats';}
    if (lowerName.includes('calculate')) {return 'Performs calculations or computations';}
    if (lowerName.includes('fetch') || lowerName.includes('load')) {
      return 'Retrieves data from external source';
    }
    if (lowerName.includes('save') || lowerName.includes('store')) {return 'Saves or stores data';}

    return 'Performs specific functionality as part of the application logic';
  }

  /**
   * Parse function using AST parser for accurate signature and parameter extraction
   * Rule 15: Proper error handling with documented fallback to regex
   */
  private async parseFunctionWithAST(
    functionName: string,
    filePath: string,
    lineNumber: number
  ): Promise<ASTParseResult | null> {
    try {
      return await astParserService.parseFunction(filePath, functionName, lineNumber);
    } catch (error) {
      // Rule 15: Log and fall back gracefully (NOT a workaround)
      console.warn(`[AST] Parsing failed for ${functionName}, using regex fallback:`, error);
      return null;
    }
  }

  /**
   * DRY: Get parameters from AST result or fall back to regex extraction
   * Single source of truth for parameter extraction logic
   */
  private getParametersFromAST(astResult: ASTParseResult | null, codeSnippet: string): Parameter[] {
    if (astResult && astResult.parameters) {
      // Use AST result
      return astResult.parameters.map(p => ({
        name: p.name,
        type: p.type,
        description: `Parameter "${p.name}" of type ${p.type}`,
        optional: p.optional,
        default_value: p.defaultValue,
      }));
    }

    // Fallback to regex (single place for regex logic - DRY)
    return this.extractParametersRegex(codeSnippet);
  }

  /**
   * DRY: Single regex-based parameter extraction method
   * Used only when AST parsing fails (documented fallback, not a workaround)
   */
  private extractParametersRegex(codeSnippet: string): Parameter[] {
    const parameters: Parameter[] = [];

    // Match function parameters: function name(param1, param2)
    const functionMatch = codeSnippet.match(/(?:function|\w+)\s*\(([^)]*)\)/);
    if (functionMatch && functionMatch[1]) {
      const params = functionMatch[1].split(',').map(p => p.trim());
      for (const param of params) {
        if (param) {
          // Check for optional parameter (has ? or default value)
          const optional = param.includes('?') || param.includes('=');
          const name = param.replace(/\?.*/, '').replace(/=.*/, '').trim().split(':')[0].trim();

          parameters.push({
            name,
            type: 'unknown', // Regex can't extract types reliably
            description: `Parameter "${name}"`,
            optional,
          });
        }
      }
    }

    return parameters;
  }
}

export default ExplainFunctionTool;
