import type { DuplicateCode } from '../types/index.js';
import { parse } from '@typescript-eslint/typescript-estree';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { distance } from 'fast-levenshtein';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

export interface DuplicationService {
  detectDuplicates(projectPath: string): Promise<DuplicateCode[]>;
  analyzeFile(filePath: string): Promise<DuplicateCode[]>;
  compareFiles(file1: string, file2: string): Promise<DuplicateCode[]>;
  findSimilarFunctions(projectPath: string, threshold?: number): Promise<FunctionDuplicate[]>;
  findSimilarClasses(projectPath: string, threshold?: number): Promise<ClassDuplicate[]>;
  generateDuplicationReport(duplicates: DuplicateCode[]): Promise<DuplicationReport>;
  suggestRefactoring(duplicate: DuplicateCode): Promise<RefactoringAdvice>;
  findDuplicateCode(codebaseId: string, options: any): Promise<any[]>;
  findDuplicates(files: string[], options: any): Promise<any[]>;
}

export interface FunctionDuplicate {
  id: string;
  functions: FunctionInfo[];
  similarity: number;
  commonCode: string;
  suggestedRefactoring: string;
}

export interface ClassDuplicate {
  id: string;
  classes: ClassInfo[];
  similarity: number;
  commonMethods: string[];
  suggestedRefactoring: string;
}

export interface FunctionInfo {
  name: string;
  file: string;
  startLine: number;
  endLine: number;
  code: string;
  signature: string;
  complexity: number;
}

export interface ClassInfo {
  name: string;
  file: string;
  startLine: number;
  endLine: number;
  code: string;
  methods: string[];
  properties: string[];
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
}

export class DefaultDuplicationService implements DuplicationService {
  private calculateSimilarity(content1: string, content2: string): number {
    // Normalize content
    const normalize = (text: string) => {
      return text
        .replace(/\s+/g, ' ')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .trim()
        .toLowerCase();
    };
    
    const norm1 = normalize(content1);
    const norm2 = normalize(content2);
    
    if (norm1 === norm2) return 1.0;
    if (norm1.length === 0 || norm2.length === 0) return 0;
    
    // Calculate Levenshtein distance
    const matrix = [];
    const len1 = norm1.length;
    const len2 = norm2.length;
    
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (norm2.charAt(i - 1) === norm1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    
    return 1 - (distance / maxLen);
  }

  private findDuplicateBlocks(file1: string, content1: string, file2: string, content2: string, minLines: number): any[] {
    const blocks: any[] = [];
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    
    // Find similar blocks of code
    for (let i = 0; i < lines1.length - minLines; i++) {
      for (let j = 0; j < lines2.length - minLines; j++) {
        let matchLength = 0;
        
        // Count consecutive matching lines
        while (i + matchLength < lines1.length &&
               j + matchLength < lines2.length &&
               this.linesAreSimilar(lines1[i + matchLength], lines2[j + matchLength])) {
          matchLength++;
        }
        
        if (matchLength >= minLines) {
          const block1Content = lines1.slice(i, i + matchLength).join('\n');
          const block2Content = lines2.slice(j, j + matchLength).join('\n');
          
          blocks.push({
            files: [
              {
                file: file1,
                lines: [i + 1, i + matchLength],
                content: block1Content
              },
              {
                file: file2,
                lines: [j + 1, j + matchLength],
                content: block2Content
              }
            ]
          });
          
          // Skip ahead to avoid overlapping matches
          i += matchLength - 1;
          break;
        }
      }
    }
    
    return blocks;
  }

  private linesAreSimilar(line1: string, line2: string): boolean {
    const normalize = (line: string) => {
      return line.trim().replace(/\s+/g, ' ').toLowerCase();
    };
    
    const norm1 = normalize(line1);
    const norm2 = normalize(line2);
    
    if (norm1 === norm2) return true;
    if (norm1.length === 0 || norm2.length === 0) return false;
    
    // Allow small differences
    const similarity = this.calculateSimilarity(norm1, norm2);
    return similarity > 0.9;
  }

  private generateSuggestion(files: any[], similarity: number): string {
    if (similarity === 1.0) {
      return 'Extract identical code to a shared utility function';
    } else if (similarity > 0.9) {
      return 'Consider extracting similar code to a common function with parameters';
    } else {
      return 'Review for potential code consolidation opportunities';
    }
  }

  private async extractCodeBlocks(filePath: string): Promise<any[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const blocks: any[] = [];
      
      try {
        const ast = acorn.parse(content, {
          ecmaVersion: 2020,
          sourceType: 'module',
          allowImportExportEverywhere: true,
          allowReturnOutsideFunction: true
        });
        
        this.traverseASTForBlocks(ast, blocks, content);
      } catch (error) {
        // Fallback to line-based blocks
        this.extractLineBasedBlocks(content, blocks);
      }
      
      return blocks;
    } catch (error) {
      console.error(`Failed to extract blocks from ${filePath}:`, error);
      return [];
    }
  }

  private traverseASTForBlocks(node: any, blocks: any[], content: string): void {
    if (!node || typeof node !== 'object') return;
    
    // Extract function blocks
    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      const startLine = node.loc?.start?.line || 1;
      const endLine = node.loc?.end?.line || startLine;
      const lines = content.split('\n');
      const blockContent = lines.slice(startLine - 1, endLine).join('\n');
      
      blocks.push({
        startLine,
        endLine,
        content: blockContent,
        tokens: this.tokenizeCode(blockContent)
      });
    }
    
    // Extract class blocks
    if (node.type === 'ClassDeclaration') {
      const startLine = node.loc?.start?.line || 1;
      const endLine = node.loc?.end?.line || startLine;
      const lines = content.split('\n');
      const blockContent = lines.slice(startLine - 1, endLine).join('\n');
      
      blocks.push({
        startLine,
        endLine,
        content: blockContent,
        tokens: this.tokenizeCode(blockContent)
      });
    }
    
    // Traverse child nodes
    for (const key in node) {
      if (key !== 'parent') {
        const child = node[key];
        if (Array.isArray(child)) {
          child.forEach(item => this.traverseASTForBlocks(item, blocks, content));
        } else if (child && typeof child === 'object') {
          this.traverseASTForBlocks(child, blocks, content);
        }
      }
    }
  }

  private extractLineBasedBlocks(content: string, blocks: any[]): void {
    const lines = content.split('\n');
    const minBlockSize = 5;
    
    for (let i = 0; i < lines.length - minBlockSize; i += minBlockSize) {
      const endLine = Math.min(i + minBlockSize, lines.length);
      const blockContent = lines.slice(i, endLine).join('\n');
      
      if (blockContent.trim().length > 0) {
        blocks.push({
          startLine: i + 1,
          endLine: endLine,
          content: blockContent,
          tokens: this.tokenizeCode(blockContent)
        });
      }
    }
  }

  private tokenizeCode(code: string): string[] {
    // Simple tokenization
    return code
      .replace(/[{}();,]/g, ' $& ')
      .split(/\s+/)
      .filter(token => token.trim().length > 0);
  }
}

export interface RefactoringAdvice {
  type: 'extract_function' | 'extract_class' | 'extract_module' | 'parameterize';
  description: string;
  steps: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  benefits: string[];
}

export interface CodeBlock {
  content: string;
  file: string;
  startLine: number;
  endLine: number;
  hash: string;
  tokens: string[];
}

export interface SimilarityMatch {
  block1: CodeBlock;
  block2: CodeBlock;
  similarity: number;
  matchType: 'exact' | 'structural' | 'semantic';
}

// Duplicate class removed - using the first implementation

  async detectDuplicates(projectPath: string): Promise<DuplicateCode[]> {
    const duplicates: DuplicateCode[] = [];
    
    // Find all relevant files
    const files = await this.getProjectFiles(projectPath);
    
    // Extract code blocks from all files
    const allBlocks: CodeBlock[] = [];
    for (const filePath of files) {
      try {
        const blocks = await this.extractCodeBlocks(filePath);
        allBlocks.push(...blocks);
      } catch (error) {
        console.warn(`Failed to analyze ${filePath}:`, error);
      }
    }
    
    // Find similar blocks
    const similarities = this.findSimilarBlocks(allBlocks);
    
    // Convert similarities to DuplicateCode objects
    for (const similarity of similarities) {
      if (similarity.similarity >= this.defaultThreshold) {
        duplicates.push({
          id: this.generateId(),
          files: [similarity.block1.file, similarity.block2.file],
          lines: [similarity.block1.startLine, similarity.block2.startLine],
          content: similarity.block1.content,
          similarity: similarity.similarity
        });
      }
    }
    
    return this.mergeSimilarDuplicates(duplicates);
  }

  async analyzeFile(filePath: string): Promise<DuplicateCode[]> {
    const duplicates: DuplicateCode[] = [];
    const blocks = await this.extractCodeBlocks(filePath);
    
    // Find duplicates within the same file
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const similarity = this.calculateSimilarity(blocks[i], blocks[j]);
        
        if (similarity >= this.defaultThreshold) {
          duplicates.push({
            id: this.generateId(),
            files: [filePath, filePath],
            lines: [blocks[i].startLine, blocks[j].startLine],
            content: blocks[i].content,
            similarity
          });
        }
      }
    }
    
    return duplicates;
  }

  async compareFiles(file1: string, file2: string): Promise<DuplicateCode[]> {
    const duplicates: DuplicateCode[] = [];
    
    const blocks1 = await this.extractCodeBlocks(file1);
    const blocks2 = await this.extractCodeBlocks(file2);
    
    for (const block1 of blocks1) {
      for (const block2 of blocks2) {
        const similarity = this.calculateSimilarity(block1, block2);
        
        if (similarity >= this.defaultThreshold) {
          duplicates.push({
            id: this.generateId(),
            files: [file1, file2],
            lines: [block1.startLine, block2.startLine],
            content: block1.content,
            similarity
          });
        }
      }
    }
    
    return duplicates;
  }

  async findSimilarFunctions(projectPath: string, threshold = 0.7): Promise<FunctionDuplicate[]> {
    const files = await this.getProjectFiles(projectPath);
    const allFunctions: FunctionInfo[] = [];
    
    // Extract all functions from all files
    for (const filePath of files) {
      try {
        const functions = await this.extractFunctions(filePath);
        allFunctions.push(...functions);
      } catch (error) {
        console.warn(`Failed to extract functions from ${filePath}:`, error);
      }
    }
    
    const duplicates: FunctionDuplicate[] = [];
    const processed = new Set<string>();
    
    // Compare all functions
    for (let i = 0; i < allFunctions.length; i++) {
      if (processed.has(allFunctions[i].name + allFunctions[i].file)) continue;
      
      const similarFunctions = [allFunctions[i]];
      
      for (let j = i + 1; j < allFunctions.length; j++) {
        if (processed.has(allFunctions[j].name + allFunctions[j].file)) continue;
        
        const similarity = this.calculateFunctionSimilarity(allFunctions[i], allFunctions[j]);
        
        if (similarity >= threshold) {
          similarFunctions.push(allFunctions[j]);
          processed.add(allFunctions[j].name + allFunctions[j].file);
        }
      }
      
      if (similarFunctions.length > 1) {
        duplicates.push({
          id: this.generateId(),
          functions: similarFunctions,
          similarity: this.calculateAverageSimilarity(similarFunctions),
          commonCode: this.extractCommonCode(similarFunctions.map(f => f.code)),
          suggestedRefactoring: this.suggestFunctionRefactoring(similarFunctions)
        });
        
        processed.add(allFunctions[i].name + allFunctions[i].file);
      }
    }
    
    return duplicates;
  }

  async findSimilarClasses(projectPath: string, threshold = 0.7): Promise<ClassDuplicate[]> {
    const files = await this.getProjectFiles(projectPath);
    const allClasses: ClassInfo[] = [];
    
    // Extract all classes from all files
    for (const filePath of files) {
      try {
        const classes = await this.extractClasses(filePath);
        allClasses.push(...classes);
      } catch (error) {
        console.warn(`Failed to extract classes from ${filePath}:`, error);
      }
    }
    
    const duplicates: ClassDuplicate[] = [];
    const processed = new Set<string>();
    
    // Compare all classes
    for (let i = 0; i < allClasses.length; i++) {
      if (processed.has(allClasses[i].name + allClasses[i].file)) continue;
      
      const similarClasses = [allClasses[i]];
      
      for (let j = i + 1; j < allClasses.length; j++) {
        if (processed.has(allClasses[j].name + allClasses[j].file)) continue;
        
        const similarity = this.calculateClassSimilarity(allClasses[i], allClasses[j]);
        
        if (similarity >= threshold) {
          similarClasses.push(allClasses[j]);
          processed.add(allClasses[j].name + allClasses[j].file);
        }
      }
      
      if (similarClasses.length > 1) {
        duplicates.push({
          id: this.generateId(),
          classes: similarClasses,
          similarity: this.calculateAverageClassSimilarity(similarClasses),
          commonMethods: this.findCommonMethods(similarClasses),
          suggestedRefactoring: this.suggestClassRefactoring(similarClasses)
        });
        
        processed.add(allClasses[i].name + allClasses[i].file);
      }
    }
    
    return duplicates;
  }

  async generateDuplicationReport(duplicates: DuplicateCode[]): Promise<DuplicationReport> {
    const totalDuplicates = duplicates.length;
    let duplicatedLines = 0;
    
    const severityBreakdown = {
      high: 0,
      medium: 0,
      low: 0
    };
    
    for (const duplicate of duplicates) {
      const lineCount = duplicate.content.split('\n').length;
      duplicatedLines += lineCount;
      
      // Classify severity based on similarity and size
      if (duplicate.similarity > 0.95 && lineCount > 10) {
        severityBreakdown.high++;
      } else if (duplicate.similarity > 0.85 && lineCount > 5) {
        severityBreakdown.medium++;
      } else {
        severityBreakdown.low++;
      }
    }
    
    // Calculate total lines in project (simplified)
    const totalLines = await this.calculateTotalLines();
    const duplicatedPercentage = totalLines > 0 ? (duplicatedLines / totalLines) * 100 : 0;
    
    // Get top duplicates (sorted by impact)
    const topDuplicates = duplicates
      .sort((a, b) => {
        const impactA = a.similarity * a.content.split('\n').length;
        const impactB = b.similarity * b.content.split('\n').length;
        return impactB - impactA;
      })
      .slice(0, 10);
    
    const recommendations = this.generateRecommendations(duplicates, severityBreakdown);
    
    return {
      totalDuplicates,
      duplicatedLines,
      duplicatedPercentage,
      severityBreakdown,
      duplicates: topDuplicates,
      recommendations
    };
  }

  async suggestRefactoring(duplicate: DuplicateCode): Promise<RefactoringAdvice> {
    const lineCount = duplicate.content.split('\n').length;
    const complexity = this.estimateComplexity(duplicate.content);
    
    if (lineCount > 20 || complexity > 10) {
      return {
        type: 'extract_class',
        description: 'Extract duplicate code into a separate class',
        steps: [
          'Create a new class to encapsulate the duplicate functionality',
          'Move the duplicate code to methods in the new class',
          'Replace duplicate code with calls to the new class',
          'Add appropriate parameters and return values'
        ],
        estimatedEffort: 'high',
        benefits: [
          'Eliminates code duplication',
          'Improves maintainability',
          'Creates reusable component',
          'Reduces bug propagation risk'
        ]
      };
    } else if (lineCount > 5) {
      return {
        type: 'extract_function',
        description: 'Extract duplicate code into a shared function',
        steps: [
          'Identify common parameters and return values',
          'Create a new function with the duplicate code',
          'Replace duplicate code with function calls',
          'Add the function to an appropriate module'
        ],
        estimatedEffort: 'medium',
        benefits: [
          'Eliminates code duplication',
          'Improves code reusability',
          'Easier to maintain and test',
          'Reduces codebase size'
        ]
      };
    } else {
      return {
        type: 'parameterize',
        description: 'Parameterize the differences in duplicate code',
        steps: [
          'Identify the varying parts in duplicate code',
          'Create parameters for the varying parts',
          'Merge the duplicate code into a single parameterized version',
          'Update all call sites to use the new parameters'
        ],
        estimatedEffort: 'low',
        benefits: [
          'Quick fix for small duplications',
          'Maintains code locality',
          'Easy to implement and test'
        ]
      };
    }
  }

  async findDuplicateCode(codebaseId: string, options: any): Promise<any[]> {
    // Mock implementation
    return [
      {
        id: 'dup_1',
        instances: [
          {
            file_path: '/src/file1.ts',
            start_line: 10,
            end_line: 15,
            content: 'function example() { return true; }'
          },
          {
            file_path: '/src/file2.ts',
            start_line: 20,
            end_line: 25,
            content: 'function example() { return true; }'
          }
        ],
        similarity_score: 0.95,
        lines_of_code: 6,
        tokens: 15
      }
    ];
  }

  async findDuplicates(files: string[], options: any): Promise<any[]> {
    const duplicates: any[] = [];
    
    try {
      const fileContents = new Map<string, string>();
      
      // Read all files
      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          fileContents.set(filePath, content);
        } catch (error) {
          console.warn(`Failed to read ${filePath}:`, error);
        }
      }
      
      // Find duplicates
      const minSimilarity = options?.minSimilarity || 0.8;
      const minLines = options?.minLines || 5;
      
      const analyzed = new Set<string>();
      
      for (const [filePath1, content1] of fileContents) {
        for (const [filePath2, content2] of fileContents) {
          if (filePath1 >= filePath2) continue;
          
          const pairKey = `${filePath1}:${filePath2}`;
          if (analyzed.has(pairKey)) continue;
          analyzed.add(pairKey);
          
          const blocks1 = await this.extractCodeBlocks(filePath1);
          const blocks2 = await this.extractCodeBlocks(filePath2);
          
          for (const block1 of blocks1) {
            for (const block2 of blocks2) {
              const similarity = this.calculateSimilarity(block1, block2);
              
              if (similarity >= minSimilarity && block1.content.split('\n').length >= minLines) {
                duplicates.push({
                  id: `dup_${duplicates.length}`,
                  instances: [
                    {
                      file_path: filePath1,
                      start_line: block1.startLine,
                      end_line: block1.endLine,
                      content: block1.content
                    },
                    {
                      file_path: filePath2,
                      start_line: block2.startLine,
                      end_line: block2.endLine,
                      content: block2.content
                    }
                  ],
                  similarity_score: similarity,
                  lines_of_code: block1.content.split('\n').length,
                  tokens: block1.tokens.length
                });
              }
            }
          }
        }
      }
      
      return duplicates;
    } catch (error) {
      console.error('Failed to find duplicates:', error);
      return [];
    }
  }

  // Private helper methods
  private async getProjectFiles(projectPath: string): Promise<string[]> {
    const patterns = ['**/*.ts', '**/*.js', '**/*.tsx', '**/*.jsx'];
    const allFiles: string[] = [];
    
    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: projectPath,
        absolute: true,
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/.git/**',
          '**/test/**',
          '**/tests/**'
        ]
      });
      allFiles.push(...files);
    }
    
    return allFiles;
  }

  private async extractCodeBlocks(filePath: string): Promise<CodeBlock[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const blocks: CodeBlock[] = [];
    
    // Extract blocks using sliding window
    for (let i = 0; i <= lines.length - this.minBlockSize; i++) {
      for (let size = this.minBlockSize; size <= Math.min(50, lines.length - i); size++) {
        const blockLines = lines.slice(i, i + size);
        const blockContent = blockLines.join('\n');
        
        // Skip blocks that are mostly comments or empty lines
        if (this.isSignificantBlock(blockLines)) {
          blocks.push({
            content: blockContent,
            file: filePath,
            startLine: i + 1,
            endLine: i + size,
            hash: this.calculateHash(blockContent),
            tokens: this.tokenizeCode(blockContent)
          });
        }
      }
    }
    
    return blocks;
  }

  private isSignificantBlock(lines: string[]): boolean {
    let significantLines = 0;
    
    for (const line of lines) {
      const trimmed = line.trim();
      let isSignificant = true;
      
      for (const pattern of this.tokenIgnorePatterns) {
        if (pattern.test(trimmed)) {
          isSignificant = false;
          break;
        }
      }
      
      if (isSignificant && trimmed.length > 0) {
        significantLines++;
      }
    }
    
    return significantLines >= Math.ceil(lines.length * 0.5);
  }

  private findSimilarBlocks(blocks: CodeBlock[]): SimilarityMatch[] {
    const matches: SimilarityMatch[] = [];
    
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        // Skip if same file and overlapping lines
        if (blocks[i].file === blocks[j].file && 
            this.blocksOverlap(blocks[i], blocks[j])) {
          continue;
        }
        
        const similarity = this.calculateSimilarity(blocks[i], blocks[j]);
        
        if (similarity >= 0.5) { // Lower threshold for initial detection
          matches.push({
            block1: blocks[i],
            block2: blocks[j],
            similarity,
            matchType: this.determineMatchType(blocks[i], blocks[j], similarity)
          });
        }
      }
    }
    
    return matches.sort((a, b) => b.similarity - a.similarity);
  }

  private calculateSimilarity(block1: CodeBlock, block2: CodeBlock): number {
    // Use multiple similarity metrics and combine them
    
    // 1. Exact match
    if (block1.hash === block2.hash) {
      return 1.0;
    }
    
    // 2. Token-based similarity (Jaccard similarity)
    const tokenSimilarity = this.calculateTokenSimilarity(block1.tokens, block2.tokens);
    
    // 3. String similarity (Levenshtein distance)
    const stringSimilarity = 1 - (distance(block1.content, block2.content) / 
                                  Math.max(block1.content.length, block2.content.length));
    
    // 4. Structural similarity (AST-based)
    const structuralSimilarity = this.calculateStructuralSimilarity(block1.content, block2.content);
    
    // Weighted combination
    return (tokenSimilarity * 0.4) + (stringSimilarity * 0.3) + (structuralSimilarity * 0.3);
  }

  private calculateTokenSimilarity(tokens1: string[], tokens2: string[]): number {
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private calculateStructuralSimilarity(code1: string, code2: string): number {
    try {
      // Extract structural features (simplified)
      const features1 = this.extractStructuralFeatures(code1);
      const features2 = this.extractStructuralFeatures(code2);
      
      return this.compareStructuralFeatures(features1, features2);
    } catch (error) {
      // Fallback to simple pattern matching
      return this.calculatePatternSimilarity(code1, code2);
    }
  }

  private extractStructuralFeatures(code: string): any {
    const features = {
      functionCalls: (code.match(/\w+\s*\(/g) || []).length,
      conditionals: (code.match(/\b(if|else|switch|case)\b/g) || []).length,
      loops: (code.match(/\b(for|while|do)\b/g) || []).length,
      assignments: (code.match(/\w+\s*=/g) || []).length,
      returns: (code.match(/\breturn\b/g) || []).length,
      variables: (code.match(/\b(const|let|var)\s+\w+/g) || []).length
    };
    
    return features;
  }

  private compareStructuralFeatures(features1: any, features2: any): number {
    const keys = Object.keys(features1);
    let totalDiff = 0;
    let maxTotal = 0;
    
    for (const key of keys) {
      const diff = Math.abs(features1[key] - features2[key]);
      const max = Math.max(features1[key], features2[key]);
      totalDiff += diff;
      maxTotal += max;
    }
    
    return maxTotal > 0 ? 1 - (totalDiff / maxTotal) : 1;
  }

  private calculatePatternSimilarity(code1: string, code2: string): number {
    // Simple pattern-based similarity
    const patterns = [
      /\bif\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\breturn\s+/g,
      /\w+\s*\(/g
    ];
    
    let matches = 0;
    let total = 0;
    
    for (const pattern of patterns) {
      const count1 = (code1.match(pattern) || []).length;
      const count2 = (code2.match(pattern) || []).length;
      
      matches += Math.min(count1, count2);
      total += Math.max(count1, count2);
    }
    
    return total > 0 ? matches / total : 0;
  }

  private tokenizeCode(code: string): string[] {
    // Simple tokenization - split by common delimiters
    return code
      .replace(/[{}()\[\];,]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0 && !/^\d+$/.test(token))
      .map(token => token.toLowerCase());
  }

  private calculateHash(content: string): string {
    // Simple hash function for exact duplicate detection
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  private blocksOverlap(block1: CodeBlock, block2: CodeBlock): boolean {
    return !(block1.endLine < block2.startLine || block2.endLine < block1.startLine);
  }

  private determineMatchType(block1: CodeBlock, block2: CodeBlock, similarity: number): 'exact' | 'structural' | 'semantic' {
    if (block1.hash === block2.hash) {
      return 'exact';
    } else if (similarity > 0.9) {
      return 'structural';
    } else {
      return 'semantic';
    }
  }

  private async extractFunctions(filePath: string): Promise<FunctionInfo[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const functions: FunctionInfo[] = [];
    
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module'
      });
      
      this.traverseAST(ast, (node: any) => {
        if (node.type === 'FunctionDeclaration' && node.id) {
          const startLine = node.loc?.start?.line || 1;
          const endLine = node.loc?.end?.line || startLine;
          const functionCode = this.extractNodeCode(content, node);
          
          functions.push({
            name: node.id.name,
            file: filePath,
            startLine,
            endLine,
            code: functionCode,
            signature: this.extractFunctionSignature(node),
            complexity: this.estimateComplexity(functionCode)
          });
        }
      });
    } catch (error) {
      // Fallback to regex-based extraction
      const regexFunctions = this.extractFunctionsWithRegex(content, filePath);
      functions.push(...regexFunctions);
    }
    
    return functions;
  }

  private async extractClasses(filePath: string): Promise<ClassInfo[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const classes: ClassInfo[] = [];
    
    try {
      const ast = parse(content, {
        loc: true,
        range: true,
        ecmaVersion: 2022,
        sourceType: 'module'
      });
      
      this.traverseAST(ast, (node: any) => {
        if (node.type === 'ClassDeclaration' && node.id) {
          const startLine = node.loc?.start?.line || 1;
          const endLine = node.loc?.end?.line || startLine;
          const classCode = this.extractNodeCode(content, node);
          
          classes.push({
            name: node.id.name,
            file: filePath,
            startLine,
            endLine,
            code: classCode,
            methods: this.extractClassMethods(node),
            properties: this.extractClassProperties(node)
          });
        }
      });
    } catch (error) {
      // Fallback to regex-based extraction
      const regexClasses = this.extractClassesWithRegex(content, filePath);
      classes.push(...regexClasses);
    }
    
    return classes;
  }

  private calculateFunctionSimilarity(func1: FunctionInfo, func2: FunctionInfo): number {
    // Compare function signatures
    const signatureSimilarity = func1.signature === func2.signature ? 1.0 : 
      1 - (distance(func1.signature, func2.signature) / Math.max(func1.signature.length, func2.signature.length));
    
    // Compare function bodies
    const bodySimilarity = 1 - (distance(func1.code, func2.code) / Math.max(func1.code.length, func2.code.length));
    
    // Weighted combination
    return (signatureSimilarity * 0.3) + (bodySimilarity * 0.7);
  }

  private calculateClassSimilarity(class1: ClassInfo, class2: ClassInfo): number {
    // Compare method names
    const methodSimilarity = this.calculateArraySimilarity(class1.methods, class2.methods);
    
    // Compare property names
    const propertySimilarity = this.calculateArraySimilarity(class1.properties, class2.properties);
    
    // Compare class bodies
    const bodySimilarity = 1 - (distance(class1.code, class2.code) / Math.max(class1.code.length, class2.code.length));
    
    // Weighted combination
    return (methodSimilarity * 0.4) + (propertySimilarity * 0.3) + (bodySimilarity * 0.3);
  }

  private calculateArraySimilarity(arr1: string[], arr2: string[]): number {
    const set1 = new Set(arr1);
    const set2 = new Set(arr2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private mergeSimilarDuplicates(duplicates: DuplicateCode[]): DuplicateCode[] {
    // Group duplicates that are very similar
    const groups: DuplicateCode[][] = [];
    const processed = new Set<string>();
    
    for (const duplicate of duplicates) {
      if (processed.has(duplicate.id)) continue;
      
      const group = [duplicate];
      processed.add(duplicate.id);
      
      for (const other of duplicates) {
        if (processed.has(other.id)) continue;
        
        if (this.areDuplicatesSimilar(duplicate, other)) {
          group.push(other);
          processed.add(other.id);
        }
      }
      
      groups.push(group);
    }
    
    // Merge each group into a single duplicate
    return groups.map(group => this.mergeGroup(group));
  }

  private areDuplicatesSimilar(dup1: DuplicateCode, dup2: DuplicateCode): boolean {
    const contentSimilarity = 1 - (distance(dup1.content, dup2.content) / 
                                   Math.max(dup1.content.length, dup2.content.length));
    return contentSimilarity > 0.9;
  }

  private mergeGroup(group: DuplicateCode[]): DuplicateCode {
    if (group.length === 1) return group[0];
    
    const allFiles = new Set<string>();
    const allLines: number[] = [];
    let totalSimilarity = 0;
    
    for (const duplicate of group) {
      duplicate.files.forEach(file => allFiles.add(file));
      allLines.push(...duplicate.lines);
      totalSimilarity += duplicate.similarity;
    }
    
    return {
      id: this.generateId(),
      files: Array.from(allFiles),
      lines: allLines,
      content: group[0].content, // Use the first one as representative
      similarity: totalSimilarity / group.length
    };
  }

  // Additional helper methods
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private traverseAST(node: any, callback: (node: any) => void): void {
    if (!node || typeof node !== 'object') return;
    
    callback(node);
    
    for (const key in node) {
      if (key !== 'parent' && node[key]) {
        if (Array.isArray(node[key])) {
          for (const child of node[key]) {
            this.traverseAST(child, callback);
          }
        } else if (typeof node[key] === 'object') {
          this.traverseAST(node[key], callback);
        }
      }
    }
  }

  private extractNodeCode(content: string, node: any): string {
    if (node.range) {
      return content.substring(node.range[0], node.range[1]);
    }
    
    const lines = content.split('\n');
    const startLine = (node.loc?.start?.line || 1) - 1;
    const endLine = (node.loc?.end?.line || lines.length) - 1;
    
    return lines.slice(startLine, endLine + 1).join('\n');
  }

  private extractFunctionSignature(node: any): string {
    const name = node.id?.name || 'anonymous';
    const params = node.params.map((param: any) => param.name || 'param').join(', ');
    return `${name}(${params})`;
  }

  private extractClassMethods(node: any): string[] {
    const methods: string[] = [];
    
    if (node.body && node.body.body) {
      for (const member of node.body.body) {
        if (member.type === 'MethodDefinition' && member.key) {
          methods.push(member.key.name || 'method');
        }
      }
    }
    
    return methods;
  }

  private extractClassProperties(node: any): string[] {
    const properties: string[] = [];
    
    if (node.body && node.body.body) {
      for (const member of node.body.body) {
        if (member.type === 'PropertyDefinition' && member.key) {
          properties.push(member.key.name || 'property');
        }
      }
    }
    
    return properties;
  }

  private extractFunctionsWithRegex(content: string, filePath: string): FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const functionMatch = line.match(/function\s+(\w+)\s*\(([^)]*)\)/);
      
      if (functionMatch) {
        const name = functionMatch[1];
        const params = functionMatch[2];
        
        // Find function end (simplified)
        let endLine = i;
        let braceCount = 0;
        let foundStart = false;
        
        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          for (const char of currentLine) {
            if (char === '{') {
              braceCount++;
              foundStart = true;
            } else if (char === '}') {
              braceCount--;
              if (foundStart && braceCount === 0) {
                endLine = j;
                break;
              }
            }
          }
          if (foundStart && braceCount === 0) break;
        }
        
        const functionCode = lines.slice(i, endLine + 1).join('\n');
        
        functions.push({
          name,
          file: filePath,
          startLine: i + 1,
          endLine: endLine + 1,
          code: functionCode,
          signature: `${name}(${params})`,
          complexity: this.estimateComplexity(functionCode)
        });
      }
    }
    
    return functions;
  }

  private extractClassesWithRegex(content: string, filePath: string): ClassInfo[] {
    const classes: ClassInfo[] = [];
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const classMatch = line.match(/class\s+(\w+)/);
      
      if (classMatch) {
        const name = classMatch[1];
        
        // Find class end (simplified)
        let endLine = i;
        let braceCount = 0;
        let foundStart = false;
        
        for (let j = i; j < lines.length; j++) {
          const currentLine = lines[j];
          for (const char of currentLine) {
            if (char === '{') {
              braceCount++;
              foundStart = true;
            } else if (char === '}') {
              braceCount--;
              if (foundStart && braceCount === 0) {
                endLine = j;
                break;
              }
            }
          }
          if (foundStart && braceCount === 0) break;
        }
        
        const classCode = lines.slice(i, endLine + 1).join('\n');
        
        classes.push({
          name,
          file: filePath,
          startLine: i + 1,
          endLine: endLine + 1,
          code: classCode,
          methods: this.extractMethodsFromCode(classCode),
          properties: this.extractPropertiesFromCode(classCode)
        });
      }
    }
    
    return classes;
  }

  private extractMethodsFromCode(code: string): string[] {
    const methods: string[] = [];
    const methodPattern = /(\w+)\s*\([^)]*\)\s*{/g;
    let match;
    
    while ((match = methodPattern.exec(code)) !== null) {
      methods.push(match[1]);
    }
    
    return methods;
  }

  private extractPropertiesFromCode(code: string): string[] {
    const properties: string[] = [];
    const propertyPattern = /this\.(\w+)\s*=/g;
    let match;
    
    while ((match = propertyPattern.exec(code)) !== null) {
      if (!properties.includes(match[1])) {
        properties.push(match[1]);
      }
    }
    
    return properties;
  }

  private estimateComplexity(code: string): number {
    let complexity = 1;
    
    const complexityPatterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bfor\b/g,
      /\bwhile\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /&&/g,
      /\|\|/g
    ];
    
    for (const pattern of complexityPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  private calculateAverageSimilarity(functions: FunctionInfo[]): number {
    if (functions.length < 2) return 1.0;
    
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < functions.length; i++) {
      for (let j = i + 1; j < functions.length; j++) {
        totalSimilarity += this.calculateFunctionSimilarity(functions[i], functions[j]);
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalSimilarity / comparisons : 1.0;
  }

  private calculateAverageClassSimilarity(classes: ClassInfo[]): number {
    if (classes.length < 2) return 1.0;
    
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < classes.length; i++) {
      for (let j = i + 1; j < classes.length; j++) {
        totalSimilarity += this.calculateClassSimilarity(classes[i], classes[j]);
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalSimilarity / comparisons : 1.0;
  }

  private extractCommonCode(codes: string[]): string {
    if (codes.length === 0) return '';
    if (codes.length === 1) return codes[0];
    
    // Find the longest common substring
    let common = codes[0];
    
    for (let i = 1; i < codes.length; i++) {
      common = this.longestCommonSubstring(common, codes[i]);
    }
    
    return common;
  }

  private longestCommonSubstring(str1: string, str2: string): string {
    const matrix: number[][] = [];
    let maxLength = 0;
    let endIndex = 0;
    
    for (let i = 0; i <= str1.length; i++) {
      matrix[i] = [];
      for (let j = 0; j <= str2.length; j++) {
        if (i === 0 || j === 0) {
          matrix[i][j] = 0;
        } else if (str1[i - 1] === str2[j - 1]) {
          matrix[i][j] = matrix[i - 1][j - 1] + 1;
          if (matrix[i][j] > maxLength) {
            maxLength = matrix[i][j];
            endIndex = i;
          }
        } else {
          matrix[i][j] = 0;
        }
      }
    }
    
    return str1.substring(endIndex - maxLength, endIndex);
  }

  private findCommonMethods(classes: ClassInfo[]): string[] {
    if (classes.length === 0) return [];
    
    let commonMethods = new Set(classes[0].methods);
    
    for (let i = 1; i < classes.length; i++) {
      const classMethods = new Set(classes[i].methods);
      commonMethods = new Set([...commonMethods].filter(x => classMethods.has(x)));
    }
    
    return Array.from(commonMethods);
  }

  private suggestFunctionRefactoring(functions: FunctionInfo[]): string {
    if (functions.length === 2) {
      return `Extract common functionality from ${functions[0].name} and ${functions[1].name} into a shared utility function`;
    } else {
      return `Extract common functionality from ${functions.length} similar functions into a shared utility function`;
    }
  }

  private suggestClassRefactoring(classes: ClassInfo[]): string {
    const commonMethods = this.findCommonMethods(classes);
    
    if (commonMethods.length > 0) {
      return `Extract common methods (${commonMethods.join(', ')}) into a base class or mixin`;
    } else {
      return `Consider creating a common interface or abstract base class for these similar classes`;
    }
  }

  private async calculateTotalLines(): Promise<number> {
    // This would need to be implemented to count total lines in the project
    // For now, return a placeholder
    return 10000;
  }

  private generateRecommendations(duplicates: DuplicateCode[], severityBreakdown: any): string[] {
    const recommendations: string[] = [];
    
    if (severityBreakdown.high > 0) {
      recommendations.push(`Address ${severityBreakdown.high} high-severity duplicates immediately`);
    }
    
    if (severityBreakdown.medium > 5) {
      recommendations.push('Consider refactoring medium-severity duplicates to improve maintainability');
    }
    
    if (duplicates.length > 20) {
      recommendations.push('High number of duplicates detected - consider implementing code review processes');
    }
    
    recommendations.push('Use automated tools to detect duplicates during development');
    recommendations.push('Establish coding standards to prevent future duplication');
    
    return recommendations;
  }
}