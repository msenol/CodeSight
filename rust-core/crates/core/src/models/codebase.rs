//! Codebase model implementation
//!
//! Represents a project or repository being indexed by the Code Intelligence system.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

use super::{ModelResult, Timestamped, Validate};
use crate::error::CodeIntelligenceError;

/// Status of a codebase in the indexing system
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CodebaseStatus {
    /// Codebase has not been indexed yet
    Unindexed,
    /// Codebase is currently being indexed
    Indexing,
    /// Codebase has been successfully indexed
    Indexed,
    /// An error occurred during indexing
    Error,
}

impl Default for CodebaseStatus {
    fn default() -> Self {
        Self::Unindexed
    }
}

/// Root entity representing a project or repository being indexed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Codebase {
    /// Unique identifier for the codebase
    pub id: Uuid,
    /// Human-readable name for the codebase
    pub name: String,
    /// Absolute filesystem path to the codebase
    pub path: String,
    /// Total size of the codebase in bytes
    pub size_bytes: u64,
    /// Total number of files in the codebase
    pub file_count: u32,
    /// Statistics about programming languages used (language -> file count)
    pub language_stats: HashMap<String, u32>,
    /// Version of the index format used
    pub index_version: Option<String>,
    /// Timestamp when the codebase was last indexed
    pub last_indexed: Option<DateTime<Utc>>,
    /// Reference to the configuration used for this codebase
    pub configuration_id: Option<Uuid>,
    /// Current status of the codebase
    pub status: CodebaseStatus,
    /// Timestamp when the codebase was created
    pub created_at: DateTime<Utc>,
    /// Timestamp when the codebase was last updated
    pub updated_at: Option<DateTime<Utc>>,
}

impl Codebase {
    /// Create a new codebase with the given name and path
    pub fn new(name: String, path: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            name,
            path,
            size_bytes: 0,
            file_count: 0,
            language_stats: HashMap::new(),
            index_version: None,
            last_indexed: None,
            configuration_id: None,
            status: CodebaseStatus::default(),
            created_at: Utc::now(),
            updated_at: None,
        }
    }

    /// Update the codebase with new statistics
    pub fn update_stats(&mut self, size_bytes: u64, file_count: u32, language_stats: HashMap<String, u32>) {
        self.size_bytes = size_bytes;
        self.file_count = file_count;
        self.language_stats = language_stats;
        self.updated_at = Some(Utc::now());
    }

    /// Mark the codebase as indexed with the given version
    pub fn mark_indexed(&mut self, index_version: String) {
        self.status = CodebaseStatus::Indexed;
        self.index_version = Some(index_version);
        self.last_indexed = Some(Utc::now());
        self.updated_at = Some(Utc::now());
    }

    /// Mark the codebase as having an indexing error
    pub fn mark_error(&mut self) {
        self.status = CodebaseStatus::Error;
        self.updated_at = Some(Utc::now());
    }

    /// Start indexing the codebase
    pub fn start_indexing(&mut self) {
        self.status = CodebaseStatus::Indexing;
        self.updated_at = Some(Utc::now());
    }

    /// Check if the codebase is ready for querying
    pub fn is_ready(&self) -> bool {
        matches!(self.status, CodebaseStatus::Indexed)
    }

    /// Get the primary programming language (most files)
    pub fn primary_language(&self) -> Option<&String> {
        self.language_stats
            .iter()
            .max_by_key(|(_, count)| *count)
            .map(|(lang, _)| lang)
    }

    /// Get the total number of supported languages
    pub fn language_count(&self) -> usize {
        self.language_stats.len()
    }

    /// Check if the codebase supports a specific language
    pub fn supports_language(&self, language: &str) -> bool {
        self.language_stats.contains_key(language)
    }

    /// Get a human-readable size string
    pub fn size_human_readable(&self) -> String {
        const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
        let mut size = self.size_bytes as f64;
        let mut unit_index = 0;

        while size >= 1024.0 && unit_index < UNITS.len() - 1 {
            size /= 1024.0;
            unit_index += 1;
        }

        format!("{:.1} {}", size, UNITS[unit_index])
    }
}

impl Validate for Codebase {
    fn validate(&self) -> ModelResult<()> {
        if self.name.trim().is_empty() {
            return Err(CodeIntelligenceError::ValidationError(
                "Codebase name cannot be empty".to_string(),
            ));
        }

        if self.path.trim().is_empty() {
            return Err(CodeIntelligenceError::ValidationError(
                "Codebase path cannot be empty".to_string(),
            ));
        }

        // Validate that path is absolute
        if !std::path::Path::new(&self.path).is_absolute() {
            return Err(CodeIntelligenceError::ValidationError(
                "Codebase path must be absolute".to_string(),
            ));
        }

        // Validate that file count matches language stats
        let total_files: u32 = self.language_stats.values().sum();
        if total_files > self.file_count {
            return Err(CodeIntelligenceError::ValidationError(
                "Language statistics exceed total file count".to_string(),
            ));
        }

        Ok(())
    }
}

impl Timestamped for Codebase {
    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    fn updated_at(&self) -> Option<DateTime<Utc>> {
        self.updated_at
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_codebase() {
        let codebase = Codebase::new("test-project".to_string(), "/path/to/project".to_string());
        
        assert_eq!(codebase.name, "test-project");
        assert_eq!(codebase.path, "/path/to/project");
        assert_eq!(codebase.status, CodebaseStatus::Unindexed);
        assert_eq!(codebase.size_bytes, 0);
        assert_eq!(codebase.file_count, 0);
        assert!(codebase.language_stats.is_empty());
    }

    #[test]
    fn test_update_stats() {
        let mut codebase = Codebase::new("test".to_string(), "/test".to_string());
        let mut stats = HashMap::new();
        stats.insert("rust".to_string(), 10);
        stats.insert("typescript".to_string(), 5);
        
        codebase.update_stats(1024, 15, stats.clone());
        
        assert_eq!(codebase.size_bytes, 1024);
        assert_eq!(codebase.file_count, 15);
        assert_eq!(codebase.language_stats, stats);
        assert!(codebase.updated_at.is_some());
    }

    #[test]
    fn test_mark_indexed() {
        let mut codebase = Codebase::new("test".to_string(), "/test".to_string());
        codebase.mark_indexed("v1.0.0".to_string());
        
        assert_eq!(codebase.status, CodebaseStatus::Indexed);
        assert_eq!(codebase.index_version, Some("v1.0.0".to_string()));
        assert!(codebase.last_indexed.is_some());
        assert!(codebase.is_ready());
    }

    #[test]
    fn test_primary_language() {
        let mut codebase = Codebase::new("test".to_string(), "/test".to_string());
        let mut stats = HashMap::new();
        stats.insert("rust".to_string(), 10);
        stats.insert("typescript".to_string(), 5);
        stats.insert("python".to_string(), 15);
        
        codebase.update_stats(1024, 30, stats);
        
        assert_eq!(codebase.primary_language(), Some(&"python".to_string()));
    }

    #[test]
    fn test_size_human_readable() {
        let mut codebase = Codebase::new("test".to_string(), "/test".to_string());
        
        codebase.size_bytes = 1024;
        assert_eq!(codebase.size_human_readable(), "1.0 KB");
        
        codebase.size_bytes = 1024 * 1024;
        assert_eq!(codebase.size_human_readable(), "1.0 MB");
        
        codebase.size_bytes = 1536; // 1.5 KB
        assert_eq!(codebase.size_human_readable(), "1.5 KB");
    }

    #[test]
    fn test_validation() {
        let mut codebase = Codebase::new("".to_string(), "/test".to_string());
        assert!(codebase.validate().is_err());
        
        codebase.name = "test".to_string();
        codebase.path = "relative/path".to_string();
        assert!(codebase.validate().is_err());
        
        codebase.path = "/absolute/path".to_string();
        assert!(codebase.validate().is_ok());
    }
}