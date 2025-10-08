use crate::{Result, Error};
use serde::{Deserialize, Serialize};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::path::PathBuf;
use tree_sitter::{Language, Parser, Tree, Node};
use tree_sitter_cpp::language as cpp_language;
use tree_sitter_javascript::language as javascript_language;
use tree_sitter_python::language as python_language;
use tree_sitter_rust::language as rust_language;
use tree_sitter_go::language as go_language;
use tree_sitter_java::language as java_language;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisConfig {
    pub enabled_languages: Vec<String>,
    pub max_file_size_mb: u32,
    pub timeout_seconds: u32,
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
    pub analysis_depth: AnalysisDepth,
    pub enable_semantic_analysis: bool,
    pub enable_complexity_analysis: bool,
    pub enable_security_analysis: bool,
    pub cache_results: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AnalysisDepth {
    Syntax,      // Only syntax tree analysis
    Semantic,    // Include semantic information
    Full,        // Complete analysis including relationships
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub file_path: String,
    pub language: String,
    pub entities: Vec<CodeEntity>,
    pub relationships: Vec<CodeRelationship>,
    pub metrics: FileMetrics,
    pub issues: Vec<AnalysisIssue>,
    pub complexity_score: f64,
    pub analysis_time_ms: u64,
    pub analyzed_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeEntity {
    pub id: String,
    pub name: String,
    pub entity_type: EntityType,
    pub file_path: String,
    pub start_line: u32,
    pub end_line: u32,
    pub start_column: u32,
    pub end_column: u32,
    pub signature: Option<String>,
    pub docstring: Option<String>,
    pub visibility: Option<Visibility>,
    pub parameters: Vec<Parameter>,
    pub return_type: Option<String>,
    pub properties: HashMap<String, serde_json::Value>,
    pub parent_id: Option<String>,
    pub children: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EntityType {
    Function,
    Method,
    Class,
    Interface,
    Struct,
    Enum,
    Variable,
    Constant,
    Module,
    Namespace,
    Import,
    Export,
    Type,
    Macro,
    Trait,
    Implementation,
    Comment,
    Attribute,
    Annotation,
    Other(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Visibility {
    Public,
    Private,
    Protected,
    Internal,
    Package,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameter {
    pub name: String,
    pub param_type: Option<String>,
    pub default_value: Option<String>,
    pub is_variadic: bool,
    pub is_optional: bool,
    pub attributes: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeRelationship {
    pub id: String,
    pub source_id: String,
    pub target_id: String,
    pub relationship_type: RelationshipType,
    pub file_path: String,
    pub line_number: u32,
    pub confidence: f64,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RelationshipType {
    Calls,           // Function calls another function
    Inherits,        // Class inherits from another class
    Implements,      // Class implements interface
    Uses,            // Uses a variable or constant
    Declares,        // Declares a variable
    Imports,         // Imports a module
    Overrides,       // Overrides method
    Contains,        // Contains another entity
    References,      // References another entity
    Extends,         // Extends another entity
    DependsOn,       // General dependency
    TypeOf,          // Type relationship
    InstanceOf,      // Instance relationship
    MemberOf,        // Member relationship
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileMetrics {
    pub lines_of_code: u32,
    pub lines_of_comments: u32,
    pub blank_lines: u32,
    pub functions_count: u32,
    pub classes_count: u32,
    pub interfaces_count: u32,
    pub cyclomatic_complexity: u32,
    pub cognitive_complexity: u32,
    pub maintainability_index: f64,
    pub technical_debt_hours: f64,
    pub test_coverage_percentage: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisIssue {
    pub id: String,
    pub issue_type: IssueType,
    pub severity: Severity,
    pub message: String,
    pub file_path: String,
    pub line_number: u32,
    pub column_number: u32,
    pub end_line: u32,
    pub end_column: u32,
    pub suggestion: Option<String>,
    pub rule_id: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IssueType {
    Complexity,
    Security,
    Performance,
    Maintainability,
    Style,
    Error,
    Warning,
    Information,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Severity {
    Info,
    Warning,
    Error,
    Critical,
}

#[async_trait]
pub trait AnalyzerService: Send + Sync {
    /// Initialize the analyzer with configuration
    async fn initialize(&mut self, config: AnalysisConfig) -> Result<()>;

    /// Analyze a single file
    async fn analyze_file(&self, file_path: &str) -> Result<AnalysisResult>;

    /// Analyze multiple files in parallel
    async fn analyze_files(&self, file_paths: &[String]) -> Result<Vec<AnalysisResult>>;

    /// Get supported languages
    fn get_supported_languages(&self) -> Vec<String>;

    /// Detect language from file content
    fn detect_language(&self, file_path: &str, content: &str) -> Option<String>;

    /// Get language-specific parser
    fn get_parser(&self, language: &str) -> Result<Box<dyn LanguageParser>>;

    /// Validate analysis configuration
    fn validate_config(&self, config: &AnalysisConfig) -> Result<()>;

    /// Get analysis statistics
    async fn get_stats(&self) -> Result<AnalysisStats>;

    /// Clear analysis cache
    async fn clear_cache(&self) -> Result<()>;
}

#[async_trait]
pub trait LanguageParser: Send + Sync {
    /// Parse source code into syntax tree
    fn parse(&mut self, source: &str) -> Result<Tree>;

    /// Extract entities from syntax tree
    fn extract_entities(&self, tree: &Tree, source: &str) -> Result<Vec<CodeEntity>>;

    /// Extract relationships from syntax tree
    fn extract_relationships(&self, tree: &Tree, source: &str, entities: &[CodeEntity]) -> Result<Vec<CodeRelationship>>;

    /// Calculate metrics for the file
    fn calculate_metrics(&self, tree: &Tree, source: &str) -> Result<FileMetrics>;

    /// Detect issues in the code
    fn detect_issues(&self, tree: &Tree, source: &str) -> Result<Vec<AnalysisIssue>>;

    /// Get language name
    fn language_name(&self) -> String;
}

pub struct TreeSitterAnalyzer {
    config: Option<AnalysisConfig>,
    parsers: HashMap<String, Box<dyn LanguageParser>>,
    stats: AnalysisStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisStats {
    pub files_analyzed: u64,
    pub entities_found: u64,
    pub relationships_found: u64,
    pub issues_detected: u64,
    pub total_analysis_time_ms: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub last_analysis: Option<DateTime<Utc>>,
}

impl TreeSitterAnalyzer {
    pub fn new() -> Self {
        Self {
            config: None,
            parsers: HashMap::new(),
            stats: AnalysisStats {
                files_analyzed: 0,
                entities_found: 0,
                relationships_found: 0,
                issues_detected: 0,
                total_analysis_time_ms: 0,
                cache_hits: 0,
                cache_misses: 0,
                last_analysis: None,
            },
        }
    }

    fn initialize_parsers(&mut self, languages: &[String]) -> Result<()> {
        for language in languages {
            if !self.parsers.contains_key(language) {
                let parser: Box<dyn LanguageParser> = match language.as_str() {
                    "javascript" | "typescript" => Box::new(JavaScriptParser::new()),
                    "python" => Box::new(PythonParser::new()),
                    "rust" => Box::new(RustParser::new()),
                    "cpp" | "c++" | "c" => Box::new(CppParser::new()),
                    "go" => Box::new(GoParser::new()),
                    "java" => Box::new(JavaParser::new()),
                    _ => return Err(Error::msg(format!("Unsupported language: {}", language))),
                };
                self.parsers.insert(language.clone(), parser);
            }
        }
        Ok(())
    }

    fn should_analyze_file(&self, file_path: &str) -> bool {
        let config = self.config.as_ref().unwrap();
        
        // Check file size
        if let Ok(metadata) = std::fs::metadata(file_path) {
            if metadata.len() > (config.max_file_size_mb as u64 * 1024 * 1024) {
                return false;
            }
        }

        let path = PathBuf::from(file_path);
        
        // Check include patterns
        if !config.include_patterns.is_empty() {
            let included = config.include_patterns.iter().any(|pattern| {
                match glob::Pattern::new(pattern) {
                    Ok(p) => p.matches_path(&path),
                    Err(_) => file_path.contains(pattern),
                }
            });
            if !included {
                return false;
            }
        }

        // Check exclude patterns
        for pattern in &config.exclude_patterns {
            if match glob::Pattern::new(pattern) {
                Ok(p) => p.matches_path(&path),
                Err(_) => file_path.contains(pattern),
            } {
                return false;
            }
        }

        true
    }

    async fn update_stats(&mut self, result: &AnalysisResult) {
        self.stats.files_analyzed += 1;
        self.stats.entities_found += result.entities.len() as u64;
        self.stats.relationships_found += result.relationships.len() as u64;
        self.stats.issues_detected += result.issues.len() as u64;
        self.stats.total_analysis_time_ms += result.analysis_time_ms;
        self.stats.last_analysis = Some(Utc::now());
    }
}

#[async_trait]
impl AnalyzerService for TreeSitterAnalyzer {
    async fn initialize(&mut self, config: AnalysisConfig) -> Result<()> {
        self.config = Some(config.clone());
        self.initialize_parsers(&config.enabled_languages)?;
        Ok(())
    }

    async fn analyze_file(&self, file_path: &str) -> Result<AnalysisResult> {
        if !self.should_analyze_file(file_path) {
            return Err(Error::msg("File should not be analyzed"));
        }

        let start_time = std::time::Instant::now();
        
        // Read file content
        let content = std::fs::read_to_string(file_path)
            .map_err(|e| Error::msg(format!("Failed to read file: {}", e)))?;

        // Detect language
        let language = self.detect_language(file_path, &content)
            .ok_or_else(|| Error::msg("Unable to detect language"))?;

        // Get parser
        let mut parser = self.get_parser(&language)?;

        // Parse the code
        let tree = parser.parse(&content)?;

        // Extract entities
        let entities = parser.extract_entities(&tree, &content)?;

        // Extract relationships
        let relationships = parser.extract_relationships(&tree, &content, &entities)?;

        // Calculate metrics
        let metrics = parser.calculate_metrics(&tree, &content)?;

        // Detect issues
        let issues = parser.detect_issues(&tree, &content)?;

        let analysis_time = start_time.elapsed().as_millis() as u64;

        Ok(AnalysisResult {
            file_path: file_path.to_string(),
            language,
            entities,
            relationships,
            metrics,
            issues,
            complexity_score: metrics.cyclomatic_complexity as f64,
            analysis_time_ms: analysis_time,
            analyzed_at: Utc::now(),
        })
    }

    async fn analyze_files(&self, file_paths: &[String]) -> Result<Vec<AnalysisResult>> {
        let mut results = Vec::new();
        
        // Process files in parallel chunks
        let chunk_size = std::cmp::max(1, file_paths.len() / num_cpus::get());
        let chunks: Vec<_> = file_paths.chunks(chunk_size).collect();

        for chunk in chunks {
            let chunk_results: Vec<Result<AnalysisResult>> = futures::future::join_all(
                chunk.iter().map(|path| self.analyze_file(path))
            )
            .await;

            for result in chunk_results {
                match result {
                    Ok(analysis) => results.push(analysis),
                    Err(e) => {
                        // Log error but continue with other files
                        eprintln!("Analysis failed: {}", e);
                    }
                }
            }
        }

        Ok(results)
    }

    fn get_supported_languages(&self) -> Vec<String> {
        self.parsers.keys().cloned().collect()
    }

    fn detect_language(&self, file_path: &str, content: &str) -> Option<String> {
        let path = PathBuf::from(file_path);
        
        // Check file extension
        if let Some(extension) = path.extension() {
            let ext = extension.to_string_lossy();
            let language = match ext.as_str() {
                "js" | "jsx" | "mjs" => Some("javascript"),
                "ts" | "tsx" => Some("typescript"),
                "py" | "pyw" => Some("python"),
                "rs" => Some("rust"),
                "cpp" | "cxx" | "cc" | "c++" | "hpp" | "hxx" | "hh" | "h++" => Some("cpp"),
                "c" => Some("cpp"),
                "go" => Some("go"),
                "java" | "class" => Some("java"),
                _ => None,
            };
            
            if language.is_some() {
                return language;
            }
        }

        // Check for shebang patterns
        if content.starts_with("#!/usr/bin/env python") || content.starts_with("#!/usr/bin/python") {
            return Some("python");
        }

        // Basic content-based detection
        if content.contains("def ") && content.contains(":") && content.contains("import ") {
            return Some("python");
        }

        if content.contains("fn ") && content.contains("{") && content.contains("->") {
            return Some("rust");
        }

        if content.contains("function ") || content.contains("const ") || content.contains("let ") {
            return Some("javascript");
        }

        None
    }

    fn get_parser(&self, language: &str) -> Result<Box<dyn LanguageParser>> {
        let config = self.config.as_ref().unwrap();
        
        if !config.enabled_languages.contains(&language.to_string()) {
            return Err(Error::msg(format!("Language {} not enabled", language)));
        }

        self.parsers
            .get(language)
            .ok_or_else(|| Error::msg(format!("No parser available for language: {}", language)))
            .map(|p| {
                // Create a new parser instance for thread safety
                match language {
                    "javascript" | "typescript" => Box::new(JavaScriptParser::new()) as Box<dyn LanguageParser>,
                    "python" => Box::new(PythonParser::new()) as Box<dyn LanguageParser>,
                    "rust" => Box::new(RustParser::new()) as Box<dyn LanguageParser>,
                    "cpp" | "c++" | "c" => Box::new(CppParser::new()) as Box<dyn LanguageParser>,
                    "go" => Box::new(GoParser::new()) as Box<dyn LanguageParser>,
                    "java" => Box::new(JavaParser::new()) as Box<dyn LanguageParser>,
                    _ => unreachable!(),
                }
            })
    }

    fn validate_config(&self, config: &AnalysisConfig) -> Result<()> {
        if config.enabled_languages.is_empty() {
            return Err(Error::msg("At least one language must be enabled"));
        }

        if config.max_file_size_mb == 0 {
            return Err(Error::msg("Max file size must be greater than 0"));
        }

        if config.timeout_seconds == 0 {
            return Err(Error::msg("Timeout must be greater than 0"));
        }

        Ok(())
    }

    async fn get_stats(&self) -> Result<AnalysisStats> {
        Ok(self.stats.clone())
    }

    async fn clear_cache(&self) -> Result<()> {
        // Implementation would clear any analysis cache
        Ok(())
    }
}

// Language-specific parsers
struct JavaScriptParser {
    parser: Parser,
}

impl JavaScriptParser {
    fn new() -> Self {
        let mut parser = Parser::new();
        parser.set_language(javascript_language()).unwrap();
        Self { parser }
    }
}

#[async_trait]
impl LanguageParser for JavaScriptParser {
    fn parse(&mut self, source: &str) -> Result<Tree> {
        self.parser.parse(source, None).ok_or_else(|| Error::msg("Failed to parse JavaScript code"))
    }

    fn extract_entities(&self, tree: &Tree, source: &str) -> Result<Vec<CodeEntity>> {
        let mut entities = Vec::new();
        let mut cursor = tree_sitter::QueryCursor::new();
        
        // Extract functions, classes, variables, etc.
        // This is a simplified implementation
        let root_node = tree.root_node();
        self.extract_entities_recursive(&root_node, source, "", &mut entities);
        
        Ok(entities)
    }

    fn extract_relationships(&self, tree: &Tree, source: &str, entities: &[CodeEntity]) -> Result<Vec<CodeRelationship>> {
        let mut relationships = Vec::new();
        // Extract function calls, imports, inheritance, etc.
        // This is a simplified implementation
        Ok(relationships)
    }

    fn calculate_metrics(&self, tree: &Tree, source: &str) -> Result<FileMetrics> {
        let lines = source.lines().count();
        let non_empty_lines = source.lines().filter(|l| !l.trim().is_empty()).count();
        let comment_lines = source.lines().filter(|l| l.trim().starts_with("//") || l.trim().starts_with("/*")).count();
        
        Ok(FileMetrics {
            lines_of_code: lines as u32,
            lines_of_comments: comment_lines as u32,
            blank_lines: (lines - non_empty_lines) as u32,
            functions_count: 0, // Count from entities
            classes_count: 0,   // Count from entities
            interfaces_count: 0,
            cyclomatic_complexity: 1, // Calculate properly
            cognitive_complexity: 1,
            maintainability_index: 100.0,
            technical_debt_hours: 0.0,
            test_coverage_percentage: 0.0,
        })
    }

    fn detect_issues(&self, tree: &Tree, source: &str) -> Result<Vec<AnalysisIssue>> {
        let mut issues = Vec::new();
        // Detect common issues
        Ok(issues)
    }

    fn language_name(&self) -> String {
        "javascript".to_string()
    }
}

impl JavaScriptParser {
    fn extract_entities_recursive(&self, node: &Node, source: &str, parent: &str, entities: &mut Vec<CodeEntity>) {
        match node.kind() {
            "function_declaration" | "function_expression" | "arrow_function" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = source[name_node.byte_range()].to_string();
                    let entity = CodeEntity {
                        id: format!("fn-{}", entities.len()),
                        name,
                        entity_type: EntityType::Function,
                        file_path: "".to_string(), // Set in analyze_file
                        start_line: node.start_position().row as u32 + 1,
                        end_line: node.end_position().row as u32 + 1,
                        start_column: node.start_position().column,
                        end_column: node.end_position().column,
                        signature: Some(source[node.byte_range()].to_string()),
                        docstring: None,
                        visibility: None,
                        parameters: Vec::new(),
                        return_type: None,
                        properties: HashMap::new(),
                        parent_id: if parent.is_empty() { None } else { Some(parent.to_string()) },
                        children: Vec::new(),
                    };
                    entities.push(entity);
                }
            }
            "class_declaration" | "class_expression" => {
                if let Some(name_node) = node.child_by_field_name("name") {
                    let name = source[name_node.byte_range()].to_string();
                    let entity = CodeEntity {
                        id: format!("class-{}", entities.len()),
                        name,
                        entity_type: EntityType::Class,
                        file_path: "".to_string(),
                        start_line: node.start_position().row as u32 + 1,
                        end_line: node.end_position().row as u32 + 1,
                        start_column: node.start_position().column,
                        end_column: node.end_position().column,
                        signature: None,
                        docstring: None,
                        visibility: None,
                        parameters: Vec::new(),
                        return_type: None,
                        properties: HashMap::new(),
                        parent_id: if parent.is_empty() { None } else { Some(parent.to_string()) },
                        children: Vec::new(),
                    };
                    entities.push(entity);
                }
            }
            _ => {}
        }

        // Recursively process children
        let mut cursor = node.walk();
        for child in node.children(&mut cursor) {
            self.extract_entities_recursive(&child, source, parent, entities);
        }
    }
}

// Simplified implementations for other languages
struct PythonParser { /* Similar implementation */ }
struct RustParser { /* Similar implementation */ }
struct CppParser { /* Similar implementation */ }
struct GoParser { /* Similar implementation */ }
struct JavaParser { /* Similar implementation */ }

impl PythonParser {
    fn new() -> Self { Self }
}

impl RustParser {
    fn new() -> Self { Self }
}

impl CppParser {
    fn new() -> Self { Self }
}

impl GoParser {
    fn new() -> Self { Self }
}

impl JavaParser {
    fn new() -> Self { Self }
}

#[async_trait]
impl LanguageParser for PythonParser {
    fn parse(&mut self, _source: &str) -> Result<Tree> { todo!() }
    fn extract_entities(&self, _tree: &Tree, _source: &str) -> Result<Vec<CodeEntity>> { todo!() }
    fn extract_relationships(&self, _tree: &Tree, _source: &str, _entities: &[CodeEntity]) -> Result<Vec<CodeRelationship>> { todo!() }
    fn calculate_metrics(&self, _tree: &Tree, _source: &str) -> Result<FileMetrics> { todo!() }
    fn detect_issues(&self, _tree: &Tree, _source: &str) -> Result<Vec<AnalysisIssue>> { todo!() }
    fn language_name(&self) -> String { "python".to_string() }
}

#[async_trait]
impl LanguageParser for RustParser {
    fn parse(&mut self, _source: &str) -> Result<Tree> { todo!() }
    fn extract_entities(&self, _tree: &Tree, _source: &str) -> Result<Vec<CodeEntity>> { todo!() }
    fn extract_relationships(&self, _tree: &Tree, _source: &str, _entities: &[CodeEntity]) -> Result<Vec<CodeRelationship>> { todo!() }
    fn calculate_metrics(&self, _tree: &Tree, _source: &str) -> Result<FileMetrics> { todo!() }
    fn detect_issues(&self, _tree: &Tree, _source: &str) -> Result<Vec<AnalysisIssue>> { todo!() }
    fn language_name(&self) -> String { "rust".to_string() }
}

#[async_trait]
impl LanguageParser for CppParser {
    fn parse(&mut self, _source: &str) -> Result<Tree> { todo!() }
    fn extract_entities(&self, _tree: &Tree, _source: &str) -> Result<Vec<CodeEntity>> { todo!() }
    fn extract_relationships(&self, _tree: &Tree, _source: &str, _entities: &[CodeEntity]) -> Result<Vec<CodeRelationship>> { todo!() }
    fn calculate_metrics(&self, _tree: &Tree, _source: &str) -> Result<FileMetrics> { todo!() }
    fn detect_issues(&self, _tree: &Tree, _source: &str) -> Result<Vec<AnalysisIssue>> { todo!() }
    fn language_name(&self) -> String { "cpp".to_string() }
}

#[async_trait]
impl LanguageParser for GoParser {
    fn parse(&mut self, _source: &str) -> Result<Tree> { todo!() }
    fn extract_entities(&self, _tree: &Tree, _source: &str) -> Result<Vec<CodeEntity>> { todo!() }
    fn extract_relationships(&self, _tree: &Tree, _source: &str, _entities: &[CodeEntity]) -> Result<Vec<CodeRelationship>> { todo!() }
    fn calculate_metrics(&self, _tree: &Tree, _source: &str) -> Result<FileMetrics> { todo!() }
    fn detect_issues(&self, _tree: &Tree, _source: &str) -> Result<Vec<AnalysisIssue>> { todo!() }
    fn language_name(&self) -> String { "go".to_string() }
}

#[async_trait]
impl LanguageParser for JavaParser {
    fn parse(&mut self, _source: &str) -> Result<Tree> { todo!() }
    fn extract_entities(&self, _tree: &Tree, _source: &str) -> Result<Vec<CodeEntity>> { todo!() }
    fn extract_relationships(&self, _tree: &Tree, _source: &str, _entities: &[CodeEntity]) -> Result<Vec<CodeRelationship>> { todo!() }
    fn calculate_metrics(&self, _tree: &Tree, _source: &str) -> Result<FileMetrics> { todo!() }
    fn detect_issues(&self, _tree: &Tree, _source: &str) -> Result<Vec<AnalysisIssue>> { todo!() }
    fn language_name(&self) -> String { "java".to_string() }
}

impl Default for AnalysisConfig {
    fn default() -> Self {
        Self {
            enabled_languages: vec![
                "javascript".to_string(),
                "typescript".to_string(),
                "python".to_string(),
                "rust".to_string(),
            ],
            max_file_size_mb: 10,
            timeout_seconds: 30,
            include_patterns: vec!["**/*.{js,ts,py,rs,cpp,hpp,c,h}".to_string()],
            exclude_patterns: vec![
                "**/node_modules/**".to_string(),
                "**/target/**".to_string(),
                "**/dist/**".to_string(),
                "**/.git/**".to_string(),
                "**/vendor/**".to_string(),
            ],
            analysis_depth: AnalysisDepth::Semantic,
            enable_semantic_analysis: true,
            enable_complexity_analysis: true,
            enable_security_analysis: true,
            cache_results: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_analyzer_initialization() {
        let mut analyzer = TreeSitterAnalyzer::new();
        let config = AnalysisConfig::default();

        let result = analyzer.initialize(config).await;
        assert!(result.is_ok());
    }

    #[test]
    fn test_language_detection() {
        let analyzer = TreeSitterAnalyzer::new();
        
        assert_eq!(analyzer.detect_language("test.js", "function test() {}"), Some("javascript".to_string()));
        assert_eq!(analyzer.detect_language("test.py", "#!/usr/bin/env python"), Some("python".to_string()));
        assert_eq!(analyzer.detect_language("test.rs", "fn main() {}"), Some("rust".to_string()));
    }

    #[test]
    fn test_config_validation() {
        let analyzer = TreeSitterAnalyzer::new();
        
        let valid_config = AnalysisConfig::default();
        assert!(analyzer.validate_config(&valid_config).is_ok());
        
        let invalid_config = AnalysisConfig {
            enabled_languages: vec![],
            ..Default::default()
        };
        assert!(analyzer.validate_config(&invalid_config).is_err());
    }
}