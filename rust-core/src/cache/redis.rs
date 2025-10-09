//! Redis cache adapter for distributed caching
//!
//! Provides high-performance caching with Redis for distributed deployments.
//! Supports multiple data structures, TTL management, and cache statistics.

use std::time::Duration;
use std::sync::Arc;
use serde::{Serialize, Deserialize};
use redis::{Client, Connection, Commands, RedisResult, RedisError};
use tokio::sync::RwLock;
use async_trait::async_trait;
use serde_json::Value;
use chrono::{DateTime, Utc};

use crate::errors::CoreError;
use crate::models::cache_entry::CacheEntry;

/// Redis cache configuration
#[derive(Debug, Clone)]
pub struct RedisConfig {
    /// Redis connection URL
    pub redis_url: String,
    /// Default TTL in seconds
    pub default_ttl: u64,
    /// Maximum number of connections in the pool
    pub max_connections: u32,
    /// Connection timeout in seconds
    pub connect_timeout: u64,
    /// Command timeout in seconds
    pub command_timeout: u64,
    /// Key prefix for namespacing
    pub key_prefix: String,
    /// Enable cluster mode
    pub enable_cluster: bool,
    /// Enable TLS/SSL
    pub enable_tls: bool,
    /// Enable compression for large values
    pub enable_compression: bool,
    /// Compression threshold in bytes
    pub compression_threshold: usize,
}

impl Default for RedisConfig {
    fn default() -> Self {
        Self {
            redis_url: "redis://localhost:6379".to_string(),
            default_ttl: 3600, // 1 hour
            max_connections: 10,
            connect_timeout: 5,
            command_timeout: 3,
            key_prefix: "codesight:".to_string(),
            enable_cluster: false,
            enable_tls: false,
            enable_compression: true,
            compression_threshold: 1024, // 1KB
        }
    }
}

/// Cache statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStats {
    pub total_keys: u64,
    pub hits: u64,
    pub misses: u64,
    pub hit_rate: f64,
    pub memory_usage: u64,
    pub connected_clients: u64,
    pub evicted_keys: u64,
    pub expired_keys: u64,
}

/// Redis cache adapter
pub struct RedisCacheAdapter {
    client: Arc<Client>,
    config: RedisConfig,
    stats: Arc<RwLock<CacheStats>>,
}

impl RedisCacheAdapter {
    /// Create a new Redis cache adapter
    pub async fn new(config: RedisConfig) -> ModelResult<Self> {
        // Create Redis client
        let client = Client::open(config.redis_url.clone())
            .map_err(|e| CoreError::CacheError(format!("Failed to create Redis client: {}", e)))?;

        // Test connection
        let mut conn = client.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to connect to Redis: {}", e)))?;

        // Ping to verify connection
        let _: String = redis::cmd("PING")
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Redis ping failed: {}", e)))?;

        // Initialize statistics
        let stats = CacheStats {
            total_keys: 0,
            hits: 0,
            misses: 0,
            hit_rate: 0.0,
            memory_usage: 0,
            connected_clients: 0,
            evicted_keys: 0,
            expired_keys: 0,
        };

        let adapter = Self {
            client: Arc::new(client),
            config: config.clone(),
            stats: Arc::new(RwLock::new(stats)),
        };

        // Load initial statistics
        adapter.update_stats().await?;

        Ok(adapter)
    }

    /// Get Redis connection
    fn get_connection(&self) -> RedisResult<Connection> {
        self.client.get_connection()
    }

    /// Generate namespaced key
    fn namespaced_key(&self, key: &str) -> String {
        format!("{}{}", self.config.key_prefix, key)
    }

    /// Serialize and optionally compress value
    fn serialize_value<T: Serialize>(&self, value: &T) -> ModelResult<Vec<u8>> {
        let data = serde_json::to_vec(value)
            .map_err(|e| CoreError::SerializationError(e.to_string()))?;

        if self.config.enable_compression && data.len() > self.config.compression_threshold {
            // Compress using simple compression (in production, use zstd or gzip)
            let compressed = self.compress_data(&data)?;
            Ok(compressed)
        } else {
            Ok(data)
        }
    }

    /// Deserialize and optionally decompress value
    fn deserialize_value<T: for<'de> Deserialize<'de>>(&self, data: &[u8], is_compressed: bool) -> ModelResult<T> {
        let decompressed_data = if is_compressed {
            self.decompress_data(data)?
        } else {
            data.to_vec()
        };

        serde_json::from_slice(&decompressed_data)
            .map_err(|e| CoreError::SerializationError(e.to_string()))
    }

    /// Simple compression (placeholder - use proper compression in production)
    fn compress_data(&self, data: &[u8]) -> ModelResult<Vec<u8>> {
        // This is a placeholder implementation
        // In production, use proper compression libraries like flate2 or zstd
        Ok(data.to_vec())
    }

    /// Simple decompression (placeholder - use proper decompression in production)
    fn decompress_data(&self, data: &[u8]) -> ModelResult<Vec<u8>> {
        // This is a placeholder implementation
        // In production, use proper compression libraries like flate2 or zstd
        Ok(data.to_vec())
    }

    /// Set cache value with TTL
    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl: Option<Duration>) -> ModelResult<()> {
        let serialized = self.serialize_value(value)?;
        let namespaced_key = self.namespaced_key(key);
        let ttl_seconds = ttl.unwrap_or(Duration::from_secs(self.config.default_ttl)).as_secs();

        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let _: () = redis::cmd("SETEX")
            .arg(&namespaced_key)
            .arg(ttl_seconds)
            .arg(&serialized)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to set cache value: {}", e)))?;

        Ok(())
    }

    /// Get cache value
    pub async fn get<T: for<'de> Deserialize<'de>>(&self, key: &str) -> ModelResult<Option<T>> {
        let namespaced_key = self.namespaced_key(key);
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let result: Option<Vec<u8>> = redis::cmd("GET")
            .arg(&namespaced_key)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to get cache value: {}", e)))?;

        match result {
            Some(data) => {
                // Update hit statistics
                self.update_hit_stats(true).await;

                // Deserialize (assuming compression for simplicity - in production track compression state)
                let value = self.deserialize_value(&data, false)?;
                Ok(Some(value))
            }
            None => {
                // Update miss statistics
                self.update_hit_stats(false).await;
                Ok(None)
            }
        }
    }

    /// Set cache value only if key doesn't exist
    pub async fn set_if_not_exists<T: Serialize>(&self, key: &str, value: &T, ttl: Option<Duration>) -> ModelResult<bool> {
        let serialized = self.serialize_value(value)?;
        let namespaced_key = self.namespaced_key(key);
        let ttl_seconds = ttl.unwrap_or(Duration::from_secs(self.config.default_ttl)).as_secs();

        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let result: bool = redis::cmd("SET")
            .arg(&namespaced_key)
            .arg(&serialized)
            .arg("NX")
            .arg("EX")
            .arg(ttl_seconds)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to set if not exists: {}", e)))?;

        Ok(result)
    }

    /// Delete cache key
    pub async fn delete(&self, key: &str) -> ModelResult<bool> {
        let namespaced_key = self.namespaced_key(key);
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let result: i32 = redis::cmd("DEL")
            .arg(&namespaced_key)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to delete cache key: {}", e)))?;

        Ok(result > 0)
    }

    /// Check if key exists
    pub async fn exists(&self, key: &str) -> ModelResult<bool> {
        let namespaced_key = self.namespaced_key(key);
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let result: bool = redis::cmd("EXISTS")
            .arg(&namespaced_key)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to check key existence: {}", e)))?;

        Ok(result)
    }

    /// Set key TTL
    pub async fn expire(&self, key: &str, ttl: Duration) -> ModelResult<bool> {
        let namespaced_key = self.namespaced_key(key);
        let ttl_seconds = ttl.as_secs();

        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let result: bool = redis::cmd("EXPIRE")
            .arg(&namespaced_key)
            .arg(ttl_seconds)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to set TTL: {}", e)))?;

        Ok(result)
    }

    /// Get remaining TTL for key
    pub async fn ttl(&self, key: &str) -> ModelResult<Option<Duration>> {
        let namespaced_key = self.namespaced_key(key);
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let result: i64 = redis::cmd("TTL")
            .arg(&namespaced_key)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to get TTL: {}", e)))?;

        match result {
            -1 => Ok(None), // No expiration
            -2 => Ok(Some(Duration::from_secs(0))), // Key doesn't exist
            ttl => Ok(Some(Duration::from_secs(ttl as u64))),
        }
    }

    /// Increment numeric value
    pub async fn increment(&self, key: &str, delta: i64) -> ModelResult<i64> {
        let namespaced_key = self.namespaced_key(key);
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let result: i64 = redis::cmd("INCRBY")
            .arg(&namespaced_key)
            .arg(delta)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to increment: {}", e)))?;

        Ok(result)
    }

    /// Add to set
    pub async fn sadd<T: Serialize>(&self, key: &str, members: &[T]) -> ModelResult<u64> {
        let namespaced_key = self.namespaced_key(key);
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let serialized_members: Result<Vec<Vec<u8>>, _> = members
            .iter()
            .map(|m| self.serialize_value(m))
            .collect();

        let members = serialized_members
            .map_err(|e| CoreError::SerializationError(e.to_string()))?;

        let result: u64 = redis::cmd("SADD")
            .arg(&namespaced_key)
            .arg(&members)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to add to set: {}", e)))?;

        Ok(result)
    }

    /// Get all set members
    pub async fn smembers<T: for<'de> Deserialize<'de>>(&self, key: &str) -> ModelResult<Vec<T>> {
        let namespaced_key = self.namespaced_key(key);
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let result: Vec<Vec<u8>> = redis::cmd("SMEMBERS")
            .arg(&namespaced_key)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to get set members: {}", e)))?;

        let members: Result<Vec<T>, _> = result
            .into_iter()
            .map(|data| self.deserialize_value(&data, false))
            .collect();

        members.map_err(|e| CoreError::SerializationError(e.to_string()))
    }

    /// Push to list
    pub async fn lpush<T: Serialize>(&self, key: &str, values: &[T]) -> ModelResult<u64> {
        let namespaced_key = self.namespaced_key(key);
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let serialized_values: Result<Vec<Vec<u8>>, _> = values
            .iter()
            .map(|v| self.serialize_value(v))
            .collect();

        let values = serialized_values
            .map_err(|e| CoreError::SerializationError(e.to_string()))?;

        let result: u64 = redis::cmd("LPUSH")
            .arg(&namespaced_key)
            .arg(&values)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to push to list: {}", e)))?;

        Ok(result)
    }

    /// Pop from list
    pub async fn rpop<T: for<'de> Deserialize<'de>>(&self, key: &str) -> ModelResult<Option<T>> {
        let namespaced_key = self.namespaced_key(key);
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let result: Option<Vec<u8>> = redis::cmd("RPOP")
            .arg(&namespaced_key)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to pop from list: {}", e)))?;

        match result {
            Some(data) => {
                let value = self.deserialize_value(&data, false)?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }

    /// Get list range
    pub async fn lrange<T: for<'de> Deserialize<'de>>(&self, key: &str, start: i64, end: i64) -> ModelResult<Vec<T>> {
        let namespaced_key = self.namespaced_key(key);
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let result: Vec<Vec<u8>> = redis::cmd("LRANGE")
            .arg(&namespaced_key)
            .arg(start)
            .arg(end)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to get list range: {}", e)))?;

        let items: Result<Vec<T>, _> = result
            .into_iter()
            .map(|data| self.deserialize_value(&data, false))
            .collect();

        items.map_err(|e| CoreError::SerializationError(e.to_string()))
    }

    /// Clear all cache entries with this adapter's prefix
    pub async fn clear(&self) -> ModelResult<u64> {
        let pattern = format!("{}*", self.config.key_prefix);
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(&pattern)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to get keys: {}", e)))?;

        if keys.is_empty() {
            return Ok(0);
        }

        let deleted: u64 = redis::cmd("DEL")
            .arg(&keys)
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to delete keys: {}", e)))?;

        Ok(deleted)
    }

    /// Update hit statistics
    async fn update_hit_stats(&self, is_hit: bool) {
        let mut stats = self.stats.write().await;
        if is_hit {
            stats.hits += 1;
        } else {
            stats.misses += 1;
        }

        let total = stats.hits + stats.misses;
        if total > 0 {
            stats.hit_rate = stats.hits as f64 / total as f64;
        }
    }

    /// Update cache statistics from Redis
    async fn update_stats(&self) -> ModelResult<()> {
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        // Get Redis info
        let info: String = redis::cmd("INFO")
            .arg("memory")
            .arg("keyspace")
            .arg("stats")
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis info: {}", e)))?;

        // Parse info and update stats (simplified parsing)
        let mut stats = self.stats.write().await;

        // Extract memory usage
        for line in info.lines() {
            if line.starts_with("used_memory:") {
                if let Some(value) = line.split(':').nth(1) {
                    if let Ok(memory) = value.parse::<u64>() {
                        stats.memory_usage = memory;
                    }
                }
            }
            // Parse other stats as needed
        }

        Ok(())
    }

    /// Get cache statistics
    pub async fn get_stats(&self) -> ModelResult<CacheStats> {
        // Update stats from Redis
        self.update_stats().await?;

        let stats = self.stats.read().await;
        Ok(stats.clone())
    }

    /// Get detailed Redis information
    pub async fn get_redis_info(&self) -> ModelResult<Value> {
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let info: String = redis::cmd("INFO")
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis info: {}", e)))?;

        // Parse Redis info into JSON
        let mut info_map = serde_json::Map::new();

        for line in info.lines() {
            if line.starts_with('#') || line.trim().is_empty() {
                continue;
            }

            if let Some((key, value)) = line.split_once(':') {
                if let Ok(num_value) = value.parse::<i64>() {
                    info_map.insert(key.to_string(), Value::Number(serde_json::Number::from(num_value)));
                } else {
                    info_map.insert(key.to_string(), Value::String(value.to_string()));
                }
            }
        }

        Ok(Value::Object(info_map))
    }

    /// Flush all cache entries (use with caution)
    pub async fn flush_all(&self) -> ModelResult<()> {
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let _: () = redis::cmd("FLUSHDB")
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Failed to flush database: {}", e)))?;

        Ok(())
    }

    /// Health check
    pub async fn health_check(&self) -> ModelResult<bool> {
        let mut conn = self.get_connection()
            .map_err(|e| CoreError::CacheError(format!("Failed to get Redis connection: {}", e)))?;

        let _: String = redis::cmd("PING")
            .query(&mut conn)
            .map_err(|e| CoreError::CacheError(format!("Redis health check failed: {}", e)))?;

        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;
    use tokio;

    #[tokio::test]
    #[ignore] // Requires Redis server
    async fn test_redis_cache_adapter() {
        let config = RedisConfig {
            redis_url: "redis://localhost:6379".to_string(),
            ..Default::default()
        };

        let cache = RedisCacheAdapter::new(config).await.unwrap();

        // Test set and get
        cache.set("test_key", &"test_value", None).await.unwrap();
        let value: Option<String> = cache.get("test_key").await.unwrap();
        assert_eq!(value, Some("test_value".to_string()));

        // Test delete
        let deleted = cache.delete("test_key").await.unwrap();
        assert!(deleted);

        let value: Option<String> = cache.get("test_key").await.unwrap();
        assert_eq!(value, None);
    }

    #[tokio::test]
    #[ignore] // Requires Redis server
    async fn test_redis_expiration() {
        let config = RedisConfig {
            redis_url: "redis://localhost:6379".to_string(),
            default_ttl: 1,
            ..Default::default()
        };

        let cache = RedisCacheAdapter::new(config).await.unwrap();

        cache.set("expire_key", &"expire_value", Some(Duration::from_secs(1))).await.unwrap();

        // Should exist immediately
        let exists = cache.exists("expire_key").await.unwrap();
        assert!(exists);

        // Wait for expiration
        tokio::time::sleep(Duration::from_secs(2)).await;

        // Should be expired
        let exists = cache.exists("expire_key").await.unwrap();
        assert!(!exists);
    }
}