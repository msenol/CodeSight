/**
 * Enhanced Security Analyzer - Phase 4.1
 * AI-powered vulnerability detection and security analysis
 */

import { CodeAnalysisService } from './code-analysis.js';
import { AILLMService } from './ai-llm.js';
import { logger } from './logger.js';

export interface SecurityAnalysisRequest {
  file_path?: string;
  code_snippet?: string;
  codebase_id: string;
  depth: 'standard' | 'deep';
}

export interface SecurityVulnerability {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'injection' | 'authentication' | 'authorization' | 'data-exposure' | 'crypto' | 'configuration';
  cwe_id?: string;
  line_number?: number;
  code_snippet?: string;
  remediation: string;
  references: string[];
  confidence: number;
  exploitability: 'high' | 'medium' | 'low';
  impact: 'high' | 'medium' | 'low';
}

export interface SecurityAnalysisResult {
  overall_score: number; // 0-100
  vulnerabilities: SecurityVulnerability[];
  risk_assessment: {
    critical_issues: number;
    high_issues: number;
    medium_issues: number;
    low_issues: number;
  };
  security_posture: 'excellent' | 'good' | 'moderate' | 'poor' | 'critical';
  recommendations: Array<{
    priority: 'immediate' | 'short-term' | 'long-term';
    action: string;
    rationale: string;
    estimated_effort: 'low' | 'medium' | 'high';
  }>;
  compliance: {
    standards_checked: string[];
    compliance_score: number;
    gaps: string[];
  };
}

/**
 * AI-Enhanced Security Analyzer
 */
export class SecurityAnalyzer {
  private codeAnalyzer: CodeAnalysisService;
  private aiService: AILLMService;

  constructor() {
    this.codeAnalyzer = new CodeAnalysisService();
    this.aiService = new AILLMService();
  }

  async analyze(request: SecurityAnalysisRequest): Promise<SecurityAnalysisResult> {
    logger.info('Security analysis started', {
      file_path: request.file_path,
      depth: request.depth,
      codebase_id: request.codebase_id
    });

    try {
      // 1. Static Analysis - Pattern-based detection
      const staticVulns = await this.performStaticAnalysis(request);

      // 2. AI-Powered Analysis - Contextual vulnerability detection
      const aiVulns = await this.performAIAnalysis(request);

      // 3. Data Flow Analysis - Track sensitive data
      const dataFlowVulns = await this.performDataFlowAnalysis(request);

      // 4. Dependency Analysis - Check vulnerable dependencies
      const dependencyVulns = await this.analyzeDependencies(request);

      // 5. Consolidate and prioritize
      const allVulnerabilities = [...staticVulns, ...aiVulns, ...dataFlowVulns, ...dependencyVulns];
      const deduplicatedVulns = this.deduplicateVulnerabilities(allVulnerabilities);

      // 6. Generate comprehensive report
      const result = await this.generateSecurityReport(deduplicatedVulns, request);

      logger.info('Security analysis completed', {
        overall_score: result.overall_score,
        vulnerabilities_count: result.vulnerabilities.length,
        security_posture: result.security_posture
      });

      return result;

    } catch (error) {
      logger.error('Security analysis failed:', error);
      throw new Error(`Security analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async performStaticAnalysis(request: SecurityAnalysisRequest): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];
    const code = request.code_snippet || await this.getFileContent(request.file_path!);

    // SQL Injection patterns
    const sqlInjectionPatterns = [
      /SELECT.*FROM.*WHERE.*\+/gi,
      /INSERT.*INTO.*VALUES.*\+/gi,
      /UPDATE.*SET.*WHERE.*\+/gi,
      /DELETE.*FROM.*WHERE.*\+/gi,
      /query\(`.*\$\{.*\}`/gi,
      /execute\(`.*\$\{.*\}`/gi
    ];

    sqlInjectionPatterns.forEach((pattern, index) => {
      const matches = code.match(pattern);
      if (matches) {
        vulnerabilities.push({
          id: `sql-injection-${index}`,
          title: 'Potential SQL Injection',
          description: 'Code may be vulnerable to SQL injection attacks through user input concatenation',
          severity: 'critical',
          category: 'injection',
          cwe_id: 'CWE-89',
          code_snippet: matches[0],
          remediation: 'Use parameterized queries, prepared statements, or ORM methods',
          references: ['https://owasp.org/www-community/attacks/SQL_Injection'],
          confidence: 75,
          exploitability: 'high',
          impact: 'high'
        });
      }
    });

    // XSS patterns
    const xssPatterns = [
      /innerHTML.*=.*\+/gi,
      /document\.write.*\$/gi,
      /eval\(.*\$/gi,
      /new Function\(.*\$/gi
    ];

    xssPatterns.forEach((pattern, index) => {
      const matches = code.match(pattern);
      if (matches) {
        vulnerabilities.push({
          id: `xss-${index}`,
          title: 'Potential Cross-Site Scripting (XSS)',
          description: 'Code may be vulnerable to XSS attacks through unescaped user input',
          severity: 'high',
          category: 'injection',
          cwe_id: 'CWE-79',
          code_snippet: matches[0],
          remediation: 'Sanitize user input and use proper escaping or frameworks that handle XSS protection',
          references: ['https://owasp.org/www-community/attacks/xss/'],
          confidence: 80,
          exploitability: 'high',
          impact: 'medium'
        });
      }
    });

    // Hardcoded secrets patterns
    const secretPatterns = [
      /password\s*=\s*['"][^'"]{8,}['"]/gi,
      /secret\s*=\s*['"][^'"]{16,}['"]/gi,
      /api_key\s*=\s*['"][^'"]{20,}['"]/gi,
      /token\s*=\s*['"][^'"]{20,}['"]/gi,
      /private_key\s*=\s*['"][^'"]{30,}['"]/gi
    ];

    secretPatterns.forEach((pattern, index) => {
      const matches = code.match(pattern);
      if (matches) {
        vulnerabilities.push({
          id: `hardcoded-secret-${index}`,
          title: 'Hardcoded Secret Detected',
          description: 'Code contains hardcoded secrets, passwords, or API keys',
          severity: 'critical',
          category: 'data-exposure',
          code_snippet: matches[0],
          remediation: 'Move secrets to environment variables, secure configuration, or secret management systems',
          references: ['https://owasp.org/www-project-cheat-sheets/cheatsheets/Secrets_Management_Cheat_Sheet.html'],
          confidence: 95,
          exploitability: 'medium',
          impact: 'high'
        });
      }
    });

    // Weak cryptography patterns
    const weakCryptoPatterns = [
      /md5\(/gi,
      /sha1\(/gi,
      /crypto\.createHash\(['"]md5/gi,
      /crypto\.createHash\(['"]sha1/gi,
      / DES\b/gi,
      / RC4\b/gi
    ];

    weakCryptoPatterns.forEach((pattern, index) => {
      const matches = code.match(pattern);
      if (matches) {
        vulnerabilities.push({
          id: `weak-crypto-${index}`,
          title: 'Weak Cryptographic Algorithm',
          description: 'Code uses weak or deprecated cryptographic algorithms',
          severity: 'medium',
          category: 'crypto',
          code_snippet: matches[0],
          remediation: 'Use strong cryptographic algorithms like SHA-256, SHA-512, bcrypt, or Argon2',
          references: ['https://owasp.org/www-project-cheat-sheets/cheatsheets/Password_Storage_Cheat_Sheet.html'],
          confidence: 90,
          exploitability: 'low',
          impact: 'medium'
        });
      }
    });

    return vulnerabilities;
  }

  private async performAIAnalysis(request: SecurityAnalysisRequest): Promise<SecurityVulnerability[]> {
    try {
      const prompts = [
        `
Analyze this code for security vulnerabilities:
${request.code_snippet || 'File: ' + request.file_path}

Focus on:
- Authentication and authorization flaws
- Input validation issues
- Business logic vulnerabilities
- Race conditions
- Information disclosure risks
- Session management issues

Provide specific, actionable security findings with severity levels.
`
      ];

      const aiInsights = await this.aiService.generateInsights(prompts);

      return aiInsights.suggestions
        .filter(suggestion => suggestion.category === 'security')
        .map((suggestion, index) => ({
          id: `ai-security-${index}`,
          title: suggestion.title,
          description: suggestion.description,
          severity: this.mapImpactToSeverity(suggestion.impact),
          category: 'data-exposure' as const,
          line_number: suggestion.line_number,
          remediation: suggestion.suggestion,
          references: [],
          confidence: suggestion.confidence,
          exploitability: 'medium' as const,
          impact: this.mapToImpactLevel(suggestion.impact)
        }));

    } catch (error) {
      logger.warn('AI security analysis failed, using fallback:', error);
      return [];
    }
  }

  private async performDataFlowAnalysis(request: SecurityAnalysisRequest): Promise<SecurityVulnerability[]> {
    // Placeholder for data flow analysis
    // In a real implementation, this would track sensitive data flows
    return [];
  }

  private async analyzeDependencies(request: SecurityAnalysisRequest): Promise<SecurityVulnerability[]> {
    // Placeholder for dependency vulnerability analysis
    // In a real implementation, this would check package.json, Cargo.toml, etc.
    return [];
  }

  private deduplicateVulnerabilities(vulnerabilities: SecurityVulnerability[]): SecurityVulnerability[] {
    const seen = new Set<string>();
    return vulnerabilities.filter(vuln => {
      const key = `${vuln.title}-${vuln.line_number || 'unknown'}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async generateSecurityReport(vulnerabilities: SecurityVulnerability[], request: SecurityAnalysisRequest): Promise<SecurityAnalysisResult> {
    // Calculate risk assessment
    const riskAssessment = {
      critical_issues: vulnerabilities.filter(v => v.severity === 'critical').length,
      high_issues: vulnerabilities.filter(v => v.severity === 'high').length,
      medium_issues: vulnerabilities.filter(v => v.severity === 'medium').length,
      low_issues: vulnerabilities.filter(v => v.severity === 'low').length
    };

    // Calculate overall score
    const severityWeights = { critical: 40, high: 20, medium: 10, low: 5 };
    let totalDeduction = 0;

    vulnerabilities.forEach(vuln => {
      totalDeduction += severityWeights[vuln.severity];
    });

    const overallScore = Math.max(0, 100 - totalDeduction);

    // Determine security posture
    let securityPosture: SecurityAnalysisResult['security_posture'];
    if (overallScore >= 90) {securityPosture = 'excellent';}
    else if (overallScore >= 75) {securityPosture = 'good';}
    else if (overallScore >= 60) {securityPosture = 'moderate';}
    else if (overallScore >= 40) {securityPosture = 'poor';}
    else {securityPosture = 'critical';}

    // Generate recommendations
    const recommendations = this.generateSecurityRecommendations(vulnerabilities, riskAssessment);

    // Compliance check
    const compliance = this.performComplianceCheck(vulnerabilities);

    return {
      overall_score: overallScore,
      vulnerabilities: vulnerabilities.sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      }),
      risk_assessment: riskAssessment,
      security_posture: securityPosture,
      recommendations,
      compliance
    };
  }

  private generateSecurityRecommendations(vulnerabilities: SecurityVulnerability[], riskAssessment: any) {
    const recommendations = [];

    if (riskAssessment.critical_issues > 0) {
      recommendations.push({
        priority: 'immediate' as const,
        action: `Address ${riskAssessment.critical_issues} critical security vulnerabilities`,
        rationale: 'Critical vulnerabilities pose immediate threats to system security',
        estimated_effort: 'high' as const
      });
    }

    if (riskAssessment.high_issues > 0) {
      recommendations.push({
        priority: 'short-term' as const,
        action: `Resolve ${riskAssessment.high_issues} high-priority security issues`,
        rationale: 'High-priority issues should be addressed in the next development cycle',
        estimated_effort: 'medium' as const
      });
    }

    const injectionVulns = vulnerabilities.filter(v => v.category === 'injection');
    if (injectionVulns.length > 0) {
      recommendations.push({
        priority: 'immediate' as const,
        action: 'Implement comprehensive input validation and parameterized queries',
        rationale: 'Injection vulnerabilities are among the most critical security risks',
        estimated_effort: 'medium' as const
      });
    }

    const dataExposureVulns = vulnerabilities.filter(v => v.category === 'data-exposure');
    if (dataExposureVulns.length > 0) {
      recommendations.push({
        priority: 'short-term' as const,
        action: 'Review and secure sensitive data handling',
        rationale: 'Data exposure vulnerabilities can lead to privacy breaches',
        estimated_effort: 'medium' as const
      });
    }

    return recommendations;
  }

  private performComplianceCheck(vulnerabilities: SecurityVulnerability[]) {
    const standards = ['OWASP Top 10', 'CWE', 'NIST Cybersecurity Framework'];
    const complianceGaps = [];

    if (vulnerabilities.some(v => v.category === 'injection')) {
      complianceGaps.push('OWASP A03: Injection');
    }

    if (vulnerabilities.some(v => v.category === 'authentication' || v.category === 'authorization')) {
      complianceGaps.push('OWASP A07: Identification and Authentication Failures');
    }

    if (vulnerabilities.some(v => v.category === 'crypto')) {
      complianceGaps.push('OWASP A02: Cryptographic Failures');
    }

    const complianceScore = Math.max(0, 100 - (complianceGaps.length * 15));

    return {
      standards_checked: standards,
      compliance_score: complianceScore,
      gaps: complianceGaps
    };
  }

  private mapImpactToSeverity(impact: string): SecurityVulnerability['severity'] {
    switch (impact) {
      case 'critical': return 'critical';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  private mapToImpactLevel(impact: string): SecurityVulnerability['impact'] {
    switch (impact) {
      case 'critical': return 'high';
      case 'high': return 'high';
      case 'medium': return 'medium';
      case 'low': return 'low';
      default: return 'medium';
    }
  }

  private async getFileContent(filePath: string): Promise<string> {
    // In a real implementation, this would read the file content
    // For now, return a placeholder
    return '// File content would be read here';
  }
}