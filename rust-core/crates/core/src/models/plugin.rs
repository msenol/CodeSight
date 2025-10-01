//! Plugin model for extensible functionality

use super::{Validate, Timestamped};
use crate::errors::CoreError;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

/// Represents a plugin in the system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Plugin {
    /// Unique identifier for the plugin
    pub id: String,
    /// Plugin name
    pub name: String,
    /// Plugin version
    pub version: String,
    /// Plugin description
    pub description: String,
    /// Plugin author
    pub author: String,
    /// Plugin type/category
    pub plugin_type: PluginType,
    /// Current status of the plugin
    pub status: PluginStatus,
    /// Plugin configuration
    pub config: PluginConfig,
    /// Plugin capabilities
    pub capabilities: Vec<PluginCapability>,
    /// Dependencies on other plugins
    pub dependencies: Vec<PluginDependency>,
    /// Plugin metadata
    pub metadata: PluginMetadata,
    /// Plugin execution statistics
    pub stats: PluginStats,
    /// When the plugin was installed
    pub installed_at: DateTime<Utc>,
    /// When the plugin was last updated
    pub updated_at: DateTime<Utc>,
    /// When the plugin was last used
    pub last_used_at: Option<DateTime<Utc>>,
}

/// Types of plugins supported
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PluginType {
    /// Language parser plugin
    Parser,
    /// Code analyzer plugin
    Analyzer,
    /// Embedding provider plugin
    EmbeddingProvider,
    /// Search enhancer plugin
    SearchEnhancer,
    /// Code formatter plugin
    Formatter,
    /// Linter plugin
    Linter,
    /// Documentation generator plugin
    DocumentationGenerator,
    /// Metrics collector plugin
    MetricsCollector,
    /// Export/import plugin
    DataExporter,
    /// Authentication plugin
    Authentication,
    /// Storage backend plugin
    StorageBackend,
    /// Custom plugin type
    Custom(String),
}

/// Plugin status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PluginStatus {
    /// Plugin is installed but not loaded
    Installed,
    /// Plugin is loaded and ready
    Loaded,
    /// Plugin is currently running
    Running,
    /// Plugin is disabled
    Disabled,
    /// Plugin has an error
    Error(String),
    /// Plugin is being updated
    Updating,
    /// Plugin is being uninstalled
    Uninstalling,
}

/// Plugin configuration
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct PluginConfig {
    /// Whether the plugin is enabled
    pub enabled: bool,
    /// Plugin-specific settings
    pub settings: HashMap<String, PluginConfigValue>,
    /// Environment variables for the plugin
    pub environment: HashMap<String, String>,
    /// Resource limits
    pub limits: PluginLimits,
    /// Security settings
    pub security: PluginSecurity,
}

/// Plugin configuration value types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PluginConfigValue {
    /// String value
    String(String),
    /// Integer value
    Integer(i64),
    /// Float value
    Float(f64),
    /// Boolean value
    Boolean(bool),
    /// Array of values
    Array(Vec<PluginConfigValue>),
    /// Object/map of values
    Object(HashMap<String, PluginConfigValue>),
}

/// Plugin resource limits
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginLimits {
    /// Maximum memory usage in bytes
    pub max_memory_bytes: Option<usize>,
    /// Maximum CPU usage percentage (0-100)
    pub max_cpu_percent: Option<f32>,
    /// Maximum execution time in seconds
    pub max_execution_time_seconds: Option<u64>,
    /// Maximum number of concurrent operations
    pub max_concurrent_operations: Option<usize>,
    /// Maximum file size that can be processed
    pub max_file_size_bytes: Option<usize>,
}

/// Plugin security settings
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct PluginSecurity {
    /// Whether the plugin can access the file system
    pub allow_file_access: bool,
    /// Whether the plugin can make network requests
    pub allow_network_access: bool,
    /// Whether the plugin can execute system commands
    pub allow_system_commands: bool,
    /// Allowed file paths (glob patterns)
    pub allowed_paths: Vec<String>,
    /// Blocked file paths (glob patterns)
    pub blocked_paths: Vec<String>,
    /// Allowed network hosts
    pub allowed_hosts: Vec<String>,
    /// API key or token for the plugin
    pub api_key: Option<String>,
}

/// Plugin capabilities
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PluginCapability {
    /// Can parse specific file types
    ParseFileTypes(Vec<String>),
    /// Can analyze code patterns
    AnalyzePatterns(Vec<String>),
    /// Can generate embeddings
    GenerateEmbeddings,
    /// Can enhance search results
    EnhanceSearch,
    /// Can format code
    FormatCode(Vec<String>),
    /// Can lint code
    LintCode(Vec<String>),
    /// Can generate documentation
    GenerateDocumentation,
    /// Can collect metrics
    CollectMetrics,
    /// Can export data
    ExportData(Vec<String>),
    /// Can authenticate users
    AuthenticateUsers,
    /// Can store data
    StoreData,
    /// Custom capability
    Custom(String, HashMap<String, String>),
}

/// Plugin dependency
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginDependency {
    /// Name of the required plugin
    pub plugin_name: String,
    /// Required version (semver)
    pub version_requirement: String,
    /// Whether this dependency is optional
    pub optional: bool,
    /// Reason for the dependency
    pub reason: Option<String>,
}

/// Plugin metadata
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct PluginMetadata {
    /// Plugin homepage URL
    pub homepage: Option<String>,
    /// Plugin repository URL
    pub repository: Option<String>,
    /// Plugin documentation URL
    pub documentation: Option<String>,
    /// Plugin license
    pub license: Option<String>,
    /// Plugin keywords/tags
    pub keywords: Vec<String>,
    /// Plugin category
    pub category: Option<String>,
    /// Minimum system requirements
    pub requirements: PluginRequirements,
    /// Plugin size in bytes
    pub size_bytes: Option<usize>,
    /// Plugin checksum for integrity
    pub checksum: Option<String>,
    /// Additional custom metadata
    pub custom: HashMap<String, String>,
}

/// Plugin system requirements
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct PluginRequirements {
    /// Minimum system version
    pub min_system_version: Option<String>,
    /// Required system features
    pub required_features: Vec<String>,
    /// Supported platforms
    pub supported_platforms: Vec<String>,
    /// Required external tools
    pub external_tools: Vec<String>,
}

/// Plugin execution statistics
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct PluginStats {
    /// Number of times the plugin has been executed
    pub execution_count: u64,
    /// Total execution time in milliseconds
    pub total_execution_time_ms: u64,
    /// Average execution time in milliseconds
    pub avg_execution_time_ms: f64,
    /// Number of successful executions
    pub success_count: u64,
    /// Number of failed executions
    pub error_count: u64,
    /// Success rate (0.0 to 1.0)
    pub success_rate: f64,
    /// Last execution time in milliseconds
    pub last_execution_time_ms: Option<u64>,
    /// Last error message
    pub last_error: Option<String>,
    /// Memory usage statistics
    pub memory_stats: MemoryStats,
}

/// Memory usage statistics
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct MemoryStats {
    /// Current memory usage in bytes
    pub current_bytes: usize,
    /// Peak memory usage in bytes
    pub peak_bytes: usize,
    /// Average memory usage in bytes
    pub avg_bytes: f64,
}

/// Plugin execution context
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginExecutionContext {
    /// Unique execution ID
    pub execution_id: String,
    /// Plugin ID being executed
    pub plugin_id: String,
    /// Input parameters
    pub input: HashMap<String, PluginConfigValue>,
    /// Execution environment
    pub environment: HashMap<String, String>,
    /// Timeout for execution
    pub timeout_seconds: Option<u64>,
    /// When execution started
    pub started_at: DateTime<Utc>,
}

/// Plugin execution result
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct PluginExecutionResult {
    /// Execution context
    pub context: PluginExecutionContext,
    /// Whether execution was successful
    pub success: bool,
    /// Output data
    pub output: Option<HashMap<String, PluginConfigValue>>,
    /// Error message if execution failed
    pub error: Option<String>,
    /// Execution time in milliseconds
    pub execution_time_ms: u64,
    /// Memory usage during execution
    pub memory_usage_bytes: Option<usize>,
    /// When execution completed
    pub completed_at: DateTime<Utc>,
}

impl Plugin {
    /// Create a new plugin
    pub fn new(
        name: String,
        version: String,
        description: String,
        author: String,
        plugin_type: PluginType,
    ) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            name,
            version,
            description,
            author,
            plugin_type,
            status: PluginStatus::Installed,
            config: PluginConfig::default(),
            capabilities: Vec::new(),
            dependencies: Vec::new(),
            metadata: PluginMetadata::default(),
            stats: PluginStats::default(),
            installed_at: Utc::now(),
            updated_at: Utc::now(),
            last_used_at: None,
        }
    }

    /// Add a capability to the plugin
    pub fn with_capability(mut self, capability: PluginCapability) -> Self {
        self.capabilities.push(capability);
        self
    }

    /// Add a dependency to the plugin
    pub fn with_dependency(mut self, dependency: PluginDependency) -> Self {
        self.dependencies.push(dependency);
        self
    }

    /// Set plugin configuration
    pub fn with_config(mut self, config: PluginConfig) -> Self {
        self.config = config;
        self
    }

    /// Set plugin metadata
    pub fn with_metadata(mut self, metadata: PluginMetadata) -> Self {
        self.metadata = metadata;
        self
    }

    /// Enable the plugin
    pub fn enable(&mut self) {
        self.config.enabled = true;
        self.status = PluginStatus::Loaded;
        self.updated_at = Utc::now();
    }

    /// Disable the plugin
    pub fn disable(&mut self) {
        self.config.enabled = false;
        self.status = PluginStatus::Disabled;
        self.updated_at = Utc::now();
    }

    /// Check if the plugin is enabled
    pub fn is_enabled(&self) -> bool {
        self.config.enabled && !matches!(self.status, PluginStatus::Disabled | PluginStatus::Error(_))
    }

    /// Check if the plugin is running
    pub fn is_running(&self) -> bool {
        matches!(self.status, PluginStatus::Running)
    }

    /// Set plugin status
    pub fn set_status(&mut self, status: PluginStatus) {
        self.status = status;
        self.updated_at = Utc::now();
    }

    /// Record plugin usage
    pub fn record_usage(&mut self) {
        self.last_used_at = Some(Utc::now());
        self.updated_at = Utc::now();
    }

    /// Update execution statistics
    pub fn update_stats(&mut self, execution_time_ms: u64, success: bool, error: Option<String>) {
        self.stats.execution_count += 1;
        self.stats.total_execution_time_ms += execution_time_ms;
        self.stats.last_execution_time_ms = Some(execution_time_ms);
        
        if success {
            self.stats.success_count += 1;
        } else {
            self.stats.error_count += 1;
            self.stats.last_error = error;
        }
        
        self.stats.avg_execution_time_ms = 
            self.stats.total_execution_time_ms as f64 / self.stats.execution_count as f64;
        
        self.stats.success_rate = 
            self.stats.success_count as f64 / self.stats.execution_count as f64;
        
        self.record_usage();
    }

    /// Check if plugin has a specific capability
    pub fn has_capability(&self, capability_type: &str) -> bool {
        self.capabilities.iter().any(|cap| {
            match cap {
                PluginCapability::ParseFileTypes(_) => capability_type == "parse",
                PluginCapability::AnalyzePatterns(_) => capability_type == "analyze",
                PluginCapability::GenerateEmbeddings => capability_type == "embeddings",
                PluginCapability::EnhanceSearch => capability_type == "search",
                PluginCapability::FormatCode(_) => capability_type == "format",
                PluginCapability::LintCode(_) => capability_type == "lint",
                PluginCapability::GenerateDocumentation => capability_type == "documentation",
                PluginCapability::CollectMetrics => capability_type == "metrics",
                PluginCapability::ExportData(_) => capability_type == "export",
                PluginCapability::AuthenticateUsers => capability_type == "auth",
                PluginCapability::StoreData => capability_type == "storage",
                PluginCapability::Custom(name, _) => name == capability_type,
            }
        })
    }

    /// Check if plugin can handle a specific file type
    pub fn can_handle_file_type(&self, file_type: &str) -> bool {
        self.capabilities.iter().any(|cap| {
            match cap {
                PluginCapability::ParseFileTypes(types) => types.contains(&file_type.to_string()),
                PluginCapability::FormatCode(types) => types.contains(&file_type.to_string()),
                PluginCapability::LintCode(types) => types.contains(&file_type.to_string()),
                _ => false,
            }
        })
    }

    /// Get plugin configuration value
    pub fn get_config_value(&self, key: &str) -> Option<&PluginConfigValue> {
        self.config.settings.get(key)
    }

    /// Set plugin configuration value
    pub fn set_config_value(&mut self, key: String, value: PluginConfigValue) {
        self.config.settings.insert(key, value);
        self.updated_at = Utc::now();
    }

    /// Check if all dependencies are satisfied
    pub fn dependencies_satisfied(&self, available_plugins: &[Plugin]) -> bool {
        self.dependencies.iter().all(|dep| {
            if dep.optional {
                return true;
            }
            
            available_plugins.iter().any(|plugin| {
                plugin.name == dep.plugin_name && 
                plugin.is_enabled() &&
                self.version_satisfies(&plugin.version, &dep.version_requirement)
            })
        })
    }

    /// Check if a version satisfies a requirement (simplified semver)
    fn version_satisfies(&self, version: &str, requirement: &str) -> bool {
        // Simplified version checking - in practice, use a proper semver library
        if requirement.starts_with('^') {
            let req_version = &requirement[1..];
            version >= req_version
        } else if requirement.starts_with('~') {
            let req_version = &requirement[1..];
            version.starts_with(req_version)
        } else {
            version == requirement
        }
    }

    /// Get plugin age
    pub fn age(&self) -> chrono::Duration {
        Utc::now() - self.installed_at
    }

    /// Get time since last use
    pub fn time_since_last_use(&self) -> Option<chrono::Duration> {
        self.last_used_at.map(|last_use| Utc::now() - last_use)
    }

    /// Check if plugin is stale (not used recently)
    pub fn is_stale(&self, max_idle_days: i64) -> bool {
        self.time_since_last_use()
            .map(|duration| duration.num_days() > max_idle_days)
            .unwrap_or(true)
    }
}

impl Default for PluginLimits {
    fn default() -> Self {
        Self {
            max_memory_bytes: Some(100 * 1024 * 1024), // 100MB
            max_cpu_percent: Some(50.0), // 50%
            max_execution_time_seconds: Some(300), // 5 minutes
            max_concurrent_operations: Some(10),
            max_file_size_bytes: Some(10 * 1024 * 1024), // 10MB
        }
    }
}

impl PluginExecutionContext {
    /// Create a new execution context
    pub fn new(plugin_id: String, input: HashMap<String, PluginConfigValue>) -> Self {
        Self {
            execution_id: Uuid::new_v4().to_string(),
            plugin_id,
            input,
            environment: HashMap::new(),
            timeout_seconds: None,
            started_at: Utc::now(),
        }
    }

    /// Set timeout
    pub fn with_timeout(mut self, timeout_seconds: u64) -> Self {
        self.timeout_seconds = Some(timeout_seconds);
        self
    }

    /// Add environment variable
    pub fn with_env(mut self, key: String, value: String) -> Self {
        self.environment.insert(key, value);
        self
    }
}

impl Validate for Plugin {
    fn validate(&self) -> Result<(), CoreError> {
        if self.name.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Plugin name cannot be empty".to_string(),
            ));
        }

        if self.version.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Plugin version cannot be empty".to_string(),
            ));
        }

        if self.author.trim().is_empty() {
            return Err(CoreError::ValidationError(
                "Plugin author cannot be empty".to_string(),
            ));
        }

        // Validate dependencies
        for dep in &self.dependencies {
            if dep.plugin_name.trim().is_empty() {
                return Err(CoreError::ValidationError(
                    "Dependency plugin name cannot be empty".to_string(),
                ));
            }
            if dep.version_requirement.trim().is_empty() {
                return Err(CoreError::ValidationError(
                    "Dependency version requirement cannot be empty".to_string(),
                ));
            }
        }

        // Validate limits
        if let Some(cpu_percent) = self.config.limits.max_cpu_percent {
            if !(0.0..=100.0).contains(&cpu_percent) {
                return Err(CoreError::ValidationError(
                    "CPU percentage must be between 0 and 100".to_string(),
                ));
            }
        }

        Ok(())
    }
}

impl Timestamped for Plugin {
    fn created_at(&self) -> DateTime<Utc> {
        self.installed_at
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
    fn test_plugin_creation() {
        let plugin = Plugin::new(
            "test-parser".to_string(),
            "1.0.0".to_string(),
            "A test parser plugin".to_string(),
            "Test Author".to_string(),
            PluginType::Parser,
        );

        assert_eq!(plugin.name, "test-parser");
        assert_eq!(plugin.version, "1.0.0");
        assert_eq!(plugin.plugin_type, PluginType::Parser);
        assert_eq!(plugin.status, PluginStatus::Installed);
        assert!(plugin.validate().is_ok());
    }

    #[test]
    fn test_plugin_capabilities() {
        let plugin = Plugin::new(
            "rust-parser".to_string(),
            "1.0.0".to_string(),
            "Rust parser".to_string(),
            "Author".to_string(),
            PluginType::Parser,
        )
        .with_capability(PluginCapability::ParseFileTypes(vec!["rs".to_string()]))
        .with_capability(PluginCapability::FormatCode(vec!["rs".to_string()]));

        assert!(plugin.has_capability("parse"));
        assert!(plugin.has_capability("format"));
        assert!(!plugin.has_capability("lint"));
        assert!(plugin.can_handle_file_type("rs"));
        assert!(!plugin.can_handle_file_type("py"));
    }

    #[test]
    fn test_plugin_enable_disable() {
        let mut plugin = Plugin::new(
            "test".to_string(),
            "1.0.0".to_string(),
            "Test".to_string(),
            "Author".to_string(),
            PluginType::Parser,
        );

        assert!(!plugin.is_enabled());
        
        plugin.enable();
        assert!(plugin.is_enabled());
        assert_eq!(plugin.status, PluginStatus::Loaded);
        
        plugin.disable();
        assert!(!plugin.is_enabled());
        assert_eq!(plugin.status, PluginStatus::Disabled);
    }

    #[test]
    fn test_plugin_stats() {
        let mut plugin = Plugin::new(
            "test".to_string(),
            "1.0.0".to_string(),
            "Test".to_string(),
            "Author".to_string(),
            PluginType::Parser,
        );

        assert_eq!(plugin.stats.execution_count, 0);
        assert_eq!(plugin.stats.success_rate, 0.0);

        plugin.update_stats(100, true, None);
        assert_eq!(plugin.stats.execution_count, 1);
        assert_eq!(plugin.stats.success_count, 1);
        assert_eq!(plugin.stats.success_rate, 1.0);
        assert_eq!(plugin.stats.avg_execution_time_ms, 100.0);

        plugin.update_stats(200, false, Some("Error".to_string()));
        assert_eq!(plugin.stats.execution_count, 2);
        assert_eq!(plugin.stats.error_count, 1);
        assert_eq!(plugin.stats.success_rate, 0.5);
        assert_eq!(plugin.stats.avg_execution_time_ms, 150.0);
    }

    #[test]
    fn test_plugin_dependencies() {
        let dependency = PluginDependency {
            plugin_name: "base-parser".to_string(),
            version_requirement: "^1.0.0".to_string(),
            optional: false,
            reason: Some("Required for parsing".to_string()),
        };

        let plugin = Plugin::new(
            "advanced-parser".to_string(),
            "1.0.0".to_string(),
            "Advanced parser".to_string(),
            "Author".to_string(),
            PluginType::Parser,
        ).with_dependency(dependency);

        let mut base_plugin = Plugin::new(
            "base-parser".to_string(),
            "1.1.0".to_string(),
            "Base parser".to_string(),
            "Author".to_string(),
            PluginType::Parser,
        );
        base_plugin.enable();

        assert!(plugin.dependencies_satisfied(&[base_plugin]));
    }

    #[test]
    fn test_plugin_config() {
        let mut plugin = Plugin::new(
            "test".to_string(),
            "1.0.0".to_string(),
            "Test".to_string(),
            "Author".to_string(),
            PluginType::Parser,
        );

        plugin.set_config_value(
            "timeout".to_string(),
            PluginConfigValue::Integer(30),
        );

        assert!(plugin.get_config_value("timeout").is_some());
        if let Some(PluginConfigValue::Integer(value)) = plugin.get_config_value("timeout") {
            assert_eq!(*value, 30);
        }
    }

    #[test]
    fn test_plugin_execution_context() {
        let mut input = HashMap::new();
        input.insert("file_path".to_string(), PluginConfigValue::String("test.rs".to_string()));

        let context = PluginExecutionContext::new("plugin123".to_string(), input)
            .with_timeout(60)
            .with_env("DEBUG".to_string(), "true".to_string());

        assert_eq!(context.plugin_id, "plugin123");
        assert_eq!(context.timeout_seconds, Some(60));
        assert_eq!(context.environment.get("DEBUG"), Some(&"true".to_string()));
    }

    #[test]
    fn test_plugin_validation() {
        let mut plugin = Plugin::new(
            "".to_string(),
            "1.0.0".to_string(),
            "Test".to_string(),
            "Author".to_string(),
            PluginType::Parser,
        );
        assert!(plugin.validate().is_err());

        plugin.name = "valid-name".to_string();
        assert!(plugin.validate().is_ok());

        plugin.config.limits.max_cpu_percent = Some(150.0);
        assert!(plugin.validate().is_err());
    }

    #[test]
    fn test_version_satisfaction() {
        let plugin = Plugin::new(
            "test".to_string(),
            "1.0.0".to_string(),
            "Test".to_string(),
            "Author".to_string(),
            PluginType::Parser,
        );

        assert!(plugin.version_satisfies("1.2.0", "^1.0.0"));
        assert!(!plugin.version_satisfies("0.9.0", "^1.0.0"));
        assert!(plugin.version_satisfies("1.0.5", "~1.0.0"));
        assert!(plugin.version_satisfies("1.0.0", "1.0.0"));
    }
}