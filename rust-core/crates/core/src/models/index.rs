//! Index model implementation
//!
//! Represents searchable index structures for codebases

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use super::{ModelResult, Timestamped, Validate};
use crate::error::CodeIntelligenceError;

/// Type of search index
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IndexType {
    /// Keyword-based full-text search index
    Keyword,
    /// Abstract Syntax Tree based index
    Ast,
    /// Semantic search index using embeddings
    Semantic,
    /// Vector-based similarity search index
    Vector,
}

/// Status of an index
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IndexStatus {
    /// Index is currently being built
    Building,
    /// Index is ready for use
    Ready,
    /// Index is corrupted and needs rebuilding
    Corrupted,
    /// Index is being rebuilt
    Rebuilding,
}

impl Default for IndexStatus {
    fn default() -> Self {
        Self::Building
    }
}

/// Searchable index structure for a codebase
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Index {
    /// Unique identifier for the index
    pub id: Uuid,
    /// Reference to the codebase this index belongs to
    pub codebase_id: Uuid,
    /// Type of index
    pub index_type: IndexType,
    /// Current status of the index
    pub status: IndexStatus,
    /// Timestamp when the index was created
    pub created_at: DateTime<Utc>,
    /// Timestamp when the index was last updated
    pub updated_at: DateTime<Utc>,
    /// Size of the index in bytes
    pub size_bytes: u64,
    /// Number of entries in the index
    pub entry_count: u64,
    /// Index-specific metadata and configuration
    pub metadata: JsonValue,
}

impl Index {
    /// Create a new index
    pub fn new(codebase_id: Uuid, index_type: IndexType) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            codebase_id,
            index_type,
            status: IndexStatus::default(),
            created_at: now,
            updated_at: now,
            size_bytes: 0,
            entry_count: 0,
            metadata: JsonValue::Object(serde_json::Map::new()),
        }
    }

    /// Create a new index with metadata
    pub fn with_metadata(codebase_id: Uuid, index_type: IndexType, metadata: JsonValue) -> Self {
        let mut index = Self::new(codebase_id, index_type);
        index.metadata = metadata;
        index
    }

    /// Mark the index as ready
    pub fn mark_ready(&mut self) {
        self.status = IndexStatus::Ready;
        self.updated_at = Utc::now();
    }

    /// Mark the index as corrupted
    pub fn mark_corrupted(&mut self) {
        self.status = IndexStatus::Corrupted;
        self.updated_at = Utc::now();
    }

    /// Start rebuilding the index
    pub fn start_rebuilding(&mut self) {
        self.status = IndexStatus::Rebuilding;
        self.updated_at = Utc::now();
    }

    /// Update index statistics
    pub fn update_stats(&mut self, size_bytes: u64, entry_count: u64) {
        self.size_bytes = size_bytes;
        self.entry_count = entry_count;
        self.updated_at = Utc::now();
    }

    /// Check if the index is ready for use
    pub fn is_ready(&self) -> bool {
        matches!(self.status, IndexStatus::Ready)
    }

    /// Check if the index is being built or rebuilt
    pub fn is_building(&self) -> bool {
        matches!(self.status, IndexStatus::Building | IndexStatus::Rebuilding)
    }

    /// Check if the index needs rebuilding
    pub fn needs_rebuilding(&self) -> bool {
        matches!(self.status, IndexStatus::Corrupted)
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

    /// Get the index type as a string
    pub fn type_string(&self) -> &'static str {
        match self.index_type {
            IndexType::Keyword => "Keyword",
            IndexType::Ast => "AST",
            IndexType::Semantic => "Semantic",
            IndexType::Vector => "Vector",
        }
    }

    /// Get the status as a string
    pub fn status_string(&self) -> &'static str {
        match self.status {
            IndexStatus::Building => "Building",
            IndexStatus::Ready => "Ready",
            IndexStatus::Corrupted => "Corrupted",
            IndexStatus::Rebuilding => "Rebuilding",
        }
    }

    /// Get metadata value by key
    pub fn get_metadata(&self, key: &str) -> Option<&JsonValue> {
        self.metadata.get(key)
    }

    /// Set metadata value
    pub fn set_metadata(&mut self, key: String, value: JsonValue) {
        if let JsonValue::Object(ref mut map) = self.metadata {
            map.insert(key, value);
        } else {
            let mut map = serde_json::Map::new();
            map.insert(key, value);
            self.metadata = JsonValue::Object(map);
        }
        self.updated_at = Utc::now();
    }

    /// Get the age of the index
    pub fn age(&self) -> chrono::Duration {
        Utc::now() - self.created_at
    }

    /// Get the time since last update
    pub fn time_since_update(&self) -> chrono::Duration {
        Utc::now() - self.updated_at
    }

    /// Check if the index is stale (older than specified duration)
    pub fn is_stale(&self, max_age: chrono::Duration) -> bool {
        self.time_since_update() > max_age
    }

    /// Calculate entries per byte ratio
    pub fn entries_per_byte(&self) -> f64 {
        if self.size_bytes == 0 {
            0.0
        } else {
            self.entry_count as f64 / self.size_bytes as f64
        }
    }

    /// Get compression ratio (if available in metadata)
    pub fn compression_ratio(&self) -> Option<f64> {
        self.get_metadata("compression_ratio")
            .and_then(|v| v.as_f64())
    }

    /// Set compression ratio in metadata
    pub fn set_compression_ratio(&mut self, ratio: f64) {
        self.set_metadata("compression_ratio".to_string(), JsonValue::from(ratio));
    }

    /// Get build duration (if available in metadata)
    pub fn build_duration(&self) -> Option<chrono::Duration> {
        self.get_metadata("build_duration_ms")
            .and_then(|v| v.as_u64())
            .map(|ms| chrono::Duration::milliseconds(ms as i64))
    }

    /// Set build duration in metadata
    pub fn set_build_duration(&mut self, duration: chrono::Duration) {
        let ms = duration.num_milliseconds().max(0) as u64;
        self.set_metadata("build_duration_ms".to_string(), JsonValue::from(ms));
    }
}

impl Validate for Index {
    fn validate(&self) -> ModelResult<()> {
        if self.entry_count > 0 && self.size_bytes == 0 {
            return Err(CodeIntelligenceError::ValidationError(
                "Index cannot have entries but zero size".to_string(),
            ));
        }

        if self.created_at > self.updated_at {
            return Err(CodeIntelligenceError::ValidationError(
                "Created timestamp cannot be after updated timestamp".to_string(),
            ));
        }

        // Validate metadata is an object
        if !self.metadata.is_object() {
            return Err(CodeIntelligenceError::ValidationError(
                "Metadata must be a JSON object".to_string(),
            ));
        }

        Ok(())
    }
}

impl Timestamped for Index {
    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    fn updated_at(&self) -> Option<DateTime<Utc>> {
        Some(self.updated_at)
    }
}

/// Index entry representing a single item in an index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexEntry {
    /// Unique identifier for the entry
    pub id: Uuid,
    /// Reference to the index this entry belongs to
    pub index_id: Uuid,
    /// Reference to the code entity (if applicable)
    pub entity_id: Option<Uuid>,
    /// The indexed content or key
    pub content: String,
    /// Weight or score for ranking
    pub weight: f32,
    /// Entry-specific metadata
    pub metadata: JsonValue,
    /// Timestamp when the entry was created
    pub created_at: DateTime<Utc>,
}

impl IndexEntry {
    /// Create a new index entry
    pub fn new(index_id: Uuid, content: String, weight: f32) -> Self {
        Self {
            id: Uuid::new_v4(),
            index_id,
            entity_id: None,
            content,
            weight: weight.clamp(0.0, 1.0),
            metadata: JsonValue::Object(serde_json::Map::new()),
            created_at: Utc::now(),
        }
    }

    /// Create a new index entry with entity reference
    pub fn with_entity(index_id: Uuid, entity_id: Uuid, content: String, weight: f32) -> Self {
        let mut entry = Self::new(index_id, content, weight);
        entry.entity_id = Some(entity_id);
        entry
    }

    /// Set metadata for the entry
    pub fn with_metadata(mut self, metadata: JsonValue) -> Self {
        self.metadata = metadata;
        self
    }

    /// Check if the entry has an associated entity
    pub fn has_entity(&self) -> bool {
        self.entity_id.is_some()
    }

    /// Get the content length
    pub fn content_length(&self) -> usize {
        self.content.len()
    }
}

/// Statistics for an index
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexStats {
    /// Total number of indexes
    pub total_indexes: usize,
    /// Count by index type
    pub by_type: std::collections::HashMap<IndexType, usize>,
    /// Count by status
    pub by_status: std::collections::HashMap<IndexStatus, usize>,
    /// Total size in bytes
    pub total_size_bytes: u64,
    /// Total number of entries
    pub total_entries: u64,
    /// Average entries per index
    pub average_entries_per_index: f64,
}

impl IndexStats {
    /// Create statistics from a collection of indexes
    pub fn from_indexes(indexes: &[Index]) -> Self {
        let mut by_type = std::collections::HashMap::new();
        let mut by_status = std::collections::HashMap::new();
        let mut total_size_bytes = 0;
        let mut total_entries = 0;

        for index in indexes {
            *by_type.entry(index.index_type.clone()).or_insert(0) += 1;
            *by_status.entry(index.status.clone()).or_insert(0) += 1;
            total_size_bytes += index.size_bytes;
            total_entries += index.entry_count;
        }

        let average_entries_per_index = if indexes.is_empty() {
            0.0
        } else {
            total_entries as f64 / indexes.len() as f64
        };

        Self {
            total_indexes: indexes.len(),
            by_type,
            by_status,
            total_size_bytes,
            total_entries,
            average_entries_per_index,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_new_index() {
        let codebase_id = Uuid::new_v4();
        let index = Index::new(codebase_id, IndexType::Keyword);

        assert_eq!(index.codebase_id, codebase_id);
        assert_eq!(index.index_type, IndexType::Keyword);
        assert_eq!(index.status, IndexStatus::Building);
        assert_eq!(index.size_bytes, 0);
        assert_eq!(index.entry_count, 0);
        assert!(index.metadata.is_object());
    }

    #[test]
    fn test_index_with_metadata() {
        let metadata = json!({
            "version": "1.0",
            "config": {
                "max_entries": 10000
            }
        });
        
        let index = Index::with_metadata(Uuid::new_v4(), IndexType::Semantic, metadata.clone());
        assert_eq!(index.metadata, metadata);
        assert_eq!(index.get_metadata("version").unwrap(), &json!("1.0"));
    }

    #[test]
    fn test_index_status_transitions() {
        let mut index = Index::new(Uuid::new_v4(), IndexType::Ast);
        
        assert_eq!(index.status, IndexStatus::Building);
        assert!(index.is_building());
        assert!(!index.is_ready());
        
        index.mark_ready();
        assert_eq!(index.status, IndexStatus::Ready);
        assert!(index.is_ready());
        assert!(!index.is_building());
        
        index.mark_corrupted();
        assert_eq!(index.status, IndexStatus::Corrupted);
        assert!(index.needs_rebuilding());
        
        index.start_rebuilding();
        assert_eq!(index.status, IndexStatus::Rebuilding);
        assert!(index.is_building());
    }

    #[test]
    fn test_index_stats_update() {
        let mut index = Index::new(Uuid::new_v4(), IndexType::Vector);
        
        index.update_stats(1024 * 1024, 5000); // 1MB, 5000 entries
        assert_eq!(index.size_bytes, 1024 * 1024);
        assert_eq!(index.entry_count, 5000);
        assert_eq!(index.size_human_readable(), "1.0 MB");
    }

    #[test]
    fn test_index_metadata_operations() {
        let mut index = Index::new(Uuid::new_v4(), IndexType::Keyword);
        
        index.set_metadata("test_key".to_string(), json!("test_value"));
        assert_eq!(index.get_metadata("test_key").unwrap(), &json!("test_value"));
        
        index.set_compression_ratio(0.75);
        assert_eq!(index.compression_ratio().unwrap(), 0.75);
        
        let duration = chrono::Duration::seconds(30);
        index.set_build_duration(duration);
        assert_eq!(index.build_duration().unwrap(), duration);
    }

    #[test]
    fn test_index_entry() {
        let index_id = Uuid::new_v4();
        let entity_id = Uuid::new_v4();
        
        let entry = IndexEntry::with_entity(
            index_id,
            entity_id,
            "test content".to_string(),
            0.8,
        );
        
        assert_eq!(entry.index_id, index_id);
        assert_eq!(entry.entity_id, Some(entity_id));
        assert_eq!(entry.content, "test content");
        assert_eq!(entry.weight, 0.8);
        assert!(entry.has_entity());
        assert_eq!(entry.content_length(), 12);
    }

    #[test]
    fn test_index_validation() {
        let mut index = Index::new(Uuid::new_v4(), IndexType::Keyword);
        
        // Valid index
        assert!(index.validate().is_ok());
        
        // Invalid: entries without size
        index.entry_count = 100;
        index.size_bytes = 0;
        assert!(index.validate().is_err());
        
        // Fix the issue
        index.size_bytes = 1024;
        assert!(index.validate().is_ok());
    }

    #[test]
    fn test_index_stats() {
        let indexes = vec![
            Index::new(Uuid::new_v4(), IndexType::Keyword),
            Index::new(Uuid::new_v4(), IndexType::Keyword),
            Index::new(Uuid::new_v4(), IndexType::Semantic),
        ];
        
        let stats = IndexStats::from_indexes(&indexes);
        assert_eq!(stats.total_indexes, 3);
        assert_eq!(stats.by_type[&IndexType::Keyword], 2);
        assert_eq!(stats.by_type[&IndexType::Semantic], 1);
        assert_eq!(stats.by_status[&IndexStatus::Building], 3);
    }

    #[test]
    fn test_index_age_and_staleness() {
        let index = Index::new(Uuid::new_v4(), IndexType::Ast);
        
        assert!(index.age().num_milliseconds() >= 0);
        assert!(index.time_since_update().num_milliseconds() >= 0);
        
        // Should not be stale for a very long duration
        assert!(!index.is_stale(chrono::Duration::days(365)));
        
        // Should be stale for a very short duration
        assert!(index.is_stale(chrono::Duration::nanoseconds(1)));
    }
}