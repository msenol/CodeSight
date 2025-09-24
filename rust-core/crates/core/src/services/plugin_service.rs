//! Plugin service for managing and executing plugins

use crate::error::CoreError;
use crate::models::{
    plugin::{
        Plugin, PluginType, PluginStatus, PluginConfig, PluginCapability, PluginDependency,
        PluginMetadata, PluginStats, PluginExecutionContext, PluginExecutionResult
    },
    configuration::Configuration,
};
use crate::services::{Service, ServiceHealth, ConfigurationService};
use crate::traits::{Validate, Timestamped};
use async_trait::async_trait;
use chrono::{DateTime, Utc, Duration};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, RwLock};
use tokio::time::{timeout, Duration as TokioDuration};
use uuid::Uuid;

/// Service for managing plugins
#[derive(Debug)]
pub struct PluginService {
    config_service: Arc<ConfigurationService>,
    plugins: Arc<RwLock<HashMap<String, Plugin>>>,
    plugin_registry: Arc<RwLock<PluginRegistry>>,
    execution_engine: Arc<RwLock<PluginExecutionEngine>>,
    metrics: Arc<RwLock<PluginServiceMetrics>>,
    security_manager: Arc<RwLock<PluginSecurityManager>>,
}

/// Plugin service metrics
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct PluginServiceMetrics {
    pub total_plugins: u64,
    pub active_plugins: u64,
    pub disabled_plugins: u64,
    pub failed_plugins: u64,
    pub total_executions: u64,
    pub successful_executions: u64,
    pub failed_executions: u64,
    pub average_execution_time_ms: f64,
    pub memory_usage_bytes: u64,
    pub plugin_type_distribution: HashMap<String, u64>,
    pub capability_usage: HashMap<String, u64>,
}

/// Plugin registry for managing plugin metadata and discovery
#[derive(Debug, Default)]
pub struct PluginRegistry {
    pub registered_plugins: HashMap<String, PluginRegistration>,
    pub plugin_dependencies: HashMap<String, Vec<String>>,
    pub capability_providers: HashMap<String, Vec<String>>,
    pub plugin_categories: HashMap<String, Vec<String>>,
}

/// Plugin registration information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginRegistration {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub plugin_type: PluginType,
    pub capabilities: Vec<PluginCapability>,
    pub dependencies: Vec<PluginDependency>,
    pub metadata: PluginMetadata,
    pub registration_time: DateTime<Utc>,
    pub last_updated: DateTime<Utc>,
}

/// Plugin execution engine
#[derive(Debug, Default)]
pub struct PluginExecutionEngine {
    pub active_executions: HashMap<String, PluginExecution>,
    pub execution_queue: Vec<PluginExecutionRequest>,
    pub worker_pool: Vec<PluginWorker>,
    pub execution_history: Vec<PluginExecutionRecord>,
}

/// Plugin execution request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginExecutionRequest {
    pub id: String,
    pub plugin_id: String,
    pub context: PluginExecutionContext,
    pub priority: ExecutionPriority,
    pub timeout_ms: Option<u64>,
    pub retry_count: u32,
    pub created_at: DateTime<Utc>,
}

/// Execution priority
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum ExecutionPriority {
    Low = 1,
    Normal = 2,
    High = 3,
    Critical = 4,
}

/// Plugin execution state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginExecution {
    pub id: String,
    pub plugin_id: String,
    pub status: ExecutionStatus,
    pub context: PluginExecutionContext,
    pub result: Option<PluginExecutionResult>,
    pub started_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub worker_id: Option<String>,
    pub progress: f32,
    pub error: Option<String>,
}

/// Execution status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ExecutionStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
    Timeout,
}

/// Plugin worker
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginWorker {
    pub id: String,
    pub status: WorkerStatus,
    pub current_execution: Option<String>,
    pub capabilities: Vec<PluginCapability>,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
    pub total_executions: u64,
    pub successful_executions: u64,
    pub failed_executions: u64,
}

/// Worker status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum WorkerStatus {
    Idle,
    Busy,
    Offline,
    Error,
}

/// Plugin execution record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginExecutionRecord {
    pub execution_id: String,
    pub plugin_id: String,
    pub status: ExecutionStatus,
    pub duration_ms: u64,
    pub memory_used_bytes: u64,
    pub cpu_time_ms: u64,
    pub started_at: DateTime<Utc>,
    pub completed_at: DateTime<Utc>,
    pub error: Option<String>,
}

/// Plugin security manager
#[derive(Debug, Default)]
pub struct PluginSecurityManager {
    pub security_policies: HashMap<String, SecurityPolicy>,
    pub permission_grants: HashMap<String, Vec<Permission>>,
    pub security_violations: Vec<SecurityViolation>,
    pub trusted_plugins: HashSet<String>,
}

/// Security policy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityPolicy {
    pub id: String,
    pub name: String,
    pub description: String,
    pub permissions: Vec<Permission>,
    pub restrictions: Vec<Restriction>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Permission types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum Permission {
    ReadFiles,
    WriteFiles,
    ExecuteCommands,
    NetworkAccess,
    DatabaseAccess,
    SystemInfo,
    PluginManagement,
    ConfigurationAccess,
    CacheAccess,
    SearchAccess,
    EmbeddingAccess,
}

/// Security restriction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Restriction {
    pub restriction_type: RestrictionType,
    pub value: String,
    pub description: String,
}

/// Restriction types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RestrictionType {
    MaxMemoryMB,
    MaxCpuPercent,
    MaxExecutionTimeMs,
    AllowedPaths,
    BlockedPaths,
    AllowedDomains,
    BlockedDomains,
}

/// Security violation record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityViolation {
    pub id: String,
    pub plugin_id: String,
    pub violation_type: ViolationType,
    pub description: String,
    pub severity: ViolationSeverity,
    pub timestamp: DateTime<Utc>,
    pub context: HashMap<String, String>,
}

/// Violation types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ViolationType {
    UnauthorizedAccess,
    ResourceExceeded,
    InvalidOperation,
    PolicyViolation,
    MaliciousActivity,
}

/// Violation severity
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum ViolationSeverity {
    Low,
    Medium,
    High,
    Critical,
}

/// Plugin installation request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginInstallRequest {
    pub source: PluginSource,
    pub version: Option<String>,
    pub config: Option<PluginConfig>,
    pub auto_enable: bool,
    pub force_reinstall: bool,
}

/// Plugin source
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PluginSource {
    LocalPath(String),
    Url(String),
    Registry { name: String, version: Option<String> },
    Git { url: String, branch: Option<String> },
}

/// Plugin update request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginUpdateRequest {
    pub plugin_id: String,
    pub target_version: Option<String>,
    pub config_updates: Option<PluginConfig>,
    pub force_update: bool,
}

impl PluginService {
    /// Create a new plugin service
    pub async fn new(config_service: Arc<ConfigurationService>) -> Result<Self, CoreError> {
        Ok(Self {
            config_service,
            plugins: Arc::new(RwLock::new(HashMap::new())),
            plugin_registry: Arc::new(RwLock::new(PluginRegistry::default())),
            execution_engine: Arc::new(RwLock::new(PluginExecutionEngine::default())),
            metrics: Arc::new(RwLock::new(PluginServiceMetrics::default())),
            security_manager: Arc::new(RwLock::new(PluginSecurityManager::default())),
        })
    }

    /// Install a plugin
    pub async fn install_plugin(
        &self,
        request: PluginInstallRequest,
    ) -> Result<String, CoreError> {
        // Validate installation request
        self.validate_install_request(&request).await?;
        
        // Download/load plugin
        let plugin_data = self.load_plugin_from_source(&request.source).await?;
        
        // Validate plugin
        let plugin = self.validate_plugin_data(plugin_data).await?;
        
        // Check dependencies
        self.check_plugin_dependencies(&plugin).await?;
        
        // Security check
        self.security_check_plugin(&plugin).await?;
        
        // Install plugin
        let plugin_id = plugin.id.clone();
        
        {
            let mut plugins = self.plugins.write().unwrap();
            plugins.insert(plugin_id.clone(), plugin.clone());
        }
        
        // Register plugin
        self.register_plugin(&plugin).await?;
        
        // Auto-enable if requested
        if request.auto_enable {
            self.enable_plugin(&plugin_id).await?;
        }
        
        // Update metrics
        self.update_installation_metrics().await;
        
        Ok(plugin_id)
    }

    /// Uninstall a plugin
    pub async fn uninstall_plugin(&self, plugin_id: &str) -> Result<(), CoreError> {
        // Check if plugin exists
        let plugin = {
            let plugins = self.plugins.read().unwrap();
            plugins.get(plugin_id).cloned()
                .ok_or_else(|| CoreError::NotFound(format!("Plugin '{}' not found", plugin_id)))?
        };
        
        // Disable plugin first
        if plugin.status == PluginStatus::Active {
            self.disable_plugin(plugin_id).await?;
        }
        
        // Cancel any running executions
        self.cancel_plugin_executions(plugin_id).await?;
        
        // Remove from registry
        self.unregister_plugin(plugin_id).await?;
        
        // Remove plugin
        {
            let mut plugins = self.plugins.write().unwrap();
            plugins.remove(plugin_id);
        }
        
        // Update metrics
        self.update_uninstallation_metrics().await;
        
        Ok(())
    }

    /// Enable a plugin
    pub async fn enable_plugin(&self, plugin_id: &str) -> Result<(), CoreError> {
        let mut plugins = self.plugins.write().unwrap();
        let plugin = plugins.get_mut(plugin_id)
            .ok_or_else(|| CoreError::NotFound(format!("Plugin '{}' not found", plugin_id)))?;
        
        // Check dependencies
        self.check_plugin_dependencies(plugin).await?;
        
        // Security check
        self.security_check_plugin(plugin).await?;
        
        // Enable plugin
        plugin.status = PluginStatus::Active;
        plugin.updated_at = Utc::now();
        
        // Initialize plugin if needed
        self.initialize_plugin(plugin).await?;
        
        Ok(())
    }

    /// Disable a plugin
    pub async fn disable_plugin(&self, plugin_id: &str) -> Result<(), CoreError> {
        let mut plugins = self.plugins.write().unwrap();
        let plugin = plugins.get_mut(plugin_id)
            .ok_or_else(|| CoreError::NotFound(format!("Plugin '{}' not found", plugin_id)))?;
        
        // Cancel running executions
        drop(plugins);
        self.cancel_plugin_executions(plugin_id).await?;
        
        let mut plugins = self.plugins.write().unwrap();
        let plugin = plugins.get_mut(plugin_id).unwrap();
        
        // Disable plugin
        plugin.status = PluginStatus::Disabled;
        plugin.updated_at = Utc::now();
        
        // Cleanup plugin resources
        self.cleanup_plugin_resources(plugin).await?;
        
        Ok(())
    }

    /// Execute a plugin
    pub async fn execute_plugin(
        &self,
        plugin_id: &str,
        context: PluginExecutionContext,
        priority: Option<ExecutionPriority>,
    ) -> Result<String, CoreError> {
        // Validate plugin exists and is active
        let plugin = {
            let plugins = self.plugins.read().unwrap();
            let plugin = plugins.get(plugin_id)
                .ok_or_else(|| CoreError::NotFound(format!("Plugin '{}' not found", plugin_id)))?;
            
            if plugin.status != PluginStatus::Active {
                return Err(CoreError::ValidationError(
                    format!("Plugin '{}' is not active", plugin_id)
                ));
            }
            
            plugin.clone()
        };
        
        // Security check
        self.security_check_execution(&plugin, &context).await?;
        
        // Create execution request
        let execution_id = Uuid::new_v4().to_string();
        let request = PluginExecutionRequest {
            id: execution_id.clone(),
            plugin_id: plugin_id.to_string(),
            context,
            priority: priority.unwrap_or(ExecutionPriority::Normal),
            timeout_ms: plugin.config.as_ref().and_then(|c| c.limits.as_ref().map(|l| l.max_execution_time_ms)),
            retry_count: 0,
            created_at: Utc::now(),
        };
        
        // Queue execution
        self.queue_execution(request).await?;
        
        // Update metrics
        self.update_execution_metrics().await;
        
        Ok(execution_id)
    }

    /// Get plugin execution status
    pub async fn get_execution_status(&self, execution_id: &str) -> Result<PluginExecution, CoreError> {
        let engine = self.execution_engine.read().unwrap();
        engine.active_executions.get(execution_id)
            .cloned()
            .ok_or_else(|| CoreError::NotFound(format!("Execution '{}' not found", execution_id)))
    }

    /// Cancel plugin execution
    pub async fn cancel_execution(&self, execution_id: &str) -> Result<(), CoreError> {
        let mut engine = self.execution_engine.write().unwrap();
        
        if let Some(execution) = engine.active_executions.get_mut(execution_id) {
            execution.status = ExecutionStatus::Cancelled;
            execution.completed_at = Some(Utc::now());
            
            // Free up worker
            if let Some(worker_id) = &execution.worker_id {
                if let Some(worker) = engine.worker_pool.iter_mut().find(|w| w.id == *worker_id) {
                    worker.status = WorkerStatus::Idle;
                    worker.current_execution = None;
                }
            }
        }
        
        Ok(())
    }

    /// List all plugins
    pub async fn list_plugins(&self) -> Vec<Plugin> {
        let plugins = self.plugins.read().unwrap();
        plugins.values().cloned().collect()
    }

    /// Get plugin by ID
    pub async fn get_plugin(&self, plugin_id: &str) -> Result<Plugin, CoreError> {
        let plugins = self.plugins.read().unwrap();
        plugins.get(plugin_id)
            .cloned()
            .ok_or_else(|| CoreError::NotFound(format!("Plugin '{}' not found", plugin_id)))
    }

    /// Update plugin configuration
    pub async fn update_plugin_config(
        &self,
        plugin_id: &str,
        config: PluginConfig,
    ) -> Result<(), CoreError> {
        let mut plugins = self.plugins.write().unwrap();
        let plugin = plugins.get_mut(plugin_id)
            .ok_or_else(|| CoreError::NotFound(format!("Plugin '{}' not found", plugin_id)))?;
        
        // Validate configuration
        config.validate()?;
        
        // Update configuration
        plugin.config = Some(config);
        plugin.updated_at = Utc::now();
        
        Ok(())
    }

    /// Get plugin metrics
    pub async fn get_metrics(&self) -> PluginServiceMetrics {
        let mut metrics = self.metrics.read().unwrap().clone();
        
        // Update real-time metrics
        let plugins = self.plugins.read().unwrap();
        metrics.total_plugins = plugins.len() as u64;
        metrics.active_plugins = plugins.values().filter(|p| p.status == PluginStatus::Active).count() as u64;
        metrics.disabled_plugins = plugins.values().filter(|p| p.status == PluginStatus::Disabled).count() as u64;
        metrics.failed_plugins = plugins.values().filter(|p| p.status == PluginStatus::Failed).count() as u64;
        
        // Update plugin type distribution
        metrics.plugin_type_distribution.clear();
        for plugin in plugins.values() {
            let type_name = format!("{:?}", plugin.plugin_type);
            *metrics.plugin_type_distribution.entry(type_name).or_insert(0) += 1;
        }
        
        metrics
    }

    /// Get security violations
    pub async fn get_security_violations(&self) -> Vec<SecurityViolation> {
        let security_manager = self.security_manager.read().unwrap();
        security_manager.security_violations.clone()
    }

    /// Add security policy
    pub async fn add_security_policy(&self, policy: SecurityPolicy) -> Result<(), CoreError> {
        let mut security_manager = self.security_manager.write().unwrap();
        security_manager.security_policies.insert(policy.id.clone(), policy);
        Ok(())
    }

    /// Grant permission to plugin
    pub async fn grant_permission(
        &self,
        plugin_id: &str,
        permission: Permission,
    ) -> Result<(), CoreError> {
        let mut security_manager = self.security_manager.write().unwrap();
        security_manager.permission_grants
            .entry(plugin_id.to_string())
            .or_insert_with(Vec::new)
            .push(permission);
        Ok(())
    }

    /// Validate installation request
    async fn validate_install_request(&self, request: &PluginInstallRequest) -> Result<(), CoreError> {
        // Basic validation
        match &request.source {
            PluginSource::LocalPath(path) => {
                if !std::path::Path::new(path).exists() {
                    return Err(CoreError::ValidationError(
                        format!("Plugin path '{}' does not exist", path)
                    ));
                }
            }
            PluginSource::Url(url) => {
                if !url.starts_with("http://") && !url.starts_with("https://") {
                    return Err(CoreError::ValidationError(
                        "Invalid plugin URL".to_string()
                    ));
                }
            }
            _ => {} // Other sources validated elsewhere
        }
        
        Ok(())
    }

    /// Load plugin from source
    async fn load_plugin_from_source(&self, source: &PluginSource) -> Result<Vec<u8>, CoreError> {
        match source {
            PluginSource::LocalPath(path) => {
                std::fs::read(path)
                    .map_err(|e| CoreError::IoError(format!("Failed to read plugin file: {}", e)))
            }
            PluginSource::Url(url) => {
                // In a real implementation, this would download from URL
                Err(CoreError::NotImplemented("URL plugin loading not implemented".to_string()))
            }
            _ => Err(CoreError::NotImplemented("Plugin source not supported".to_string()))
        }
    }

    /// Validate plugin data
    async fn validate_plugin_data(&self, _data: Vec<u8>) -> Result<Plugin, CoreError> {
        // In a real implementation, this would parse and validate plugin data
        // For now, return a mock plugin
        Ok(Plugin::new(
            "test_plugin".to_string(),
            "Test Plugin".to_string(),
            "1.0.0".to_string(),
            "Test Author".to_string(),
            PluginType::Analyzer,
        ))
    }

    /// Check plugin dependencies
    async fn check_plugin_dependencies(&self, plugin: &Plugin) -> Result<(), CoreError> {
        for dependency in &plugin.dependencies {
            let plugins = self.plugins.read().unwrap();
            if !plugins.contains_key(&dependency.plugin_id) {
                return Err(CoreError::ValidationError(
                    format!("Missing dependency: {}", dependency.plugin_id)
                ));
            }
        }
        Ok(())
    }

    /// Security check for plugin
    async fn security_check_plugin(&self, _plugin: &Plugin) -> Result<(), CoreError> {
        // In a real implementation, this would perform comprehensive security checks
        Ok(())
    }

    /// Security check for execution
    async fn security_check_execution(
        &self,
        _plugin: &Plugin,
        _context: &PluginExecutionContext,
    ) -> Result<(), CoreError> {
        // In a real implementation, this would check execution permissions
        Ok(())
    }

    /// Register plugin
    async fn register_plugin(&self, plugin: &Plugin) -> Result<(), CoreError> {
        let mut registry = self.plugin_registry.write().unwrap();
        
        let registration = PluginRegistration {
            id: plugin.id.clone(),
            name: plugin.name.clone(),
            version: plugin.version.clone(),
            author: plugin.author.clone(),
            description: plugin.description.clone(),
            plugin_type: plugin.plugin_type.clone(),
            capabilities: plugin.capabilities.clone(),
            dependencies: plugin.dependencies.clone(),
            metadata: plugin.metadata.clone(),
            registration_time: Utc::now(),
            last_updated: Utc::now(),
        };
        
        registry.registered_plugins.insert(plugin.id.clone(), registration);
        
        // Update capability providers
        for capability in &plugin.capabilities {
            let capability_name = format!("{:?}", capability);
            registry.capability_providers
                .entry(capability_name)
                .or_insert_with(Vec::new)
                .push(plugin.id.clone());
        }
        
        Ok(())
    }

    /// Unregister plugin
    async fn unregister_plugin(&self, plugin_id: &str) -> Result<(), CoreError> {
        let mut registry = self.plugin_registry.write().unwrap();
        registry.registered_plugins.remove(plugin_id);
        
        // Remove from capability providers
        for providers in registry.capability_providers.values_mut() {
            providers.retain(|id| id != plugin_id);
        }
        
        Ok(())
    }

    /// Initialize plugin
    async fn initialize_plugin(&self, _plugin: &Plugin) -> Result<(), CoreError> {
        // In a real implementation, this would initialize the plugin runtime
        Ok(())
    }

    /// Cleanup plugin resources
    async fn cleanup_plugin_resources(&self, _plugin: &Plugin) -> Result<(), CoreError> {
        // In a real implementation, this would cleanup plugin resources
        Ok(())
    }

    /// Cancel all executions for a plugin
    async fn cancel_plugin_executions(&self, plugin_id: &str) -> Result<(), CoreError> {
        let mut engine = self.execution_engine.write().unwrap();
        
        let execution_ids: Vec<String> = engine.active_executions
            .iter()
            .filter(|(_, execution)| execution.plugin_id == plugin_id)
            .map(|(id, _)| id.clone())
            .collect();
        
        for execution_id in execution_ids {
            if let Some(execution) = engine.active_executions.get_mut(&execution_id) {
                execution.status = ExecutionStatus::Cancelled;
                execution.completed_at = Some(Utc::now());
            }
        }
        
        Ok(())
    }

    /// Queue execution
    async fn queue_execution(&self, request: PluginExecutionRequest) -> Result<(), CoreError> {
        let mut engine = self.execution_engine.write().unwrap();
        
        // Create execution
        let execution = PluginExecution {
            id: request.id.clone(),
            plugin_id: request.plugin_id.clone(),
            status: ExecutionStatus::Queued,
            context: request.context.clone(),
            result: None,
            started_at: Utc::now(),
            completed_at: None,
            worker_id: None,
            progress: 0.0,
            error: None,
        };
        
        engine.active_executions.insert(request.id.clone(), execution);
        engine.execution_queue.push(request);
        
        // Sort queue by priority
        engine.execution_queue.sort_by(|a, b| b.priority.cmp(&a.priority));
        
        Ok(())
    }

    /// Update installation metrics
    async fn update_installation_metrics(&self) {
        let mut metrics = self.metrics.write().unwrap();
        metrics.total_plugins += 1;
    }

    /// Update uninstallation metrics
    async fn update_uninstallation_metrics(&self) {
        let mut metrics = self.metrics.write().unwrap();
        if metrics.total_plugins > 0 {
            metrics.total_plugins -= 1;
        }
    }

    /// Update execution metrics
    async fn update_execution_metrics(&self) {
        let mut metrics = self.metrics.write().unwrap();
        metrics.total_executions += 1;
    }
}

#[async_trait]
impl Service for PluginService {
    async fn initialize(&self) -> Result<(), CoreError> {
        // Initialize worker pool
        let mut engine = self.execution_engine.write().unwrap();
        
        // Create default workers
        for i in 0..4 {
            let worker = PluginWorker {
                id: format!("worker_{}", i),
                status: WorkerStatus::Idle,
                current_execution: None,
                capabilities: vec![
                    PluginCapability::CodeAnalysis,
                    PluginCapability::TextProcessing,
                    PluginCapability::DataTransformation,
                ],
                created_at: Utc::now(),
                last_activity: Utc::now(),
                total_executions: 0,
                successful_executions: 0,
                failed_executions: 0,
            };
            engine.worker_pool.push(worker);
        }
        
        Ok(())
    }

    async fn shutdown(&self) -> Result<(), CoreError> {
        // Cancel all running executions
        let mut engine = self.execution_engine.write().unwrap();
        
        for execution in engine.active_executions.values_mut() {
            if execution.status == ExecutionStatus::Running {
                execution.status = ExecutionStatus::Cancelled;
                execution.completed_at = Some(Utc::now());
            }
        }
        
        // Set all workers offline
        for worker in &mut engine.worker_pool {
            worker.status = WorkerStatus::Offline;
        }
        
        Ok(())
    }

    async fn health_check(&self) -> ServiceHealth {
        let plugins = self.plugins.read().unwrap();
        let engine = self.execution_engine.read().unwrap();
        
        // Check if we have active workers
        let active_workers = engine.worker_pool.iter()
            .filter(|w| w.status != WorkerStatus::Offline)
            .count();
        
        if active_workers == 0 {
            return ServiceHealth::unhealthy(
                "No active plugin workers".to_string(),
            );
        }
        
        // Check for failed plugins
        let failed_plugins = plugins.values()
            .filter(|p| p.status == PluginStatus::Failed)
            .count();
        
        if failed_plugins > 0 {
            return ServiceHealth::degraded(
                format!("{} plugins in failed state", failed_plugins),
            );
        }
        
        ServiceHealth::healthy()
    }

    fn name(&self) -> &'static str {
        "PluginService"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    async fn create_test_service() -> PluginService {
        let config_service = Arc::new(ConfigurationService::new().await.unwrap());
        PluginService::new(config_service).await.unwrap()
    }

    #[tokio::test]
    async fn test_plugin_service_creation() {
        let service = create_test_service().await;
        assert_eq!(service.name(), "PluginService");
    }

    #[tokio::test]
    async fn test_plugin_installation() {
        let service = create_test_service().await;
        
        // Create a test plugin file
        let temp_file = std::env::temp_dir().join("test_plugin.json");
        std::fs::write(&temp_file, b"{}").unwrap();
        
        let request = PluginInstallRequest {
            source: PluginSource::LocalPath(temp_file.to_string_lossy().to_string()),
            version: None,
            config: None,
            auto_enable: false,
            force_reinstall: false,
        };
        
        let result = service.install_plugin(request).await;
        assert!(result.is_ok());
        
        // Cleanup
        std::fs::remove_file(temp_file).ok();
    }

    #[tokio::test]
    async fn test_plugin_enable_disable() {
        let service = create_test_service().await;
        
        // Create and install a test plugin
        let plugin = Plugin::new(
            "test_plugin".to_string(),
            "Test Plugin".to_string(),
            "1.0.0".to_string(),
            "Test Author".to_string(),
            PluginType::Analyzer,
        );
        
        {
            let mut plugins = service.plugins.write().unwrap();
            plugins.insert(plugin.id.clone(), plugin.clone());
        }
        
        // Test enable
        let result = service.enable_plugin(&plugin.id).await;
        assert!(result.is_ok());
        
        // Test disable
        let result = service.disable_plugin(&plugin.id).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_plugin_execution() {
        let service = create_test_service().await;
        
        // Create and install an active plugin
        let mut plugin = Plugin::new(
            "test_plugin".to_string(),
            "Test Plugin".to_string(),
            "1.0.0".to_string(),
            "Test Author".to_string(),
            PluginType::Analyzer,
        );
        plugin.status = PluginStatus::Active;
        
        {
            let mut plugins = service.plugins.write().unwrap();
            plugins.insert(plugin.id.clone(), plugin.clone());
        }
        
        // Test execution
        let context = PluginExecutionContext {
            input_data: HashMap::new(),
            environment: HashMap::new(),
            user_id: Some("test_user".to_string()),
            session_id: Some("test_session".to_string()),
        };
        
        let result = service.execute_plugin(&plugin.id, context, None).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_plugin_metrics() {
        let service = create_test_service().await;
        let metrics = service.get_metrics().await;
        
        assert_eq!(metrics.total_plugins, 0);
        assert_eq!(metrics.active_plugins, 0);
        assert_eq!(metrics.total_executions, 0);
    }

    #[tokio::test]
    async fn test_security_policy() {
        let service = create_test_service().await;
        
        let policy = SecurityPolicy {
            id: "test_policy".to_string(),
            name: "Test Policy".to_string(),
            description: "Test security policy".to_string(),
            permissions: vec![Permission::ReadFiles, Permission::WriteFiles],
            restrictions: vec![],
            created_at: Utc::now(),
            updated_at: Utc::now(),
        };
        
        let result = service.add_security_policy(policy).await;
        assert!(result.is_ok());
    }
}