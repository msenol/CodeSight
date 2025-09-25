//! Tree-sitter based code parser for Code Intelligence MCP Server
//!
//! This crate provides parsing capabilities for multiple programming languages
//! using Tree-sitter parsers. It extracts code entities like functions, classes,
//! variables, and their relationships.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use uuid::Uuid;

pub mod languages;
pub mod parsers;
pub mod extractors;
pub mod utils;

/// Supported programming languages
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Language {
    TypeScript,
    JavaScript,
    Python,
    Rust,
    Go,
    Java,
    Cpp,
    CSharp,
}

impl std::fmt::Display for Language {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Language::TypeScript => write!(f, "TypeScript"),
            Language::JavaScript => write!(f, "JavaScript"),
            Language::Python => write!(f, "Python"),
            Language::Rust => write!(f, "Rust"),
            Language::Go => write!(f, "Go"),
            Language::Java => write!(f, "Java"),
            Language::Cpp => write!(f, "C++"),
            Language::CSharp => write!(f, "C#"),
        }
    }
}

/// Code entity types that can be extracted
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EntityType {
    Function,
    Class,
    Interface,
    Variable,
    Constant,
    Module,
    Import,
    Export,
}

/// Parsed code entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeEntity {
    pub id: Uuid,
    pub name: String,
    pub entity_type: EntityType,
    pub file_path: String,
    pub start_line: u32,
    pub end_line: u32,
    pub start_column: u32,
    pub end_column: u32,
    pub content: String,
    pub signature: Option<String>,
    pub documentation: Option<String>,
    pub visibility: Option<String>,
    pub parameters: Vec<Parameter>,
    pub return_type: Option<String>,
    pub dependencies: Vec<String>,
    pub metadata: HashMap<String, String>,
}

/// Function/method parameter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameter {
    pub name: String,
    pub param_type: Option<String>,
    pub default_value: Option<String>,
    pub is_optional: bool,
}

/// Parse result containing extracted entities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult {
    pub file_path: String,
    pub language: Language,
    pub entities: Vec<CodeEntity>,
    pub imports: Vec<String>,
    pub exports: Vec<String>,
    pub errors: Vec<ParseError>,
    pub parse_time_ms: u64,
}

/// Parse error information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseError {
    pub message: String,
    pub line: u32,
    pub column: u32,
    pub severity: ErrorSeverity,
}

/// Error severity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Error,
    Warning,
    Info,
}

/// Main parser interface
pub struct CodeParser {
    parsers: HashMap<Language, Box<dyn LanguageParser>>,
}

/// Language-specific parser trait
pub trait LanguageParser: Send + Sync {
    fn parse_file(&self, file_path: &Path, content: &str) -> Result<ParseResult>;
    fn extract_entities(&self, tree: &tree_sitter::Tree, content: &str) -> Result<Vec<CodeEntity>>;
    fn get_language(&self) -> Language;
}

impl CodeParser {
    /// Create a new code parser with all supported languages
    pub fn new() -> Self {
        let mut parsers: HashMap<Language, Box<dyn LanguageParser>> = HashMap::new();

        // Initialize parsers for each language
        parsers.insert(Language::TypeScript, Box::new(parsers::TypeScriptParser::new()));
        parsers.insert(Language::JavaScript, Box::new(parsers::JavaScriptParser::new()));
        parsers.insert(Language::Python, Box::new(parsers::PythonParser::new()));
        parsers.insert(Language::Rust, Box::new(parsers::RustParser::new()));
        parsers.insert(Language::Go, Box::new(parsers::GoParser::new()));
        parsers.insert(Language::Java, Box::new(parsers::JavaParser::new()));
        parsers.insert(Language::Cpp, Box::new(parsers::CppParser::new()));
        parsers.insert(Language::CSharp, Box::new(parsers::CSharpParser::new()));

        Self { parsers }
    }
    
    /// Parse a file and extract code entities
    pub fn parse_file(&self, file_path: &Path, content: &str) -> Result<ParseResult> {
        let language = self.detect_language(file_path)?;
        
        if let Some(parser) = self.parsers.get(&language) {
            parser.parse_file(file_path, content)
        } else {
            anyhow::bail!("Unsupported language: {:?}", language)
        }
    }
    
    /// Detect programming language from file extension
    pub fn detect_language(&self, file_path: &Path) -> Result<Language> {
        let extension = file_path
            .extension()
            .and_then(|ext| ext.to_str())
            .ok_or_else(|| anyhow::anyhow!("No file extension found"))?;
        
        match extension {
            "ts" | "tsx" => Ok(Language::TypeScript),
            "js" | "jsx" | "mjs" => Ok(Language::JavaScript),
            "py" | "pyw" => Ok(Language::Python),
            "rs" => Ok(Language::Rust),
            "go" => Ok(Language::Go),
            "java" => Ok(Language::Java),
            "cpp" | "cc" | "cxx" | "c++" | "hpp" | "h" => Ok(Language::Cpp),
            "cs" => Ok(Language::CSharp),
            _ => anyhow::bail!("Unsupported file extension: {}", extension),
        }
    }
    
    /// Get supported languages
    pub fn supported_languages(&self) -> Vec<Language> {
        self.parsers.keys().cloned().collect()
    }

    /// Get all supported file extensions
    pub fn all_supported_extensions() -> Vec<&'static str> {
        vec![
            "ts", "tsx",      // TypeScript
            "js", "jsx", "mjs", // JavaScript
            "py", "pyw",      // Python
            "rs",             // Rust
            "go",             // Go
            "java",           // Java
            "cpp", "cc", "cxx", "c++", "hpp", "h", // C++
            "cs",             // C#
        ]
    }
}

impl Default for CodeParser {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    
    #[test]
    fn test_language_detection() {
        let parser = CodeParser::new();
        
        assert_eq!(parser.detect_language(&PathBuf::from("test.ts")).unwrap(), Language::TypeScript);
        assert_eq!(parser.detect_language(&PathBuf::from("test.js")).unwrap(), Language::JavaScript);
        assert_eq!(parser.detect_language(&PathBuf::from("test.py")).unwrap(), Language::Python);
        assert_eq!(parser.detect_language(&PathBuf::from("test.rs")).unwrap(), Language::Rust);
        assert_eq!(parser.detect_language(&PathBuf::from("test.go")).unwrap(), Language::Go);
        assert_eq!(parser.detect_language(&PathBuf::from("test.java")).unwrap(), Language::Java);
        assert_eq!(parser.detect_language(&PathBuf::from("test.cpp")).unwrap(), Language::Cpp);
        assert_eq!(parser.detect_language(&PathBuf::from("test.cs")).unwrap(), Language::CSharp);
    }
    
    #[test]
    fn test_supported_languages() {
        let parser = CodeParser::new();
        let languages = parser.supported_languages();

        // All parsers should now be initialized
        assert_eq!(languages.len(), 8);
        assert!(languages.contains(&Language::TypeScript));
        assert!(languages.contains(&Language::JavaScript));
        assert!(languages.contains(&Language::Python));
        assert!(languages.contains(&Language::Rust));
        assert!(languages.contains(&Language::Go));
        assert!(languages.contains(&Language::Java));
        assert!(languages.contains(&Language::Cpp));
        assert!(languages.contains(&Language::CSharp));
    }
}

// Re-export utility functions
pub use languages::all_supported_extensions;