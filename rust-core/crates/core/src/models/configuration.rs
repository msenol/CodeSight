//! Configuration model for system settings and preferences

use crate::error::CoreError;
use crate::traits::{Validate, Timestamped, JsonSerializable};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

/// Main configuration for the Code Intelligence MCP Server
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Configuration {
    /// Unique identifier for this configuration
    pub id: String,
    /// Configuration name/profile
    pub name: String,
    /// Configuration description
    pub description: Option<String>,
    /// Configuration version
    pub version: String,
    /// Server configuration
    pub server: ServerConfig,
    /// Indexing configuration
    pub indexing: IndexingConfig,
    /// Search configuration
    pub search: SearchConfig,
    /// Embedding configuration
    pub embedding: EmbeddingConfig,
    /// Storage configuration
    pub storage: StorageConfig,
    /// Cache configuration
    pub cache: CacheConfig,
    /// Security configuration
    pub security: SecurityConfig,
    /// Logging configuration
    pub logging: LoggingConfig,
    /// Performance configuration
    pub performance: PerformanceConfig,
    /// Plugin configuration
    pub plugins: PluginConfig,
    /// Environment-specific settings
    pub environment: EnvironmentConfig,
    /// When the configuration was created
    pub created_at: DateTime<Utc>,
    /// When the configuration was last updated
    pub updated_at: DateTime<Utc>,
}

/// Server configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ServerConfig {
    /// Server host address
    pub host: String,
    /// Server port
    pub port: u16,
    /// Maximum number of concurrent connections
    pub max_connections: usize,
    /// Request timeout in seconds
    pub request_timeout_seconds: u64,
    /// Whether to enable CORS
    pub enable_cors: bool,
    /// Allowed CORS origins
    pub cors_origins: Vec<String>,
    /// API rate limiting
    pub rate_limiting: RateLimitConfig,
    /// TLS configuration
    pub tls: Option<TlsConfig>,
}

/// Rate limiting configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RateLimitConfig {
    /// Whether rate limiting is enabled
    pub enabled: bool,
    /// Requests per minute per IP
    pub requests_per_minute: u32,
    /// Burst size
    pub burst_size: u32,
    /// Whitelist of IPs exempt from rate limiting
    pub whitelist: Vec<String>,
}

/// TLS configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct TlsConfig {
    /// Path to certificate file
    pub cert_path: PathBuf,
    /// Path to private key file
    pub key_path: PathBuf,
    /// Whether to require client certificates
    pub require_client_cert: bool,
    /// Path to CA certificate for client verification
    pub ca_cert_path: Option<PathBuf>,
}

/// Indexing configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IndexingConfig {
    /// Whether indexing is enabled
    pub enabled: bool,
    /// Batch size for indexing operations
    pub batch_size: usize,
    /// Number of parallel workers
    pub parallel_workers: usize,
    /// Maximum file size to index (in bytes)
    pub max_file_size_bytes: usize,
    /// File patterns to include
    pub include_patterns: Vec<String>,
    /// File patterns to exclude
    pub exclude_patterns: Vec<String>,
    /// Whether to follow symbolic links
    pub follow_symlinks: bool,
    /// Whether to index hidden files
    pub index_hidden_files: bool,
    /// Indexing schedule (cron expression)
    pub schedule: Option<String>,
    /// Whether to enable incremental indexing
    pub incremental: bool,
    /// Debounce time for file changes (milliseconds)
    pub debounce_ms: u64,
}

/// Search configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SearchConfig {
    /// Default search limit
    pub default_limit: usize,
    /// Maximum search limit
    pub max_limit: usize,
    /// Default similarity threshold for semantic search
    pub default_similarity_threshold: f32,
    /// Whether to enable fuzzy search
    pub enable_fuzzy_search: bool,
    /// Fuzzy search threshold
    pub fuzzy_threshold: f32,
    /// Whether to enable search result caching
    pub enable_result_caching: bool,
    /// Search result cache TTL in seconds
    pub result_cache_ttl_seconds: u64,
    /// Whether to enable search analytics
    pub enable_analytics: bool,
}

/// Embedding configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmbeddingConfig {
    /// Whether embedding generation is enabled
    pub enabled: bool,
    /// Default embedding provider
    pub default_provider: String,
    /// Provider-specific configurations
    pub providers: HashMap<String, EmbeddingProviderConfig>,
    /// Batch size for embedding generation
    pub batch_size: usize,
    /// Maximum text length for embedding
    pub max_text_length: usize,
    /// Whether to normalize embeddings
    pub normalize_embeddings: bool,
    /// Embedding cache TTL in seconds
    pub cache_ttl_seconds: u64,
    /// Whether to enable embedding compression
    pub enable_compression: bool,
}

/// Embedding provider configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EmbeddingProviderConfig {
    /// Provider name
    pub name: String,
    /// API endpoint URL
    pub endpoint: String,
    /// API key (encrypted)
    pub api_key: Option<String>,
    /// Model name
    pub model: String,
    /// Request timeout in seconds
    pub timeout_seconds: u64,
    /// Maximum retries
    pub max_retries: u32,
    /// Retry delay in milliseconds
    pub retry_delay_ms: u64,
    /// Custom headers
    pub headers: HashMap<String, String>,
}

/// Storage configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct StorageConfig {
    /// Storage backend type
    pub backend: StorageBackend,
    /// Connection string or path
    pub connection: String,
    /// Connection pool size
    pub pool_size: usize,
    /// Connection timeout in seconds
    pub connection_timeout_seconds: u64,
    /// Query timeout in seconds
    pub query_timeout_seconds: u64,
    /// Whether to enable connection pooling
    pub enable_pooling: bool,
    /// Whether to enable SSL/TLS
    pub enable_ssl: bool,
    /// Backup configuration
    pub backup: Option<BackupConfig>,
}

/// Storage backend types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum StorageBackend {
    /// SQLite database
    Sqlite,
    /// PostgreSQL database
    PostgreSQL,
    /// MySQL database
    MySQL,
    /// In-memory storage
    Memory,
    /// File-based storage
    File,
}

/// Backup configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct BackupConfig {
    /// Whether backups are enabled
    pub enabled: bool,
    /// Backup directory
    pub directory: PathBuf,
    /// Backup schedule (cron expression)
    pub schedule: String,
    /// Number of backups to retain
    pub retention_count: usize,
    /// Whether to compress backups
    pub compress: bool,
    /// Whether to encrypt backups
    pub encrypt: bool,
    /// Encryption key (encrypted)
    pub encryption_key: Option<String>,
}

/// Cache configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CacheConfig {
    /// Whether caching is enabled
    pub enabled: bool,
    /// Cache backend type
    pub backend: CacheBackend,
    /// Maximum cache size in bytes
    pub max_size_bytes: usize,
    /// Maximum number of entries
    pub max_entries: usize,
    /// Default TTL in seconds
    pub default_ttl_seconds: u64,
    /// Eviction policy
    pub eviction_policy: EvictionPolicy,
    /// Whether to enable cache compression
    pub enable_compression: bool,
    /// Cache statistics collection interval in seconds
    pub stats_interval_seconds: u64,
}

/// Cache backend types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum CacheBackend {
    /// In-memory cache
    Memory,
    /// Redis cache
    Redis,
    /// File-based cache
    File,
    /// Hybrid cache (memory + persistent)
    Hybrid,
}

/// Cache eviction policies
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum EvictionPolicy {
    /// Least Recently Used
    Lru,
    /// Least Frequently Used
    Lfu,
    /// First In, First Out
    Fifo,
    /// Time To Live
    Ttl,
}

/// Security configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SecurityConfig {
    /// Whether authentication is enabled
    pub enable_authentication: bool,
    /// Authentication method
    pub auth_method: AuthMethod,
    /// JWT secret key (encrypted)
    pub jwt_secret: Option<String>,
    /// JWT expiration time in seconds
    pub jwt_expiration_seconds: u64,
    /// Whether to enable API key authentication
    pub enable_api_keys: bool,
    /// Valid API keys (encrypted)
    pub api_keys: Vec<String>,
    /// Whether to enable request signing
    pub enable_request_signing: bool,
    /// Encryption configuration
    pub encryption: EncryptionConfig,
}

/// Authentication methods
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum AuthMethod {
    /// No authentication
    None,
    /// API key authentication
    ApiKey,
    /// JWT token authentication
    Jwt,
    /// OAuth 2.0
    OAuth2,
    /// Custom authentication
    Custom(String),
}

/// Encryption configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EncryptionConfig {
    /// Whether encryption is enabled
    pub enabled: bool,
    /// Encryption algorithm
    pub algorithm: String,
    /// Key derivation function
    pub key_derivation: String,
    /// Salt for key derivation
    pub salt: Option<String>,
    /// Number of iterations for key derivation
    pub iterations: u32,
}

/// Logging configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LoggingConfig {
    /// Log level
    pub level: LogLevel,
    /// Log format
    pub format: LogFormat,
    /// Log output destinations
    pub outputs: Vec<LogOutput>,
    /// Whether to enable structured logging
    pub structured: bool,
    /// Whether to enable log rotation
    pub enable_rotation: bool,
    /// Maximum log file size in bytes
    pub max_file_size_bytes: usize,
    /// Number of log files to retain
    pub max_files: usize,
    /// Whether to compress rotated logs
    pub compress_rotated: bool,
}

/// Log levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LogLevel {
    /// Trace level
    Trace,
    /// Debug level
    Debug,
    /// Info level
    Info,
    /// Warning level
    Warn,
    /// Error level
    Error,
}

/// Log formats
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LogFormat {
    /// Plain text format
    Text,
    /// JSON format
    Json,
    /// Custom format
    Custom(String),
}

/// Log output destinations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum LogOutput {
    /// Standard output
    Stdout,
    /// Standard error
    Stderr,
    /// File output
    File(PathBuf),
    /// Syslog output
    Syslog,
    /// Custom output
    Custom(String),
}

/// Performance configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PerformanceConfig {
    /// Number of worker threads
    pub worker_threads: usize,
    /// Thread stack size in bytes
    pub thread_stack_size_bytes: usize,
    /// Whether to enable performance monitoring
    pub enable_monitoring: bool,
    /// Metrics collection interval in seconds
    pub metrics_interval_seconds: u64,
    /// Memory usage limits
    pub memory_limits: MemoryLimits,
    /// CPU usage limits
    pub cpu_limits: CpuLimits,
    /// I/O limits
    pub io_limits: IoLimits,
}

/// Memory usage limits
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct MemoryLimits {
    /// Maximum heap size in bytes
    pub max_heap_bytes: Option<usize>,
    /// Memory usage warning threshold (percentage)
    pub warning_threshold_percent: f32,
    /// Memory usage critical threshold (percentage)
    pub critical_threshold_percent: f32,
    /// Whether to enable garbage collection tuning
    pub enable_gc_tuning: bool,
}

/// CPU usage limits
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CpuLimits {
    /// Maximum CPU usage percentage
    pub max_usage_percent: Option<f32>,
    /// CPU usage warning threshold (percentage)
    pub warning_threshold_percent: f32,
    /// CPU usage critical threshold (percentage)
    pub critical_threshold_percent: f32,
    /// Whether to enable CPU throttling
    pub enable_throttling: bool,
}

/// I/O limits
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct IoLimits {
    /// Maximum read operations per second
    pub max_read_ops_per_second: Option<u32>,
    /// Maximum write operations per second
    pub max_write_ops_per_second: Option<u32>,
    /// Maximum read bandwidth in bytes per second
    pub max_read_bytes_per_second: Option<usize>,
    /// Maximum write bandwidth in bytes per second
    pub max_write_bytes_per_second: Option<usize>,
}

/// Plugin configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginConfig {
    /// Whether plugins are enabled
    pub enabled: bool,
    /// Plugin directory
    pub plugin_directory: PathBuf,
    /// Whether to auto-load plugins
    pub auto_load: bool,
    /// Plugin security settings
    pub security: PluginSecurityConfig,
    /// Plugin resource limits
    pub resource_limits: PluginResourceLimits,
    /// Enabled plugins
    pub enabled_plugins: Vec<String>,
    /// Disabled plugins
    pub disabled_plugins: Vec<String>,
}

/// Plugin security configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginSecurityConfig {
    /// Whether to enable plugin sandboxing
    pub enable_sandboxing: bool,
    /// Whether to verify plugin signatures
    pub verify_signatures: bool,
    /// Trusted plugin sources
    pub trusted_sources: Vec<String>,
    /// Whether to allow network access
    pub allow_network_access: bool,
    /// Whether to allow file system access
    pub allow_file_access: bool,
}

/// Plugin resource limits
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginResourceLimits {
    /// Maximum memory usage per plugin in bytes
    pub max_memory_bytes: usize,
    /// Maximum CPU usage per plugin (percentage)
    pub max_cpu_percent: f32,
    /// Maximum execution time per operation in seconds
    pub max_execution_time_seconds: u64,
    /// Maximum number of concurrent operations per plugin
    pub max_concurrent_operations: usize,
}

/// Environment-specific configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EnvironmentConfig {
    /// Environment name (development, staging, production)
    pub name: String,
    /// Whether this is a development environment
    pub is_development: bool,
    /// Whether to enable debug features
    pub enable_debug: bool,
    /// Custom environment variables
    pub variables: HashMap<String, String>,
    /// Feature flags
    pub feature_flags: HashMap<String, bool>,
}

impl Configuration {
    /// Create a new configuration with defaults
    pub fn new(name: String) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            description: None,
            version: "1.0.0".to_string(),
            server: ServerConfig::default(),
            indexing: IndexingConfig::default(),
            search: SearchConfig::default(),
            embedding: EmbeddingConfig::default(),
            storage: StorageConfig::default(),
            cache: CacheConfig::default(),
            security: SecurityConfig::default(),
            logging: LoggingConfig::default(),
            performance: PerformanceConfig::default(),
            plugins: PluginConfig::default(),
            environment: EnvironmentConfig::default(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// Create a development configuration
    pub fn development() -> Self {
        let mut config = Self::new("development".to_string());
        config.environment.is_development = true;
        config.environment.enable_debug = true;
        config.logging.level = LogLevel::Debug;
        config.security.enable_authentication = false;
        config
    }

    /// Create a production configuration
    pub fn production() -> Self {
        let mut config = Self::new("production".to_string());
        config.environment.is_development = false;
        config.environment.enable_debug = false;
        config.logging.level = LogLevel::Info;
        config.security.enable_authentication = true;
        config.performance.enable_monitoring = true;
        config
    }

    /// Update the configuration
    pub fn update(&mut self) {
        self.updated_at = Utc::now();
    }

    /// Merge with another configuration
    pub fn merge(&mut self, other: &Configuration) {
        // Merge non-structural fields
        if !other.description.as_ref().unwrap_or(&String::new()).is_empty() {
            self.description = other.description.clone();
        }
        
        // Merge environment variables
        for (key, value) in &other.environment.variables {
            self.environment.variables.insert(key.clone(), value.clone());
        }
        
        // Merge feature flags
        for (key, value) in &other.environment.feature_flags {
            self.environment.feature_flags.insert(key.clone(), *value);
        }
        
        self.update();
    }

    /// Check if a feature flag is enabled
    pub fn is_feature_enabled(&self, feature: &str) -> bool {
        self.environment.feature_flags.get(feature).copied().unwrap_or(false)
    }

    /// Set a feature flag
    pub fn set_feature_flag(&mut self, feature: String, enabled: bool) {
        self.environment.feature_flags.insert(feature, enabled);
        self.update();
    }

    /// Get environment variable
    pub fn get_env_var(&self, key: &str) -> Option<&String> {
        self.environment.variables.get(key)
    }

    /// Set environment variable
    pub fn set_env_var(&mut self, key: String, value: String) {
        self.environment.variables.insert(key, value);
        self.update();
    }

    /// Check if running in development mode
    pub fn is_development(&self) -> bool {
        self.environment.is_development
    }

    /// Check if debug features are enabled
    pub fn is_debug_enabled(&self) -> bool {
        self.environment.enable_debug
    }
}

// Default implementations
impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".to_string(),
            port: 8080,
            max_connections: 1000,
            request_timeout_seconds: 30,
            enable_cors: true,
            cors_origins: vec!["*".to_string()],
            rate_limiting: RateLimitConfig::default(),
            tls: None,
        }
    }
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            requests_per_minute: 60,
            burst_size: 10,
            whitelist: Vec::new(),
        }
    }
}

impl Default for IndexingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            batch_size: 100,
            parallel_workers: 4,
            max_file_size_bytes: 10 * 1024 * 1024, // 10MB
            include_patterns: vec!["**/*.rs".to_string(), "**/*.ts".to_string(), "**/*.js".to_string()],
            exclude_patterns: vec!["**/node_modules/**".to_string(), "**/target/**".to_string()],
            follow_symlinks: false,
            index_hidden_files: false,
            schedule: None,
            incremental: true,
            debounce_ms: 1000,
        }
    }
}

impl Default for SearchConfig {
    fn default() -> Self {
        Self {
            default_limit: 50,
            max_limit: 1000,
            default_similarity_threshold: 0.7,
            enable_fuzzy_search: true,
            fuzzy_threshold: 0.8,
            enable_result_caching: true,
            result_cache_ttl_seconds: 300,
            enable_analytics: true,
        }
    }
}

impl Default for EmbeddingConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            default_provider: "openai".to_string(),
            providers: HashMap::new(),
            batch_size: 100,
            max_text_length: 8000,
            normalize_embeddings: true,
            cache_ttl_seconds: 86400, // 24 hours
            enable_compression: true,
        }
    }
}

impl Default for StorageConfig {
    fn default() -> Self {
        Self {
            backend: StorageBackend::Sqlite,
            connection: "./data/database.db".to_string(),
            pool_size: 10,
            connection_timeout_seconds: 30,
            query_timeout_seconds: 60,
            enable_pooling: true,
            enable_ssl: false,
            backup: None,
        }
    }
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            backend: CacheBackend::Memory,
            max_size_bytes: 100 * 1024 * 1024, // 100MB
            max_entries: 10000,
            default_ttl_seconds: 3600, // 1 hour
            eviction_policy: EvictionPolicy::Lru,
            enable_compression: true,
            stats_interval_seconds: 60,
        }
    }
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            enable_authentication: false,
            auth_method: AuthMethod::None,
            jwt_secret: None,
            jwt_expiration_seconds: 3600,
            enable_api_keys: false,
            api_keys: Vec::new(),
            enable_request_signing: false,
            encryption: EncryptionConfig::default(),
        }
    }
}

impl Default for EncryptionConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            algorithm: "AES-256-GCM".to_string(),
            key_derivation: "PBKDF2".to_string(),
            salt: None,
            iterations: 100000,
        }
    }
}

impl Default for LoggingConfig {
    fn default() -> Self {
        Self {
            level: LogLevel::Info,
            format: LogFormat::Text,
            outputs: vec![LogOutput::Stdout],
            structured: false,
            enable_rotation: true,
            max_file_size_bytes: 10 * 1024 * 1024, // 10MB
            max_files: 5,
            compress_rotated: true,
        }
    }
}

impl Default for PerformanceConfig {
    fn default() -> Self {
        Self {
            worker_threads: num_cpus::get(),
            thread_stack_size_bytes: 2 * 1024 * 1024, // 2MB
            enable_monitoring: false,
            metrics_interval_seconds: 60,
            memory_limits: MemoryLimits::default(),
            cpu_limits: CpuLimits::default(),
            io_limits: IoLimits::default(),
        }
    }
}

impl Default for MemoryLimits {
    fn default() -> Self {
        Self {
            max_heap_bytes: None,
            warning_threshold_percent: 80.0,
            critical_threshold_percent: 95.0,
            enable_gc_tuning: false,
        }
    }
}

impl Default for CpuLimits {
    fn default() -> Self {
        Self {
            max_usage_percent: None,
            warning_threshold_percent: 80.0,
            critical_threshold_percent: 95.0,
            enable_throttling: false,
        }
    }
}

impl Default for IoLimits {
    fn default() -> Self {
        Self {
            max_read_ops_per_second: None,
            max_write_ops_per_second: None,
            max_read_bytes_per_second: None,
            max_write_bytes_per_second: None,
        }
    }
}

impl Default for PluginConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            plugin_directory: PathBuf::from("./plugins"),
            auto_load: true,
            security: PluginSecurityConfig::default(),
            resource_limits: PluginResourceLimits::default(),
            enabled_plugins: Vec::new(),
            disabled_plugins: Vec::new(),
        }
    }
}

impl Default for PluginSecurityConfig {
    fn default() -> Self {
        Self {
            enable_sandboxing: true,
            verify_signatures: true,
            trusted_sources: Vec::new(),
            allow_network_access: false,
            allow_file_access: false,
        }
    }
}

impl Default for PluginResourceLimits {
    fn default() -> Self {
        Self {
            max_memory_bytes: 100 * 1024 * 1024, // 100MB
            max_cpu_percent: 50.0,
            max_execution_time_seconds: 300, // 5 minutes
            max_concurrent_operations: 10,
        }
    }
}

impl Default for EnvironmentConfig {
    fn default() -> Self {
        Self {
            name: "default".to_string(),
            is_development: false,
            enable_debug: false,
            variables: HashMap::new(),
            feature_flags: HashMap::new(),
        }
    }
}

impl Validate for Configuration {
    fn validate(&self) -> Result<(), CoreError> {
        if self.name.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Configuration name cannot be empty".to_string(),
            ));
        }

        if self.server.port == 0 {
            return Err(CoreError::ValidationError(
                "Server port must be greater than 0".to_string(),
            ));
        }

        if self.indexing.batch_size == 0 {
            return Err(CoreError::ValidationError(
                "Indexing batch size must be greater than 0".to_string(),
            ));
        }

        if self.indexing.parallel_workers == 0 {
            return Err(CoreError::ValidationError(
                "Number of parallel workers must be greater than 0".to_string(),
            ));
        }

        if !(0.0..=1.0).contains(&self.search.default_similarity_threshold) {
            return Err(CoreError::ValidationError(
                "Similarity threshold must be between 0.0 and 1.0".to_string(),
            ));
        }

        if self.performance.worker_threads == 0 {
            return Err(CoreError::ValidationError(
                "Number of worker threads must be greater than 0".to_string(),
            ));
        }

        Ok(())
    }
}

impl Timestamped for Configuration {
    fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    fn updated_at(&self) -> Option<DateTime<Utc>> {
        Some(self.updated_at)
    }
}

impl JsonSerializable for Configuration {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_configuration_creation() {
        let config = Configuration::new("test".to_string());
        assert_eq!(config.name, "test");
        assert_eq!(config.version, "1.0.0");
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_development_configuration() {
        let config = Configuration::development();
        assert_eq!(config.name, "development");
        assert!(config.is_development());
        assert!(config.is_debug_enabled());
        assert_eq!(config.logging.level, LogLevel::Debug);
        assert!(!config.security.enable_authentication);
    }

    #[test]
    fn test_production_configuration() {
        let config = Configuration::production();
        assert_eq!(config.name, "production");
        assert!(!config.is_development());
        assert!(!config.is_debug_enabled());
        assert_eq!(config.logging.level, LogLevel::Info);
        assert!(config.security.enable_authentication);
        assert!(config.performance.enable_monitoring);
    }

    #[test]
    fn test_feature_flags() {
        let mut config = Configuration::new("test".to_string());
        assert!(!config.is_feature_enabled("new_feature"));
        
        config.set_feature_flag("new_feature".to_string(), true);
        assert!(config.is_feature_enabled("new_feature"));
        
        config.set_feature_flag("new_feature".to_string(), false);
        assert!(!config.is_feature_enabled("new_feature"));
    }

    #[test]
    fn test_environment_variables() {
        let mut config = Configuration::new("test".to_string());
        assert!(config.get_env_var("TEST_VAR").is_none());
        
        config.set_env_var("TEST_VAR".to_string(), "test_value".to_string());
        assert_eq!(config.get_env_var("TEST_VAR"), Some(&"test_value".to_string()));
    }

    #[test]
    fn test_configuration_merge() {
        let mut config1 = Configuration::new("config1".to_string());
        let mut config2 = Configuration::new("config2".to_string());
        
        config2.description = Some("Merged config".to_string());
        config2.set_env_var("MERGE_VAR".to_string(), "merged_value".to_string());
        config2.set_feature_flag("merge_feature".to_string(), true);
        
        config1.merge(&config2);
        
        assert_eq!(config1.description, Some("Merged config".to_string()));
        assert_eq!(config1.get_env_var("MERGE_VAR"), Some(&"merged_value".to_string()));
        assert!(config1.is_feature_enabled("merge_feature"));
    }

    #[test]
    fn test_configuration_validation() {
        let mut config = Configuration::new("".to_string());
        assert!(config.validate().is_err());
        
        config.name = "valid_name".to_string();
        assert!(config.validate().is_ok());
        
        config.server.port = 0;
        assert!(config.validate().is_err());
        
        config.server.port = 8080;
        config.search.default_similarity_threshold = 1.5;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_default_configurations() {
        let server_config = ServerConfig::default();
        assert_eq!(server_config.host, "127.0.0.1");
        assert_eq!(server_config.port, 8080);
        
        let indexing_config = IndexingConfig::default();
        assert!(indexing_config.enabled);
        assert_eq!(indexing_config.batch_size, 100);
        
        let search_config = SearchConfig::default();
        assert_eq!(search_config.default_limit, 50);
        assert_eq!(search_config.default_similarity_threshold, 0.7);
    }

    #[test]
    fn test_storage_backends() {
        let sqlite_config = StorageConfig {
            backend: StorageBackend::Sqlite,
            ..Default::default()
        };
        assert_eq!(sqlite_config.backend, StorageBackend::Sqlite);
        
        let postgres_config = StorageConfig {
            backend: StorageBackend::PostgreSQL,
            ..Default::default()
        };
        assert_eq!(postgres_config.backend, StorageBackend::PostgreSQL);
    }

    #[test]
    fn test_cache_backends() {
        let memory_cache = CacheConfig {
            backend: CacheBackend::Memory,
            ..Default::default()
        };
        assert_eq!(memory_cache.backend, CacheBackend::Memory);
        
        let redis_cache = CacheConfig {
            backend: CacheBackend::Redis,
            ..Default::default()
        };
        assert_eq!(redis_cache.backend, CacheBackend::Redis);
    }

    #[test]
    fn test_auth_methods() {
        let no_auth = SecurityConfig {
            auth_method: AuthMethod::None,
            ..Default::default()
        };
        assert_eq!(no_auth.auth_method, AuthMethod::None);
        
        let api_key_auth = SecurityConfig {
            auth_method: AuthMethod::ApiKey,
            ..Default::default()
        };
        assert_eq!(api_key_auth.auth_method, AuthMethod::ApiKey);
    }
}