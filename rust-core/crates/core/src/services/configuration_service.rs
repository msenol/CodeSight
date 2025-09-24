//! Configuration service for managing application settings and environment

use crate::error::CoreError;
use crate::models::configuration::{
    Configuration, ServerConfig, IndexingConfig, SearchConfig, EmbeddingConfig,
    StorageConfig, CacheConfig, SecurityConfig, LoggingConfig, PerformanceConfig,
    PluginConfig, EnvironmentConfig
};
use crate::services::{Service, ServiceHealth};
use crate::traits::{Validate, Timestamped};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::path::{Path, PathBuf};
use uuid::Uuid;

/// Service for managing configuration
#[derive(Debug)]
pub struct ConfigurationService {
    current_config: Arc<RwLock<Configuration>>,
    config_history: Arc<RwLock<Vec<ConfigurationSnapshot>>>,
    watchers: Arc<RwLock<Vec<ConfigurationWatcher>>>,
    config_sources: Arc<RwLock<Vec<ConfigurationSource>>>,
    validation_rules: Arc<RwLock<HashMap<String, ValidationRule>>>,
    metrics: Arc<RwLock<ConfigurationMetrics>>,
}

/// Configuration snapshot for history tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationSnapshot {
    pub id: String,
    pub config: Configuration,
    pub timestamp: DateTime<Utc>,
    pub reason: String,
    pub user_id: Option<String>,
    pub checksum: String,
}

/// Configuration watcher for change notifications
#[derive(Debug, Clone)]
pub struct ConfigurationWatcher {
    pub id: String,
    pub name: String,
    pub callback: Arc<dyn Fn(&Configuration, &Configuration) + Send + Sync>,
    pub created_at: DateTime<Utc>,
    pub last_triggered: Option<DateTime<Utc>>,
    pub trigger_count: u64,
}

/// Configuration source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationSource {
    pub id: String,
    pub source_type: ConfigurationSourceType,
    pub location: String,
    pub priority: u32,
    pub enabled: bool,
    pub last_loaded: Option<DateTime<Utc>>,
    pub checksum: Option<String>,
}

/// Configuration source types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ConfigurationSourceType {
    File,
    Environment,
    Database,
    Remote,
    Memory,
}

/// Validation rule for configuration values
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationRule {
    pub id: String,
    pub path: String,
    pub rule_type: ValidationRuleType,
    pub parameters: HashMap<String, String>,
    pub error_message: String,
    pub enabled: bool,
}

/// Validation rule types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ValidationRuleType {
    Required,
    Range,
    Pattern,
    Custom,
    Type,
    Dependency,
}

/// Configuration service metrics
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct ConfigurationMetrics {
    pub total_loads: u64,
    pub successful_loads: u64,
    pub failed_loads: u64,
    pub total_saves: u64,
    pub successful_saves: u64,
    pub failed_saves: u64,
    pub validation_errors: u64,
    pub watcher_triggers: u64,
    pub config_changes: u64,
    pub average_load_time_ms: f64,
    pub average_save_time_ms: f64,
    pub source_metrics: HashMap<String, SourceMetrics>,
}

/// Source-specific metrics
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct SourceMetrics {
    pub loads: u64,
    pub successful_loads: u64,
    pub failed_loads: u64,
    pub last_load_time: Option<DateTime<Utc>>,
    pub average_load_time_ms: f64,
}

/// Configuration update request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationUpdateRequest {
    pub path: String,
    pub value: ConfigurationValue,
    pub reason: String,
    pub user_id: Option<String>,
    pub validate: bool,
    pub create_snapshot: bool,
}

/// Configuration value types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConfigurationValue {
    String(String),
    Integer(i64),
    Float(f64),
    Boolean(bool),
    Array(Vec<ConfigurationValue>),
    Object(HashMap<String, ConfigurationValue>),
    Null,
}

/// Configuration query request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationQuery {
    pub path: Option<String>,
    pub pattern: Option<String>,
    pub include_metadata: bool,
    pub include_history: bool,
    pub max_results: Option<usize>,
}

/// Configuration query result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationQueryResult {
    pub values: HashMap<String, ConfigurationValue>,
    pub metadata: Option<ConfigurationMetadata>,
    pub history: Option<Vec<ConfigurationSnapshot>>,
    pub total_matches: usize,
}

/// Configuration metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationMetadata {
    pub last_modified: DateTime<Utc>,
    pub modified_by: Option<String>,
    pub version: String,
    pub checksum: String,
    pub source: String,
    pub validation_status: ValidationStatus,
}

/// Validation status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ValidationStatus {
    Valid,
    Invalid,
    Warning,
    Unknown,
}

/// Configuration backup request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationBackupRequest {
    pub name: String,
    pub description: Option<String>,
    pub include_history: bool,
    pub compression: bool,
}

/// Configuration restore request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigurationRestoreRequest {
    pub backup_id: String,
    pub validate: bool,
    pub create_snapshot: bool,
    pub force: bool,
}

impl ConfigurationService {
    /// Create a new configuration service
    pub async fn new() -> Result<Self, CoreError> {
        let default_config = Configuration::default();
        
        Ok(Self {
            current_config: Arc::new(RwLock::new(default_config)),
            config_history: Arc::new(RwLock::new(Vec::new())),
            watchers: Arc::new(RwLock::new(Vec::new())),
            config_sources: Arc::new(RwLock::new(Vec::new())),
            validation_rules: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(ConfigurationMetrics::default())),
        })
    }

    /// Load configuration from file
    pub async fn load_from_file<P: AsRef<Path>>(&self, path: P) -> Result<(), CoreError> {
        let start_time = std::time::Instant::now();
        
        let path = path.as_ref();
        let content = std::fs::read_to_string(path)
            .map_err(|e| CoreError::IoError(format!("Failed to read config file: {}", e)))?;
        
        let config: Configuration = match path.extension().and_then(|ext| ext.to_str()) {
            Some("json") => serde_json::from_str(&content)
                .map_err(|e| CoreError::ParseError(format!("Invalid JSON config: {}", e)))?,
            Some("yaml") | Some("yml") => serde_yaml::from_str(&content)
                .map_err(|e| CoreError::ParseError(format!("Invalid YAML config: {}", e)))?,
            Some("toml") => toml::from_str(&content)
                .map_err(|e| CoreError::ParseError(format!("Invalid TOML config: {}", e)))?,
            _ => return Err(CoreError::ValidationError(
                "Unsupported configuration file format".to_string()
            )),
        };
        
        // Validate configuration
        config.validate()?;
        
        // Create snapshot of current config
        self.create_snapshot("File load".to_string(), None).await?;
        
        // Update current configuration
        {
            let mut current = self.current_config.write().unwrap();
            *current = config;
        }
        
        // Update metrics
        let load_time = start_time.elapsed();
        self.update_load_metrics(true, load_time).await;
        
        // Trigger watchers
        self.trigger_watchers().await;
        
        Ok(())
    }

    /// Save configuration to file
    pub async fn save_to_file<P: AsRef<Path>>(&self, path: P) -> Result<(), CoreError> {
        let start_time = std::time::Instant::now();
        
        let path = path.as_ref();
        let config = self.current_config.read().unwrap().clone();
        
        let content = match path.extension().and_then(|ext| ext.to_str()) {
            Some("json") => serde_json::to_string_pretty(&config)
                .map_err(|e| CoreError::SerializationError(format!("JSON serialization failed: {}", e)))?,
            Some("yaml") | Some("yml") => serde_yaml::to_string(&config)
                .map_err(|e| CoreError::SerializationError(format!("YAML serialization failed: {}", e)))?,
            Some("toml") => toml::to_string_pretty(&config)
                .map_err(|e| CoreError::SerializationError(format!("TOML serialization failed: {}", e)))?,
            _ => return Err(CoreError::ValidationError(
                "Unsupported configuration file format".to_string()
            )),
        };
        
        std::fs::write(path, content)
            .map_err(|e| CoreError::IoError(format!("Failed to write config file: {}", e)))?;
        
        // Update metrics
        let save_time = start_time.elapsed();
        self.update_save_metrics(true, save_time).await;
        
        Ok(())
    }

    /// Load configuration from environment variables
    pub async fn load_from_environment(&self) -> Result<(), CoreError> {
        let mut config = self.current_config.read().unwrap().clone();
        
        // Load environment-specific settings
        if let Ok(env) = std::env::var("ENVIRONMENT") {
            config.environment.environment = env;
        }
        
        if let Ok(debug) = std::env::var("DEBUG") {
            config.environment.debug = debug.parse().unwrap_or(false);
        }
        
        // Load server settings
        if let Ok(host) = std::env::var("SERVER_HOST") {
            config.server.host = host;
        }
        
        if let Ok(port) = std::env::var("SERVER_PORT") {
            config.server.port = port.parse().unwrap_or(config.server.port);
        }
        
        // Load database settings
        if let Ok(db_url) = std::env::var("DATABASE_URL") {
            config.storage.connection_string = Some(db_url);
        }
        
        // Load cache settings
        if let Ok(redis_url) = std::env::var("REDIS_URL") {
            // Update cache configuration with Redis URL
            // This would be implemented based on the cache config structure
        }
        
        // Validate and update
        config.validate()?;
        
        {
            let mut current = self.current_config.write().unwrap();
            *current = config;
        }
        
        Ok(())
    }

    /// Get current configuration
    pub async fn get_config(&self) -> Configuration {
        self.current_config.read().unwrap().clone()
    }

    /// Get configuration value by path
    pub async fn get_value(&self, path: &str) -> Result<ConfigurationValue, CoreError> {
        let config = self.current_config.read().unwrap();
        self.extract_value_by_path(&*config, path)
    }

    /// Set configuration value by path
    pub async fn set_value(&self, request: ConfigurationUpdateRequest) -> Result<(), CoreError> {
        // Validate if requested
        if request.validate {
            self.validate_value(&request.path, &request.value).await?;
        }
        
        // Create snapshot if requested
        if request.create_snapshot {
            self.create_snapshot(request.reason.clone(), request.user_id.clone()).await?;
        }
        
        // Update configuration
        {
            let mut config = self.current_config.write().unwrap();
            self.set_value_by_path(&mut *config, &request.path, request.value)?;
            config.updated_at = Utc::now();
        }
        
        // Update metrics
        self.increment_config_changes().await;
        
        // Trigger watchers
        self.trigger_watchers().await;
        
        Ok(())
    }

    /// Query configuration values
    pub async fn query(&self, query: ConfigurationQuery) -> Result<ConfigurationQueryResult, CoreError> {
        let config = self.current_config.read().unwrap();
        let mut values = HashMap::new();
        
        if let Some(path) = &query.path {
            // Get specific path
            let value = self.extract_value_by_path(&*config, path)?;
            values.insert(path.clone(), value);
        } else if let Some(pattern) = &query.pattern {
            // Pattern matching (simplified implementation)
            values = self.find_values_by_pattern(&*config, pattern)?;
        } else {
            // Return all values (simplified)
            values.insert("root".to_string(), self.config_to_value(&*config));
        }
        
        // Apply limit
        if let Some(max_results) = query.max_results {
            if values.len() > max_results {
                values = values.into_iter().take(max_results).collect();
            }
        }
        
        let metadata = if query.include_metadata {
            Some(ConfigurationMetadata {
                last_modified: config.updated_at,
                modified_by: None,
                version: config.version.clone(),
                checksum: self.calculate_checksum(&*config),
                source: "current".to_string(),
                validation_status: ValidationStatus::Valid,
            })
        } else {
            None
        };
        
        let history = if query.include_history {
            Some(self.config_history.read().unwrap().clone())
        } else {
            None
        };
        
        Ok(ConfigurationQueryResult {
            total_matches: values.len(),
            values,
            metadata,
            history,
        })
    }

    /// Add configuration watcher
    pub async fn add_watcher<F>(&self, name: String, callback: F) -> Result<String, CoreError>
    where
        F: Fn(&Configuration, &Configuration) + Send + Sync + 'static,
    {
        let watcher_id = Uuid::new_v4().to_string();
        
        let watcher = ConfigurationWatcher {
            id: watcher_id.clone(),
            name,
            callback: Arc::new(callback),
            created_at: Utc::now(),
            last_triggered: None,
            trigger_count: 0,
        };
        
        let mut watchers = self.watchers.write().unwrap();
        watchers.push(watcher);
        
        Ok(watcher_id)
    }

    /// Remove configuration watcher
    pub async fn remove_watcher(&self, watcher_id: &str) -> Result<(), CoreError> {
        let mut watchers = self.watchers.write().unwrap();
        watchers.retain(|w| w.id != watcher_id);
        Ok(())
    }

    /// Add configuration source
    pub async fn add_source(&self, source: ConfigurationSource) -> Result<(), CoreError> {
        let mut sources = self.config_sources.write().unwrap();
        sources.push(source);
        
        // Sort by priority
        sources.sort_by(|a, b| b.priority.cmp(&a.priority));
        
        Ok(())
    }

    /// Remove configuration source
    pub async fn remove_source(&self, source_id: &str) -> Result<(), CoreError> {
        let mut sources = self.config_sources.write().unwrap();
        sources.retain(|s| s.id != source_id);
        Ok(())
    }

    /// Reload configuration from all sources
    pub async fn reload(&self) -> Result<(), CoreError> {
        let sources = self.config_sources.read().unwrap().clone();
        
        for source in sources {
            if !source.enabled {
                continue;
            }
            
            match source.source_type {
                ConfigurationSourceType::File => {
                    if let Err(e) = self.load_from_file(&source.location).await {
                        eprintln!("Failed to load from file {}: {}", source.location, e);
                    }
                }
                ConfigurationSourceType::Environment => {
                    if let Err(e) = self.load_from_environment().await {
                        eprintln!("Failed to load from environment: {}", e);
                    }
                }
                _ => {
                    // Other source types would be implemented here
                }
            }
        }
        
        Ok(())
    }

    /// Create configuration snapshot
    pub async fn create_snapshot(
        &self,
        reason: String,
        user_id: Option<String>,
    ) -> Result<String, CoreError> {
        let config = self.current_config.read().unwrap().clone();
        let snapshot_id = Uuid::new_v4().to_string();
        
        let snapshot = ConfigurationSnapshot {
            id: snapshot_id.clone(),
            config,
            timestamp: Utc::now(),
            reason,
            user_id,
            checksum: self.calculate_checksum(&self.current_config.read().unwrap()),
        };
        
        let mut history = self.config_history.write().unwrap();
        history.push(snapshot);
        
        // Limit history size
        if history.len() > 100 {
            history.drain(0..10);
        }
        
        Ok(snapshot_id)
    }

    /// Restore from snapshot
    pub async fn restore_snapshot(&self, snapshot_id: &str) -> Result<(), CoreError> {
        let history = self.config_history.read().unwrap();
        let snapshot = history.iter()
            .find(|s| s.id == snapshot_id)
            .ok_or_else(|| CoreError::NotFound(format!("Snapshot '{}' not found", snapshot_id)))?;
        
        // Create current snapshot before restore
        drop(history);
        self.create_snapshot("Before restore".to_string(), None).await?;
        
        // Restore configuration
        {
            let mut current = self.current_config.write().unwrap();
            *current = snapshot.config.clone();
        }
        
        // Trigger watchers
        self.trigger_watchers().await;
        
        Ok(())
    }

    /// Get configuration metrics
    pub async fn get_metrics(&self) -> ConfigurationMetrics {
        self.metrics.read().unwrap().clone()
    }

    /// Validate configuration value
    async fn validate_value(
        &self,
        path: &str,
        value: &ConfigurationValue,
    ) -> Result<(), CoreError> {
        let rules = self.validation_rules.read().unwrap();
        
        for rule in rules.values() {
            if rule.path == path && rule.enabled {
                match rule.rule_type {
                    ValidationRuleType::Required => {
                        if matches!(value, ConfigurationValue::Null) {
                            return Err(CoreError::ValidationError(rule.error_message.clone()));
                        }
                    }
                    ValidationRuleType::Range => {
                        // Implement range validation
                    }
                    ValidationRuleType::Pattern => {
                        // Implement pattern validation
                    }
                    _ => {
                        // Other validation types
                    }
                }
            }
        }
        
        Ok(())
    }

    /// Extract value by path
    fn extract_value_by_path(
        &self,
        config: &Configuration,
        path: &str,
    ) -> Result<ConfigurationValue, CoreError> {
        // Simplified path extraction
        match path {
            "server.host" => Ok(ConfigurationValue::String(config.server.host.clone())),
            "server.port" => Ok(ConfigurationValue::Integer(config.server.port as i64)),
            "environment.debug" => Ok(ConfigurationValue::Boolean(config.environment.debug)),
            _ => Err(CoreError::NotFound(format!("Path '{}' not found", path))),
        }
    }

    /// Set value by path
    fn set_value_by_path(
        &self,
        config: &mut Configuration,
        path: &str,
        value: ConfigurationValue,
    ) -> Result<(), CoreError> {
        // Simplified path setting
        match path {
            "server.host" => {
                if let ConfigurationValue::String(host) = value {
                    config.server.host = host;
                } else {
                    return Err(CoreError::ValidationError("Invalid type for server.host".to_string()));
                }
            }
            "server.port" => {
                if let ConfigurationValue::Integer(port) = value {
                    config.server.port = port as u16;
                } else {
                    return Err(CoreError::ValidationError("Invalid type for server.port".to_string()));
                }
            }
            "environment.debug" => {
                if let ConfigurationValue::Boolean(debug) = value {
                    config.environment.debug = debug;
                } else {
                    return Err(CoreError::ValidationError("Invalid type for environment.debug".to_string()));
                }
            }
            _ => return Err(CoreError::NotFound(format!("Path '{}' not found", path))),
        }
        
        Ok(())
    }

    /// Find values by pattern
    fn find_values_by_pattern(
        &self,
        config: &Configuration,
        pattern: &str,
    ) -> Result<HashMap<String, ConfigurationValue>, CoreError> {
        let mut results = HashMap::new();
        
        // Simplified pattern matching
        if pattern.contains("server") {
            results.insert("server.host".to_string(), ConfigurationValue::String(config.server.host.clone()));
            results.insert("server.port".to_string(), ConfigurationValue::Integer(config.server.port as i64));
        }
        
        Ok(results)
    }

    /// Convert configuration to value
    fn config_to_value(&self, config: &Configuration) -> ConfigurationValue {
        // Simplified conversion
        let mut obj = HashMap::new();
        obj.insert("version".to_string(), ConfigurationValue::String(config.version.clone()));
        obj.insert("name".to_string(), ConfigurationValue::String(config.name.clone()));
        ConfigurationValue::Object(obj)
    }

    /// Calculate configuration checksum
    fn calculate_checksum(&self, config: &Configuration) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};
        
        let mut hasher = DefaultHasher::new();
        config.version.hash(&mut hasher);
        config.name.hash(&mut hasher);
        config.updated_at.timestamp().hash(&mut hasher);
        
        format!("{:x}", hasher.finish())
    }

    /// Trigger all watchers
    async fn trigger_watchers(&self) {
        let config = self.current_config.read().unwrap().clone();
        let mut watchers = self.watchers.write().unwrap();
        
        for watcher in watchers.iter_mut() {
            (watcher.callback)(&config, &config);
            watcher.last_triggered = Some(Utc::now());
            watcher.trigger_count += 1;
        }
        
        // Update metrics
        drop(watchers);
        let mut metrics = self.metrics.write().unwrap();
        metrics.watcher_triggers += 1;
    }

    /// Update load metrics
    async fn update_load_metrics(&self, success: bool, duration: std::time::Duration) {
        let mut metrics = self.metrics.write().unwrap();
        
        metrics.total_loads += 1;
        if success {
            metrics.successful_loads += 1;
        } else {
            metrics.failed_loads += 1;
        }
        
        let load_time_ms = duration.as_millis() as f64;
        if metrics.total_loads == 1 {
            metrics.average_load_time_ms = load_time_ms;
        } else {
            metrics.average_load_time_ms = 
                (metrics.average_load_time_ms * (metrics.total_loads - 1) as f64 + load_time_ms) 
                / metrics.total_loads as f64;
        }
    }

    /// Update save metrics
    async fn update_save_metrics(&self, success: bool, duration: std::time::Duration) {
        let mut metrics = self.metrics.write().unwrap();
        
        metrics.total_saves += 1;
        if success {
            metrics.successful_saves += 1;
        } else {
            metrics.failed_saves += 1;
        }
        
        let save_time_ms = duration.as_millis() as f64;
        if metrics.total_saves == 1 {
            metrics.average_save_time_ms = save_time_ms;
        } else {
            metrics.average_save_time_ms = 
                (metrics.average_save_time_ms * (metrics.total_saves - 1) as f64 + save_time_ms) 
                / metrics.total_saves as f64;
        }
    }

    /// Increment config changes
    async fn increment_config_changes(&self) {
        let mut metrics = self.metrics.write().unwrap();
        metrics.config_changes += 1;
    }
}

#[async_trait]
impl Service for ConfigurationService {
    async fn initialize(&self) -> Result<(), CoreError> {
        // Load default configuration sources
        let default_sources = vec![
            ConfigurationSource {
                id: "env".to_string(),
                source_type: ConfigurationSourceType::Environment,
                location: "environment".to_string(),
                priority: 100,
                enabled: true,
                last_loaded: None,
                checksum: None,
            },
            ConfigurationSource {
                id: "config_file".to_string(),
                source_type: ConfigurationSourceType::File,
                location: "config.yaml".to_string(),
                priority: 50,
                enabled: true,
                last_loaded: None,
                checksum: None,
            },
        ];
        
        for source in default_sources {
            self.add_source(source).await?;
        }
        
        // Load from environment
        if let Err(e) = self.load_from_environment().await {
            eprintln!("Warning: Failed to load environment configuration: {}", e);
        }
        
        // Try to load from config file
        if let Err(e) = self.load_from_file("config.yaml").await {
            eprintln!("Warning: Failed to load config file: {}", e);
        }
        
        Ok(())
    }

    async fn shutdown(&self) -> Result<(), CoreError> {
        // Save current configuration
        if let Err(e) = self.save_to_file("config_backup.yaml").await {
            eprintln!("Warning: Failed to save configuration backup: {}", e);
        }
        
        // Clear watchers
        {
            let mut watchers = self.watchers.write().unwrap();
            watchers.clear();
        }
        
        Ok(())
    }

    async fn health_check(&self) -> ServiceHealth {
        let config = self.current_config.read().unwrap();
        
        // Validate current configuration
        if let Err(e) = config.validate() {
            return ServiceHealth::unhealthy(
                format!("Configuration validation failed: {}", e),
            );
        }
        
        // Check if we have any configuration sources
        let sources = self.config_sources.read().unwrap();
        if sources.is_empty() {
            return ServiceHealth::degraded(
                "No configuration sources available".to_string(),
            );
        }
        
        ServiceHealth::healthy()
    }

    fn name(&self) -> &'static str {
        "ConfigurationService"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    async fn create_test_service() -> ConfigurationService {
        ConfigurationService::new().await.unwrap()
    }

    #[tokio::test]
    async fn test_configuration_service_creation() {
        let service = create_test_service().await;
        assert_eq!(service.name(), "ConfigurationService");
    }

    #[tokio::test]
    async fn test_configuration_load_save() {
        let service = create_test_service().await;
        let temp_dir = tempdir().unwrap();
        let config_path = temp_dir.path().join("test_config.json");
        
        // Create test config file
        let test_config = r#"{
            "name": "test",
            "version": "1.0.0",
            "description": "Test configuration"
        }"#;
        
        fs::write(&config_path, test_config).unwrap();
        
        // Test load
        let result = service.load_from_file(&config_path).await;
        assert!(result.is_ok());
        
        // Test save
        let save_path = temp_dir.path().join("saved_config.json");
        let result = service.save_to_file(&save_path).await;
        assert!(result.is_ok());
        
        // Verify file exists
        assert!(save_path.exists());
    }

    #[tokio::test]
    async fn test_configuration_values() {
        let service = create_test_service().await;
        
        // Test set value
        let request = ConfigurationUpdateRequest {
            path: "server.host".to_string(),
            value: ConfigurationValue::String("localhost".to_string()),
            reason: "Test update".to_string(),
            user_id: None,
            validate: true,
            create_snapshot: false,
        };
        
        let result = service.set_value(request).await;
        assert!(result.is_ok());
        
        // Test get value
        let value = service.get_value("server.host").await.unwrap();
        match value {
            ConfigurationValue::String(host) => assert_eq!(host, "localhost"),
            _ => panic!("Expected string value"),
        }
    }

    #[tokio::test]
    async fn test_configuration_watchers() {
        let service = create_test_service().await;
        
        // Add watcher
        let watcher_id = service.add_watcher(
            "test_watcher".to_string(),
            |_old, _new| {
                // Watcher callback
            },
        ).await.unwrap();
        
        // Remove watcher
        let result = service.remove_watcher(&watcher_id).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_configuration_snapshots() {
        let service = create_test_service().await;
        
        // Create snapshot
        let snapshot_id = service.create_snapshot(
            "Test snapshot".to_string(),
            Some("test_user".to_string()),
        ).await.unwrap();
        
        // Restore snapshot
        let result = service.restore_snapshot(&snapshot_id).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_configuration_query() {
        let service = create_test_service().await;
        
        let query = ConfigurationQuery {
            path: Some("server.host".to_string()),
            pattern: None,
            include_metadata: true,
            include_history: false,
            max_results: None,
        };
        
        let result = service.query(query).await;
        assert!(result.is_ok());
        
        let query_result = result.unwrap();
        assert!(query_result.metadata.is_some());
    }

    #[tokio::test]
    async fn test_configuration_metrics() {
        let service = create_test_service().await;
        let metrics = service.get_metrics().await;
        
        assert_eq!(metrics.total_loads, 0);
        assert_eq!(metrics.total_saves, 0);
        assert_eq!(metrics.config_changes, 0);
    }
}