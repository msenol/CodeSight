//! Error types for the Code Intelligence MCP Server

use std::fmt;

/// Main error type for the Code Intelligence system
#[derive(Debug, Clone)]
pub enum CodeIntelligenceError {
    /// Validation error with description
    ValidationError(String),
    /// IO error with description
    IoError(String),
    /// Parse error with description
    ParseError(String),
    /// Index error with description
    IndexError(String),
    /// Search error with description
    SearchError(String),
    /// Configuration error with description
    ConfigError(String),
    /// Database error with description
    DatabaseError(String),
    /// Network error with description
    NetworkError(String),
    /// Authentication error with description
    AuthError(String),
    /// Permission error with description
    PermissionError(String),
    /// Resource not found error
    NotFound(String),
    /// Resource already exists error
    AlreadyExists(String),
    /// Internal error with description
    Internal(String),
}

impl fmt::Display for CodeIntelligenceError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CodeIntelligenceError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            CodeIntelligenceError::IoError(msg) => write!(f, "IO error: {}", msg),
            CodeIntelligenceError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            CodeIntelligenceError::IndexError(msg) => write!(f, "Index error: {}", msg),
            CodeIntelligenceError::SearchError(msg) => write!(f, "Search error: {}", msg),
            CodeIntelligenceError::ConfigError(msg) => write!(f, "Configuration error: {}", msg),
            CodeIntelligenceError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            CodeIntelligenceError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            CodeIntelligenceError::AuthError(msg) => write!(f, "Authentication error: {}", msg),
            CodeIntelligenceError::PermissionError(msg) => write!(f, "Permission error: {}", msg),
            CodeIntelligenceError::NotFound(msg) => write!(f, "Not found: {}", msg),
            CodeIntelligenceError::AlreadyExists(msg) => write!(f, "Already exists: {}", msg),
            CodeIntelligenceError::Internal(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

impl std::error::Error for CodeIntelligenceError {}

/// Result type alias for the Code Intelligence system
pub type Result<T> = std::result::Result<T, CodeIntelligenceError>;

/// Convert from std::io::Error
impl From<std::io::Error> for CodeIntelligenceError {
    fn from(err: std::io::Error) -> Self {
        CodeIntelligenceError::IoError(err.to_string())
    }
}

/// Convert from serde_json::Error
impl From<serde_json::Error> for CodeIntelligenceError {
    fn from(err: serde_json::Error) -> Self {
        CodeIntelligenceError::ParseError(err.to_string())
    }
}