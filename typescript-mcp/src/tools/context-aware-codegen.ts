/**
 * Context-Aware Code Generation - Phase 4.1
 * AI-powered intelligent code generation with full project context
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CodeAnalysisService } from '../services/code-analysis.js';
import { AILLMService } from '../services/ai-llm.js';
import { logger } from '../services/logger.js';

interface CodeGenerationRequest {
  prompt?: string;  // Made optional for test compatibility
  requirement?: string;  // Alternative parameter name used by tests
  context: {
    file_path?: string;
    surrounding_code?: string;
    project_structure?: string;
    existing_patterns?: string[];
    dependencies?: string[];
    coding_standards?: {
      language: string;
      style_guide: string;
      naming_conventions: string[];
    };
    language?: string;  // Test compatibility
    style?: string;     // Test compatibility
    libraries?: string[];  // Test compatibility
    framework?: string;    // Test compatibility
    patterns?: string[];   // Test compatibility
    conventions?: string[]; // Test compatibility
  };
  generation_type?: 'function' | 'class' | 'module' | 'test' | 'documentation' | 'configuration';
  constraints?: {
    max_lines?: number;
    complexity_limit?: number;
    test_required?: boolean;
    documentation_required?: boolean;
    performance_optimized?: boolean;
  };
  codebase_id: string;
}

interface CodeGenerationResult {
  generated_code: string;
  code_metadata: {
    language: string;
    type: string;
    estimated_lines: number;
    complexity_score: number;
    dependencies: string[];
  };

  context_analysis: {
    matched_patterns: string[];
    style_compliance: number; // 0-100
    naming_convention_compliance: number; // 0-100
    architectural_alignment: number; // 0-100
  };

  validation_results: {
    syntax_valid: boolean;
    potential_issues: Array<{
      type: 'warning' | 'error' | 'suggestion';
      message: string;
      line_number?: number;
    }>;
    security_considerations: string[];
  };

  suggestions: {
    alternative_implementations: string[];
    optimization_opportunities: string[];
    test_recommendations: string[];
    documentation_notes: string[];
  };

  integration_plan: {
    required_changes: Array<{
      file: string;
      change_type: 'add' | 'modify' | 'import';
      description: string;
    }>;
    backward_compatibility: boolean;
    migration_steps: string[];
  };

  confidence_score: number; // 0-100
  alternatives: Array<{
    code: string;
    description: string;
    pros: string[];
    cons: string[];
    use_case: string;
  }>;
}

/**
 * Context-Aware Code Generation Tool
 * Generates code that aligns with project context, patterns, and best practices
 */
export class ContextAwareCodegenTool {
  readonly name = 'context_aware_code_generation';
  readonly description = 'AI-powered context-aware code generation with project understanding';

  private codeAnalyzer: CodeAnalysisService;
  private aiService: AILLMService;

  constructor() {
    this.codeAnalyzer = new CodeAnalysisService();
    this.aiService = new AILLMService();
  }

  async call(args: CodeGenerationRequest): Promise<CodeGenerationResult> {
    // Normalize input parameters - support both 'prompt' and 'requirement'
    const effectivePrompt = args.requirement || args.prompt || '';
    const effectiveGenerationType = args.generation_type || 'function';

    // Input validation
    if (!effectivePrompt || effectivePrompt.trim().length === 0) {
      throw new Error('Either prompt or requirement must be provided');
    }

    // Ensure context object exists
    const normalizedContext = {
      file_path: args.context?.file_path,
      surrounding_code: args.context?.surrounding_code || '',
      project_structure: args.context?.project_structure,
      existing_patterns: args.context?.existing_patterns || [],
      dependencies: args.context?.dependencies || [],
      coding_standards: args.context?.coding_standards || {
        language: args.context?.language || 'typescript',
        style_guide: args.context?.style || 'standard',
        naming_conventions: args.context?.conventions || ['camelCase']
      }
    };

    // Normalize args for internal use
    const normalizedArgs: CodeGenerationRequest = {
      ...args,
      prompt: effectivePrompt,
      generation_type: effectiveGenerationType,
      context: normalizedContext
    };

    logger.info('Context-aware code generation started', {
      prompt: effectivePrompt.substring(0, Math.min(100, effectivePrompt.length)),
      generation_type: effectiveGenerationType,
      file_path: normalizedContext.file_path
    });

    try {
      // 1. Analyze project context
      const projectContext = await this.analyzeProjectContext(normalizedArgs);

      // 2. Extract coding patterns and styles
      const codePatterns = await this.extractCodePatterns(normalizedArgs);

      // 3. Generate context-aware code
      const generatedCode = await this.generateCodeWithContext(normalizedArgs, projectContext, codePatterns);

      // 4. Validate generated code
      const validationResults = await this.validateGeneratedCode(generatedCode, normalizedArgs);

      // 5. Analyze context compliance
      const contextAnalysis = await this.analyzeContextCompliance(generatedCode, codePatterns, normalizedArgs);

      // 6. Generate alternatives and suggestions
      const alternatives = await this.generateAlternatives(normalizedArgs, generatedCode, projectContext);
      const suggestions = await this.generateSuggestions(generatedCode, validationResults, normalizedArgs);

      // 7. Create integration plan
      const integrationPlan = await this.createIntegrationPlan(normalizedArgs, generatedCode);

      // 8. Calculate confidence score
      const confidenceScore = this.calculateConfidenceScore(
        generatedCode,
        contextAnalysis,
        validationResults,
        normalizedArgs
      );

      const result: CodeGenerationResult = {
        generated_code: generatedCode,
        code_metadata: this.extractCodeMetadata(generatedCode, normalizedArgs),
        context_analysis: contextAnalysis,
        validation_results: validationResults,
        suggestions,
        integration_plan: integrationPlan,
        confidence_score: confidenceScore,
        alternatives
      };

      logger.info('Context-aware code generation completed', {
        lines_generated: result.code_metadata.estimated_lines,
        confidence_score: result.confidence_score,
        validation_issues: result.validation_results.potential_issues.length
      });

      return result;

    } catch (error) {
      logger.error('Context-aware code generation failed:', error);
      throw new Error(`Code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzeProjectContext(args: CodeGenerationRequest) {
    const context = {
      project_style: {},
      patterns: [],
      dependencies: new Set<string>(),
      architecture_patterns: []
    };

    // Analyze existing code in the file
    if (args.context.file_path) {
      try {
        const fileAnalysis = await this.codeAnalyzer.analyzeFile(args.context.file_path, args.codebase_id);

        // Extract patterns from surrounding code
        if (args.context.surrounding_code) {
          context.patterns = this.extractSurroundingPatterns(args.context.surrounding_code);
        }

        // Analyze dependencies
        if (fileAnalysis.imports) {
          fileAnalysis.imports.forEach((imp: any) => context.dependencies.add(imp.module));
        }

      } catch (error) {
        logger.warn('Failed to analyze file context:', error);
      }
    }

    // Add user-provided dependencies
    if (args.context.dependencies) {
      args.context.dependencies.forEach(dep => context.dependencies.add(dep));
    }

    return context;
  }

  private extractSurroundingPatterns(code: string): string[] {
    const patterns = [];

    // Extract import patterns
    const importMatches = code.match(/import\s+.*from\s+['"][^'"]+['"]/g);
    if (importMatches) {
      patterns.push('imports', 'es6-modules');
    }

    // Extract class patterns
    if (code.includes('class ')) {
      patterns.push('class-based');
    }

    // Extract async patterns
    if (code.includes('async ') || code.includes('await ')) {
      patterns.push('async-await');
    }

    // Extract functional patterns
    if (code.includes('=>') || code.includes('function ')) {
      patterns.push('functional');
    }

    // Extract TypeScript patterns
    if (code.includes(': ') || code.includes('interface ') || code.includes('type ')) {
      patterns.push('typescript');
    }

    return [...new Set(patterns)];
  }

  private async extractCodePatterns(args: CodeGenerationRequest) {
    const patterns = {
      naming_conventions: this.analyzeNamingConventions(args.context.surrounding_code || ''),
      code_style: this.analyzeCodeStyle(args.context.surrounding_code || ''),
      architectural_patterns: this.analyzeArchitecturalPatterns(args.context.surrounding_code || ''),
      error_handling: this.analyzeErrorHandling(args.context.surrounding_code || '')
    };

    return patterns;
  }

  private analyzeNamingConventions(code: string) {
    const conventions = {
      variable_style: 'camelCase',
      function_style: 'camelCase',
      class_style: 'PascalCase',
      constant_style: 'UPPER_SNAKE_CASE',
      interface_style: 'PascalCase'
    };

    // Analyze actual naming patterns in the code
    const variableMatches = code.match(/\b[a-z][a-zA-Z0-9]*\b/g) || [];
    const classMatches = code.match(/\b[A-Z][a-zA-Z0-9]*\b/g) || [];
    const constantMatches = code.match(/\b[A-Z][A-Z0-9_]*\b/g) || [];

    // Detect actual patterns used
    if (variableMatches.length > 0) {
      const camelCaseCount = variableMatches.filter(v => /^[a-z][a-zA-Z0-9]*$/.test(v)).length;
      if (camelCaseCount / variableMatches.length > 0.8) {
        conventions.variable_style = 'camelCase';
      }
    }

    return conventions;
  }

  private analyzeCodeStyle(code: string) {
    return {
      semicolons: code.includes(';'),
      quote_style: code.includes("'") ? 'single' : code.includes('"') ? 'double' : 'mixed',
      indentation: code.includes('  ') ? 'spaces' : 'tabs',
      brace_style: code.includes('{\n') ? 'allman' : 'k&r',
      trailing_commas: code.includes(',\n}') || code.includes(',\r\n}')
    };
  }

  private analyzeArchitecturalPatterns(code: string) {
    const patterns = [];

    if (code.includes('export default class') || code.includes('export class')) {
      patterns.push('class-module');
    }

    if (code.includes('module.exports') || code.includes('exports.')) {
      patterns.push('commonjs');
    }

    if (code.includes('decorator') || code.includes('@')) {
      patterns.push('decorators');
    }

    if (code.includes('Observer') || code.includes('Subject')) {
      patterns.push('observer-pattern');
    }

    return patterns;
  }

  private analyzeErrorHandling(code: string) {
    const patterns = [];

    if (code.includes('try') && code.includes('catch')) {
      patterns.push('try-catch');
    }

    if (code.includes('.catch(')) {
      patterns.push('promise-catch');
    }

    if (code.includes('throw new ')) {
      patterns.push('custom-errors');
    }

    return patterns;
  }

  private async generateCodeWithContext(args: CodeGenerationRequest, projectContext: any, codePatterns: any) {
    const contextInfo = {
      project_patterns: projectContext.patterns,
      dependencies: Array.from(projectContext.dependencies),
      naming_conventions: codePatterns.naming_conventions,
      code_style: codePatterns.code_style,
      architectural_patterns: codePatterns.architectural_patterns,
      error_handling: codePatterns.error_handling
    };

    const prompts = [
      `
Generate code based on this request:

Prompt: ${args.prompt}
Generation Type: ${args.generation_type}

Project Context:
${JSON.stringify(contextInfo, null, 2)}

Constraints:
${JSON.stringify(args.constraints, null, 2)}

Surrounding Code Context:
${args.context.surrounding_code || 'None'}

Coding Standards:
${JSON.stringify(args.context.coding_standards, null, 2)}

Requirements:
1. Follow the existing code patterns and style
2. Use appropriate naming conventions
3. Include necessary imports from project dependencies
4. Follow architectural patterns used in the project
5. Include error handling if appropriate
6. Add comments for complex logic
7. Ensure code is syntactically correct
8. Consider performance implications
9. Make code testable and maintainable

Generate clean, production-ready code that integrates seamlessly with the existing codebase.
`
    ];

    try {
      const aiInsights = await this.aiService.generateInsights(prompts);

      // Extract the generated code from AI response
      if (aiInsights.suggestions && aiInsights.suggestions.length > 0) {
        return aiInsights.suggestions[0].suggestion || this.generateFallbackCode(args);
      }

      return this.generateFallbackCode(args);

    } catch (error) {
      logger.warn('AI code generation failed, using fallback:', error);
      return this.generateFallbackCode(args);
    }
  }

  private generateFallbackCode(args: CodeGenerationRequest): string {
    const { prompt, generation_type } = args;

    switch (generation_type) {
      case 'function':
        return this.generateFunction(prompt, args);
      case 'class':
        return this.generateClass(prompt, args);
      case 'test':
        return this.generateTest(prompt, args);
      case 'documentation':
        return this.generateDocumentation(prompt, args);
      default:
        return `// Generated code for: ${prompt}
// TODO: Implement based on requirements
function generatedFunction() {
  // Implementation needed
}`;
    }
  }

  private generateFunction(prompt: string, args: CodeGenerationRequest): string {
    const functionName = this.extractFunctionName(prompt) || 'newFunction';
    const hasAsync = prompt.toLowerCase().includes('async') || prompt.toLowerCase().includes('await');
    const hasError = prompt.toLowerCase().includes('error') || prompt.toLowerCase().includes('exception');

    let code = '';

    if (hasAsync) {
      code += `/**
 * ${this.generateFunctionDescription(prompt)}
 * @returns Promise with function result
 */
export async function ${functionName}() {\n`;
    } else {
      code += `/**
 * ${this.generateFunctionDescription(prompt)}
 * @returns Function result
 */
export function ${functionName}() {\n`;
    }

    if (hasError) {
      code += `  try {\n    // TODO: Implement main logic\n    const result = await processData();\n    return result;\n  } catch (error) {\n    console.error('Error in ${functionName}:', error);\n    throw error;\n  }\n`;
    } else {
      code += '  // TODO: Implement main logic\n  const result = processData();\n  return result;\n';
    }

    code += '}\n\n// Helper function (to be implemented)\nfunction processData() {\n  // Implementation needed\n  return null;\n}';

    return code;
  }

  private generateClass(prompt: string, args: CodeGenerationRequest): string {
    const className = this.extractClassName(prompt) || 'NewClass';

    return `/**
 * ${this.generateClassDescription(prompt)}
 */
export class ${className} {
  private property: string;

  constructor(initialValue?: string) {
    this.property = initialValue || '';
  }

  /**
   * Getter for property
   */
  public getProperty(): string {
    return this.property;
  }

  /**
   * Setter for property
   */
  public setProperty(value: string): void {
    this.property = value;
  }

  /**
   * Main functionality
   */
  public process(): void {
    // TODO: Implement main functionality
  }
}`;
  }

  private generateTest(prompt: string, args: CodeGenerationRequest): string {
    const testName = this.extractTestName(prompt) || 'Functionality';

    return `describe('${testName}', () => {
  it('should handle basic case', () => {
    // TODO: Arrange
    const input = {}; // Set up test data

    // TODO: Act
    const result = functionToTest(input);

    // TODO: Assert
    expect(result).toBeDefined();
    // Add more specific assertions
  });

  it('should handle edge cases', () => {
    // TODO: Test edge cases
  });

  it('should handle error cases', () => {
    // TODO: Test error scenarios
  });
});

/**
 * Helper function to be tested (implementation needed)
 */
function functionToTest(input: any): any {
  // TODO: Implement function to be tested
  return input;
}`;
  }

  private generateDocumentation(prompt: string, args: CodeGenerationRequest): string {
    return `/**
 * ${this.generateDocumentationTitle(prompt)}
 *
 * ## Overview
 * TODO: Add overview description
 *
 * ## Usage
 * \`\`\`typescript
 * // TODO: Add usage examples
 * \`\`\`
 *
 * ## API Reference
 * TODO: Document API methods and properties
 *
 * ## Examples
 * TODO: Add practical examples
 *
 * ## Notes
 * TODO: Add implementation notes and considerations
 */`;
  }

  private extractFunctionName(prompt: string): string | null {
    const match = prompt.match(/function\s+(\w+)/i) || prompt.match(/(\w+)\s+function/i);
    return match ? match[1] : null;
  }

  private extractClassName(prompt: string): string | null {
    const match = prompt.match(/class\s+(\w+)/i) || prompt.match(/(\w+)\s+class/i);
    return match ? match[1] : null;
  }

  private extractTestName(prompt: string): string | null {
    const match = prompt.match(/test\s+(\w+)/i) || prompt.match(/(\w+)\s+test/i);
    return match ? match[1] : null;
  }

  private generateFunctionDescription(prompt: string): string {
    return `Generated function for: ${prompt}`;
  }

  private generateClassDescription(prompt: string): string {
    return `Generated class for: ${prompt}`;
  }

  private generateDocumentationTitle(prompt: string): string {
    return `Documentation for: ${prompt}`;
  }

  private async validateGeneratedCode(code: string, args: CodeGenerationRequest) {
    const validation = {
      syntax_valid: true,
      potential_issues: [] as Array<{
        type: 'warning' | 'error' | 'suggestion';
        message: string;
        line_number?: number;
      }>,
      security_considerations: [] as string[]
    };

    // Basic syntax validation
    try {
      // Check for balanced braces
      const openBraces = (code.match(/\{/g) || []).length;
      const closeBraces = (code.match(/\}/g) || []).length;
      if (openBraces !== closeBraces) {
        validation.potential_issues.push({
          type: 'error',
          message: 'Unbalanced braces detected'
        });
        validation.syntax_valid = false;
      }

      // Check for balanced parentheses
      const openParens = (code.match(/\(/g) || []).length;
      const closeParens = (code.match(/\)/g) || []).length;
      if (openParens !== closeParens) {
        validation.potential_issues.push({
          type: 'error',
          message: 'Unbalanced parentheses detected'
        });
        validation.syntax_valid = false;
      }

      // Security considerations
      if (code.includes('eval(') || code.includes('new Function(')) {
        validation.security_considerations.push('Dynamic code execution detected - review for security implications');
      }

      if (code.includes('password') || code.includes('secret') || code.includes('token')) {
        validation.security_considerations.push('Code references sensitive information - ensure proper handling');
      }

    } catch (error) {
      validation.syntax_valid = false;
      validation.potential_issues.push({
        type: 'error',
        message: 'Syntax validation failed'
      });
    }

    return validation;
  }

  private async analyzeContextCompliance(code: string, patterns: any, args: CodeGenerationRequest) {
    const compliance = {
      matched_patterns: [],
      style_compliance: 0,
      naming_convention_compliance: 0,
      architectural_alignment: 0
    };

    // Check naming convention compliance
    const variables = code.match(/\b[a-z][a-zA-Z0-9]*\b/g) || [];
    const camelCaseCount = variables.filter(v => /^[a-z][a-zA-Z0-9]*$/.test(v)).length;
    compliance.naming_convention_compliance = variables.length > 0 ? (camelCaseCount / variables.length) * 100 : 100;

    // Check style compliance
    let styleScore = 0;
    if (patterns.code_style.semicolons && code.includes(';')) {styleScore += 25;}
    if (patterns.code_style.semicolons === false && !code.includes(';')) {styleScore += 25;}
    compliance.style_compliance = styleScore;

    // Check architectural alignment
    if (patterns.architectural_patterns.includes('class-module') && code.includes('class ')) {
      compliance.architectural_alignment += 50;
      compliance.matched_patterns.push('class-based-architecture');
    }

    return compliance;
  }

  private async generateAlternatives(args: CodeGenerationRequest, generatedCode: string, projectContext: any) {
    const alternatives = [];

    // Alternative implementation 1: More concise
    if (generatedCode.length > 200) {
      alternatives.push({
        code: '// Concise alternative implementation\n// TODO: Implement shorter version',
        description: 'More concise implementation',
        pros: ['Shorter code', 'Easier to read'],
        cons: ['May sacrifice some flexibility'],
        use_case: 'When simplicity is preferred'
      });
    }

    // Alternative implementation 2: More robust
    alternatives.push({
      code: '// Robust alternative implementation\n// TODO: Add comprehensive error handling',
      description: 'More robust implementation with extensive error handling',
      pros: ['Better error handling', 'More reliable'],
      cons: ['More complex', 'Longer code'],
      use_case: 'Production environments requiring high reliability'
    });

    return alternatives;
  }

  private async generateSuggestions(code: string, validation: any, args: CodeGenerationRequest) {
    return {
      alternative_implementations: [
        'Consider using functional programming patterns',
        'Evaluate if a different design pattern would be more suitable'
      ],
      optimization_opportunities: [
        'Review for potential performance optimizations',
        'Consider caching expensive operations'
      ],
      test_recommendations: [
        'Add unit tests for all public methods',
        'Include integration tests for external dependencies'
      ],
      documentation_notes: [
        'Add inline comments for complex logic',
        'Document edge cases and assumptions'
      ]
    };
  }

  private async createIntegrationPlan(args: CodeGenerationRequest, code: string) {
    const plan = {
      required_changes: [] as Array<{
        file: string;
        change_type: 'add' | 'modify' | 'import';
        description: string;
      }>,
      backward_compatibility: true,
      migration_steps: [] as string[]
    };

    // Extract imports from generated code
    const importMatches = code.match(/import\s+.*from\s+['"][^'"]+['"]/g);
    if (importMatches) {
      importMatches.forEach(imp => {
        plan.required_changes.push({
          file: args.context.file_path || 'target-file',
          change_type: 'import',
          description: `Add import: ${imp}`
        });
      });
    }

    plan.migration_steps.push('Review generated code for project alignment');
    plan.migration_steps.push('Add necessary unit tests');
    plan.migration_steps.push('Update documentation if needed');

    return plan;
  }

  private calculateConfidenceScore(code: string, contextAnalysis: any, validation: any, args: CodeGenerationRequest): number {
    let score = 50; // Base score

    // Add points for context compliance
    score += contextAnalysis.style_compliance * 0.2;
    score += contextAnalysis.naming_convention_compliance * 0.2;
    score += contextAnalysis.architectural_alignment * 0.1;

    // Subtract points for validation issues
    validation.potential_issues.forEach((issue: any) => {
      if (issue.type === 'error') {score -= 20;}
      else if (issue.type === 'warning') {score -= 10;}
      else {score -= 5;}
    });

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  private extractCodeMetadata(code: string, args: CodeGenerationRequest) {
    const lines = code.split('\n').length;
    const dependencies = [];

    // Extract imports
    const importMatches = code.match(/import\s+.*from\s+['"][^'"]+['"]/g);
    if (importMatches) {
      importMatches.forEach(imp => {
        const match = imp.match(/from\s+['"]([^'"]+)['"]/);
        if (match) {dependencies.push(match[1]);}
      });
    }

    return {
      language: args.context.coding_standards?.language || 'typescript',
      type: args.generation_type,
      estimated_lines: lines,
      complexity_score: Math.min(100, lines * 2), // Simple heuristic
      dependencies: [...new Set(dependencies)]
    };
  }
}