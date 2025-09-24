use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};
use crate::models::query::Query;
use crate::models::search_result::SearchResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedQueryResult {
    pub results: Vec<SearchResult>,
    pub execution_time_ms: u64,
    pub cached_at: Instant,
    pub ttl: Duration,
    pub hit_count: u64,
    pub query_hash: String,
}

impl CachedQueryResult {
    pub fn new(
        results: Vec<SearchResult>,
        execution_time_ms: u64,
        ttl: Duration,
        query_hash: String,
    ) -> Self {
        Self {
            results,
            execution_time_ms,
            cached_at: Instant::now(),
            ttl,
            hit_count: 0,
            query_hash,
        }
    }
    
    pub fn is_expired(&self) -> bool {
        self.cached_at.elapsed() > self.ttl
    }
    
    pub fn increment_hit_count(&mut self) {
        self.hit_count += 1;
    }
}

#[derive(Debug, Clone)]
pub struct QueryCacheConfig {
    pub max_entries: usize,
    pub default_ttl: Duration,
    pub semantic_query_ttl: Duration,
    pub simple_query_ttl: Duration,
    pub enable_compression: bool,
    pub cache_hit_threshold: f64, // Minimum similarity for cache hit
}

impl Default for QueryCacheConfig {
    fn default() -> Self {
        Self {
            max_entries: 10000,
            default_ttl: Duration::from_secs(3600), // 1 hour
            semantic_query_ttl: Duration::from_secs(1800), // 30 minutes
            simple_query_ttl: Duration::from_secs(7200), // 2 hours
            enable_compression: true,
            cache_hit_threshold: 0.85,
        }
    }
}

#[derive(Debug)]
pub struct QueryCacheStats {
    pub total_requests: u64,
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub evictions: u64,
    pub current_size: usize,
    pub average_hit_time_ms: f64,
    pub average_miss_time_ms: f64,
}

impl QueryCacheStats {
    pub fn hit_rate(&self) -> f64 {
        if self.total_requests == 0 {
            0.0
        } else {
            self.cache_hits as f64 / self.total_requests as f64
        }
    }
}

pub struct QueryCache {
    cache: Arc<RwLock<HashMap<String, CachedQueryResult>>>,
    config: QueryCacheConfig,
    stats: Arc<RwLock<QueryCacheStats>>,
    lru_order: Arc<RwLock<Vec<String>>>, // For LRU eviction
}

impl QueryCache {
    pub fn new(config: QueryCacheConfig) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::new())),
            config,
            stats: Arc::new(RwLock::new(QueryCacheStats {
                total_requests: 0,
                cache_hits: 0,
                cache_misses: 0,
                evictions: 0,
                current_size: 0,
                average_hit_time_ms: 0.0,
                average_miss_time_ms: 0.0,
            })),
            lru_order: Arc::new(RwLock::new(Vec::new())),
        }
    }
    
    pub fn with_default_config() -> Self {
        Self::new(QueryCacheConfig::default())
    }
    
    /// Generate a cache key for a query
    pub fn generate_cache_key(&self, query: &Query) -> String {
        let mut hasher = Sha256::new();
        
        // Include query text (normalized)
        let normalized_query = self.normalize_query_text(&query.query_text);
        hasher.update(normalized_query.as_bytes());
        
        // Include codebase ID
        hasher.update(query.codebase_id.to_string().as_bytes());
        
        // Include query type and intent
        hasher.update(format!("{:?}", query.query_type).as_bytes());
        if let Some(intent) = &query.intent {
            hasher.update(format!("{:?}", intent).as_bytes());
        }
        
        format!("{:x}", hasher.finalize())
    }
    
    /// Normalize query text for better cache hits
    fn normalize_query_text(&self, query_text: &str) -> String {
        query_text
            .to_lowercase()
            .trim()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
    }
    
    /// Get cached result for a query
    pub fn get(&self, query: &Query) -> Option<CachedQueryResult> {
        let start_time = Instant::now();
        let cache_key = self.generate_cache_key(query);
        
        let mut cache = self.cache.write().unwrap();
        let mut stats = self.stats.write().unwrap();
        let mut lru_order = self.lru_order.write().unwrap();
        
        stats.total_requests += 1;
        
        if let Some(mut cached_result) = cache.get_mut(&cache_key) {
            if !cached_result.is_expired() {
                // Cache hit
                cached_result.increment_hit_count();
                
                // Update LRU order
                if let Some(pos) = lru_order.iter().position(|k| k == &cache_key) {
                    lru_order.remove(pos);
                }
                lru_order.push(cache_key);
                
                stats.cache_hits += 1;
                let hit_time = start_time.elapsed().as_millis() as f64;
                stats.average_hit_time_ms = 
                    (stats.average_hit_time_ms * (stats.cache_hits - 1) as f64 + hit_time) / stats.cache_hits as f64;
                
                return Some(cached_result.clone());
            } else {
                // Expired entry, remove it
                cache.remove(&cache_key);
                if let Some(pos) = lru_order.iter().position(|k| k == &cache_key) {
                    lru_order.remove(pos);
                }
                stats.current_size = cache.len();
            }
        }
        
        // Cache miss
        stats.cache_misses += 1;
        let miss_time = start_time.elapsed().as_millis() as f64;
        stats.average_miss_time_ms = 
            (stats.average_miss_time_ms * (stats.cache_misses - 1) as f64 + miss_time) / stats.cache_misses as f64;
        
        None
    }
    
    /// Store query result in cache
    pub fn put(
        &self,
        query: &Query,
        results: Vec<SearchResult>,
        execution_time_ms: u64,
    ) {
        let cache_key = self.generate_cache_key(query);
        let ttl = self.get_ttl_for_query(query);
        
        let cached_result = CachedQueryResult::new(
            results,
            execution_time_ms,
            ttl,
            cache_key.clone(),
        );
        
        let mut cache = self.cache.write().unwrap();
        let mut stats = self.stats.write().unwrap();
        let mut lru_order = self.lru_order.write().unwrap();
        
        // Check if we need to evict entries
        while cache.len() >= self.config.max_entries {
            if let Some(oldest_key) = lru_order.first().cloned() {
                cache.remove(&oldest_key);
                lru_order.remove(0);
                stats.evictions += 1;
            } else {
                break;
            }
        }
        
        // Insert new entry
        cache.insert(cache_key.clone(), cached_result);
        lru_order.push(cache_key);
        stats.current_size = cache.len();
    }
    
    /// Get TTL based on query characteristics
    fn get_ttl_for_query(&self, query: &Query) -> Duration {
        match query.intent {
            Some(crate::models::query::QueryIntent::FindFunction) => self.config.simple_query_ttl,
            Some(crate::models::query::QueryIntent::ExplainCode) => self.config.semantic_query_ttl,
            Some(crate::models::query::QueryIntent::TraceFlow) => self.config.semantic_query_ttl,
            Some(crate::models::query::QueryIntent::SecurityAudit) => self.config.semantic_query_ttl,
            _ => self.config.default_ttl,
        }
    }
    
    /// Find similar cached queries using fuzzy matching
    pub fn find_similar(&self, query: &Query, similarity_threshold: f64) -> Option<CachedQueryResult> {
        let cache = self.cache.read().unwrap();
        let query_words: Vec<&str> = query.query_text.to_lowercase().split_whitespace().collect();
        
        let mut best_match: Option<(f64, CachedQueryResult)> = None;
        
        for cached_result in cache.values() {
            if cached_result.is_expired() {
                continue;
            }
            
            // Simple word-based similarity
            let similarity = self.calculate_query_similarity(&query_words, &cached_result.query_hash);
            
            if similarity >= similarity_threshold {
                if let Some((best_similarity, _)) = &best_match {
                    if similarity > *best_similarity {
                        best_match = Some((similarity, cached_result.clone()));
                    }
                } else {
                    best_match = Some((similarity, cached_result.clone()));
                }
            }
        }
        
        best_match.map(|(_, result)| result)
    }
    
    /// Calculate similarity between query words and cached query
    fn calculate_query_similarity(&self, query_words: &[&str], _cached_hash: &str) -> f64 {
        // Simplified similarity calculation
        // In a real implementation, this would use more sophisticated algorithms
        // like Jaccard similarity, cosine similarity, or edit distance
        
        // For now, return a random similarity for demonstration
        // This should be replaced with actual similarity calculation
        0.5
    }
    
    /// Clear expired entries
    pub fn cleanup_expired(&self) {
        let mut cache = self.cache.write().unwrap();
        let mut lru_order = self.lru_order.write().unwrap();
        let mut stats = self.stats.write().unwrap();
        
        let expired_keys: Vec<String> = cache
            .iter()
            .filter(|(_, result)| result.is_expired())
            .map(|(key, _)| key.clone())
            .collect();
        
        for key in expired_keys {
            cache.remove(&key);
            if let Some(pos) = lru_order.iter().position(|k| k == &key) {
                lru_order.remove(pos);
            }
        }
        
        stats.current_size = cache.len();
    }
    
    /// Get cache statistics
    pub fn get_stats(&self) -> QueryCacheStats {
        let stats = self.stats.read().unwrap();
        QueryCacheStats {
            total_requests: stats.total_requests,
            cache_hits: stats.cache_hits,
            cache_misses: stats.cache_misses,
            evictions: stats.evictions,
            current_size: stats.current_size,
            average_hit_time_ms: stats.average_hit_time_ms,
            average_miss_time_ms: stats.average_miss_time_ms,
        }
    }
    
    /// Clear all cache entries
    pub fn clear(&self) {
        let mut cache = self.cache.write().unwrap();
        let mut lru_order = self.lru_order.write().unwrap();
        let mut stats = self.stats.write().unwrap();
        
        cache.clear();
        lru_order.clear();
        stats.current_size = 0;
    }
    
    /// Warm up cache with common queries
    pub async fn warmup(&self, common_queries: Vec<Query>) {
        // This would typically be called during application startup
        // to pre-populate the cache with frequently used queries
        
        for query in common_queries {
            // Execute query and cache result
            // This is a placeholder - actual implementation would
            // call the search service to get results
            let mock_results = vec![];
            self.put(&query, mock_results, 100);
        }
    }
    
    /// Get cache configuration
    pub fn get_config(&self) -> &QueryCacheConfig {
        &self.config
    }
    
    /// Update cache configuration
    pub fn update_config(&mut self, new_config: QueryCacheConfig) {
        self.config = new_config;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::query::{QueryType, QueryIntent};
    use uuid::Uuid;
    
    fn create_test_query(text: &str) -> Query {
        Query {
            id: Uuid::new_v4(),
            query_text: text.to_string(),
            query_type: QueryType::NaturalLanguage,
            intent: Some(QueryIntent::FindFunction),
            codebase_id: Uuid::new_v4(),
            user_id: Some("test_user".to_string()),
            timestamp: chrono::Utc::now(),
            execution_time_ms: 0,
            result_count: 0,
            cache_hit: false,
        }
    }
    
    #[test]
    fn test_cache_key_generation() {
        let cache = QueryCache::with_default_config();
        let query1 = create_test_query("find authentication function");
        let query2 = create_test_query("find authentication function");
        let query3 = create_test_query("find user function");
        
        let key1 = cache.generate_cache_key(&query1);
        let key2 = cache.generate_cache_key(&query2);
        let key3 = cache.generate_cache_key(&query3);
        
        // Same queries should generate same keys
        assert_eq!(key1, key2);
        // Different queries should generate different keys
        assert_ne!(key1, key3);
    }
    
    #[test]
    fn test_cache_put_and_get() {
        let cache = QueryCache::with_default_config();
        let query = create_test_query("test query");
        let results = vec![];
        
        // Initially should be cache miss
        assert!(cache.get(&query).is_none());
        
        // Put result in cache
        cache.put(&query, results, 100);
        
        // Now should be cache hit
        let cached_result = cache.get(&query);
        assert!(cached_result.is_some());
        assert_eq!(cached_result.unwrap().execution_time_ms, 100);
    }
    
    #[test]
    fn test_cache_expiration() {
        let mut config = QueryCacheConfig::default();
        config.default_ttl = Duration::from_millis(10); // Very short TTL
        
        let cache = QueryCache::new(config);
        let query = create_test_query("test query");
        let results = vec![];
        
        // Put result in cache
        cache.put(&query, results, 100);
        
        // Should be cache hit immediately
        assert!(cache.get(&query).is_some());
        
        // Wait for expiration
        std::thread::sleep(Duration::from_millis(20));
        
        // Should be cache miss after expiration
        assert!(cache.get(&query).is_none());
    }
    
    #[test]
    fn test_cache_stats() {
        let cache = QueryCache::with_default_config();
        let query = create_test_query("test query");
        
        // Initial stats
        let stats = cache.get_stats();
        assert_eq!(stats.total_requests, 0);
        assert_eq!(stats.cache_hits, 0);
        assert_eq!(stats.cache_misses, 0);
        
        // Cache miss
        cache.get(&query);
        let stats = cache.get_stats();
        assert_eq!(stats.total_requests, 1);
        assert_eq!(stats.cache_misses, 1);
        
        // Put and hit
        cache.put(&query, vec![], 100);
        cache.get(&query);
        let stats = cache.get_stats();
        assert_eq!(stats.total_requests, 2);
        assert_eq!(stats.cache_hits, 1);
        assert_eq!(stats.cache_misses, 1);
    }
}