//! Configuration management for Code Intelligence Core

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Database configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub timeout_seconds: u64,
}

/// Cache configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    pub redis_url: Option<String>,
    pub memory_size: usize,
    pub ttl_seconds: u64,
}

/// Embedding configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingConfig {
    pub model_path: Option<PathBuf>,
    pub dimension: usize,
    pub batch_size: usize,
}

/// Indexing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexingConfig {
    pub max_workers: usize,
    pub chunk_size: usize,
    pub include_patterns: Vec<String>,
    pub exclude_patterns: Vec<String>,
}

/// Logging configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfig {
    pub level: String,
    pub file_path: Option<PathBuf>,
    pub max_file_size: u64,
}

/// Performance configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceConfig {
    pub query_timeout_ms: u64,
    pub max_results: usize,
    pub enable_metrics: bool,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            url: "sqlite://./code_intelligence.db".to_string(),
            max_connections: 10,
            timeout_seconds: 30,
        }
    }
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            redis_url: None,
            memory_size: 1000,
            ttl_seconds: 3600,
        }
    }
}

impl Default for EmbeddingConfig {
    fn default() -> Self {
        Self {
            model_path: None,
            dimension: 384,
            batch_size: 32,
        }
    }
}

impl Default for IndexingConfig {
    fn default() -> Self {
        Self {
            max_workers: num_cpus::get(),
            chunk_size: 1000,
            include_patterns: vec!["**/*.rs".to_string(), "**/*.ts".to_string(), "**/*.js".to_string()],
            exclude_patterns: vec!["**/node_modules/**".to_string(), "**/target/**".to_string()],
        }
    }
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            file_path: None,
            max_file_size: 10 * 1024 * 1024, // 10MB
        }
    }
}

impl Default for PerformanceConfig {
    fn default() -> Self {
        Self {
            query_timeout_ms: 5000,
            max_results: 100,
            enable_metrics: true,
        }
    }
}