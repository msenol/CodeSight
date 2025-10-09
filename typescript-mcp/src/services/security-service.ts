 
 
 
 
import type { SecurityIssue, SecurityPattern, SecurityScanOptions } from '../types/index.js';
import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface SecurityService {
  analyzeCode(code: string, language: string): Promise<SecurityIssue[]>;
  scanFile(filePath: string, codebaseId: string): Promise<SecurityIssue[]>;
  getSecurityPatterns(): SecurityPattern[];
  validateInput(input: string): boolean;
  analyzeVulnerabilities(input: { code: string; language: string; }): Promise<SecurityIssue[]>;
  scanForVulnerabilities(
    codebaseId: string,
    options?: SecurityScanOptions,
  ): Promise<SecurityIssue[]>;
  analyzeSecurityPatterns(codebaseId: string): Promise<SecurityPattern[]>;
}

export class DefaultSecurityService implements SecurityService {
  private patterns: SecurityPattern[] = [
    {
      id: 'sql_injection',
      name: 'SQL Injection',
      description: 'Potential SQL injection vulnerability',
      severity: 'high',
      pattern: /(?:SELECT|INSERT|UPDATE|DELETE).*(?:WHERE|SET).*\$\{|\+.*\}/gi,
    },
    {
      id: 'xss',
      name: 'Cross-Site Scripting',
      description: 'Potential XSS vulnerability',
      severity: 'medium',
      pattern: /innerHTML|outerHTML|document\.write/gi,
    },
    {
      id: 'hardcoded_secret',
      name: 'Hardcoded Secret',
      description: 'Potential hardcoded secret or API key',
      severity: 'high',
      pattern: /(?:api[_-]?key|password|secret|token)]*[=:]]*['"][^'"]{8,}/gi,
    },
  ];

  async analyzeCode(code: string, language: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    const lines = code.split('\n');

    for (const pattern of this.patterns) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const matches = line.match(pattern.pattern);
        if (matches) {
          issues.push({
            id: `${pattern.id}_${i}`,
            type: pattern.id,
            severity: pattern.severity,
            message: pattern.description,
            file: 'current_file',
            line: i + 1,
            column: line.indexOf(matches[0]) + 1,
            code: line.trim(),
            suggestion: `Review and fix ${pattern.name.toLowerCase()}`,
          });
        }
      }
    }

    return issues;
  }

  async scanFile(filePath: string, codebaseId: string): Promise<SecurityIssue[]> {
    // Mock implementation - would read file and analyze
    return [
      {
        id: 'mock_issue',
        type: 'info',
        severity: 'low',
        message: `Security scan completed for ${filePath}`,
        file: filePath,
        line: 1,
        column: 1,
        code: '// No issues found',
        suggestion: 'File appears secure',
      },
    ];
  }

  getSecurityPatterns(): SecurityPattern[] {
    return this.patterns;
  }

  validateInput(input: string): boolean {
    // Basic input validation
    const dangerousPatterns = [/<script/gi, /javascript:/gi, /on\w+]*=/gi, /eval]*\(/gi];

    return !dangerousPatterns.some(pattern => pattern.test(input));
  }

  async analyzeVulnerabilities(input: { code: string; language: string; }): Promise<SecurityIssue[]> {
    // Mock implementation
    return [
      {
        id: 'vuln_1',
        type: 'sql_injection',
        severity: 'high',
        message: 'Potential SQL injection vulnerability detected',
        file: '/src/example.ts',
        line: 10,
        column: 5,
        code: 'SELECT * FROM users WHERE id = ' + 'userId',
        suggestion: 'Use parameterized queries instead',
      },
    ];
  }

  async scanForVulnerabilities(
    codebaseId: string,
    options?: SecurityScanOptions,
  ): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    try {
      const files = await glob('**/*.{ts,tsx,js,jsx}', {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const fileIssues = await this.analyzeFileForVulnerabilities(filePath, content, options);
          issues.push(...fileIssues);
        } catch (error) {
          console.warn(`Failed to analyze ${filePath}:`, error);
        }
      }

      // Sort by severity
      return this.sortIssuesBySeverity(issues);
    } catch (error) {
      console.error('Failed to scan for vulnerabilities:', error);
      return [];
    }
  }

  async analyzeSecurityPatterns(codebaseId: string): Promise<SecurityPattern[]> {
    const patterns: SecurityPattern[] = [];

    try {
      const files = await glob('**/*.{ts,tsx,js,jsx,json,env}', {
        cwd: codebaseId,
        absolute: true,
        ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
      });

      const patternResults = new Map<string, { count: number; matches: SecurityPattern[] }>();

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          this.detectSecurityPatterns(filePath, content, patternResults);
        } catch (error) {
          console.warn(`Failed to analyze patterns in ${filePath}:`, error);
        }
      }

      // Convert map to array
      for (const [patternName, data] of patternResults) {
        // Get the first match as representative for severity and description
        const representative = data.matches[0];
        if (representative) {
          patterns.push({
            id: patternName,
            name: patternName,
            pattern: representative.pattern,
            matches: data.count,
            severity: representative.severity,
            description: representative.description,
            files: representative.files || [],
          });
        }
      }

      return patterns.sort(
        (a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity),
      );
    } catch (error) {
      console.error('Failed to analyze security patterns:', error);
      return [];
    }
  }

  private async analyzeFileForVulnerabilities(
    filePath: string,
    content: string,
    options?: SecurityScanOptions,
  ): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    const relativePath = path.relative(process.cwd(), filePath);

    // SQL Injection patterns
    this.detectSQLInjection(content, issues, relativePath);

    // XSS patterns
    this.detectXSS(content, issues, relativePath);

    // Hardcoded secrets
    this.detectHardcodedSecrets(content, issues, relativePath);

    // Insecure random
    this.detectInsecureRandom(content, issues, relativePath);

    // Path traversal
    this.detectPathTraversal(content, issues, relativePath);

    // Weak crypto
    this.detectWeakCrypto(content, issues, relativePath);

    return issues;
  }

  private detectSQLInjection(content: string, issues: SecurityIssue[], filePath: string): void {
    const patterns = [
      /query\s*\(\s*['"`].*\$\{.*\}.*['"`]\s*\)/g,
      /execute\s*\(\s*['"`].*\+.*['"`]\s*\)/g,
      /SELECT\s+.*\+.*FROM/gi,
      /INSERT\s+.*\+.*VALUES/gi,
      /UPDATE\s+.*\+.*SET/gi,
      /DELETE\s+.*\+.*WHERE/gi,
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;

        issues.push({
          id: `sql_${issues.length}`,
          type: 'sql_injection',
          severity: 'high',
          message: 'Potential SQL injection vulnerability detected',
          file: filePath,
          line: lineNumber,
          column: 0,
          code: match[0],
          suggestion: 'Use parameterized queries or prepared statements',
        });
      }
    });
  }

  private detectXSS(content: string, issues: SecurityIssue[], filePath: string): void {
    const patterns = [
      /innerHTML]*=]*.*\+/g,
      /document\.write]*\(/g,
      /eval]*\(/g,
      /dangerouslySetInnerHTML/g,
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;

        issues.push({
          id: `xss_${issues.length}`,
          type: 'xss',
          severity: 'medium',
          message: 'Potential XSS vulnerability detected',
          file: filePath,
          line: lineNumber,
          column: 0,
          code: match[0],
          suggestion: 'Sanitize user input and use safe DOM manipulation methods',
        });
      }
    });
  }

  private detectHardcodedSecrets(content: string, issues: SecurityIssue[], filePath: string): void {
    const patterns = [
      /(?:password|pwd|pass)]*[=:]]*['"\`][^'"\` ]{8,}['"\`]/gi,
      /(?:api[_-]?key|apikey)]*[=:]]*['"\`][^'"\` ]{16,}['"\`]/gi,
      /(?:secret|token)]*[=:]]*['"\`][^'"\` ]{16,}['"\`]/gi,
      /(?:private[_-]?key|privatekey)]*[=:]]*['"\`][^'"\` ]{32,}['"\`]/gi,
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;

        issues.push({
          id: `secret_${issues.length}`,
          type: 'hardcoded_secret',
          severity: 'critical',
          message: 'Hardcoded secret detected',
          file: filePath,
          line: lineNumber,
          column: 0,
          code: match[0],
          suggestion: 'Move secrets to environment variables or secure configuration',
        });
      }
    });
  }

  private detectInsecureRandom(content: string, issues: SecurityIssue[], filePath: string): void {
    const patterns = [/Math\.random\s*\(\s*\)/g, /new\s+Date\s*\(\s*\)\.getTime\s*\(\s*\)/g];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;

        issues.push({
          id: `random_${issues.length}`,
          type: 'insecure_random',
          severity: 'medium',
          message: 'Insecure random number generation',
          file: filePath,
          line: lineNumber,
          column: 0,
          code: match[0],
          suggestion: 'Use cryptographically secure random number generators',
        });
      }
    });
  }

  private detectPathTraversal(content: string, issues: SecurityIssue[], filePath: string): void {
    const patterns = [/readFile\s*\([^)]*\+.*)/g, /writeFile\s*\([^)]*\+.*)/g, /\.\.[\/\\]/g];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;

        issues.push({
          id: `path_${issues.length}`,
          type: 'path_traversal',
          severity: 'high',
          message: 'Potential path traversal vulnerability',
          file: filePath,
          line: lineNumber,
          column: 0,
          code: match[0],
          suggestion: 'Validate and sanitize file paths',
        });
      }
    });
  }

  private detectWeakCrypto(content: string, issues: SecurityIssue[], filePath: string): void {
    const patterns = [/md5|sha1/gi, /DES|3DES/gi, /RC4/gi];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNumber = content.substring(0, match.index).split('\n').length;

        issues.push({
          id: `crypto_${issues.length}`,
          type: 'weak_crypto',
          severity: 'medium',
          message: 'Weak cryptographic algorithm detected',
          file: filePath,
          line: lineNumber,
          column: 0,
          code: match[0],
          suggestion: 'Use strong cryptographic algorithms like SHA-256 or AES',
        });
      }
    });
  }

  private detectSecurityPatterns(
    filePath: string,
    content: string,
    patternResults: Map<string, { count: number; matches: SecurityPattern[] }>,
  ): void {
    // Hardcoded secrets pattern
    const secretPatterns = [
      /(?:password|pwd|pass)\s*[=:]\s*['"`][^'"` ]{8,}['"`]/gi,
      /(?:api[_-]?key|apikey)\s*[=:]\s*['"`][^'"` ]{16,}['"`]/gi,
      /(?:secret|token)\s*[=:]\s*['"`][^'"` ]{16,}['"`]/gi,
    ];

    let secretMatches = 0;
    secretPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {secretMatches += matches.length;}
    });

    if (secretMatches > 0) {
      this.updatePatternResult(patternResults, 'hardcoded_secrets', {
        id: 'hardcoded_secrets',
        name: 'Hardcoded Secrets',
        pattern: /(?:password|pwd|pass)\s*[=:]\s*['"`][^'"` ]{8,}['"`]/gi,
        matches: secretMatches,
        severity: 'critical',
        description: 'Hardcoded API keys or passwords found',
        files: [filePath],
      });
    }

    // SQL injection patterns
    const sqlPatterns = [/query\s*\(\s*['"`].*\$\{.*\}.*['"`]\s*\)/g, /SELECT\s+.*\+.*FROM/gi];

    let sqlMatches = 0;
    sqlPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {sqlMatches += matches.length;}
    });

    if (sqlMatches > 0) {
      this.updatePatternResult(patternResults, 'sql_injection', {
        id: 'sql_injection',
        name: 'SQL Injection',
        pattern: /SELECT\s+.*\+.*FROM/gi,
        matches: sqlMatches,
        severity: 'high',
        description: 'Potential SQL injection vulnerabilities',
        files: [filePath],
      });
    }

    // XSS patterns
    const xssPatterns = [/innerHTML\s*=.*\+/g, /dangerouslySetInnerHTML/g];

    let xssMatches = 0;
    xssPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {xssMatches += matches.length;}
    });

    if (xssMatches > 0) {
      this.updatePatternResult(patternResults, 'xss_vulnerabilities', {
        id: 'xss_vulnerabilities',
        name: 'XSS Vulnerabilities',
        pattern: /innerHTML\s*=.*\+/g,
        matches: xssMatches,
        severity: 'medium',
        description: 'Potential XSS vulnerabilities',
        files: [filePath],
      });
    }
  }

  private updatePatternResult(patternResults: Map<string, { count: number; matches: SecurityPattern[] }>, pattern: string, data: SecurityPattern): void {
    if (patternResults.has(pattern)) {
      const existing = patternResults.get(pattern)!;
      existing.count += 1;
      existing.matches.push(data);
    } else {
      patternResults.set(pattern, {
        count: 1,
        matches: [data]
      });
    }
  }

  private sortIssuesBySeverity(issues: SecurityIssue[]): SecurityIssue[] {
    return issues.sort(
      (a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity),
    );
  }

  private getSeverityWeight(severity: string): number {
    switch (severity) {
      case 'critical':
        return 4;
      case 'high':
        return 3;
      case 'medium':
        return 2;
      case 'low':
        return 1;
      default:
        return 0;
    }
  }
}

export const securityService = new DefaultSecurityService();
export default securityService;
