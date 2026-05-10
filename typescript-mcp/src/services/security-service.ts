import type { SecurityIssue, SecurityPattern, SecurityScanOptions } from '../types/index.js';
import { promises as fs } from 'fs';
import * as path from 'path';
import { glob } from 'glob';

export interface SecurityService {
  analyzeCode(code: string, language: string): Promise<SecurityIssue[]>;
  scanFile(filePath: string, codebaseId: string): Promise<SecurityIssue[]>;
  getSecurityPatterns(): SecurityPattern[];
  validateInput(input: string): boolean;
  analyzeVulnerabilities(input: { code: string; language: string }): Promise<SecurityIssue[]>;
  scanForVulnerabilities(
    codebaseId: string,
    options?: SecurityScanOptions,
  ): Promise<SecurityIssue[]>;
  analyzeSecurityPatterns(codebaseId: string): Promise<SecurityPattern[]>;
}

export class DefaultSecurityService implements SecurityService {
  async analyzeCode(_code: string, _language: string): Promise<SecurityIssue[]> {
    return [];
  }

  async scanFile(filePath: string, _codebaseId: string): Promise<SecurityIssue[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return await this.analyzeFileForVulnerabilities(filePath, content);
    } catch {
      return [];
    }
  }

  getSecurityPatterns(): SecurityPattern[] {
    return [];
  }

  validateInput(input: string): boolean {
    const dangerousPatterns = [/<script/gi, /javascript:/gi, /\bon\w+\s*=/gi, /\beval\s*\(/gi];
    return !dangerousPatterns.some(pattern => pattern.test(input));
  }

  async analyzeVulnerabilities(input: {
    code: string;
    language: string;
  }): Promise<SecurityIssue[]> {
    return this.analyzeFileForVulnerabilities('input', input.code);
  }

  async scanForVulnerabilities(
    codebaseId: string,
    _options?: SecurityScanOptions,
  ): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];

    try {
      // Resolve codebase path from DB if codebaseId is not a valid directory
      let codebasePath = codebaseId;
      try {
        await fs.access(codebaseId);
      } catch {
        // Not a path — look up in database
        try {
          const { getIndexingService } = await import('./indexing-service.js');
          const db = getIndexingService().db;
          const row = db
            .prepare('SELECT path FROM codebases WHERE LOWER(id) = LOWER(?)')
            .get(codebaseId) as { path: string } | undefined;
          if (row?.path) {
            codebasePath = row.path;
          } else {
            // Fallback: scan files from indexed entities
            const entities = db
              .prepare(
                'SELECT DISTINCT file_path FROM code_entities WHERE LOWER(codebase_id) = LOWER(?) LIMIT 200',
              )
              .all(codebaseId) as { file_path: string }[];
            for (const entity of entities) {
              try {
                const content = await fs.readFile(entity.file_path, 'utf-8');
                const fileIssues = await this.analyzeFileForVulnerabilities(
                  entity.file_path,
                  content,
                );
                issues.push(...fileIssues);
              } catch {
                /* skip */
              }
            }
            return this.sortIssuesBySeverity(issues);
          }
        } catch {
          /* DB not available */
        }
      }

      const files = await glob('**/*.{ts,tsx,js,jsx,py,java,go,rs}', {
        cwd: codebasePath,
        absolute: true,
        ignore: [
          '**/node_modules/**',
          '**/dist/**',
          '**/.git/**',
          '**/coverage/**',
          '**/*.test.*',
          '**/*.spec.*',
          '**/vendor/**',
        ],
      });

      for (const filePath of files) {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const fileIssues = await this.analyzeFileForVulnerabilities(filePath, content);
          issues.push(...fileIssues);
        } catch {
          /* skip unreadable files */
        }
      }

      return this.sortIssuesBySeverity(issues);
    } catch (error) {
      console.error('Failed to scan for vulnerabilities:', error);
      return [];
    }
  }

  async analyzeSecurityPatterns(codebaseId: string): Promise<SecurityPattern[]> {
    const results = await this.scanForVulnerabilities(codebaseId);
    const grouped = new Map<string, SecurityPattern>();

    for (const issue of results) {
      const key = issue.type;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          name: issue.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          pattern: new RegExp(issue.type.replace(/_/g, '_'), 'gi'),
          matches: 1,
          severity: issue.severity,
          description: issue.message,
          files: [issue.file],
        });
      } else {
        const existing = grouped.get(key)!;
        existing.matches++;
        if (!existing.files?.includes(issue.file)) {
          existing.files?.push(issue.file);
        }
      }
    }

    return Array.from(grouped.values()).sort(
      (a, b) => this.getSeverityWeight(b.severity) - this.getSeverityWeight(a.severity),
    );
  }

  private async analyzeFileForVulnerabilities(
    filePath: string,
    content: string,
  ): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    const relativePath = path.relative(process.cwd(), filePath);
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmed = line.trim();

      // SQL Injection — string concatenation in SQL queries
      if (
        /\bSELECT\b.*\+\s*\w/i.test(trimmed) ||
        /\bINSERT\b.*\+\s*\w/i.test(trimmed) ||
        /\bUPDATE\b.*\+\s*\w/i.test(trimmed) ||
        /\bDELETE\b.*\+\s*\w/i.test(trimmed) ||
        /['"`]SELECT\s/i.test(trimmed) ||
        /['"`]INSERT\s/i.test(trimmed) ||
        /['"`]UPDATE\s/i.test(trimmed) ||
        /['"`]DELETE\s/i.test(trimmed)
      ) {
        issues.push({
          id: `sql_${lineNum}`,
          type: 'sql_injection',
          severity: 'high',
          message: 'SQL injection: string concatenation in SQL query',
          file: relativePath,
          line: lineNum,
          column: 0,
          code: trimmed.substring(0, 100),
          suggestion: 'Use parameterized queries or prepared statements',
        });
      }

      // eval() / Function() — RCE
      if (/\beval\s*\(/.test(trimmed) || /\bnew\s+Function\s*\(/.test(trimmed)) {
        issues.push({
          id: `eval_${lineNum}`,
          type: 'remote_code_execution',
          severity: 'critical',
          message: 'Remote code execution: eval() or Function() usage',
          file: relativePath,
          line: lineNum,
          column: 0,
          code: trimmed.substring(0, 100),
          suggestion: 'Avoid eval() and new Function(). Use safe alternatives.',
        });
      }

      // Command injection
      if (
        /\bexec\s*\([^)]*\+/i.test(trimmed) ||
        /\bexecSync\s*\([^)]*\+/i.test(trimmed) ||
        /\bspawn\s*\([^)]*\+/i.test(trimmed) ||
        /\bsystem\s*\([^)]*\+/i.test(trimmed)
      ) {
        issues.push({
          id: `cmdi_${lineNum}`,
          type: 'command_injection',
          severity: 'critical',
          message: 'Command injection: dynamic input in shell command',
          file: relativePath,
          line: lineNum,
          column: 0,
          code: trimmed.substring(0, 100),
          suggestion: 'Use child_process.execFile with arguments array, never shell strings.',
        });
      }

      // Hardcoded secrets
      if (
        /(?:password|pwd|secret|api_?key|apikey|aws_secret|db_password|access_token)\s*[=:]\s*['"][^'"]{4,}['"]/i.test(
          trimmed,
        )
      ) {
        issues.push({
          id: `secret_${lineNum}`,
          type: 'hardcoded_secret',
          severity: 'critical',
          message: 'Hardcoded secret/API key detected',
          file: relativePath,
          line: lineNum,
          column: 0,
          code: trimmed.replace(/['"][^'"]{8,}['"]/g, "'***REDACTED***'").substring(0, 100),
          suggestion: 'Move secrets to environment variables or vault.',
        });
      }

      // Weak crypto: MD5, SHA1, DES
      if (/\bmd5\b/i.test(trimmed) || /\bsha1\b/i.test(trimmed) || /\bDES\b/.test(trimmed)) {
        issues.push({
          id: `crypto_${lineNum}`,
          type: 'weak_crypto',
          severity: 'medium',
          message: 'Weak cryptographic algorithm detected (MD5/SHA1/DES)',
          file: relativePath,
          line: lineNum,
          column: 0,
          code: trimmed.substring(0, 100),
          suggestion: 'Use SHA-256 or stronger algorithms.',
        });
      }

      // Insecure random
      if (/\bMath\.random\s*\(\s*\)/.test(trimmed)) {
        issues.push({
          id: `random_${lineNum}`,
          type: 'insecure_random',
          severity: 'medium',
          message: 'Insecure random: Math.random() not cryptographically secure',
          file: relativePath,
          line: lineNum,
          column: 0,
          code: trimmed.substring(0, 100),
          suggestion: 'Use crypto.randomBytes() or window.crypto.getRandomValues().',
        });
      }

      // Path traversal
      if (
        /\breadFile\s*\([^)]*\+\s*\w/.test(trimmed) ||
        /\bwriteFile\s*\([^)]*\+\s*\w/.test(trimmed) ||
        /\.\.[/\\]/.test(trimmed)
      ) {
        issues.push({
          id: `path_${lineNum}`,
          type: 'path_traversal',
          severity: 'high',
          message: 'Path traversal: dynamic path construction',
          file: relativePath,
          line: lineNum,
          column: 0,
          code: trimmed.substring(0, 100),
          suggestion: 'Validate and sanitize file paths. Use path.resolve() and check boundaries.',
        });
      }

      // Open redirect
      if (/redirect\s*\([^)]*\breq\.|res\.redirect\s*\([^)]*\breq\./i.test(trimmed)) {
        issues.push({
          id: `redirect_${lineNum}`,
          type: 'open_redirect',
          severity: 'medium',
          message: 'Open redirect: unvalidated redirect target',
          file: relativePath,
          line: lineNum,
          column: 0,
          code: trimmed.substring(0, 100),
          suggestion: 'Whitelist allowed redirect URLs.',
        });
      }

      // innerHTML / document.write
      if (/\.innerHTML\s*=/.test(trimmed) || /document\.write\s*\(/.test(trimmed)) {
        issues.push({
          id: `xss_${lineNum}`,
          type: 'xss',
          severity: 'medium',
          message: 'XSS: unsafe DOM manipulation',
          file: relativePath,
          line: lineNum,
          column: 0,
          code: trimmed.substring(0, 100),
          suggestion: 'Use textContent or DOMPurify.sanitize() for user content.',
        });
      }
    }

    return issues;
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
