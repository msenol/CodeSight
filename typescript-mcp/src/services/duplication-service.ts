/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable no-undef */
/* eslint-disable no-useless-escape */
import type { DuplicateCode, ASTNode } from '../types/index.js';
import { parse } from '@typescript-eslint/typescript-estree';
import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { distance } from 'fast-levenshtein';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as acorn from 'acorn';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as walk from 'acorn-walk';

export interface DuplicationService {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  detectDuplicates(_projectPath: string): Promise<DuplicateCode[]>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  analyzeFile(_filePath: string): Promise<DuplicateCode[]>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  compareFiles(_file1: string, _file2: string): Promise<DuplicateCode[]>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findSimilarFunctions(_projectPath: string, _threshold?: number): Promise<FunctionDuplicate[]>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findSimilarClasses(_projectPath: string, _threshold?: number): Promise<ClassDuplicate[]>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generateDuplicationReport(_duplicates: DuplicateCode[]): Promise<DuplicationReport>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  suggestRefactoring(_duplicate: DuplicateCode): Promise<RefactoringAdvice>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findDuplicateCode(_codebaseId: string, _options: Record<string, unknown>): Promise<DuplicateCode[]>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  findDuplicates(_files: string[], _options: Record<string, unknown>): Promise<DuplicateCode[]>;
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
  methods: string[];
  properties: string[];
}

export interface DuplicationReport {
  totalDuplicates: number;
  totalLinesAffected: number;
  savingsPotential: number;
  priorityRefactorings: RefactoringAdvice[];
  duplicatesByType: Map<string, DuplicateCode[]>;
}

export interface RefactoringAdvice {
  type: 'extract-method' | 'extract-class' | 'extract-module' | 'use-inheritance';
  description: string;
  impact: 'high' | 'medium' | 'low';
  estimatedEffort: 'low' | 'medium' | 'high';
  codeExample?: string;
}

interface CodeBlock {
  file: string;
  startLine: number;
  endLine: number;
  content: string;
  hash: string;
  ast?: ASTNode;
}

export class DuplicationServiceImpl implements DuplicationService {
  private readonly minLines: number = 5;
  private readonly similarityThreshold: number = 0.85;
  private readonly fileExtensions = ['.js', '.jsx', '.ts', '.tsx'];

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
        console.error(`Error processing file ${filePath}:`, error);
      }
    }

    // Find duplicates
    for (let i = 0; i < allBlocks.length; i++) {
      for (let j = i + 1; j < allBlocks.length; j++) {
        const similarity = this.calculateSimilarity(allBlocks[i].content, allBlocks[j].content);

        if (similarity >= this.similarityThreshold) {
          duplicates.push({
            id: `dup-${i}-${j}`,
            locations: [
              {
                file: allBlocks[i].file,
                startLine: allBlocks[i].startLine,
                endLine: allBlocks[i].endLine,
              },
              {
                file: allBlocks[j].file,
                startLine: allBlocks[j].startLine,
                endLine: allBlocks[j].endLine,
              },
            ],
            similarity,
            linesAffected: allBlocks[i].endLine - allBlocks[i].startLine + 1,
            suggestion: 'Consider extracting common code',
          });
        }
      }
    }

    return duplicates;
  }

  async analyzeFile(filePath: string): Promise<DuplicateCode[]> {
    const blocks = await this.extractCodeBlocks(filePath);
    const duplicates: DuplicateCode[] = [];

    // Find duplicates within the same file
    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const similarity = this.calculateSimilarity(blocks[i].content, blocks[j].content);

        if (similarity >= this.similarityThreshold) {
          duplicates.push({
            id: `file-dup-${i}-${j}`,
            locations: [
              {
                file: filePath,
                startLine: blocks[i].startLine,
                endLine: blocks[i].endLine,
              },
              {
                file: filePath,
                startLine: blocks[j].startLine,
                endLine: blocks[j].endLine,
              },
            ],
            similarity,
            linesAffected: blocks[i].endLine - blocks[i].startLine + 1,
            suggestion: 'Consider extracting common code to a reusable function',
          });
        }
      }
    }

    return duplicates;
  }

  async compareFiles(file1: string, file2: string): Promise<DuplicateCode[]> {
    const blocks1 = await this.extractCodeBlocks(file1);
    const blocks2 = await this.extractCodeBlocks(file2);
    const duplicates: DuplicateCode[] = [];

    for (const block1 of blocks1) {
      for (const block2 of blocks2) {
        const similarity = this.calculateSimilarity(block1.content, block2.content);

        if (similarity >= this.similarityThreshold) {
          duplicates.push({
            id: `cross-file-${block1.hash}-${block2.hash}`,
            locations: [
              {
                file: file1,
                startLine: block1.startLine,
                endLine: block1.endLine,
              },
              {
                file: file2,
                startLine: block2.startLine,
                endLine: block2.endLine,
              },
            ],
            similarity,
            linesAffected: block1.endLine - block1.startLine + 1,
            suggestion: 'Consider extracting common code to a shared module',
          });
        }
      }
    }

    return duplicates;
  }

  async findSimilarFunctions(projectPath: string, threshold = 0.8): Promise<FunctionDuplicate[]> {
    const files = await this.getProjectFiles(projectPath);
    const allFunctions: FunctionInfo[] = [];

    for (const file of files) {
      const functions = await this.extractFunctions(file);
      allFunctions.push(...functions);
    }

    const duplicates: FunctionDuplicate[] = [];

    for (let i = 0; i < allFunctions.length; i++) {
      for (let j = i + 1; j < allFunctions.length; j++) {
        const similarity = this.calculateSimilarity(allFunctions[i].code, allFunctions[j].code);

        if (similarity >= threshold) {
          duplicates.push({
            id: `func-dup-${i}-${j}`,
            functions: [allFunctions[i], allFunctions[j]],
            similarity,
            commonCode: this.findCommonCode(allFunctions[i].code, allFunctions[j].code),
            suggestedRefactoring: 'Extract common logic to a shared function',
          });
        }
      }
    }

    return duplicates;
  }

  async findSimilarClasses(projectPath: string, threshold = 0.7): Promise<ClassDuplicate[]> {
    const files = await this.getProjectFiles(projectPath);
    const allClasses: ClassInfo[] = [];

    for (const file of files) {
      const classes = await this.extractClasses(file);
      allClasses.push(...classes);
    }

    const duplicates: ClassDuplicate[] = [];

    for (let i = 0; i < allClasses.length; i++) {
      for (let j = i + 1; j < allClasses.length; j++) {
        const commonMethods = this.findCommonMethods(allClasses[i], allClasses[j]);
        const similarity =
          commonMethods.length /
          Math.max(allClasses[i].methods.length, allClasses[j].methods.length);

        if (similarity >= threshold) {
          duplicates.push({
            id: `class-dup-${i}-${j}`,
            classes: [allClasses[i], allClasses[j]],
            similarity,
            commonMethods,
            suggestedRefactoring: 'Consider using inheritance or composition',
          });
        }
      }
    }

    return duplicates;
  }

  async generateDuplicationReport(duplicates: DuplicateCode[]): Promise<DuplicationReport> {
    const totalLinesAffected = duplicates.reduce((sum, dup) => sum + dup.linesAffected, 0);
    const savingsPotential = Math.round(totalLinesAffected * 0.4); // Estimate 40% reduction

    const duplicatesByType = new Map<string, DuplicateCode[]>();
    for (const dup of duplicates) {
      const type = this.categorizeDuplicate(dup);
      if (!duplicatesByType.has(type)) {
        duplicatesByType.set(type, []);
      }
      duplicatesByType.get(type)!.push(dup);
    }

    const priorityRefactorings: RefactoringAdvice[] = [];
    for (const dup of duplicates.slice(0, 5)) {
      // Top 5 priorities
      const advice = await this.suggestRefactoring(dup);
      priorityRefactorings.push(advice);
    }

    return {
      totalDuplicates: duplicates.length,
      totalLinesAffected,
      savingsPotential,
      priorityRefactorings,
      duplicatesByType,
    };
  }

  async suggestRefactoring(duplicate: DuplicateCode): Promise<RefactoringAdvice> {
    const { locations } = duplicate;

    let description = 'No specific refactoring suggestion available';
    let type: RefactoringAdvice['type'] = 'extract-method';
    let impact: RefactoringAdvice['impact'] = 'low';
    let estimatedEffort: RefactoringAdvice['estimatedEffort'] = 'low';

    if (locations.length === 0) {
      return { type, description, impact, estimatedEffort };
    }

    const sameFile = locations.every(loc => loc.file === locations[0].file);

    if (sameFile) {
      if (duplicate.linesAffected < 10) {
        description = 'Extract this code into a private helper method';
        type = 'extract-method';
        impact = 'low';
        estimatedEffort = 'low';
      } else {
        description = 'Extract this code into a separate method with clear parameters';
        type = 'extract-method';
        impact = 'medium';
        estimatedEffort = 'medium';
      }
    } else {
      if (duplicate.linesAffected < 10) {
        description = 'Create a utility function in a shared module';
        type = 'extract-module';
        impact = 'medium';
        estimatedEffort = 'low';
      } else {
        description = 'Consider creating a dedicated service or module for this functionality';
        type = 'extract-module';
        impact = 'high';
        estimatedEffort = 'high';
      }
    }

    return { type, description, impact, estimatedEffort };
  }

  async findDuplicateCode(codebaseId: string, options: Record<string, unknown>): Promise<DuplicateCode[]> {
    // Implementation for MCP tool compatibility
    const duplicates = await this.detectDuplicates(codebaseId);
    return duplicates.map(dup => ({
      ...dup,
      codebaseId,
    }));
  }

  async findDuplicates(files: string[], options: Record<string, unknown>): Promise<DuplicateCode[]> {
    const allDuplicates: DuplicateCode[] = [];

    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const duplicates = await this.compareFiles(files[i], files[j]);
        allDuplicates.push(...duplicates);
      }
    }

    return allDuplicates;
  }

  // Private helper methods
  private async getProjectFiles(projectPath: string): Promise<string[]> {
    const patterns = this.fileExtensions.map(ext => `**/*${ext}`);
    const files: string[] = [];

    for (const pattern of patterns) {
      const matched = await glob(pattern, {
        cwd: projectPath,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
      });
      files.push(...matched.map(f => path.join(projectPath, f)));
    }

    return files;
  }

  private async extractCodeBlocks(filePath: string): Promise<CodeBlock[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const blocks: CodeBlock[] = [];

    // Simple block extraction - can be improved with AST
    for (let i = 0; i < lines.length - this.minLines; i++) {
      const block = lines.slice(i, i + this.minLines).join('\n');
      blocks.push({
        file: filePath,
        startLine: i + 1,
        endLine: i + this.minLines,
        content: block,
        hash: this.hashContent(block),
      });
    }

    return blocks;
  }

  private async extractFunctions(filePath: string): Promise<FunctionInfo[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const functions: FunctionInfo[] = [];

    try {
      const ast = parse(content, {
        jsx: filePath.endsWith('.jsx') || filePath.endsWith('.tsx'),
        loc: true,
      });

      // Traverse AST to find functions
      // This is a simplified version - real implementation would be more comprehensive
    } catch (error) {
      console.error(`Error parsing ${filePath}:`, error);
    }

    return functions;
  }

  private async extractClasses(filePath: string): Promise<ClassInfo[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const classes: ClassInfo[] = [];

    try {
      const ast = parse(content, {
        jsx: filePath.endsWith('.jsx') || filePath.endsWith('.tsx'),
        loc: true,
      });

      // Traverse AST to find classes
      // This is a simplified version - real implementation would be more comprehensive
    } catch (error) {
      console.error(`Error parsing ${filePath}:`, error);
    }

    return classes;
  }

  private calculateSimilarity(text1: string, text2: string): number {
    const maxLength = Math.max(text1.length, text2.length);
    if (maxLength === 0) {return 1;}

    const editDistance = distance(text1, text2);
    return 1 - editDistance / maxLength;
  }

  private hashContent(content: string): string {
    // Simple hash for demo - use crypto.createHash in production
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }

  private findCommonCode(code1: string, code2: string): string {
    // Simplified LCS algorithm
    const lines1 = code1.split('\n');
    const lines2 = code2.split('\n');
    const common: string[] = [];

    for (const line1 of lines1) {
      if (lines2.includes(line1) && line1.trim().length > 0) {
        common.push(line1);
      }
    }

    return common.join('\n');
  }

  private findCommonMethods(class1: ClassInfo, class2: ClassInfo): string[] {
    return class1.methods.filter(method => class2.methods.includes(method));
  }

  private categorizeDuplicate(duplicate: DuplicateCode): string {
    if (duplicate.linesAffected < 10) {return 'small';}
    if (duplicate.linesAffected < 50) {return 'medium';}
    return 'large';
  }
}

export const duplicationService = new DuplicationServiceImpl();
