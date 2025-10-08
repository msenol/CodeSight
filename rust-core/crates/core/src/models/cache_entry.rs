//! Cache entry model for storing and retrieving cached data

use super::{Validate, Timestamped};
use crate::errors::CoreError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Represents a cached entry in the system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CacheEntry {
    /// Unique identifier for the cache entry
    pub id: String,
    /// Cache key for retrieval
    pub key: String,
    /// Type of cached data
    pub entry_type: CacheEntryType,
    /// The cached data as bytes
    pub data: Vec<u8>,
    /// Size of the data in bytes
    pub size_bytes: usize,
    /// Content type/format of the data
    pub content_type: String,
    /// Compression algorithm used (if any)
    pub compression: Option<CompressionType>,
    /// Hash of the original data for integrity
    pub data_hash: String,
    /// Metadata about the cache entry
    pub metadata: CacheMetadata,
    /// When the entry expires (TTL)
    pub expires_at: Option<DateTime<Utc>>,
    /// Number of times this entry has been accessed
    pub access_count: u64,
    /// When the entry was last accessed
    pub last_accessed_at: Option<DateTime<Utc>>,
    /// When the entry was created
    pub created_at: DateTime<Utc>,
    /// When the entry was last updated
    pub updated_at: DateTime<Utc>,
}

/// Types of data that can be cached
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CacheEntryType {
    /// Query results
    QueryResult,
    /// Embedding vectors
    Embedding,
    /// Parsed AST data
    ParsedAst,
    /// Index data
    IndexData,
    /// File content
    FileContent,
    /// Processed code snippets
    CodeSnippet,
    /// Search results
    SearchResult,
    /// Configuration data
    Configuration,
    /// Metadata
    Metadata,
    /// Temporary data
    Temporary,
    /// User session data
    Session,
    /// API response
    ApiResponse,
}

/// Compression algorithms supported
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CompressionType {
    /// No compression
    None,
    /// Gzip compression
    Gzip,
    /// Zstd compression
    Zstd,
    /// LZ4 compression
    Lz4,
    /// Brotli compression
    Brotli,
}

/// Metadata associated with cache entries
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct CacheMetadata {
    /// Source of the cached data
    pub source: Option<String>,
    /// Version of the data
    pub version: Option<String>,
    /// Tags for categorization
    pub tags: Vec<String>,
    /// Priority level (higher = more important)
    pub priority: CachePriority,
    /// Whether this entry can be evicted
    pub evictable: bool,
    /// Cost of regenerating this data (1-10)
    pub regeneration_cost: u8,
    /// Frequency of access (for LFU eviction)
    pub access_frequency: f64,
    /// Size of original uncompressed data
    pub original_size_bytes: Option<usize>,
    /// Compression ratio achieved
    pub compression_ratio: Option<f32>,
    /// Additional custom metadata
    pub custom: HashMap<String, String>,
}

/// Priority levels for cache entries
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub enum CachePriority {
    /// Lowest priority - evict first
    Low,
    /// Normal priority
    #[default]
    Normal,
    /// High priority - keep longer
    High,
    /// Critical - avoid eviction
    Critical,
}

/// Cache statistics and metrics
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct CacheStats {
    /// Total number of entries
    pub total_entries: usize,
    /// Total size in bytes
    pub total_size_bytes: usize,
    /// Number of hits
    pub hits: u64,
    /// Number of misses
    pub misses: u64,
    /// Number of evictions
    pub evictions: u64,
    /// Hit ratio (0.0 to 1.0)
    pub hit_ratio: f64,
    /// Average entry size
    pub avg_entry_size: f64,
    /// Memory usage percentage
    pub memory_usage_percent: f64,
    /// Number of expired entries
    pub expired_entries: usize,
}

/// Cache operation result
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CacheOperation {
    /// Type of operation performed
    pub operation: CacheOperationType,
    /// Key involved in the operation
    pub key: String,
    /// Whether the operation was successful
    pub success: bool,
    /// Time taken for the operation in microseconds
    pub duration_micros: u64,
    /// Size of data involved
    pub data_size_bytes: Option<usize>,
    /// Error message if operation failed
    pub error: Option<String>,
    /// When the operation occurred
    pub timestamp: DateTime<Utc>,
}

/// Types of cache operations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CacheOperationType {
    /// Get operation
    Get,
    /// Set operation
    Set,
    /// Delete operation
    Delete,
    /// Update operation
    Update,
    /// Eviction operation
    Evict,
    /// Cleanup operation
    Cleanup,
    /// Flush operation
    Flush,
}

/// Cache eviction policy
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EvictionPolicy {
    /// Least Recently Used
    Lru,
    /// Least Frequently Used
    Lfu,
    /// First In, First Out
    Fifo,
    /// Time To Live based
    Ttl,
    /// Priority based
    Priority,
    /// Size based
    Size,
    /// Custom policy
    Custom(String),
}

/// Cache configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CacheConfig {
    /// Maximum number of entries
    pub max_entries: Option<usize>,
    /// Maximum total size in bytes
    pub max_size_bytes: Option<usize>,
    /// Default TTL in seconds
    pub default_ttl_seconds: Option<u64>,
    /// Eviction policy to use
    pub eviction_policy: EvictionPolicy,
    /// Whether to enable compression
    pub enable_compression: bool,
    /// Compression algorithm to use
    pub compression_type: CompressionType,
    /// Minimum size for compression
    pub compression_threshold_bytes: usize,
    /// Whether to persist cache to disk
    pub persistent: bool,
    /// Cleanup interval in seconds
    pub cleanup_interval_seconds: u64,
}

impl CacheEntry {
    /// Create a new cache entry
    pub fn new(
        key: String,
        entry_type: CacheEntryType,
        data: Vec<u8>,
        content_type: String,
    ) -> Self {
        let size_bytes = data.len();
        let data_hash = Self::calculate_hash(&data);
        
        Self {
            id: Uuid::new_v4().to_string(),
            key,
            entry_type,
            data,
            size_bytes,
            content_type,
            compression: None,
            data_hash,
            metadata: CacheMetadata::default(),
            expires_at: None,
            access_count: 0,
            last_accessed_at: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// Create a cache entry with TTL
    pub fn with_ttl(
        key: String,
        entry_type: CacheEntryType,
        data: Vec<u8>,
        content_type: String,
        ttl_seconds: u64,
    ) -> Self {
        let mut entry = Self::new(key, entry_type, data, content_type);
        entry.expires_at = Some(Utc::now() + chrono::Duration::seconds(ttl_seconds as i64));
        entry
    }

    /// Set metadata
    pub fn with_metadata(mut self, metadata: CacheMetadata) -> Self {
        self.metadata = metadata;
        self
    }

    /// Set priority
    pub fn with_priority(mut self, priority: CachePriority) -> Self {
        self.metadata.priority = priority;
        self
    }

    /// Add tags
    pub fn with_tags(mut self, tags: Vec<String>) -> Self {
        self.metadata.tags = tags;
        self
    }

    /// Set compression
    pub fn with_compression(mut self, compression: CompressionType) -> Self {
        self.compression = Some(compression);
        self
    }

    /// Record an access to this entry
    pub fn record_access(&mut self) {
        self.access_count += 1;
        self.last_accessed_at = Some(Utc::now());
        self.metadata.access_frequency = self.calculate_access_frequency();
        self.updated_at = Utc::now();
    }

    /// Check if the entry has expired
    pub fn is_expired(&self) -> bool {
        if let Some(expires_at) = self.expires_at {
            Utc::now() > expires_at
        } else {
            false
        }
    }

    /// Get time until expiration
    pub fn time_until_expiration(&self) -> Option<chrono::Duration> {
        self.expires_at.map(|expires_at| expires_at - Utc::now())
    }

    /// Check if entry is evictable
    pub fn is_evictable(&self) -> bool {
        self.metadata.evictable && !matches!(self.metadata.priority, CachePriority::Critical)
    }

    /// Get age of the entry
    pub fn age(&self) -> chrono::Duration {
        Utc::now() - self.created_at
    }

    /// Get time since last access
    pub fn time_since_last_access(&self) -> Option<chrono::Duration> {
        self.last_accessed_at.map(|last_access| Utc::now() - last_access)
    }

    /// Calculate access frequency (accesses per hour)
    fn calculate_access_frequency(&self) -> f64 {
        let age_hours = self.age().num_seconds() as f64 / 3600.0;
        if age_hours > 0.0 {
            self.access_count as f64 / age_hours
        } else {
            self.access_count as f64
        }
    }

    /// Get eviction score (higher = more likely to be evicted)
    pub fn eviction_score(&self, policy: &EvictionPolicy) -> f64 {
        if !self.is_evictable() {
            return 0.0; // Never evict non-evictable entries
        }

        match policy {
            EvictionPolicy::Lru => {
                // Higher score for older last access
                self.time_since_last_access()
                    .map(|duration| duration.num_seconds() as f64)
                    .unwrap_or(0.0)
            }
            EvictionPolicy::Lfu => {
                // Higher score for lower frequency
                1.0 / (self.metadata.access_frequency + 1.0)
            }
            EvictionPolicy::Fifo => {
                // Higher score for older entries
                self.age().num_seconds() as f64
            }
            EvictionPolicy::Ttl => {
                // Higher score for entries closer to expiration
                if let Some(time_left) = self.time_until_expiration() {
                    1.0 / (time_left.num_seconds() as f64 + 1.0)
                } else {
                    0.0
                }
            }
            EvictionPolicy::Priority => {
                // Higher score for lower priority
                match self.metadata.priority {
                    CachePriority::Low => 4.0,
                    CachePriority::Normal => 3.0,
                    CachePriority::High => 2.0,
                    CachePriority::Critical => 0.0,
                }
            }
            EvictionPolicy::Size => {
                // Higher score for larger entries
                self.size_bytes as f64
            }
            EvictionPolicy::Custom(_) => {
                // Default to LRU for custom policies
                self.time_since_last_access()
                    .map(|duration| duration.num_seconds() as f64)
                    .unwrap_or(0.0)
            }
        }
    }

    /// Update the data in this cache entry
    pub fn update_data(&mut self, data: Vec<u8>, content_type: String) {
        self.data = data;
        self.size_bytes = self.data.len();
        self.content_type = content_type;
        self.data_hash = Self::calculate_hash(&self.data);
        self.updated_at = Utc::now();
    }

    /// Extend the TTL of this entry
    pub fn extend_ttl(&mut self, additional_seconds: u64) {
        if let Some(expires_at) = self.expires_at {
            self.expires_at = Some(expires_at + chrono::Duration::seconds(additional_seconds as i64));
        } else {
            self.expires_at = Some(Utc::now() + chrono::Duration::seconds(additional_seconds as i64));
        }
        self.updated_at = Utc::now();
    }

    /// Calculate hash of data
    fn calculate_hash(data: &[u8]) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        data.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    /// Verify data integrity
    pub fn verify_integrity(&self) -> bool {
        Self::calculate_hash(&self.data) == self.data_hash
    }

    /// Get human-readable size
    pub fn size_human_readable(&self) -> String {
        format!("{} bytes", self.size_bytes)
    }

    /// Check if entry matches any of the given tags
    pub fn has_any_tag(&self, tags: &[String]) -> bool {
        tags.iter().any(|tag| self.metadata.tags.contains(tag))
    }

    /// Check if entry has all of the given tags
    pub fn has_all_tags(&self, tags: &[String]) -> bool {
        tags.iter().all(|tag| self.metadata.tags.contains(tag))
    }
}

impl CacheStats {
    /// Create new empty cache stats
    pub fn new() -> Self {
        Self::default()
    }

    /// Update hit ratio
    pub fn update_hit_ratio(&mut self) {
        let total_requests = self.hits + self.misses;
        if total_requests > 0 {
            self.hit_ratio = self.hits as f64 / total_requests as f64;
        } else {
            self.hit_ratio = 0.0;
        }
    }

    /// Update average entry size
    pub fn update_avg_entry_size(&mut self) {
        if self.total_entries > 0 {
            self.avg_entry_size = self.total_size_bytes as f64 / self.total_entries as f64;
        } else {
            self.avg_entry_size = 0.0;
        }
    }

    /// Record a cache hit
    pub fn record_hit(&mut self) {
        self.hits += 1;
        self.update_hit_ratio();
    }

    /// Record a cache miss
    pub fn record_miss(&mut self) {
        self.misses += 1;
        self.update_hit_ratio();
    }

    /// Record an eviction
    pub fn record_eviction(&mut self) {
        self.evictions += 1;
    }
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            max_entries: Some(10000),
            max_size_bytes: Some(100 * 1024 * 1024), // 100MB
            default_ttl_seconds: Some(3600), // 1 hour
            eviction_policy: EvictionPolicy::Lru,
            enable_compression: true,
            compression_type: CompressionType::Gzip,
            compression_threshold_bytes: 1024, // 1KB
            persistent: false,
            cleanup_interval_seconds: 300, // 5 minutes
        }
    }
}

impl Validate for CacheEntry {
    fn validate(&self) -> Result<(), CoreError> {
        if self.key.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Cache key cannot be empty".to_string(),
            ));
        }

        if self.data.is_empty() {
            return Err(CoreError::ValidationError(
                "Cache data cannot be empty".to_string(),
            ));
        }

        if self.size_bytes != self.data.len() {
            return Err(CoreError::ValidationError(
                "Size bytes must match data length".to_string(),
            ));
        }

        if !self.verify_integrity() {
            return Err(CoreError::ValidationError(
                "Data integrity check failed".to_string(),
            ));
        }

        if self.metadata.regeneration_cost > 10 {
            return Err(CoreError::ValidationError(
                "Regeneration cost must be between 1 and 10".to_string(),
            ));
        }

        Ok(())
    }
}

impl Timestamped for CacheEntry {
    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    fn updated_at(&self) -> Option<DateTime<Utc>> {
        Some(self.updated_at)
    }
}

// JsonSerializable is automatically implemented for all types via the blanket impl in mod.rs

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_entry_creation() {
        let data = b"test data".to_vec();
        let entry = CacheEntry::new(
            "test_key".to_string(),
            CacheEntryType::QueryResult,
            data.clone(),
            "application/json".to_string(),
        );

        assert_eq!(entry.key, "test_key");
        assert_eq!(entry.entry_type, CacheEntryType::QueryResult);
        assert_eq!(entry.data, data);
        assert_eq!(entry.size_bytes, data.len());
        assert!(entry.validate().is_ok());
    }

    #[test]
    fn test_cache_entry_with_ttl() {
        let entry = CacheEntry::with_ttl(
            "key".to_string(),
            CacheEntryType::Temporary,
            b"data".to_vec(),
            "text/plain".to_string(),
            3600,
        );

        assert!(entry.expires_at.is_some());
        assert!(!entry.is_expired());
    }

    #[test]
    fn test_cache_entry_access() {
        let mut entry = CacheEntry::new(
            "key".to_string(),
            CacheEntryType::QueryResult,
            b"data".to_vec(),
            "application/json".to_string(),
        );

        assert_eq!(entry.access_count, 0);
        assert!(entry.last_accessed_at.is_none());

        entry.record_access();
        assert_eq!(entry.access_count, 1);
        assert!(entry.last_accessed_at.is_some());
    }

    #[test]
    fn test_cache_entry_expiration() {
        let mut entry = CacheEntry::new(
            "key".to_string(),
            CacheEntryType::Temporary,
            b"data".to_vec(),
            "text/plain".to_string(),
        );

        // Set expiration to past
        entry.expires_at = Some(Utc::now() - chrono::Duration::seconds(1));
        assert!(entry.is_expired());

        // Extend TTL
        entry.extend_ttl(3600);
        assert!(!entry.is_expired());
    }

    #[test]
    fn test_eviction_scores() {
        let mut entry = CacheEntry::new(
            "key".to_string(),
            CacheEntryType::QueryResult,
            b"data".to_vec(),
            "application/json".to_string(),
        );

        // Make the entry evictable so scores are calculated
        entry.metadata.evictable = true;

        // Test LRU policy
        let lru_score = entry.eviction_score(&EvictionPolicy::Lru);
        assert!(lru_score >= 0.0);

        // Test priority policy
        entry.metadata.priority = CachePriority::High;
        let priority_score = entry.eviction_score(&EvictionPolicy::Priority);
        assert_eq!(priority_score, 2.0);

        // Test critical priority (should not be evictable)
        entry.metadata.priority = CachePriority::Critical;
        let critical_score = entry.eviction_score(&EvictionPolicy::Priority);
        assert_eq!(critical_score, 0.0);
    }

    #[test]
    fn test_cache_stats() {
        let mut stats = CacheStats::new();
        assert_eq!(stats.hit_ratio, 0.0);

        stats.record_hit();
        stats.record_hit();
        stats.record_miss();

        assert_eq!(stats.hits, 2);
        assert_eq!(stats.misses, 1);
        assert!((stats.hit_ratio - 2.0/3.0).abs() < 1e-6);
    }

    #[test]
    fn test_data_integrity() {
        let data = b"test data".to_vec();
        let mut entry = CacheEntry::new(
            "key".to_string(),
            CacheEntryType::QueryResult,
            data,
            "application/json".to_string(),
        );

        assert!(entry.verify_integrity());

        // Corrupt the data
        entry.data[0] = 0xFF;
        assert!(!entry.verify_integrity());
        assert!(entry.validate().is_err());
    }

    #[test]
    fn test_cache_tags() {
        let entry = CacheEntry::new(
            "key".to_string(),
            CacheEntryType::QueryResult,
            b"data".to_vec(),
            "application/json".to_string(),
        ).with_tags(vec!["search".to_string(), "user123".to_string()]);

        assert!(entry.has_any_tag(&["search".to_string()]));
        assert!(entry.has_all_tags(&["search".to_string(), "user123".to_string()]));
        assert!(!entry.has_any_tag(&["nonexistent".to_string()]));
    }

    #[test]
    fn test_cache_config_default() {
        let config = CacheConfig::default();
        assert_eq!(config.max_entries, Some(10000));
        assert_eq!(config.eviction_policy, EvictionPolicy::Lru);
        assert!(config.enable_compression);
        assert_eq!(config.compression_type, CompressionType::Gzip);
    }

    #[test]
    fn test_cache_entry_update() {
        let mut entry = CacheEntry::new(
            "key".to_string(),
            CacheEntryType::QueryResult,
            b"old data".to_vec(),
            "text/plain".to_string(),
        );

        let old_hash = entry.data_hash.clone();
        let new_data = b"new data".to_vec();
        
        entry.update_data(new_data.clone(), "application/json".to_string());
        
        assert_eq!(entry.data, new_data);
        assert_eq!(entry.content_type, "application/json");
        assert_ne!(entry.data_hash, old_hash);
        assert!(entry.verify_integrity());
    }
}