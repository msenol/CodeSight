//! Cache service for managing distributed caching and performance optimization

use crate::error::CoreError;
use crate::models::{
    cache_entry::{
        CacheEntry, CacheKey, CacheValue, CacheMetadata, CachePolicy, CacheStats,
        EvictionPolicy, CompressionType, CacheEntryStatus
    },
    configuration::Configuration,
};
use crate::services::{Service, ServiceHealth, ConfigurationService};
use crate::traits::{Validate, Timestamped};
use async_trait::async_trait;
use chrono::{DateTime, Utc, Duration};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, BTreeMap};
use std::sync::{Arc, RwLock};
use tokio::time::{timeout, Duration as TokioDuration};
use uuid::Uuid;

/// Service for managing cache operations
#[derive(Debug)]
pub struct CacheService {
    config_service: Arc<ConfigurationService>,
    backends: Arc<RwLock<HashMap<String, Box<dyn CacheBackend>>>>,
    primary_backend: Arc<RwLock<Option<String>>>,
    metrics: Arc<RwLock<CacheServiceMetrics>>,
    policies: Arc<RwLock<HashMap<String, CachePolicy>>>,
    stats_collector: Arc<RwLock<CacheStatsCollector>>,
}

/// Cache service metrics
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct CacheServiceMetrics {
    pub total_requests: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub cache_writes: u64,
    pub cache_deletes: u64,
    pub cache_evictions: u64,
    pub total_size_bytes: u64,
    pub average_response_time_ms: f64,
    pub error_count: u64,
    pub backend_metrics: HashMap<String, BackendMetrics>,
}

/// Backend-specific metrics
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct BackendMetrics {
    pub hits: u64,
    pub misses: u64,
    pub writes: u64,
    pub deletes: u64,
    pub errors: u64,
    pub size_bytes: u64,
    pub entry_count: u64,
    pub average_response_time_ms: f64,
}

/// Cache backend trait
#[async_trait]
pub trait CacheBackend: Send + Sync + std::fmt::Debug {
    /// Get backend name
    fn name(&self) -> &str;
    
    /// Get a value from cache
    async fn get(&self, key: &CacheKey) -> Result<Option<CacheEntry>, CoreError>;
    
    /// Set a value in cache
    async fn set(&self, entry: CacheEntry) -> Result<(), CoreError>;
    
    /// Delete a value from cache
    async fn delete(&self, key: &CacheKey) -> Result<bool, CoreError>;
    
    /// Check if key exists
    async fn exists(&self, key: &CacheKey) -> Result<bool, CoreError>;
    
    /// Get multiple values
    async fn get_multi(&self, keys: &[CacheKey]) -> Result<Vec<Option<CacheEntry>>, CoreError>;
    
    /// Set multiple values
    async fn set_multi(&self, entries: Vec<CacheEntry>) -> Result<(), CoreError>;
    
    /// Delete multiple values
    async fn delete_multi(&self, keys: &[CacheKey]) -> Result<Vec<bool>, CoreError>;
    
    /// Clear all entries
    async fn clear(&self) -> Result<(), CoreError>;
    
    /// Get cache statistics
    async fn get_stats(&self) -> Result<BackendMetrics, CoreError>;
    
    /// Perform cache maintenance
    async fn maintenance(&self) -> Result<(), CoreError>;
    
    /// Health check
    async fn health_check(&self) -> Result<(), CoreError>;
}

/// In-memory cache backend
#[derive(Debug)]
pub struct MemoryBackend {
    name: String,
    storage: Arc<RwLock<HashMap<String, CacheEntry>>>,
    metrics: Arc<RwLock<BackendMetrics>>,
    max_size: usize,
    eviction_policy: EvictionPolicy,
    access_times: Arc<RwLock<BTreeMap<DateTime<Utc>, String>>>,
}

/// Redis cache backend
#[derive(Debug)]
pub struct RedisBackend {
    name: String,
    connection_string: String,
    metrics: Arc<RwLock<BackendMetrics>>,
    timeout: TokioDuration,
}

/// Cache operation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheRequest {
    pub operation: CacheOperation,
    pub key: CacheKey,
    pub value: Option<CacheValue>,
    pub policy: Option<CachePolicy>,
    pub timeout_ms: Option<u64>,
}

/// Cache operation types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CacheOperation {
    Get,
    Set,
    Delete,
    Exists,
    Clear,
    GetStats,
}

/// Cache operation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheResult {
    pub operation: CacheOperation,
    pub success: bool,
    pub value: Option<CacheValue>,
    pub exists: Option<bool>,
    pub stats: Option<CacheStats>,
    pub response_time_ms: u64,
    pub backend_used: String,
    pub error: Option<String>,
}

/// Cache invalidation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvalidationRequest {
    pub pattern: String,
    pub tags: Vec<String>,
    pub cascade: bool,
    pub reason: String,
}

/// Cache warming request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WarmingRequest {
    pub keys: Vec<CacheKey>,
    pub priority: WarmingPriority,
    pub batch_size: usize,
    pub delay_ms: u64,
}

/// Cache warming priority
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WarmingPriority {
    Low,
    Normal,
    High,
    Critical,
}

/// Cache statistics collector
#[derive(Debug, Default)]
pub struct CacheStatsCollector {
    pub request_history: Vec<CacheRequestRecord>,
    pub performance_samples: Vec<PerformanceSample>,
    pub eviction_history: Vec<EvictionRecord>,
}

/// Cache request record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheRequestRecord {
    pub timestamp: DateTime<Utc>,
    pub operation: CacheOperation,
    pub key_hash: String,
    pub hit: bool,
    pub response_time_ms: u64,
    pub backend: String,
    pub size_bytes: Option<u64>,
}

/// Performance sample
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSample {
    pub timestamp: DateTime<Utc>,
    pub hit_rate: f64,
    pub average_response_time_ms: f64,
    pub memory_usage_bytes: u64,
    pub request_rate_per_second: f64,
}

/// Eviction record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvictionRecord {
    pub timestamp: DateTime<Utc>,
    pub key_hash: String,
    pub reason: EvictionReason,
    pub size_bytes: u64,
    pub age_seconds: u64,
}

/// Eviction reason
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EvictionReason {
    Expired,
    SizeLimit,
    LruEviction,
    LfuEviction,
    Manual,
    PolicyViolation,
}

impl CacheService {
    /// Create a new cache service
    pub async fn new(config_service: Arc<ConfigurationService>) -> Result<Self, CoreError> {
        let mut backends: HashMap<String, Box<dyn CacheBackend>> = HashMap::new();
        
        // Initialize memory backend by default
        let memory_backend = MemoryBackend::new(
            "memory".to_string(),
            10000, // max entries
            EvictionPolicy::Lru,
        );
        backends.insert("memory".to_string(), Box::new(memory_backend));
        
        Ok(Self {
            config_service,
            backends: Arc::new(RwLock::new(backends)),
            primary_backend: Arc::new(RwLock::new(Some("memory".to_string()))),
            metrics: Arc::new(RwLock::new(CacheServiceMetrics::default())),
            policies: Arc::new(RwLock::new(HashMap::new())),
            stats_collector: Arc::new(RwLock::new(CacheStatsCollector::default())),
        })
    }

    /// Get a value from cache
    pub async fn get(&self, key: &CacheKey) -> Result<Option<CacheEntry>, CoreError> {
        let start_time = std::time::Instant::now();
        
        let backend_name = self.get_primary_backend().await?;
        let backends = self.backends.read().unwrap();
        let backend = backends.get(&backend_name)
            .ok_or_else(|| CoreError::NotFound(format!("Backend '{}' not found", backend_name)))?;
        
        let result = backend.get(key).await;
        let response_time = start_time.elapsed();
        
        // Update metrics
        self.update_request_metrics(
            &CacheOperation::Get,
            result.is_ok() && result.as_ref().unwrap().is_some(),
            response_time,
            &backend_name,
        ).await;
        
        // Record request
        self.record_request(
            CacheOperation::Get,
            key,
            result.is_ok() && result.as_ref().unwrap().is_some(),
            response_time,
            &backend_name,
            result.as_ref().ok().and_then(|opt| opt.as_ref().map(|e| e.size_bytes)),
        ).await;
        
        result
    }

    /// Set a value in cache
    pub async fn set(&self, mut entry: CacheEntry) -> Result<(), CoreError> {
        let start_time = std::time::Instant::now();
        
        // Apply default policy if none specified
        if entry.policy.is_none() {
            entry.policy = Some(self.get_default_policy().await);
        }
        
        let backend_name = self.get_primary_backend().await?;
        let backends = self.backends.read().unwrap();
        let backend = backends.get(&backend_name)
            .ok_or_else(|| CoreError::NotFound(format!("Backend '{}' not found", backend_name)))?;
        
        let result = backend.set(entry.clone()).await;
        let response_time = start_time.elapsed();
        
        // Update metrics
        self.update_request_metrics(
            &CacheOperation::Set,
            result.is_ok(),
            response_time,
            &backend_name,
        ).await;
        
        // Record request
        self.record_request(
            CacheOperation::Set,
            &entry.key,
            result.is_ok(),
            response_time,
            &backend_name,
            Some(entry.size_bytes),
        ).await;
        
        if result.is_ok() {
            self.increment_write_metrics().await;
        }
        
        result
    }

    /// Delete a value from cache
    pub async fn delete(&self, key: &CacheKey) -> Result<bool, CoreError> {
        let start_time = std::time::Instant::now();
        
        let backend_name = self.get_primary_backend().await?;
        let backends = self.backends.read().unwrap();
        let backend = backends.get(&backend_name)
            .ok_or_else(|| CoreError::NotFound(format!("Backend '{}' not found", backend_name)))?;
        
        let result = backend.delete(key).await;
        let response_time = start_time.elapsed();
        
        // Update metrics
        self.update_request_metrics(
            &CacheOperation::Delete,
            result.is_ok(),
            response_time,
            &backend_name,
        ).await;
        
        // Record request
        self.record_request(
            CacheOperation::Delete,
            key,
            result.is_ok(),
            response_time,
            &backend_name,
            None,
        ).await;
        
        if result.is_ok() {
            self.increment_delete_metrics().await;
        }
        
        result
    }

    /// Check if key exists
    pub async fn exists(&self, key: &CacheKey) -> Result<bool, CoreError> {
        let backend_name = self.get_primary_backend().await?;
        let backends = self.backends.read().unwrap();
        let backend = backends.get(&backend_name)
            .ok_or_else(|| CoreError::NotFound(format!("Backend '{}' not found", backend_name)))?;
        
        backend.exists(key).await
    }

    /// Get multiple values from cache
    pub async fn get_multi(&self, keys: &[CacheKey]) -> Result<Vec<Option<CacheEntry>>, CoreError> {
        let backend_name = self.get_primary_backend().await?;
        let backends = self.backends.read().unwrap();
        let backend = backends.get(&backend_name)
            .ok_or_else(|| CoreError::NotFound(format!("Backend '{}' not found", backend_name)))?;
        
        backend.get_multi(keys).await
    }

    /// Set multiple values in cache
    pub async fn set_multi(&self, entries: Vec<CacheEntry>) -> Result<(), CoreError> {
        let backend_name = self.get_primary_backend().await?;
        let backends = self.backends.read().unwrap();
        let backend = backends.get(&backend_name)
            .ok_or_else(|| CoreError::NotFound(format!("Backend '{}' not found", backend_name)))?;
        
        backend.set_multi(entries).await
    }

    /// Delete multiple values from cache
    pub async fn delete_multi(&self, keys: &[CacheKey]) -> Result<Vec<bool>, CoreError> {
        let backend_name = self.get_primary_backend().await?;
        let backends = self.backends.read().unwrap();
        let backend = backends.get(&backend_name)
            .ok_or_else(|| CoreError::NotFound(format!("Backend '{}' not found", backend_name)))?;
        
        backend.delete_multi(keys).await
    }

    /// Clear all cache entries
    pub async fn clear(&self) -> Result<(), CoreError> {
        let backend_name = self.get_primary_backend().await?;
        let backends = self.backends.read().unwrap();
        let backend = backends.get(&backend_name)
            .ok_or_else(|| CoreError::NotFound(format!("Backend '{}' not found", backend_name)))?;
        
        backend.clear().await
    }

    /// Invalidate cache entries by pattern
    pub async fn invalidate(&self, request: InvalidationRequest) -> Result<u64, CoreError> {
        // For now, implement simple pattern matching
        // In a real implementation, this would be more sophisticated
        let mut invalidated_count = 0;
        
        // This is a simplified implementation
        // Real implementation would iterate through cache entries and match patterns
        
        Ok(invalidated_count)
    }

    /// Warm cache with specified keys
    pub async fn warm_cache(&self, request: WarmingRequest) -> Result<u64, CoreError> {
        let mut warmed_count = 0;
        
        for chunk in request.keys.chunks(request.batch_size) {
            for key in chunk {
                // Check if key already exists
                if !self.exists(key).await? {
                    // In a real implementation, this would fetch data from the source
                    // and populate the cache
                    warmed_count += 1;
                }
            }
            
            if request.delay_ms > 0 {
                tokio::time::sleep(TokioDuration::from_millis(request.delay_ms)).await;
            }
        }
        
        Ok(warmed_count)
    }

    /// Get cache statistics
    pub async fn get_stats(&self) -> Result<CacheServiceMetrics, CoreError> {
        let mut metrics = self.metrics.read().unwrap().clone();
        
        // Update backend metrics
        let backends = self.backends.read().unwrap();
        for (name, backend) in backends.iter() {
            if let Ok(backend_metrics) = backend.get_stats().await {
                metrics.backend_metrics.insert(name.clone(), backend_metrics);
            }
        }
        
        Ok(metrics)
    }

    /// Get performance samples
    pub async fn get_performance_samples(&self, limit: Option<usize>) -> Vec<PerformanceSample> {
        let collector = self.stats_collector.read().unwrap();
        let samples = &collector.performance_samples;
        
        if let Some(limit) = limit {
            samples.iter().rev().take(limit).cloned().collect()
        } else {
            samples.clone()
        }
    }

    /// Add cache backend
    pub async fn add_backend(
        &self,
        name: String,
        backend: Box<dyn CacheBackend>,
    ) -> Result<(), CoreError> {
        let mut backends = self.backends.write().unwrap();
        backends.insert(name, backend);
        Ok(())
    }

    /// Remove cache backend
    pub async fn remove_backend(&self, name: &str) -> Result<(), CoreError> {
        let mut backends = self.backends.write().unwrap();
        backends.remove(name);
        
        // Update primary backend if it was removed
        let primary = self.primary_backend.read().unwrap();
        if primary.as_ref() == Some(&name.to_string()) {
            drop(primary);
            let mut primary = self.primary_backend.write().unwrap();
            *primary = backends.keys().next().map(|k| k.clone());
        }
        
        Ok(())
    }

    /// Set primary backend
    pub async fn set_primary_backend(&self, name: String) -> Result<(), CoreError> {
        let backends = self.backends.read().unwrap();
        if !backends.contains_key(&name) {
            return Err(CoreError::NotFound(format!("Backend '{}' not found", name)));
        }
        
        let mut primary = self.primary_backend.write().unwrap();
        *primary = Some(name);
        Ok(())
    }

    /// Get primary backend name
    async fn get_primary_backend(&self) -> Result<String, CoreError> {
        let primary = self.primary_backend.read().unwrap();
        primary.clone().ok_or_else(|| CoreError::ConfigError("No primary backend configured".to_string()))
    }

    /// Get default cache policy
    async fn get_default_policy(&self) -> CachePolicy {
        CachePolicy {
            ttl_seconds: Some(3600), // 1 hour default
            max_size_bytes: Some(1024 * 1024), // 1MB default
            eviction_policy: EvictionPolicy::Lru,
            compression: Some(CompressionType::Gzip),
            tags: Vec::new(),
            priority: 1,
        }
    }

    /// Update request metrics
    async fn update_request_metrics(
        &self,
        operation: &CacheOperation,
        success: bool,
        response_time: std::time::Duration,
        backend_name: &str,
    ) {
        let mut metrics = self.metrics.write().unwrap();
        
        metrics.total_requests += 1;
        
        match operation {
            CacheOperation::Get => {
                if success {
                    metrics.cache_hits += 1;
                } else {
                    metrics.cache_misses += 1;
                }
            }
            CacheOperation::Set => {
                if success {
                    metrics.cache_writes += 1;
                }
            }
            CacheOperation::Delete => {
                if success {
                    metrics.cache_deletes += 1;
                }
            }
            _ => {}
        }
        
        if !success {
            metrics.error_count += 1;
        }
        
        // Update average response time
        let response_time_ms = response_time.as_millis() as f64;
        if metrics.total_requests == 1 {
            metrics.average_response_time_ms = response_time_ms;
        } else {
            metrics.average_response_time_ms = 
                (metrics.average_response_time_ms * (metrics.total_requests - 1) as f64 + response_time_ms) 
                / metrics.total_requests as f64;
        }
        
        // Update backend metrics
        let backend_metrics = metrics.backend_metrics.entry(backend_name.to_string()).or_insert_with(BackendMetrics::default);
        match operation {
            CacheOperation::Get => {
                if success {
                    backend_metrics.hits += 1;
                } else {
                    backend_metrics.misses += 1;
                }
            }
            CacheOperation::Set => {
                if success {
                    backend_metrics.writes += 1;
                }
            }
            CacheOperation::Delete => {
                if success {
                    backend_metrics.deletes += 1;
                }
            }
            _ => {}
        }
        
        if !success {
            backend_metrics.errors += 1;
        }
        
        // Update backend average response time
        let total_backend_requests = backend_metrics.hits + backend_metrics.misses + backend_metrics.writes + backend_metrics.deletes;
        if total_backend_requests == 1 {
            backend_metrics.average_response_time_ms = response_time_ms;
        } else {
            backend_metrics.average_response_time_ms = 
                (backend_metrics.average_response_time_ms * (total_backend_requests - 1) as f64 + response_time_ms) 
                / total_backend_requests as f64;
        }
    }

    /// Record cache request
    async fn record_request(
        &self,
        operation: CacheOperation,
        key: &CacheKey,
        hit: bool,
        response_time: std::time::Duration,
        backend: &str,
        size_bytes: Option<u64>,
    ) {
        let mut collector = self.stats_collector.write().unwrap();
        
        let record = CacheRequestRecord {
            timestamp: Utc::now(),
            operation,
            key_hash: self.hash_key(key),
            hit,
            response_time_ms: response_time.as_millis() as u64,
            backend: backend.to_string(),
            size_bytes,
        };
        
        collector.request_history.push(record);
        
        // Limit history size
        if collector.request_history.len() > 10000 {
            collector.request_history.drain(0..1000);
        }
    }

    /// Hash cache key for logging
    fn hash_key(&self, key: &CacheKey) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        key.key.hash(&mut hasher);
        format!("{:x}", hasher.finish())
    }

    /// Increment write metrics
    async fn increment_write_metrics(&self) {
        let mut metrics = self.metrics.write().unwrap();
        metrics.cache_writes += 1;
    }

    /// Increment delete metrics
    async fn increment_delete_metrics(&self) {
        let mut metrics = self.metrics.write().unwrap();
        metrics.cache_deletes += 1;
    }

    /// Perform maintenance on all backends
    pub async fn maintenance(&self) -> Result<(), CoreError> {
        let backends = self.backends.read().unwrap();
        
        for backend in backends.values() {
            if let Err(e) = backend.maintenance().await {
                eprintln!("Maintenance failed for backend {}: {}", backend.name(), e);
            }
        }
        
        Ok(())
    }
}

impl MemoryBackend {
    /// Create a new memory backend
    pub fn new(name: String, max_size: usize, eviction_policy: EvictionPolicy) -> Self {
        Self {
            name,
            storage: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(BackendMetrics::default())),
            max_size,
            eviction_policy,
            access_times: Arc::new(RwLock::new(BTreeMap::new())),
        }
    }

    /// Evict entries if necessary
    fn evict_if_necessary(&self) {
        let storage = self.storage.read().unwrap();
        if storage.len() >= self.max_size {
            drop(storage);
            
            match self.eviction_policy {
                EvictionPolicy::Lru => self.evict_lru(),
                EvictionPolicy::Lfu => self.evict_lfu(),
                EvictionPolicy::Ttl => self.evict_expired(),
                EvictionPolicy::Random => self.evict_random(),
            }
        }
    }

    /// Evict least recently used entries
    fn evict_lru(&self) {
        let mut access_times = self.access_times.write().unwrap();
        let mut storage = self.storage.write().unwrap();
        
        if let Some((_, key)) = access_times.iter().next() {
            let key = key.clone();
            storage.remove(&key);
            access_times.remove(&access_times.keys().next().unwrap().clone());
        }
    }

    /// Evict least frequently used entries (simplified)
    fn evict_lfu(&self) {
        // Simplified LFU - just remove oldest entry
        self.evict_lru();
    }

    /// Evict expired entries
    fn evict_expired(&self) {
        let mut storage = self.storage.write().unwrap();
        let now = Utc::now();
        
        let expired_keys: Vec<String> = storage
            .iter()
            .filter(|(_, entry)| {
                if let Some(expires_at) = entry.expires_at {
                    expires_at < now
                } else {
                    false
                }
            })
            .map(|(key, _)| key.clone())
            .collect();
        
        for key in expired_keys {
            storage.remove(&key);
        }
    }

    /// Evict random entry
    fn evict_random(&self) {
        let mut storage = self.storage.write().unwrap();
        if let Some(key) = storage.keys().next().cloned() {
            storage.remove(&key);
        }
    }
}

#[async_trait]
impl CacheBackend for MemoryBackend {
    fn name(&self) -> &str {
        &self.name
    }
    
    async fn get(&self, key: &CacheKey) -> Result<Option<CacheEntry>, CoreError> {
        let storage = self.storage.read().unwrap();
        let entry = storage.get(&key.key).cloned();
        
        if let Some(ref entry) = entry {
            // Check if expired
            if let Some(expires_at) = entry.expires_at {
                if expires_at < Utc::now() {
                    return Ok(None);
                }
            }
            
            // Update access time
            let mut access_times = self.access_times.write().unwrap();
            access_times.insert(Utc::now(), key.key.clone());
        }
        
        Ok(entry)
    }
    
    async fn set(&self, entry: CacheEntry) -> Result<(), CoreError> {
        self.evict_if_necessary();
        
        let mut storage = self.storage.write().unwrap();
        let mut access_times = self.access_times.write().unwrap();
        
        storage.insert(entry.key.key.clone(), entry.clone());
        access_times.insert(Utc::now(), entry.key.key.clone());
        
        Ok(())
    }
    
    async fn delete(&self, key: &CacheKey) -> Result<bool, CoreError> {
        let mut storage = self.storage.write().unwrap();
        Ok(storage.remove(&key.key).is_some())
    }
    
    async fn exists(&self, key: &CacheKey) -> Result<bool, CoreError> {
        let storage = self.storage.read().unwrap();
        Ok(storage.contains_key(&key.key))
    }
    
    async fn get_multi(&self, keys: &[CacheKey]) -> Result<Vec<Option<CacheEntry>>, CoreError> {
        let mut results = Vec::new();
        for key in keys {
            results.push(self.get(key).await?);
        }
        Ok(results)
    }
    
    async fn set_multi(&self, entries: Vec<CacheEntry>) -> Result<(), CoreError> {
        for entry in entries {
            self.set(entry).await?;
        }
        Ok(())
    }
    
    async fn delete_multi(&self, keys: &[CacheKey]) -> Result<Vec<bool>, CoreError> {
        let mut results = Vec::new();
        for key in keys {
            results.push(self.delete(key).await?);
        }
        Ok(results)
    }
    
    async fn clear(&self) -> Result<(), CoreError> {
        let mut storage = self.storage.write().unwrap();
        let mut access_times = self.access_times.write().unwrap();
        
        storage.clear();
        access_times.clear();
        
        Ok(())
    }
    
    async fn get_stats(&self) -> Result<BackendMetrics, CoreError> {
        let storage = self.storage.read().unwrap();
        let mut metrics = self.metrics.read().unwrap().clone();
        
        metrics.entry_count = storage.len() as u64;
        metrics.size_bytes = storage.values().map(|e| e.size_bytes).sum();
        
        Ok(metrics)
    }
    
    async fn maintenance(&self) -> Result<(), CoreError> {
        // Remove expired entries
        self.evict_expired();
        Ok(())
    }
    
    async fn health_check(&self) -> Result<(), CoreError> {
        // Memory backend is always healthy if we can access it
        let _storage = self.storage.read().unwrap();
        Ok(())
    }
}

#[async_trait]
impl Service for CacheService {
    async fn initialize(&self) -> Result<(), CoreError> {
        // Initialize all backends
        let backends = self.backends.read().unwrap();
        for backend in backends.values() {
            if let Err(e) = backend.health_check().await {
                eprintln!("Backend {} health check failed: {}", backend.name(), e);
            }
        }
        Ok(())
    }

    async fn shutdown(&self) -> Result<(), CoreError> {
        // Clear all caches and save metrics
        let backends = self.backends.read().unwrap();
        for backend in backends.values() {
            if let Err(e) = backend.clear().await {
                eprintln!("Failed to clear backend {}: {}", backend.name(), e);
            }
        }
        Ok(())
    }

    async fn health_check(&self) -> ServiceHealth {
        let backends = self.backends.read().unwrap();
        
        if backends.is_empty() {
            return ServiceHealth::unhealthy(
                "No cache backends available".to_string(),
            );
        }
        
        let mut healthy_backends = 0;
        for backend in backends.values() {
            if backend.health_check().await.is_ok() {
                healthy_backends += 1;
            }
        }
        
        if healthy_backends == 0 {
            return ServiceHealth::unhealthy(
                "No healthy cache backends".to_string(),
            );
        }
        
        if healthy_backends < backends.len() {
            return ServiceHealth::degraded(
                format!("{}/{} backends healthy", healthy_backends, backends.len()),
            );
        }
        
        ServiceHealth::healthy()
    }

    fn name(&self) -> &'static str {
        "CacheService"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn create_test_service() -> CacheService {
        let config_service = Arc::new(ConfigurationService::new().await.unwrap());
        CacheService::new(config_service).await.unwrap()
    }

    #[tokio::test]
    async fn test_cache_service_creation() {
        let service = create_test_service().await;
        assert_eq!(service.name(), "CacheService");
    }

    #[tokio::test]
    async fn test_memory_backend() {
        let backend = MemoryBackend::new(
            "test".to_string(),
            100,
            EvictionPolicy::Lru,
        );
        
        let key = CacheKey::new("test_key".to_string());
        let entry = CacheEntry::new(
            key.clone(),
            CacheValue::String("test_value".to_string()),
        );
        
        // Test set and get
        backend.set(entry.clone()).await.unwrap();
        let retrieved = backend.get(&key).await.unwrap();
        assert!(retrieved.is_some());
        
        // Test delete
        let deleted = backend.delete(&key).await.unwrap();
        assert!(deleted);
        
        let retrieved = backend.get(&key).await.unwrap();
        assert!(retrieved.is_none());
    }

    #[tokio::test]
    async fn test_cache_operations() {
        let service = create_test_service().await;
        
        let key = CacheKey::new("test_key".to_string());
        let entry = CacheEntry::new(
            key.clone(),
            CacheValue::String("test_value".to_string()),
        );
        
        // Test set and get
        service.set(entry.clone()).await.unwrap();
        let retrieved = service.get(&key).await.unwrap();
        assert!(retrieved.is_some());
        
        // Test exists
        let exists = service.exists(&key).await.unwrap();
        assert!(exists);
        
        // Test delete
        let deleted = service.delete(&key).await.unwrap();
        assert!(deleted);
        
        let exists = service.exists(&key).await.unwrap();
        assert!(!exists);
    }

    #[tokio::test]
    async fn test_cache_metrics() {
        let service = create_test_service().await;
        let metrics = service.get_stats().await.unwrap();
        
        assert_eq!(metrics.total_requests, 0);
        assert_eq!(metrics.cache_hits, 0);
        assert_eq!(metrics.cache_misses, 0);
    }

    #[tokio::test]
    async fn test_multi_operations() {
        let service = create_test_service().await;
        
        let keys = vec![
            CacheKey::new("key1".to_string()),
            CacheKey::new("key2".to_string()),
        ];
        
        let entries = vec![
            CacheEntry::new(keys[0].clone(), CacheValue::String("value1".to_string())),
            CacheEntry::new(keys[1].clone(), CacheValue::String("value2".to_string())),
        ];
        
        // Test multi set
        service.set_multi(entries).await.unwrap();
        
        // Test multi get
        let results = service.get_multi(&keys).await.unwrap();
        assert_eq!(results.len(), 2);
        assert!(results[0].is_some());
        assert!(results[1].is_some());
        
        // Test multi delete
        let deleted = service.delete_multi(&keys).await.unwrap();
        assert_eq!(deleted.len(), 2);
        assert!(deleted[0]);
        assert!(deleted[1]);
    }
}