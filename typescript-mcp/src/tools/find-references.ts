/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable no-undef */
/* eslint-disable no-useless-escape */
// import type { Tool } from '@modelcontextprotocol/sdk/types.js'; // Rule 15: Import reserved for future implementation
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { AnalysisService } from '../services/analysis-service.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { CodebaseService } from '../services/codebase-service.js';
import { z } from 'zod';

// Input validation schema
const FindReferencesInputSchema = z.object({
  entity_id: z.string().uuid('Invalid entity ID'),
  include_tests: z.boolean().default(true),
  include_indirect: z.boolean().default(false),
  include_comments: z.boolean().default(false),
  include_strings: z.boolean().default(false),
  max_results: z.number().int().min(1).max(1000).default(100),
  file_types: z.array(z.string()).optional(),
  exclude_patterns: z.array(z.string()).optional(),
  context_lines: z.number().int().min(0).max(10).default(2),
});

// Rule 15: Type definition for FindReferencesInput
type FindReferencesInput = z.infer<typeof FindReferencesInputSchema>;

interface Reference {
  id: string;
  file_path: string;
  line_number: number;
  column_number: number;
  reference_type: 'direct' | 'indirect' | 'import' | 'type_reference' | 'comment' | 'string';
  context: string;
  surrounding_code: string[];
  confidence: number;
  usage_type:
    | 'call'
    | 'assignment'
    | 'declaration'
    | 'parameter'
    | 'return'
    | 'property_access'
    | 'other';
  containing_function?: string;
  containing_class?: string;
  is_modification: boolean;
  language: string;
}

interface ReferenceGroup {
  file_path: string;
  language: string;
  total_references: number;
  references: Reference[];
}

interface FindReferencesResult {
  entity_id: string;
  entity_name: string;
  entity_type: string;
  total_count: number;
  direct_references: number;
  indirect_references: number;
  test_references: number;
  groups_by_file: ReferenceGroup[];
  usage_patterns: Record<string, number>;
  most_common_usage: string;
  hotspots: string[]; // Files with most references
}

/**
 * Find all references to a code entity (function, class, variable, etc.)
 * Supports direct references, indirect references, and usage analysis
 */
export class FindReferencesTool {
  name = 'find_references';
  description = 'Find all references to a code entity with detailed usage analysis';

  inputSchema = {
    type: 'object',
    properties: {
      entity_id: {
        type: 'string',
        description: 'UUID of the code entity to find references for',
      },
      include_tests: {
        type: 'boolean',
        description: 'Include references in test files',
        default: true,
      },
      include_indirect: {
        type: 'boolean',
        description: 'Include indirect references (through other functions)',
        default: false,
      },
      include_comments: {
        type: 'boolean',
        description: 'Include references in comments',
        default: false,
      },
      include_strings: {
        type: 'boolean',
        description: 'Include references in string literals',
        default: false,
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of references to return',
        default: 100,
      },
      file_types: {
        type: 'array',
        items: { type: 'string' },
        description: 'File extensions to include (e.g., [".ts", ".js"])',
      },
      exclude_patterns: {
        type: 'array',
        items: { type: 'string' },
        description: 'Patterns to exclude from search',
      },
      context_lines: {
        type: 'number',
        description: 'Number of context lines around each reference',
        default: 2,
      },
    },
    required: ['entity_id'],
  };

  // Constructor removed - services injected via dependency injection

  async call(args: unknown): Promise<FindReferencesResult> {
    try {
      // Validate input
      const input = FindReferencesInputSchema.parse(args);

      // Get the target entity
      const entity = await this.codebaseService.getCodeEntity(input.entity_id);
      if (!entity) {
        throw new Error(`Code entity with ID ${input.entity_id} not found`);
      }

      // Find all references
      const allReferences = await this.findAllReferences(entity, input);

      // Filter and categorize references
      const filteredReferences = this.filterReferences(allReferences, input);
      const categorizedReferences = this.categorizeReferences(filteredReferences);

      // Group references by file
      const groupsByFile = this.groupReferencesByFile(categorizedReferences);

      // Analyze usage patterns
      const usagePatterns = this.analyzeUsagePatterns(categorizedReferences);
      const mostCommonUsage = this.getMostCommonUsage(usagePatterns);

      // Find hotspots (files with most references)
      const hotspots = this.findHotspots(groupsByFile);

      // Count different types of references
      const directRefs = categorizedReferences.filter(r => r.reference_type === 'direct').length;
      const indirectRefs = categorizedReferences.filter(
        r => r.reference_type === 'indirect',
      ).length;
      const testRefs = categorizedReferences.filter(r => this.isTestFile(r.file_path)).length;

      return {
        entity_id: entity.id,
        entity_name: entity.name,
        entity_type: entity.entity_type,
        total_count: categorizedReferences.length,
        direct_references: directRefs,
        indirect_references: indirectRefs,
        test_references: testRefs,
        groups_by_file: groupsByFile.slice(0, input.max_results),
        usage_patterns: usagePatterns,
        most_common_usage: mostCommonUsage,
        hotspots: hotspots.slice(0, 10), // Top 10 hotspots
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Invalid input: ${error.errors.map(e => e.message).join(', ')}`);
      }

      throw new Error(
        `Find references failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Find all references to the entity
   */
  private async findAllReferences(entity: unknown, input: FindReferencesInput): Promise<Reference[]> {
    const references: Reference[] = [];

    // Find direct references through relationships
    const directRefs = await this.analysisService.findDirectReferences(entity.id);
    references.push(...directRefs.map(ref => this.convertToReference(ref, 'direct')));

    // Find references through text search
    const textRefs = await this.findTextReferences(entity, input);
    references.push(...textRefs);

    // Find indirect references if requested
    if (input.include_indirect) {
      const indirectRefs = await this.findIndirectReferences(entity, input);
      references.push(...indirectRefs);
    }

    // Find references in comments if requested
    if (input.include_comments) {
      const commentRefs = await this.findCommentReferences(entity, input);
      references.push(...commentRefs);
    }

    // Find references in strings if requested
    if (input.include_strings) {
      const stringRefs = await this.findStringReferences(entity, input);
      references.push(...stringRefs);
    }

    return references;
  }

  /**
   * Find references through text search
   */
  private async findTextReferences(entity: unknown, input: FindReferencesInput): Promise<Reference[]> {
    const references: Reference[] = [];

    // Search for entity name in code
    const searchResults = await this.analysisService.searchText(entity.codebase_id, entity.name, {
      file_types: input.file_types,
      exclude_patterns: input.exclude_patterns,
    });

    for (const result of searchResults) {
      // Skip the definition itself
      if (
        result.file_path === entity.file_path &&
        result.line_number >= entity.start_line &&
        result.line_number <= entity.end_line
      ) {
        continue;
      }

      const reference = await this.createReferenceFromSearchResult(result, entity, input);
      if (reference) {
        references.push(reference);
      }
    }

    return references;
  }

  /**
   * Find indirect references (through other functions that use this entity)
   */
  private async findIndirectReferences(
    entity: unknown,
    input: FindReferencesInput,
  ): Promise<Reference[]> {
    const references: Reference[] = [];

    // Find functions that directly use this entity
    const directUsers = await this.analysisService.findDirectUsers(entity.id);

    // For each direct user, find their references
    for (const user of directUsers) {
      const userRefs = await this.analysisService.findDirectReferences(user.id);

      for (const ref of userRefs) {
        const indirectRef = this.convertToReference(ref, 'indirect');
        indirectRef.containing_function = user.name;
        references.push(indirectRef);
      }
    }

    return references;
  }

  /**
   * Find references in comments
   */
  private async findCommentReferences(
    entity: unknown,
    input: FindReferencesInput,
  ): Promise<Reference[]> {
    const references: Reference[] = [];

    const commentMatches = await this.analysisService.searchInComments(
      entity.codebase_id,
      entity.name,
    );

    for (const match of commentMatches) {
      const reference = await this.createReferenceFromMatch(match, 'comment', entity, input);
      if (reference) {
        references.push(reference);
      }
    }

    return references;
  }

  /**
   * Find references in string literals
   */
  private async findStringReferences(
    entity: unknown,
    input: FindReferencesInput,
  ): Promise<Reference[]> {
    const references: Reference[] = [];

    const stringMatches = await this.analysisService.searchInStrings(
      entity.codebase_id,
      entity.name,
    );

    for (const match of stringMatches) {
      const reference = await this.createReferenceFromMatch(match, 'string', entity, input);
      if (reference) {
        references.push(reference);
      }
    }

    return references;
  }

  /**
   * Convert analysis result to Reference object
   */
  private convertToReference(result: unknown, type: 'direct' | 'indirect'): Reference {
    return {
      id: result.id || `${result.file_path}:${result.line_number}`,
      file_path: result.file_path,
      line_number: result.line_number,
      column_number: result.column_number || 0,
      reference_type: type,
      context: result.context || '',
      surrounding_code: result.surrounding_code || [],
      confidence: result.confidence || 1.0,
      usage_type: this.determineUsageType(result.context || ''),
      containing_function: result.containing_function,
      containing_class: result.containing_class,
      is_modification: this.isModification(result.context || ''),
      language: this.detectLanguage(result.file_path),
    };
  }

  /**
   * Create reference from search result
   */
  private async createReferenceFromSearchResult(
    result: unknown,
    entity: unknown,
    input: FindReferencesInput,
  ): Promise<Reference | null> {
    try {
      // Get surrounding code for context
      const surroundingCode = await this.codebaseService.getCodeLines(
        result.file_path,
        Math.max(1, result.line_number - input.context_lines),
        result.line_number + input.context_lines,
      );

      // Analyze the context to determine usage type
      const context = surroundingCode[input.context_lines] || '';
      const usageType = this.determineUsageType(context);

      // Calculate confidence based on context
      const confidence = this.calculateConfidence(context, entity.name);

      return {
        id: `${result.file_path}:${result.line_number}`,
        file_path: result.file_path,
        line_number: result.line_number,
        column_number: result.column_number || 0,
        reference_type: 'direct',
        context,
        surrounding_code: surroundingCode,
        confidence,
        usage_type: usageType,
        containing_function: await this.findContainingFunction(
          result.file_path,
          result.line_number,
        ),
        containing_class: await this.findContainingClass(result.file_path, result.line_number),
        is_modification: this.isModification(context),
        language: this.detectLanguage(result.file_path),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Create reference from match
   */
  private async createReferenceFromMatch(
    match: unknown,
    type: 'comment' | 'string',
    entity: unknown,
    input: FindReferencesInput,
  ): Promise<Reference | null> {
    try {
      const surroundingCode = await this.codebaseService.getCodeLines(
        match.file_path,
        Math.max(1, match.line_number - input.context_lines),
        match.line_number + input.context_lines,
      );

      return {
        id: `${match.file_path}:${match.line_number}:${type}`,
        file_path: match.file_path,
        line_number: match.line_number,
        column_number: match.column_number || 0,
        reference_type: type,
        context: match.context || '',
        surrounding_code: surroundingCode,
        confidence: 0.7, // Lower confidence for comments and strings
        usage_type: 'other',
        is_modification: false,
        language: this.detectLanguage(match.file_path),
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Filter references based on input criteria
   */
  private filterReferences(references: Reference[], input: FindReferencesInput): Reference[] {
    let filtered = references;

    // Filter by test files
    if (!input.include_tests) {
      filtered = filtered.filter(ref => !this.isTestFile(ref.file_path));
    }

    // Filter by file types
    if (input.file_types && input.file_types.length > 0) {
      filtered = filtered.filter(ref => {
        const ext = `.${  ref.file_path.split('.').pop()}`;
        return input.file_types!.includes(ext);
      });
    }

    // Filter by exclude patterns
    if (input.exclude_patterns && input.exclude_patterns.length > 0) {
      filtered = filtered.filter(ref => {
        return !input.exclude_patterns!.some(pattern => ref.file_path.includes(pattern));
      });
    }

    // Remove duplicates
    const seen = new Set<string>();
    filtered = filtered.filter(ref => {
      const key = `${ref.file_path}:${ref.line_number}:${ref.column_number}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    // Sort by confidence and file path
    filtered.sort((a, b) => {
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }
      return a.file_path.localeCompare(b.file_path);
    });

    return filtered;
  }

  /**
   * Categorize references by type and usage
   */
  private categorizeReferences(references: Reference[]): Reference[] {
    return references.map(ref => {
      // Enhance categorization based on context analysis
      if (ref.context) {
        ref.usage_type = this.determineUsageType(ref.context);
        ref.is_modification = this.isModification(ref.context);
      }

      return ref;
    });
  }

  /**
   * Group references by file
   */
  private groupReferencesByFile(references: Reference[]): ReferenceGroup[] {
    const groups = new Map<string, Reference[]>();

    for (const ref of references) {
      if (!groups.has(ref.file_path)) {
        groups.set(ref.file_path, []);
      }
      groups.get(ref.file_path)!.push(ref);
    }

    return Array.from(groups.entries())
      .map(([filePath, refs]) => ({
        file_path: filePath,
        language: refs[0]?.language || this.detectLanguage(filePath),
        total_references: refs.length,
        references: refs.sort((a, b) => a.line_number - b.line_number),
      }))
      .sort((a, b) => b.total_references - a.total_references);
  }

  /**
   * Analyze usage patterns
   */
  private analyzeUsagePatterns(references: Reference[]): Record<string, number> {
    const patterns: Record<string, number> = {};

    for (const ref of references) {
      patterns[ref.usage_type] = (patterns[ref.usage_type] || 0) + 1;
    }

    return patterns;
  }

  /**
   * Get most common usage type
   */
  private getMostCommonUsage(patterns: Record<string, number>): string {
    let maxCount = 0;
    let mostCommon = 'other';

    for (const [usage, count] of Object.entries(patterns)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = usage;
      }
    }

    return mostCommon;
  }

  /**
   * Find hotspots (files with most references)
   */
  private findHotspots(groups: ReferenceGroup[]): string[] {
    return groups.filter(group => group.total_references > 1).map(group => group.file_path);
  }

  /**
   * Determine usage type from context
   */
  private determineUsageType(
    context: string,
  ): 'call' | 'assignment' | 'declaration' | 'parameter' | 'return' | 'property_access' | 'other' {
    const lowerContext = context.toLowerCase();

    if (lowerContext.includes('(') && lowerContext.includes(')')) {
      return 'call';
    }
    if (
      lowerContext.includes('=') &&
      !lowerContext.includes('==') &&
      !lowerContext.includes('!=')
    ) {
      return 'assignment';
    }
    if (
      lowerContext.includes('function') ||
      lowerContext.includes('def ') ||
      lowerContext.includes('fn ')
    ) {
      return 'declaration';
    }
    if (lowerContext.includes('return')) {
      return 'return';
    }
    if (lowerContext.includes('.')) {
      return 'property_access';
    }
    if (lowerContext.includes(',') || lowerContext.includes('(')) {
      return 'parameter';
    }

    return 'other';
  }

  /**
   * Check if context indicates modification
   */
  private isModification(context: string): boolean {
    const modificationPatterns = [
      /\w+]*=]*/, // assignment
      /\w+]*\+=/, // compound assignment
      /\w+]*-=/,
      /\w+]*\*=/,
      /\w+]*]=/,
      /\w+\+\+/, // increment
      /\+\+\w+/,
      /\w+--/, // decrement
      /--\w+/,
      /\.push\(/, // array modification
      /\.pop\(/,
      /\.splice\(/,
      /\.sort\(/,
      /\.reverse\(/,
    ];

    return modificationPatterns.some(pattern => pattern.test(context));
  }

  /**
   * Calculate confidence score for a reference
   */
  private calculateConfidence(context: string, entityName: string): number {
    let confidence = 0.5; // Base confidence

    // Exact word match increases confidence
    const wordBoundaryRegex = new RegExp(`]b${entityName}]b`);
    if (wordBoundaryRegex.test(context)) {
      confidence += 0.3;
    }

    // Function call pattern increases confidence
    if (context.includes(`${entityName}(`)) {
      confidence += 0.2;
    }

    // Property access increases confidence
    if (context.includes(`${entityName}.`) || context.includes(`.${entityName}`)) {
      confidence += 0.15;
    }

    // Import statement increases confidence
    if (context.includes('import') && context.includes(entityName)) {
      confidence += 0.25;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(filePath: string): boolean {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /]test]/,
      /]tests]/,
      /]spec]/,
      /]specs]/,
      /__tests__/,
      /__test__/,
    ];

    return testPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      cpp: 'cpp',
      cc: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      swift: 'swift',
      kt: 'kotlin',
    };

    return languageMap[ext || ''] || 'unknown';
  }

  /**
   * Find containing function for a line
   */
  private async findContainingFunction(
    filePath: string,
    lineNumber: number,
  ): Promise<string | undefined> {
    try {
      const containingEntity = await this.analysisService.findContainingEntity(
        filePath,
        lineNumber,
        0,
      );
      return containingEntity?.name;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Find containing class for a line
   */
  private async findContainingClass(
    filePath: string,
    lineNumber: number,
  ): Promise<string | undefined> {
    try {
      const containingEntity = await this.analysisService.findContainingEntity(
        filePath,
        lineNumber,
        0,
      );
      return containingEntity?.name;
    } catch (error) {
      return undefined;
    }
  }
}

export default FindReferencesTool;
