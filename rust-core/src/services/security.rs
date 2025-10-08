use crate::{Result, Error};
use serde::{Deserialize, Serialize};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use regex::Regex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub enabled_scanners: Vec<SecurityScannerType>,
    pub severity_threshold: Severity,
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
    pub custom_rules: Vec<SecurityRule>,
    pub timeout_seconds: u32,
    pub enable_context_analysis: bool,
    pub false_positive_threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SecurityScannerType {
    /// Static Application Security Testing
    SAST,
    /// Dependency vulnerability scanning
    DependencyScanning,
    /// Secret detection
    SecretScanning,
    /// Infrastructure as Code security
    IaCScanning,
    /// Container security
    ContainerScanning,
    /// API security testing
    APISecurityTesting,
    /// Business logic testing
    BusinessLogicTesting,
    /// Malware detection
    MalwareDetection,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum Severity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityScan {
    pub id: String,
    pub scan_type: SecurityScannerType,
    pub target: String, // file_path, directory, or URL
    pub status: ScanStatus,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub findings: Vec<SecurityFinding>,
    pub statistics: ScanStatistics,
    pub config_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScanStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
    Timeout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityFinding {
    pub id: String,
    pub title: String,
    pub description: String,
    pub severity: Severity,
    pub confidence: f64, // 0.0 to 1.0
    pub finding_type: FindingType,
    pub file_path: String,
    pub line_number: Option<u32>,
    pub end_line_number: Option<u32>,
    pub column_number: Option<u32>,
    pub end_column_number: Option<u32>,
    pub code_snippet: Option<String>,
    pub cwe_id: Option<u32>,
    pub owasp_category: Option<OWASPCategory>,
    pub references: Vec<String>,
    pub remediation: Option<Remediation>,
    pub context: HashMap<String, serde_json::Value>,
    pub false_positive: bool,
    pub reviewed: bool,
    pub discovered_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FindingType {
    Vulnerability,
    Weakness,
    AntiPattern,
    BadPractice,
    SecurityMisconfiguration,
    SensitiveData,
    HardcodedSecret,
    InsecureDependency,
    Injection,
    BrokenAccessControl,
    CryptographicIssue,
    InformationDisclosure,
    DenialOfService,
    CrossSiteScripting,
    InsecureDeserialization,
    SecurityHeadersMissing,
    WeakCryptography,
    UnsafeReflection,
    PathTraversal,
    InsecureDirectObjectReference,
    Other(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OWASPCategory {
    A01_BrokenAccessControl,
    A02_CryptographicFailures,
    A03_Injection,
    A04_InsecureDesign,
    A05_SecurityMisconfiguration,
    A06_VulnerableAndOutdatedComponents,
    A07_IdentificationAndAuthenticationFailures,
    A08_SoftwareAndDataIntegrityFailures,
    A09_SecurityLoggingAndMonitoringFailures,
    A10_ServerSideRequestForgery,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Remediation {
    pub steps: Vec<String>,
    pub effort: RemediationEffort,
    pub priority: RemediationPriority,
    pub tools: Vec<String>,
    pub code_example: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RemediationEffort {
    Trivial,
    Easy,
    Medium,
    Complex,
    Expert,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RemediationPriority {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanStatistics {
    pub total_files_scanned: u64,
    pub lines_of_code_analyzed: u64,
    pub total_findings: u64,
    pub findings_by_severity: HashMap<Severity, u64>,
    pub findings_by_type: HashMap<FindingType, u64>,
    pub false_positive_rate: f64,
    pub scan_duration_seconds: u64,
    pub vulnerabilities_per_kloc: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityRule {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: FindingType,
    pub severity: Severity,
    pub pattern: String,
    pub language: Option<String>,
    pub test_cases: Vec<TestCase>,
    pub enabled: bool,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCase {
    pub input: String,
    pub should_match: bool,
    pub expected_line: Option<u32>,
    pub description: String,
}

#[async_trait]
pub trait SecurityService: Send + Sync {
    /// Initialize the security service with configuration
    async fn initialize(&mut self, config: SecurityConfig) -> Result<()>;

    /// Start a new security scan
    async fn start_scan(&self, target: &str, scan_type: SecurityScannerType) -> Result<String>;

    /// Get scan status and results
    async fn get_scan(&self, scan_id: &str) -> Result<SecurityScan>;

    /// List all scans
    async fn list_scans(&self, limit: Option<u32>, offset: Option<u32>) -> Result<Vec<SecurityScan>>;

    /// Cancel a running scan
    async fn cancel_scan(&self, scan_id: &str) -> Result<()>;

    /// Mark finding as false positive
    async fn mark_false_positive(&self, finding_id: &str, reason: &str) -> Result<()>;

    /// Update finding review status
    async fn update_finding_review(&self, finding_id: &str, reviewed: bool) -> Result<()>;

    /// Get security statistics
    async fn get_statistics(&self) -> Result<SecurityStatistics>;

    /// Export findings in various formats
    async fn export_findings(&self, scan_id: &str, format: ExportFormat) -> Result<Vec<u8>>;

    /// Update security rules
    async fn update_rules(&self, rules: Vec<SecurityRule>) -> Result<()>;

    /// Validate security configuration
    fn validate_config(&self, config: &SecurityConfig) -> Result<()>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityStatistics {
    pub total_scans: u64,
    pub total_findings: u64,
    pub critical_findings: u64,
    pub high_findings: u64,
    pub medium_findings: u64,
    pub low_findings: u64,
    pub info_findings: u64,
    pub average_scan_time_seconds: f64,
    pub most_common_vulnerabilities: Vec<(FindingType, u64)>,
    pub most_vulnerable_files: Vec<(String, u64)>,
    pub remediation_backlog: u64,
    pub false_positive_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExportFormat {
    JSON,
    SARIF,
    PDF,
    CSV,
    XML,
}

pub struct DefaultSecurityService {
    config: Option<SecurityConfig>,
    scans: HashMap<String, SecurityScan>,
    rules: Vec<SecurityRule>,
    stats: SecurityStatistics,
}

impl DefaultSecurityService {
    pub fn new() -> Self {
        Self {
            config: None,
            scans: HashMap::new(),
            rules: Self::default_rules(),
            stats: SecurityStatistics {
                total_scans: 0,
                total_findings: 0,
                critical_findings: 0,
                high_findings: 0,
                medium_findings: 0,
                low_findings: 0,
                info_findings: 0,
                average_scan_time_seconds: 0.0,
                most_common_vulnerabilities: Vec::new(),
                most_vulnerable_files: Vec::new(),
                remediation_backlog: 0,
                false_positive_rate: 0.0,
            },
        }
    }

    fn default_rules() -> Vec<SecurityRule> {
        vec![
            // Hardcoded secrets
            SecurityRule {
                id: "secret_001".to_string(),
                name: "Hardcoded API Key".to_string(),
                description: "Detects hardcoded API keys in source code".to_string(),
                category: FindingType::HardcodedSecret,
                severity: Severity::High,
                pattern: r"(?i)(api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['\"][a-zA-Z0-9_-]{20,}['\"]".to_string(),
                language: None,
                test_cases: vec![
                    TestCase {
                        input: "const apiKey = 'sk-1234567890abcdef';".to_string(),
                        should_match: true,
                        expected_line: Some(1),
                        description: "Detect API key in JavaScript".to_string(),
                    },
                ],
                enabled: true,
                tags: vec!["secrets".to_string(), "api-keys".to_string()],
            },
            
            // SQL Injection patterns
            SecurityRule {
                id: "sqli_001".to_string(),
                name: "SQL Injection Vulnerability".to_string(),
                description: "Detects potential SQL injection vulnerabilities".to_string(),
                category: FindingType::Injection,
                severity: Severity::Critical,
                pattern: r"(?i)(execute|query)\s*\(\s*['\"].*?\+.*?['\"]".to_string(),
                language: None,
                test_cases: vec![
                    TestCase {
                        input: "db.execute('SELECT * FROM users WHERE id = ' + userInput);".to_string(),
                        should_match: true,
                        expected_line: Some(1),
                        description: "Detect SQL injection with string concatenation".to_string(),
                    },
                ],
                enabled: true,
                tags: vec!["injection".to_string(), "sql".to_string(), "critical".to_string()],
            },
            
            // Hardcoded passwords
            SecurityRule {
                id: "auth_001".to_string(),
                name: "Hardcoded Password".to_string(),
                description: "Detects hardcoded passwords in source code".to_string(),
                category: FindingType::HardcodedSecret,
                severity: Severity::Critical,
                pattern: r"(?i)(password|passwd|pwd)\s*[:=]\s*['\"][^'\"]{4,}['\"]".to_string(),
                language: None,
                test_cases: vec![
                    TestCase {
                        input: "const password = 'mySecretPassword123';".to_string(),
                        should_match: true,
                        expected_line: Some(1),
                        description: "Detect hardcoded password".to_string(),
                    },
                ],
                enabled: true,
                tags: vec!["authentication".to_string(), "passwords".to_string(), "secrets".to_string()],
            },
            
            // Weak cryptography
            SecurityRule {
                id: "crypto_001".to_string(),
                name: "Weak Cryptographic Algorithm".to_string(),
                description: "Detects use of weak cryptographic algorithms".to_string(),
                category: FindingType::WeakCryptography,
                severity: Severity::Medium,
                pattern: r"(?i)(md5|sha1|rc4|des|aes128)\s*\(".to_string(),
                language: None,
                test_cases: vec![
                    TestCase {
                        input: "const hash = md5(data);".to_string(),
                        should_match: true,
                        expected_line: Some(1),
                        description: "Detect weak MD5 usage".to_string(),
                    },
                ],
                enabled: true,
                tags: vec!["cryptography".to_string(), "weak-algorithms".to_string()],
            },
            
            // Path Traversal
            SecurityRule {
                id: "path_001".to_string(),
                name: "Path Traversal Vulnerability".to_string(),
                description: "Detects potential path traversal vulnerabilities".to_string(),
                category: FindingType::PathTraversal,
                severity: Severity::High,
                pattern: r"(?i)(read|write|open)\s*\(\s*.*?\+.*?\.(txt|log|conf|ini)".to_string(),
                language: None,
                test_cases: vec![
                    TestCase {
                        input: "fs.readFile(path + '/../secret.txt', callback);".to_string(),
                        should_match: true,
                        expected_line: Some(1),
                        description: "Detect path traversal pattern".to_string(),
                    },
                ],
                enabled: true,
                tags: vec!["path-traversal".to_string(), "file-access".to_string()],
            },
        ]
    }

    async fn scan_file(&self, file_path: &str) -> Result<Vec<SecurityFinding>> {
        let content = std::fs::read_to_string(file_path)
            .map_err(|e| Error::msg(format!("Failed to read file: {}", e)))?;

        let mut findings = Vec::new();
        let lines: Vec<&str> = content.lines().collect();

        for rule in &self.rules {
            if !rule.enabled {
                continue;
            }

            // Check if rule applies to this file's language
            if let Some(ref lang) = rule.language {
                if !file_path.ends_with(lang) {
                    continue;
                }
            }

            let regex = Regex::new(&rule.pattern)
                .map_err(|e| Error::msg(format!("Invalid regex in rule {}: {}", rule.id, e)))?;

            for (line_num, line) in lines.iter().enumerate() {
                for mat in regex.find_iter(line) {
                    let finding = SecurityFinding {
                        id: format!("{}-{}-{}", rule.id, file_path, line_num + 1),
                        title: rule.name.clone(),
                        description: rule.description.clone(),
                        severity: rule.severity.clone(),
                        confidence: 0.8, // Default confidence
                        finding_type: rule.category.clone(),
                        file_path: file_path.to_string(),
                        line_number: Some(line_num as u32 + 1),
                        end_line_number: Some(line_num as u32 + 1),
                        column_number: Some(mat.start() as u32),
                        end_column_number: Some(mat.end() as u32),
                        code_snippet: Some(line.to_string()),
                        cwe_id: self.get_cwe_for_finding_type(&rule.category),
                        owasp_category: self.get_owasp_category_for_finding_type(&rule.category),
                        references: self.get_references_for_finding_type(&rule.category),
                        remediation: Some(self.get_remediation_for_finding_type(&rule.category)),
                        context: HashMap::new(),
                        false_positive: false,
                        reviewed: false,
                        discovered_at: Utc::now(),
                    };
                    findings.push(finding);
                }
            }
        }

        Ok(findings)
    }

    fn get_cwe_for_finding_type(&self, finding_type: &FindingType) -> Option<u32> {
        match finding_type {
            FindingType::Injection => Some(89), // CWE-89: SQL Injection
            FindingType::HardcodedSecret => Some(798), // CWE-798: Use of Hard-coded Credentials
            FindingType::WeakCryptography => Some(327), // CWE-327: Use of a Broken or Risky Cryptographic Algorithm
            FindingType::PathTraversal => Some(22), // CWE-22: Path Traversal
            FindingType::CrossSiteScripting => Some(79), // CWE-79: Cross-site Scripting
            FindingType::BrokenAccessControl => Some(284), // CWE-284: Improper Access Control
            FindingType::InsecureDeserialization => Some(502), // CWE-502: Deserialization of Untrusted Data
            _ => None,
        }
    }

    fn get_owasp_category_for_finding_type(&self, finding_type: &FindingType) -> Option<OWASPCategory> {
        match finding_type {
            FindingType::BrokenAccessControl => Some(OWASPCategory::A01_BrokenAccessControl),
            FindingType::WeakCryptography => Some(OWASPCategory::A02_CryptographicFailures),
            FindingType::Injection => Some(OWASPCategory::A03_Injection),
            FindingType::InsecureDependency => Some(OWASPCategory::A06_VulnerableAndOutdatedComponents),
            FindingType::HardcodedSecret => Some(OWASPCategory::A05_SecurityMisconfiguration),
            FindingType::CrossSiteScripting => Some(OWASPCategory::A03_Injection),
            _ => None,
        }
    }

    fn get_references_for_finding_type(&self, finding_type: &FindingType) -> Vec<String> {
        match finding_type {
            FindingType::Injection => vec![
                "https://owasp.org/www-community/attacks/SQL_Injection".to_string(),
                "https://cwe.mitre.org/data/definitions/89.html".to_string(),
            ],
            FindingType::HardcodedSecret => vec![
                "https://cwe.mitre.org/data/definitions/798.html".to_string(),
            ],
            FindingType::WeakCryptography => vec![
                "https://owasp.org/www-project-cheat-sheets/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html".to_string(),
            ],
            _ => Vec::new(),
        }
    }

    fn get_remediation_for_finding_type(&self, finding_type: &FindingType) -> Remediation {
        match finding_type {
            FindingType::Injection => Remediation {
                steps: vec![
                    "Use parameterized queries or prepared statements".to_string(),
                    "Implement input validation and sanitization".to_string(),
                    "Use ORM frameworks that provide built-in protection".to_string(),
                ],
                effort: RemediationEffort::Medium,
                priority: RemediationPriority::Critical,
                tools: vec!["SQLAlchemy".to_string(), "Hibernate".to_string(), "Knex.js".to_string()],
                code_example: Some("// Use parameterized query\nconst result = await db.query('SELECT * FROM users WHERE id = $1', [userId]);".to_string()),
            },
            FindingType::HardcodedSecret => Remediation {
                steps: vec![
                    "Remove hardcoded secrets from source code".to_string(),
                    "Use environment variables or secure configuration management".to_string(),
                    "Implement secrets management solution".to_string(),
                    "Rotate any exposed secrets immediately".to_string(),
                ],
                effort: RemediationEffort::Easy,
                priority: RemediationPriority::Critical,
                tools: vec!["Vault".to_string(), "AWS Secrets Manager".to_string(), "Docker Secrets".to_string()],
                code_example: Some("// Use environment variables\nconst apiKey = process.env.API_KEY;".to_string()),
            },
            FindingType::WeakCryptography => Remediation {
                steps: vec![
                    "Replace weak algorithms with strong alternatives".to_string(),
                    "Use well-vetted cryptographic libraries".to_string(),
                    "Implement proper key management".to_string(),
                ],
                effort: RemediationEffort::Medium,
                priority: RemediationPriority::High,
                tools: vec!["bcrypt".to_string(), "argon2".to_string(), "crypto-js".to_string()],
                code_example: Some("// Use strong cryptographic algorithm\nconst hash = await bcrypt.hash(password, 12);".to_string()),
            },
            _ => Remediation {
                steps: vec!["Address the security issue".to_string()],
                effort: RemediationEffort::Medium,
                priority: RemediationPriority::Medium,
                tools: Vec::new(),
                code_example: None,
            },
        }
    }

    async fn update_statistics(&mut self) {
        let mut total_findings = 0;
        let mut critical_findings = 0;
        let mut high_findings = 0;
        let mut medium_findings = 0;
        let mut low_findings = 0;
        let mut info_findings = 0;
        
        let mut most_common_vulnerabilities: HashMap<FindingType, u64> = HashMap::new();
        let mut most_vulnerable_files: HashMap<String, u64> = HashMap::new();

        for scan in self.scans.values() {
            for finding in &scan.findings {
                total_findings += 1;
                
                match finding.severity {
                    Severity::Critical => critical_findings += 1,
                    Severity::High => high_findings += 1,
                    Severity::Medium => medium_findings += 1,
                    Severity::Low => low_findings += 1,
                    Severity::Info => info_findings += 1,
                }

                *most_common_vulnerabilities.entry(finding.finding_type.clone()).or_insert(0) += 1;
                *most_vulnerable_files.entry(finding.file_path.clone()).or_insert(0) += 1;
            }
        }

        // Sort by frequency
        let mut common_vulns: Vec<_> = most_common_vulnerabilities.into_iter().collect();
        common_vulns.sort_by(|a, b| b.1.cmp(&a.1));
        common_vulns.truncate(10);

        let mut vulnerable_files: Vec<_> = most_vulnerable_files.into_iter().collect();
        vulnerable_files.sort_by(|a, b| b.1.cmp(&a.1));
        vulnerable_files.truncate(10);

        self.stats = SecurityStatistics {
            total_scans: self.scans.len() as u64,
            total_findings,
            critical_findings,
            high_findings,
            medium_findings,
            low_findings,
            info_findings,
            average_scan_time_seconds: 0.0, // Calculate based on scan durations
            most_common_vulnerabilities: common_vulns,
            most_vulnerable_files: vulnerable_files,
            remediation_backlog: total_findings, // All findings represent remediation backlog
            false_positive_rate: 0.0, // Calculate based on false positives
        };
    }
}

#[async_trait]
impl SecurityService for DefaultSecurityService {
    async fn initialize(&mut self, config: SecurityConfig) -> Result<()> {
        self.validate_config(&config)?;
        self.config = Some(config);
        Ok(())
    }

    async fn start_scan(&self, target: &str, scan_type: SecurityScannerType) -> Result<String> {
        let scan_id = uuid::Uuid::new_v4().to_string();
        let scan = SecurityScan {
            id: scan_id.clone(),
            scan_type,
            target: target.to_string(),
            status: ScanStatus::Queued,
            started_at: Utc::now(),
            completed_at: None,
            findings: Vec::new(),
            statistics: ScanStatistics {
                total_files_scanned: 0,
                lines_of_code_analyzed: 0,
                total_findings: 0,
                findings_by_severity: HashMap::new(),
                findings_by_type: HashMap::new(),
                false_positive_rate: 0.0,
                scan_duration_seconds: 0,
                vulnerabilities_per_kloc: 0.0,
            },
            config_hash: "".to_string(), // Calculate hash of config
        };

        // In a real implementation, this would queue the scan
        // For now, we'll simulate a quick scan
        Ok(scan_id)
    }

    async fn get_scan(&self, scan_id: &str) -> Result<SecurityScan> {
        self.scans
            .get(scan_id)
            .cloned()
            .ok_or_else(|| Error::msg("Scan not found"))
    }

    async fn list_scans(&self, limit: Option<u32>, offset: Option<u32>) -> Result<Vec<SecurityScan>> {
        let mut scans: Vec<_> = self.scans.values().cloned().collect();
        scans.sort_by(|a, b| b.started_at.cmp(&a.started_at));

        let offset = offset.unwrap_or(0) as usize;
        let limit = limit.unwrap_or(50) as usize;

        Ok(scans.into_iter().skip(offset).take(limit).collect())
    }

    async fn cancel_scan(&self, _scan_id: &str) -> Result<()> {
        // Implementation would cancel a running scan
        Ok(())
    }

    async fn mark_false_positive(&self, _finding_id: &str, _reason: &str) -> Result<()> {
        // Implementation would mark finding as false positive
        Ok(())
    }

    async fn update_finding_review(&self, _finding_id: &str, _reviewed: bool) -> Result<()> {
        // Implementation would update finding review status
        Ok(())
    }

    async fn get_statistics(&self) -> Result<SecurityStatistics> {
        Ok(self.stats.clone())
    }

    async fn export_findings(&self, scan_id: &str, format: ExportFormat) -> Result<Vec<u8>> {
        let scan = self.get_scan(scan_id).await?;
        
        match format {
            ExportFormat::JSON => {
                serde_json::to_vec_pretty(&scan.findings)
                    .map_err(|e| Error::msg(format!("Failed to serialize findings: {}", e)))
            }
            ExportFormat::CSV => {
                let mut csv = String::new();
                csv.push_str("id,title,severity,file_path,line_number,description\n");
                
                for finding in &scan.findings {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{}\n",
                        finding.id,
                        finding.title,
                        format!("{:?}", finding.severity),
                        finding.file_path,
                        finding.line_number.unwrap_or(0),
                        finding.description.replace(',', ";")
                    ));
                }
                
                Ok(csv.into_bytes())
            }
            _ => Err(Error::msg("Export format not yet implemented")),
        }
    }

    async fn update_rules(&self, _rules: Vec<SecurityRule>) -> Result<()> {
        // Implementation would update security rules
        Ok(())
    }

    fn validate_config(&self, config: &SecurityConfig) -> Result<()> {
        if config.enabled_scanners.is_empty() {
            return Err(Error::msg("At least one security scanner must be enabled"));
        }

        if config.timeout_seconds == 0 {
            return Err(Error::msg("Timeout must be greater than 0"));
        }

        Ok(())
    }
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            enabled_scanners: vec![
                SecurityScannerType::SAST,
                SecurityScannerType::SecretScanning,
            ],
            severity_threshold: Severity::Low,
            include_patterns: vec!["**/*.{js,ts,py,rs,cpp,hpp,c,h,java,go}".to_string()],
            exclude_patterns: vec![
                "**/node_modules/**".to_string(),
                "**/target/**".to_string(),
                "**/dist/**".to_string(),
                "**/.git/**".to_string(),
                "**/vendor/**".to_string(),
            ],
            custom_rules: Vec::new(),
            timeout_seconds: 300,
            enable_context_analysis: true,
            false_positive_threshold: 0.7,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_security_service_initialization() {
        let mut service = DefaultSecurityService::new();
        let config = SecurityConfig::default();

        let result = service.initialize(config).await;
        assert!(result.is_ok());
    }

    #[test]
    fn test_config_validation() {
        let service = DefaultSecurityService::new();
        
        let valid_config = SecurityConfig::default();
        assert!(service.validate_config(&valid_config).is_ok());
        
        let invalid_config = SecurityConfig {
            enabled_scanners: vec![],
            ..Default::default()
        };
        assert!(service.validate_config(&invalid_config).is_err());
    }

    #[test]
    fn test_default_rules() {
        let rules = DefaultSecurityService::default_rules();
        assert!(!rules.is_empty());
        
        // Check that we have rules for common vulnerabilities
        let has_secret_rule = rules.iter().any(|r| matches!(r.category, FindingType::HardcodedSecret));
        assert!(has_secret_rule);
        
        let has_injection_rule = rules.iter().any(|r| matches!(r.category, FindingType::Injection));
        assert!(has_injection_rule);
    }

    #[tokio::test]
    async fn test_scan_file() {
        let service = DefaultSecurityService::new();
        
        // Create a temporary file with vulnerable code
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("test_vuln.js");
        std::fs::write(&test_file, "const apiKey = 'sk-1234567890abcdef';").unwrap();

        let findings = service.scan_file(test_file.to_str().unwrap()).await.unwrap();
        assert!(!findings.is_empty());
        assert!(findings[0].title.contains("API Key"));

        // Cleanup
        std::fs::remove_file(&test_file).unwrap();
    }

    #[test]
    fn test_severity_ordering() {
        assert!(Severity::Critical > Severity::High);
        assert!(Severity::High > Severity::Medium);
        assert!(Severity::Medium > Severity::Low);
        assert!(Severity::Low > Severity::Info);
    }
}