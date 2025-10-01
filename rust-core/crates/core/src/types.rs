//! Core types for Code Intelligence

use serde::{Deserialize, Serialize};

/// Language types
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

/// Entity visibility
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Visibility {
    Public,
    Private,
    Protected,
    Internal,
}

/// Function parameter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Parameter {
    pub name: String,
    pub param_type: Option<String>,
    pub default_value: Option<String>,
    pub is_optional: bool,
}

/// Code location
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Location {
    pub file_path: String,
    pub start_line: u32,
    pub end_line: u32,
    pub start_column: u32,
    pub end_column: u32,
}

/// Search highlight
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Highlight {
    pub start: usize,
    pub end: usize,
    pub text: String,
}

/// Metrics for performance tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metrics {
    pub parse_time_ms: u64,
    pub index_time_ms: u64,
    pub search_time_ms: u64,
    pub total_entities: usize,
    pub cache_hits: usize,
    pub cache_misses: usize,
}

/// Progress tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Progress {
    pub current: usize,
    pub total: usize,
    pub percentage: f32,
    pub message: String,
}